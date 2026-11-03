import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSupabaseAdmin } from '../lib/supabase';
import type { MatrizCalidad } from '../types/database';

export const app = new Hono().basePath('/api');

// Enable CORS
app.use('*', cors());

// Helper to get YYYY-MM-DD (usando fecha local o parámetro explícito)
function getFormattedDate(dateStr?: string): string {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Helper to get tomorrow's date string YYYY-MM-DD
function getTomorrowDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().split('T')[0];
}

// Helper to calculate difference in hours between two times HH:MM
function calculateTimeDiffHours(start: string, end: string): number {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  let minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * GET /api/dia/hoy
 * Obtiene el estado de hoy, horas netas acumuladas, sesiones registradas y las tareas asignadas para hoy.
 */
app.get('/dia/hoy', async (c) => {
  try {
    const supabase = getSupabaseAdmin(c.env);
    const fecha = getFormattedDate(c.req.query('fecha'));

    // Auto-cierre preventivo de días anteriores que hayan quedado sin cerrar al cruzar medianoche (11:59 PM)
    try {
      await supabase
        .from('dias_salud')
        .update({
          cierre_realizado: true,
          cierre_timestamp: new Date().toISOString()
        })
        .lt('fecha', fecha)
        .eq('cierre_realizado', false);
    } catch (autoCloseErr) {
      console.warn('Auto-close past days warning:', autoCloseErr);
    }

    // Check or create dia in dias_salud
    let { data: dia, error: diaErr } = await supabase
      .from('dias_salud')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle();

    if (diaErr) {
      console.warn('Initial dia fetch warning:', diaErr);
    }

    if (!dia) {
      const { data: newDia, error: insertErr } = await supabase
        .from('dias_salud')
        .insert({
          fecha,
          cierre_realizado: false,
        })
        .select('*')
        .single();

      if (insertErr) {
        // Retry in case of concurrent insert
        const { data: retryDia, error: retryErr } = await supabase
          .from('dias_salud')
          .select('*')
          .eq('fecha', fecha)
          .single();

        if (retryErr) {
          return c.json({ error: retryErr.message || 'Error al obtener registro diario tras inserción' }, 500);
        }
        dia = retryDia;
      } else {
        dia = newDia;
      }
    }

    if (!dia) {
      return c.json({ error: 'No se pudo obtener o crear el registro diario' }, 500);
    }

    // Get sesiones for this dia
    const { data: sesiones, error: sesErr } = await supabase
      .from('sesiones_flujo')
      .select('*')
      .eq('dia_id', dia.id)
      .order('registrado_a', { ascending: true });

    if (sesErr) {
      return c.json({ error: sesErr.message || 'Error al obtener sesiones' }, 500);
    }

    // Get tareas for fecha_objetivo = fecha
    const { data: tareas, error: tarErr } = await supabase
      .from('tareas_planificadas')
      .select('*')
      .eq('fecha_objetivo', fecha)
      .order('hora_inicio', { ascending: true });

    if (tarErr) {
      return c.json({ error: tarErr.message || 'Error al obtener tareas' }, 500);
    }

    const totalHorasNetas = (sesiones || []).reduce(
      (sum, s) => sum + (parseFloat(s.horas_netas) || 0),
      0
    );

    return c.json({
      dia,
      totalHorasNetas: Number(totalHorasNetas.toFixed(2)),
      cierreRealizado: Boolean(dia.cierre_realizado),
      sesiones: sesiones || [],
      tareas: tareas || [],
    });
  } catch (err: any) {
    console.error('Error in GET /api/dia/hoy:', err);
    return c.json({ error: err.message || 'Error interno del servidor' }, 500);
  }
});

/**
 * POST /api/sesiones
 * Inserta una nueva sesión de flujo vinculada al día actual.
 */
app.post('/sesiones', async (c) => {
  try {
    const supabase = getSupabaseAdmin(c.env);
    const body = await c.req.json();
    const { tipo, horas_netas, intensidad, incomodidad, calidad, fecha: customFecha } = body;

    if (!tipo || !String(tipo).trim()) {
      return c.json({ error: 'El tipo de sesión es requerido' }, 400);
    }

    const parsedHoras = parseFloat(horas_netas);
    if (isNaN(parsedHoras) || parsedHoras <= 0) {
      return c.json({ error: 'Las horas netas deben ser un número positivo' }, 400);
    }

    const fecha = getFormattedDate(customFecha);

    // Ensure dia exists
    let { data: dia, error: fetchDiaErr } = await supabase
      .from('dias_salud')
      .select('id')
      .eq('fecha', fecha)
      .maybeSingle();

    if (fetchDiaErr) {
      return c.json({ error: fetchDiaErr.message || 'Error al buscar el día' }, 500);
    }

    if (!dia) {
      const { data: newDia, error: createDiaErr } = await supabase
        .from('dias_salud')
        .insert({ fecha, cierre_realizado: false })
        .select('id')
        .single();

      if (createDiaErr) {
        return c.json({ error: createDiaErr.message || 'Error al crear el día' }, 500);
      }
      dia = newDia;
    }

    if (!dia) {
      return c.json({ error: 'No se pudo obtener o crear el registro diario' }, 500);
    }

    const { data: sesion, error: insertErr } = await supabase
      .from('sesiones_flujo')
      .insert({
        dia_id: dia.id,
        tipo: tipo.trim(),
        horas_netas: parsedHoras,
        intensidad: intensidad || 'Media',
        incomodidad: incomodidad || 'Media',
        calidad: (calidad || '').trim(),
        registrado_a: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insertErr) {
      return c.json({ error: insertErr.message || 'Error al registrar sesión' }, 500);
    }

    return c.json({ success: true, sesion }, 201);
  } catch (err: any) {
    console.error('Error in POST /api/sesiones:', err);
    return c.json({ error: err.message || 'Error al registrar sesión' }, 500);
  }
});

/**
 * PUT /api/sesiones/:id
 * Actualiza una sesión existente en sesiones_flujo.
 */
app.put('/sesiones/:id', async (c) => {
  try {
    const supabase = getSupabaseAdmin(c.env);
    const id = c.req.param('id');
    const body = await c.req.json();
    const { tipo, horas_netas, intensidad, incomodidad, calidad } = body;

    const updatePayload: Record<string, any> = {};

    if (tipo !== undefined) {
      if (!String(tipo).trim()) {
        return c.json({ error: 'El tipo de sesión no puede estar vacío' }, 400);
      }
      updatePayload.tipo = String(tipo).trim();
    }

    if (horas_netas !== undefined) {
      const parsedHoras = parseFloat(horas_netas);
      if (isNaN(parsedHoras) || parsedHoras <= 0) {
        return c.json({ error: 'Las horas netas deben ser un número positivo' }, 400);
      }
      updatePayload.horas_netas = parsedHoras;
    }

    if (intensidad !== undefined) {
      updatePayload.intensidad = intensidad;
    }

    if (incomodidad !== undefined) {
      updatePayload.incomodidad = incomodidad;
    }

    if (calidad !== undefined) {
      updatePayload.calidad = String(calidad).trim();
    }

    const { data: sesion, error: updateErr } = await supabase
      .from('sesiones_flujo')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      return c.json({ error: updateErr.message || 'Error al actualizar sesión' }, 500);
    }

    return c.json({ success: true, sesion });
  } catch (err: any) {
    console.error('Error in PUT /api/sesiones/:id:', err);
    return c.json({ error: err.message || 'Error al actualizar sesión' }, 500);
  }
});

/**
 * DELETE /api/sesiones/:id
 * Elimina una sesión de sesiones_flujo.
 */
app.delete('/sesiones/:id', async (c) => {
  try {
    const supabase = getSupabaseAdmin(c.env);
    const id = c.req.param('id');

    const { error: deleteErr } = await supabase
      .from('sesiones_flujo')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      return c.json({ error: deleteErr.message || 'Error al eliminar sesión' }, 500);
    }

    return c.json({ success: true, message: 'Sesión eliminada' });
  } catch (err: any) {
    console.error('Error in DELETE /api/sesiones/:id:', err);
    return c.json({ error: err.message || 'Error al eliminar sesión' }, 500);
  }
});

/**
 * PUT /api/tareas/:id
 * Actualiza el estado ('pendiente', 'hecho', 'incompleto', 'no_hecho') y 'motivo_desvio'.
 */
app.put('/tareas/:id', async (c) => {
  try {
    const supabase = getSupabaseAdmin(c.env);
    const id = c.req.param('id');
    const body = await c.req.json();
    const { estado, motivo_desvio } = body;

    const validEstados = ['pendiente', 'hecho', 'incompleto', 'no_hecho'];
    if (!validEstados.includes(estado)) {
      return c.json({
        error: `Estado inválido: ${estado}. Valores permitidos: ${validEstados.join(', ')}`
      }, 400);
    }

    const updatePayload: Record<string, any> = { estado };
    if (motivo_desvio !== undefined) {
      updatePayload.motivo_desvio = motivo_desvio ? String(motivo_desvio).trim() : null;
    }

    const { data: tarea, error: updateErr } = await supabase
      .from('tareas_planificadas')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      return c.json({ error: updateErr.message || 'Error al actualizar tarea' }, 500);
    }

    return c.json({ success: true, tarea });
  } catch (err: any) {
    console.error('Error in PUT /api/tareas/:id:', err);
    return c.json({ error: err.message || 'Error al actualizar tarea' }, 500);
  }
});

/**
 * POST /api/cierre
 * Procesa la salud, el frío mental, el parseo del Markdown para las tareas de mañana y sella cierre_realizado = TRUE.
 */
app.post('/cierre', async (c) => {
  try {
    const supabase = getSupabaseAdmin(c.env);
    const body = await c.req.json();
    const {
      fecha: customFecha,
      alimento,
      ejercicio_horas,
      ejercicio_intensidad,
      frio_mental,
      planificacion_markdown
    } = body;

    const fecha = getFormattedDate(customFecha);
    const fechaManana = getTomorrowDate(fecha);

    // Ensure dia exists
    let { data: dia, error: fetchDiaErr } = await supabase
      .from('dias_salud')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle();

    if (fetchDiaErr) {
      return c.json({ error: fetchDiaErr.message || 'Error al buscar el día de cierre' }, 500);
    }

    if (!dia) {
      const { data: newDia, error: createDiaErr } = await supabase
        .from('dias_salud')
        .insert({ fecha, cierre_realizado: false })
        .select('*')
        .single();

      if (createDiaErr) {
        return c.json({ error: createDiaErr.message || 'Error al crear el día de cierre' }, 500);
      }
      dia = newDia;
    }

    if (!dia) {
      return c.json({ error: 'No se pudo obtener el día de cierre' }, 500);
    }

    // Strict Markdown regex parser
    const regex = /^\s*-\s*\[\s*\]\s*\[(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\]\s*\[(PROFUNDO|SUPERFICIAL)\]\s*(.+?)(?:\s*\((\d+(?:\.\d+)?)\s*h\s*netas\))?\s*$/i;

    const lineas = typeof planificacion_markdown === 'string'
      ? planificacion_markdown.split('\n')
      : [];

    const tareasToInsert: any[] = [];
    for (const line of lineas) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(regex);
      if (match) {
        const hora_inicio = match[1];
        const hora_fin = match[2];
        const tipo_trabajo = match[3].toUpperCase() as 'PROFUNDO' | 'SUPERFICIAL';
        const descripcion = match[4].trim();
        const horasEstimadas = match[5]
          ? parseFloat(match[5])
          : calculateTimeDiffHours(hora_inicio, hora_fin);

        tareasToInsert.push({
          dia_origen_id: dia.id,
          fecha_objetivo: fechaManana,
          hora_inicio,
          hora_fin,
          tipo_trabajo,
          descripcion,
          horas_netas_estimadas: isNaN(horasEstimadas) ? 1.0 : horasEstimadas,
          estado: 'pendiente',
          motivo_desvio: null,
          creado_a: new Date().toISOString()
        });
      }
    }

    let tareasCreadas: any[] = [];
    if (tareasToInsert.length > 0) {
      const { data: inserted, error: insertTareasErr } = await supabase
        .from('tareas_planificadas')
        .insert(tareasToInsert)
        .select('*');

      if (insertTareasErr) {
        console.error('Error inserting planned tasks:', insertTareasErr);
      } else {
        tareasCreadas = inserted || [];
      }
    }

    let normalizedFrio = frio_mental;
    if (frio_mental === 'Frío total') normalizedFrio = 'Frio total';
    if (frio_mental === 'Ávido') normalizedFrio = 'Avido';

    const updateData: Record<string, any> = {
      cierre_realizado: true,
      cierre_timestamp: new Date().toISOString()
    };

    if (alimento !== undefined && alimento !== null) {
      updateData.alimento = Math.max(1, Math.min(5, parseInt(alimento, 10)));
    }
    if (ejercicio_horas !== undefined && ejercicio_horas !== null) {
      updateData.ejercicio_horas = parseFloat(ejercicio_horas) || 0;
    }
    if (ejercicio_intensidad) {
      updateData.ejercicio_intensidad = ejercicio_intensidad;
    }
    if (normalizedFrio) {
      updateData.frio_mental = normalizedFrio;
    }

    const { data: diaActualizado, error: updateDiaErr } = await supabase
      .from('dias_salud')
      .update(updateData)
      .eq('id', dia.id)
      .select('*')
      .single();

    if (updateDiaErr) {
      return c.json({ error: updateDiaErr.message || 'Error al actualizar día de cierre' }, 500);
    }

    return c.json({
      success: true,
      message: 'Ritual de cierre completado. Mente liberada hasta mañana.',
      dia: diaActualizado,
      tareasCreadas,
      fechaManana
    });
  } catch (err: any) {
    console.error('Error in POST /api/cierre:', err);
    return c.json({ error: err.message || 'Error al procesar ritual de cierre' }, 500);
  }
});

/**
 * GET /api/exportar
 * Retorna el JSON completo del mes actual consultando la vista vista_resumen_diario.
 */
app.get('/exportar', async (c) => {
  try {
    const supabase = getSupabaseAdmin(c.env);
    const mesParam = c.req.query('mes');
    const now = new Date();
    const currentMonth = mesParam || now.toISOString().slice(0, 7);

    // Consultar vista_resumen_diario
    const { data: viewData, error: viewError } = await supabase
      .from('vista_resumen_diario')
      .select('*');

    if (!viewError && viewData) {
      const filtered = viewData.filter((item: any) => {
        if (!item.fecha) return true;
        return String(item.fecha).startsWith(currentMonth);
      });

      return c.json({
        mes: currentMonth,
        exportado_a: new Date().toISOString(),
        total_dias: filtered.length,
        resumen: filtered
      });
    }

    // Fallback: aggregation from tables
    const { data: dias, error: diasErr } = await supabase
      .from('dias_salud')
      .select('*, sesiones:sesiones_flujo(*), tareas:tareas_planificadas(*)')
      .gte('fecha', `${currentMonth}-01`)
      .lte('fecha', `${currentMonth}-31`)
      .order('fecha', { ascending: false });

    if (diasErr) {
      return c.json({ error: diasErr.message || 'Error en fallback de exportación' }, 500);
    }

    return c.json({
      mes: currentMonth,
      exportado_a: new Date().toISOString(),
      total_dias: (dias || []).length,
      resumen: dias || []
    });
  } catch (err: any) {
    console.error('Error in GET /api/exportar:', err);
    return c.json({ error: err.message || 'Error al exportar datos' }, 500);
  }
});

/**
 * GET /api/estadisticas
 * Retorna métricas globales consolidadas, tendencias temporales, distribución de flujo,
 * correlación psicofísica y rachas de Deep Work.
 */
app.get('/estadisticas', async (c) => {
  try {
    const supabase = getSupabaseAdmin(c.env);
    const fechaHoy = getFormattedDate(c.req.query('fecha'));

    // Auto-cierre de días anteriores que hayan quedado sin cerrar al cruzar medianoche (11:59 PM)
    try {
      await supabase
        .from('dias_salud')
        .update({
          cierre_realizado: true,
          cierre_timestamp: new Date().toISOString()
        })
        .lt('fecha', fechaHoy)
        .eq('cierre_realizado', false);
    } catch (e) {
      console.warn('Auto-close past days in stats warning:', e);
    }

    // Fetch dias_salud
    const { data: diasData, error: diasErr } = await supabase
      .from('dias_salud')
      .select('*')
      .order('fecha', { ascending: true });

    if (diasErr) {
      return c.json({ error: diasErr.message }, 500);
    }
    const dias = diasData || [];

    // Fetch sesiones
    const { data: sesionesData, error: sesErr } = await supabase
      .from('sesiones_flujo')
      .select('*')
      .order('registrado_a', { ascending: true });

    if (sesErr) {
      return c.json({ error: sesErr.message }, 500);
    }
    const sesiones = sesionesData || [];

    // Fetch tareas
    const { data: tareasData, error: tarErr } = await supabase
      .from('tareas_planificadas')
      .select('*');

    if (tarErr) {
      return c.json({ error: tarErr.message }, 500);
    }
    const tareas = tareasData || [];

    // Map dia_id to fecha
    const diaIdToFecha = new Map<string, string>();
    const fechaToDia = new Map<string, any>();
    dias.forEach((d) => {
      diaIdToFecha.set(d.id, d.fecha);
      fechaToDia.set(d.fecha, d);
    });

    // Sessions per date
    const fechaToSesiones = new Map<string, any[]>();
    let totalHorasNetas = 0;
    const tiposMap = new Map<string, { horas: number; count: number }>();
    const intensidadMap = { Alta: 0, Media: 0, Baja: 0 };
    const incomodidadMap = { Alta: 0, Media: 0, Baja: 0 };

    // Matriz de Calidad 3x3: Intensidad x Incomodidad
    const matrizCalidad: MatrizCalidad = {
      Alta: { Alta: 0, Media: 0, Baja: 0 },
      Media: { Alta: 0, Media: 0, Baja: 0 },
      Baja: { Alta: 0, Media: 0, Baja: 0 },
    };

    sesiones.forEach((s) => {
      const fecha = diaIdToFecha.get(s.dia_id) || (s.registrado_a ? s.registrado_a.split('T')[0] : '');
      const h = parseFloat(String(s.horas_netas)) || 0;
      totalHorasNetas += h;

      if (fecha) {
        if (!fechaToSesiones.has(fecha)) {
          fechaToSesiones.set(fecha, []);
        }
        fechaToSesiones.get(fecha)!.push(s);
      }

      // Tipos
      const tipo = (s.tipo || 'Desarrollo').trim();
      const prevTipo = tiposMap.get(tipo) || { horas: 0, count: 0 };
      tiposMap.set(tipo, { horas: prevTipo.horas + h, count: prevTipo.count + 1 });

      const intKey: 'Alta' | 'Media' | 'Baja' = (s.intensidad === 'Alta' || s.intensidad === 'Baja') ? s.intensidad : 'Media';
      const incKey: 'Alta' | 'Media' | 'Baja' = (s.incomodidad === 'Alta' || s.incomodidad === 'Baja') ? s.incomodidad : 'Media';

      matrizCalidad[intKey][incKey] = Number((matrizCalidad[intKey][incKey] + h).toFixed(2));

      // Intensidad
      if (intKey === 'Alta') intensidadMap.Alta += h;
      else if (intKey === 'Baja') intensidadMap.Baja += h;
      else intensidadMap.Media += h;

      // Incomodidad
      if (incKey === 'Alta') incomodidadMap.Alta += h;
      else if (incKey === 'Baja') incomodidadMap.Baja += h;
      else incomodidadMap.Media += h;
    });

    totalHorasNetas = Number(totalHorasNetas.toFixed(2));

    // Distribution by types
    const distribucionTipos = Array.from(tiposMap.entries()).map(([tipo, val]) => ({
      tipo,
      horas: Number(val.horas.toFixed(2)),
      porcentaje: totalHorasNetas > 0 ? Number(((val.horas / totalHorasNetas) * 100).toFixed(1)) : 0,
      count: val.count,
    })).sort((a, b) => b.horas - a.horas);

    // Active days count & avg
    const fechasConSesiones = Array.from(fechaToSesiones.keys()).sort();
    const diasActivosCount = fechasConSesiones.length;
    const promedioHorasDiarias = diasActivosCount > 0 ? Number((totalHorasNetas / diasActivosCount).toFixed(2)) : 0;

    // Streaks calculation ending on fechaHoy or yesterday
    let rachaActual = 0;
    let rachaMaxima = 0;

    if (fechasConSesiones.length > 0) {
      const sessionDateSet = new Set(fechasConSesiones);
      
      // Calculate max streak
      let tempStreak = 0;
      let prevDateObj: Date | null = null;
      for (const f of fechasConSesiones) {
        const curr = new Date(f + 'T00:00:00Z');
        if (!prevDateObj) {
          tempStreak = 1;
        } else {
          const diffDays = Math.round((curr.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            tempStreak++;
          } else if (diffDays > 1) {
            tempStreak = 1;
          }
        }
        if (tempStreak > rachaMaxima) rachaMaxima = tempStreak;
        prevDateObj = curr;
      }

      // Calculate current streak ending on fechaHoy or yesterday
      const [hy, hm, hd] = fechaHoy.split('-').map(Number);
      const hoyDateObj = new Date(Date.UTC(hy, hm - 1, hd));
      const yestDateObj = new Date(hoyDateObj.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = yestDateObj.toISOString().split('T')[0];

      let checkDate = sessionDateSet.has(fechaHoy) ? hoyDateObj : (sessionDateSet.has(yestStr) ? yestDateObj : null);
      if (checkDate) {
        let cursor = new Date(checkDate.getTime());
        while (true) {
          const cStr = cursor.toISOString().split('T')[0];
          if (sessionDateSet.has(cStr)) {
            rachaActual++;
            cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
          } else {
            break;
          }
        }
      }
    }

    // Tasa cierre
    const totalDiasRegistrados = Math.max(1, dias.length);
    const diasConCierre = dias.filter((d) => d.cierre_realizado).length;
    const tasaCierre = Number(((diasConCierre / totalDiasRegistrados) * 100).toFixed(1));

    // Desglose métricas exclusivas de HOY
    const sesionesHoy = fechaToSesiones.get(fechaHoy) || [];
    const horasHoy = sesionesHoy.reduce((sum, s) => sum + (parseFloat(String(s.horas_netas)) || 0), 0);
    const intensidadHoy = { Alta: 0, Media: 0, Baja: 0 };
    const incomodidadHoy = { Alta: 0, Media: 0, Baja: 0 };
    const matrizCalidadHoy: MatrizCalidad = {
      Alta: { Alta: 0, Media: 0, Baja: 0 },
      Media: { Alta: 0, Media: 0, Baja: 0 },
      Baja: { Alta: 0, Media: 0, Baja: 0 },
    };

    sesionesHoy.forEach((s) => {
      const h = parseFloat(String(s.horas_netas)) || 0;
      const intKey: 'Alta' | 'Media' | 'Baja' = (s.intensidad === 'Alta' || s.intensidad === 'Baja') ? s.intensidad : 'Media';
      const incKey: 'Alta' | 'Media' | 'Baja' = (s.incomodidad === 'Alta' || s.incomodidad === 'Baja') ? s.incomodidad : 'Media';

      matrizCalidadHoy[intKey][incKey] = Number((matrizCalidadHoy[intKey][incKey] + h).toFixed(2));

      if (intKey === 'Alta') intensidadHoy.Alta += h;
      else if (intKey === 'Baja') intensidadHoy.Baja += h;
      else intensidadHoy.Media += h;

      if (incKey === 'Alta') incomodidadHoy.Alta += h;
      else if (incKey === 'Baja') incomodidadHoy.Baja += h;
      else incomodidadHoy.Media += h;
    });

    const diaHoyObj = fechaToDia.get(fechaHoy);
    const hoy = {
      fecha: fechaHoy,
      horasNetas: Number(horasHoy.toFixed(2)),
      sesionesCount: sesionesHoy.length,
      cierreRealizado: Boolean(diaHoyObj?.cierre_realizado),
      ejercicioHoras: diaHoyObj?.ejercicio_horas ? parseFloat(String(diaHoyObj.ejercicio_horas)) : 0,
      alimento: diaHoyObj?.alimento || null,
      frioMental: diaHoyObj?.frio_mental || null,
      distribucionIntensidad: {
        Alta: Number(intensidadHoy.Alta.toFixed(2)),
        Media: Number(intensidadHoy.Media.toFixed(2)),
        Baja: Number(intensidadHoy.Baja.toFixed(2)),
      },
      distribucionIncomodidad: {
        Alta: Number(incomodidadHoy.Alta.toFixed(2)),
        Media: Number(incomodidadHoy.Media.toFixed(2)),
        Baja: Number(incomodidadHoy.Baja.toFixed(2)),
      },
    };

    // Tendencia últimos 30 días continuos anclada en fechaHoy
    const [hy, hm, hd] = fechaHoy.split('-').map(Number);
    const baseDate = new Date(Date.UTC(hy, hm - 1, hd));
    const tendenciaDias: any[] = [];
    for (let i = 29; i >= 0; i--) {
      const cur = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
      const fStr = cur.toISOString().split('T')[0];
      const diaObj = fechaToDia.get(fStr);
      const sesList = fechaToSesiones.get(fStr) || [];
      const horasNetas = sesList.reduce((sum, item) => sum + (parseFloat(String(item.horas_netas)) || 0), 0);

      const dayIntensidad = { Alta: 0, Media: 0, Baja: 0 };
      const dayIncomodidad = { Alta: 0, Media: 0, Baja: 0 };
      sesList.forEach((s) => {
        const h = parseFloat(String(s.horas_netas)) || 0;
        const intKey = (s.intensidad === 'Alta' || s.intensidad === 'Baja') ? s.intensidad : 'Media';
        const incKey = (s.incomodidad === 'Alta' || s.incomodidad === 'Baja') ? s.incomodidad : 'Media';
        if (intKey === 'Alta') dayIntensidad.Alta += h;
        else if (intKey === 'Baja') dayIntensidad.Baja += h;
        else dayIntensidad.Media += h;

        if (incKey === 'Alta') dayIncomodidad.Alta += h;
        else if (incKey === 'Baja') dayIncomodidad.Baja += h;
        else dayIncomodidad.Media += h;
      });

      tendenciaDias.push({
        fecha: fStr,
        horasNetas: Number(horasNetas.toFixed(2)),
        sesionesCount: sesList.length,
        cierreRealizado: Boolean(diaObj?.cierre_realizado),
        alimento: diaObj?.alimento || null,
        ejercicioHoras: diaObj?.ejercicio_horas ? parseFloat(String(diaObj.ejercicio_horas)) : null,
        frioMental: diaObj?.frio_mental || null,
        distribucionIntensidad: {
          Alta: Number(dayIntensidad.Alta.toFixed(2)),
          Media: Number(dayIntensidad.Media.toFixed(2)),
          Baja: Number(dayIntensidad.Baja.toFixed(2)),
        },
        distribucionIncomodidad: {
          Alta: Number(dayIncomodidad.Alta.toFixed(2)),
          Media: Number(dayIncomodidad.Media.toFixed(2)),
          Baja: Number(dayIncomodidad.Baja.toFixed(2)),
        },
      });
    }

    // Salud metrics
    const diasConAlimento = dias.filter((d) => d.alimento != null && d.alimento > 0);
    const sumaAlimento = diasConAlimento.reduce((sum, d) => sum + Number(d.alimento), 0);
    const promedioAlimento = diasConAlimento.length > 0 ? Number((sumaAlimento / diasConAlimento.length).toFixed(1)) : 0;

    let totalEjercicioHoras = 0;
    let diasConEjercicio = 0;
    const distribucionFrioMental: Record<string, number> = {
      'Frio total': 0,
      'Inspirado': 0,
      'Avido': 0,
    };

    dias.forEach((d) => {
      const ej = parseFloat(String(d.ejercicio_horas)) || 0;
      if (ej > 0) {
        totalEjercicioHoras += ej;
        diasConEjercicio++;
      }
      if (d.frio_mental) {
        let key = d.frio_mental;
        if (key === 'Frío total') key = 'Frio total';
        if (key === 'Ávido') key = 'Avido';
        distribucionFrioMental[key] = (distribucionFrioMental[key] || 0) + 1;
      }
    });

    // Tareas metrics
    const totalTareas = tareas.length;
    const hechas = tareas.filter((t) => t.estado === 'hecho').length;
    const incompletas = tareas.filter((t) => t.estado === 'incompleto').length;
    const noHechas = tareas.filter((t) => t.estado === 'no_hecho').length;
    const pendientes = tareas.filter((t) => t.estado === 'pendiente').length;
    const tasaCumplimiento = totalTareas > 0 ? Number(((hechas / totalTareas) * 100).toFixed(1)) : 0;

    return c.json({
      totalHorasNetas,
      totalSesiones: sesiones.length,
      diasActivosCount,
      promedioHorasDiarias,
      rachaActual,
      rachaMaxima,
      tasaCierre,
      distribucionTipos,
      distribucionIntensidad: {
        Alta: Number(intensidadMap.Alta.toFixed(2)),
        Media: Number(intensidadMap.Media.toFixed(2)),
        Baja: Number(intensidadMap.Baja.toFixed(2)),
      },
      distribucionIncomodidad: {
        Alta: Number(incomodidadMap.Alta.toFixed(2)),
        Media: Number(incomodidadMap.Media.toFixed(2)),
        Baja: Number(incomodidadMap.Baja.toFixed(2)),
      },
      matrizCalidad,
      matrizCalidadHoy,
      hoy,
      tendenciaDias,
      salud: {
        promedioAlimento,
        totalEjercicioHoras: Number(totalEjercicioHoras.toFixed(1)),
        diasConEjercicio,
        distribucionFrioMental,
      },
      tareas: {
        total: totalTareas,
        hechas,
        incompletas,
        noHechas,
        pendientes,
        tasaCumplimiento,
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/estadisticas:', err);
    return c.json({ error: err.message || 'Error al calcular estadísticas' }, 500);
  }
});

export default app;

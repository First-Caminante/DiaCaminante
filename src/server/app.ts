import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSupabaseAdmin } from '../lib/supabase';

export const app = new Hono().basePath('/api');

// Enable CORS
app.use('*', cors());

// Helper to get YYYY-MM-DD
function getFormattedDate(dateStr?: string): string {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  return new Date().toISOString().split('T')[0];
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

export default app;

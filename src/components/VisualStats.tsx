import React, { useState, useEffect, useMemo } from 'react';
import type {
  EstadisticasResponse,
  TendenciaDia,
  SesionFlujo,
  Intensidad,
  Incomodidad,
  DetalleDiaHistorico,
  RegistroSueno,
  RegistroComida,
  RegistroEjercicio,
  TareaPlanificada,
  TipoTrabajo,
  EstadoTarea,
} from '../types/database';
import { getDiaDelCiclo, FECHA_INICIO_CICLO } from '../data/reflections';

interface VisualStatsProps {
  fechaHoy?: string;
  sesionesHoy?: SesionFlujo[];
  suenosHoy?: RegistroSueno[];
  comidasHoy?: RegistroComida[];
  ejerciciosHoy?: RegistroEjercicio[];
  tareasHoy?: TareaPlanificada[];
  onTaskUpdated?: (tarea: TareaPlanificada) => void;
  onTaskCreated?: (nuevasTareas: TareaPlanificada[]) => void;
  onTaskDeleted?: (id: string) => void;
  onGoToDailyLog?: () => void;
  onGoToTasks?: () => void;
}

export interface HoraSlot24 {
  hora: number;
  horaLabel: string;
  rangoLabel: string;
  minutosFoco: number;
  minutosSueno: number;
  minutosEjercicio: number;
  puntosComida: number;
  horasNetas: number;
  sesiones: { sesion: SesionFlujo; minutos: number }[];
  suenos: { sueno: RegistroSueno; minutos: number }[];
  comidas: RegistroComida[];
  ejercicios: { ejercicio: RegistroEjercicio; minutos: number }[];
  tareas: TareaPlanificada[];
  intensidadPredominante: Intensidad | null;
  incomodidadPredominante: Incomodidad | null;
  esHoraActual: boolean;
  esPasada: boolean;
  esFutura: boolean;
}

// Helper para calcular solapamiento exacto de minutos en un slot horario (soporta cruce de medianoche)
function calculateSlotOverlap(slotH: number, startStr?: string | null, endStr?: string | null): number {
  if (!startStr || !endStr) return 0;
  const [hStart, mStart] = startStr.split(':').map(Number);
  const [hEnd, mEnd] = endStr.split(':').map(Number);
  if (isNaN(hStart) || isNaN(mStart) || isNaN(hEnd) || isNaN(mEnd)) return 0;

  const sStartMin = (hStart || 0) * 60 + (mStart || 0);
  const sEndMin = (hEnd || 0) * 60 + (mEnd || 0);

  const slotStart = slotH * 60;
  const slotEnd = (slotH + 1) * 60;

  if (sStartMin <= sEndMin) {
    const oStart = Math.max(sStartMin, slotStart);
    const oEnd = Math.min(sEndMin, slotEnd);
    return Math.max(0, oEnd - oStart);
  } else {
    // Sesión o sueño que cruza la medianoche (ej: 23:00 - 07:00)
    const oStart1 = Math.max(sStartMin, slotStart);
    const oEnd1 = Math.min(1440, slotEnd);
    const overlap1 = Math.max(0, oEnd1 - oStart1);

    const oStart2 = Math.max(0, slotStart);
    const oEnd2 = Math.min(sEndMin, slotEnd);
    const overlap2 = Math.max(0, oEnd2 - oStart2);

    return overlap1 + overlap2;
  }
}

// Algoritmo para generar curvas de Montaña Bézier Suavizadas y Clampeadas a la base
// Elimina rebotes / dips debajo del horizonte y garantiza un dibujo continuo sin artefactos
function generateSmoothAreaPath(
  points: { x: number; y: number; value?: number }[],
  baselineY: number,
  topY: number = 15
): { linePath: string; areaPath: string } {
  if (points.length === 0) return { linePath: '', areaPath: '' };
  if (points.length === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      areaPath: `M ${p.x.toFixed(1)} ${baselineY} L ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${p.x.toFixed(1)} ${baselineY} Z`,
    };
  }

  const n = points.length;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 0; i < n - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < n - 2 ? points[i + 2] : p2;

    const p1OnBase = p1.y >= baselineY - 0.5;
    const p2OnBase = p2.y >= baselineY - 0.5;

    // Si ambos puntos están en la línea de base (0 actividad), se traza una línea plana horizontal
    if (p1OnBase && p2OnBase) {
      d += ` L ${p2.x.toFixed(1)} ${baselineY.toFixed(1)}`;
      continue;
    }

    const dx = p2.x - p1.x;
    let dy1 = (p2.y - p0.y) / 2;
    let dy2 = (p3.y - p1.y) / 2;

    // Si despega desde la base, la tangente no puede hundirse por debajo de la base
    if (p1OnBase) {
      dy1 = 0;
    }
    // Si aterriza en la base, la tangente final debe ser horizontal
    if (p2OnBase) {
      dy2 = 0;
    }

    // Aplanar tangentes en crestas / picos locales
    if ((p1.y < p0.y && p1.y < p2.y) || (p1.y > p0.y && p1.y > p2.y)) {
      dy1 = 0;
    }
    if ((p2.y < p1.y && p2.y < p3.y) || (p2.y > p1.y && p2.y > p3.y)) {
      dy2 = 0;
    }

    let cp1x = p1.x + dx / 3;
    let cp1y = p1.y + dy1 / 3;
    let cp2x = p2.x - dx / 3;
    let cp2y = p2.y - dy2 / 3;

    // Clamping estricto para que la curva nunca sobrepase la base ni la cima
    cp1y = Math.min(baselineY, Math.max(topY, cp1y));
    cp2y = Math.min(baselineY, Math.max(topY, cp2y));

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${d} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

  return { linePath: d, areaPath };
}

// Helper para construir estructuras de puntos y curvas de montaña para cualquier modalidad
function buildMountainData(
  slots: HoraSlot24[],
  getValue: (s: HoraSlot24) => number,
  maxExpected: number = 60,
  width: number = 900,
  height: number = 140
) {
  const paddingX = 22;
  const baselineY = height - 18;
  const topY = 16;
  const usableHeight = baselineY - topY;

  const step = (width - paddingX * 2) / Math.max(1, slots.length - 1);
  const points = slots.map((slot, idx) => {
    const x = paddingX + idx * step;
    const val = getValue(slot);
    const ratio = Math.min(1, Math.max(0, val / maxExpected));
    const y = baselineY - ratio * usableHeight;
    return { x, y, value: val, slot };
  });

  const { linePath, areaPath } = generateSmoothAreaPath(points, baselineY, topY);
  return { width, height, baselineY, topY, points, linePath, areaPath };
}

// Función pura para construir las 24 ranuras horarias de cualquier jornada (Hoy o Histórica)
function compute24hSlots(
  targetDate: string,
  sessions: SesionFlujo[],
  suenos: RegistroSueno[] = [],
  comidas: RegistroComida[] = [],
  ejercicios: RegistroEjercicio[] = [],
  currentLiveHour?: number | null,
  tareas: TareaPlanificada[] = []
): HoraSlot24[] {
  const [year, month, day] = targetDate.split('-').map(Number);
  const slots: HoraSlot24[] = [];

  for (let h = 0; h < 24; h++) {
    const horaLabel = `${String(h).padStart(2, '0')}:00`;
    const nextH = (h + 1) % 24;
    const rangoLabel = `${horaLabel} - ${String(nextH).padStart(2, '0')}:00`;

    const hourStartMs = new Date(year, month - 1, day, h, 0, 0, 0).getTime();
    const hourEndMs = new Date(year, month - 1, day, h + 1, 0, 0, 0).getTime();

    let minutosEnHora = 0;
    const sesionesEnSlot: { sesion: SesionFlujo; minutos: number }[] = [];
    const suenosEnSlot: { sueno: RegistroSueno; minutos: number }[] = [];
    const comidasEnSlot: RegistroComida[] = [];
    const ejerciciosEnSlot: { ejercicio: RegistroEjercicio; minutos: number }[] = [];

    let intAltaMins = 0;
    let intMediaMins = 0;
    let intBajaMins = 0;

    let incAltaMins = 0;
    let incMediaMins = 0;
    let incBajaMins = 0;

    // 1. Sesiones de Trabajo Profundo
    sessions.forEach((s) => {
      let overlapMins = 0;

      if (s.hora_inicio && s.hora_fin) {
        overlapMins = calculateSlotOverlap(h, s.hora_inicio, s.hora_fin);
      } else if (s.registrado_a) {
        const regDate = new Date(s.registrado_a);
        const sessionEndMs = regDate.getTime();
        const durationMin = Math.round((parseFloat(String(s.horas_netas)) || 0) * 60);
        const sessionStartMs = sessionEndMs - durationMin * 60 * 1000;

        const overlapStart = Math.max(sessionStartMs, hourStartMs);
        const overlapEnd = Math.min(sessionEndMs, hourEndMs);

        if (overlapEnd > overlapStart) {
          overlapMins = Math.round((overlapEnd - overlapStart) / 60000);
        } else if (regDate.getHours() === h && durationMin > 0) {
          overlapMins = Math.min(60, durationMin);
        }
      }

      if (overlapMins > 0) {
        minutosEnHora += overlapMins;
        sesionesEnSlot.push({ sesion: s, minutos: overlapMins });

        if (s.intensidad === 'Alta') intAltaMins += overlapMins;
        else if (s.intensidad === 'Baja') intBajaMins += overlapMins;
        else intMediaMins += overlapMins;

        if (s.incomodidad === 'Alta') incAltaMins += overlapMins;
        else if (s.incomodidad === 'Baja') incBajaMins += overlapMins;
        else incMediaMins += overlapMins;
      }
    });

    // 2. Registros de Sueño
    let minutosSuenoEnSlot = 0;
    suenos.forEach((sueno) => {
      if (sueno.hora_inicio && sueno.hora_fin) {
        const overlap = calculateSlotOverlap(h, sueno.hora_inicio, sueno.hora_fin);
        if (overlap > 0) {
          suenosEnSlot.push({ sueno, minutos: overlap });
          minutosSuenoEnSlot += overlap;
        }
      }
    });
    minutosSuenoEnSlot = Math.min(60, minutosSuenoEnSlot);

    // 3. Registros de Alimentación / Comida (Cálculo de magnitud nutricional)
    let puntosComidaEnSlot = 0;
    comidas.forEach((comida) => {
      if (comida.hora) {
        const hComida = parseInt(comida.hora.split(':')[0], 10);
        if (hComida === h) {
          comidasEnSlot.push(comida);
          let pts = 45;
          if (comida.tipo_comida === 'Almuerzo') pts = 60;
          else if (comida.tipo_comida === 'Cena') pts = 55;
          else if (comida.tipo_comida === 'Desayuno') pts = 50;
          else if (comida.tipo_comida === 'Merienda / Snack') pts = 35;
          else pts = 30;
          puntosComidaEnSlot = Math.max(puntosComidaEnSlot, pts);
        }
      }
    });

    // 4. Registros de Ejercicio Físico
    let minutosEjercicioEnSlot = 0;
    ejercicios.forEach((ejercicio) => {
      if (ejercicio.hora_inicio && ejercicio.hora_fin) {
        const overlap = calculateSlotOverlap(h, ejercicio.hora_inicio, ejercicio.hora_fin);
        if (overlap > 0) {
          ejerciciosEnSlot.push({ ejercicio, minutos: overlap });
          minutosEjercicioEnSlot += overlap;
        }
      } else if (ejercicio.duracion_horas) {
        const durMin = Math.round((parseFloat(String(ejercicio.duracion_horas)) || 0) * 60);
        if (durMin > 0 && h === 18) {
          // Asignación por defecto en hora típica si carece de rango explícito
          minutosEjercicioEnSlot = Math.min(60, durMin);
        }
      }
    });
    minutosEjercicioEnSlot = Math.min(60, minutosEjercicioEnSlot);

    minutosEnHora = Math.min(60, minutosEnHora);

    let intensidadPredominante: Intensidad | null = null;
    if (sesionesEnSlot.length > 0) {
      if (intAltaMins >= intMediaMins && intAltaMins >= intBajaMins && intAltaMins > 0) {
        intensidadPredominante = 'Alta';
      } else if (intMediaMins >= intBajaMins && intMediaMins > 0) {
        intensidadPredominante = 'Media';
      } else {
        intensidadPredominante = 'Baja';
      }
    }

    let incomodidadPredominante: Incomodidad | null = null;
    if (sesionesEnSlot.length > 0) {
      if (incAltaMins >= incMediaMins && incAltaMins >= incBajaMins && incAltaMins > 0) {
        incomodidadPredominante = 'Alta';
      } else if (incMediaMins >= incBajaMins && incMediaMins > 0) {
        incomodidadPredominante = 'Media';
      } else {
        incomodidadPredominante = 'Baja';
      }
    }

    // 5. Tareas Planificadas en este slot
    const tareasEnSlot: TareaPlanificada[] = (tareas || []).filter((t) => {
      if (!t.hora_inicio || !t.hora_fin) return false;
      return calculateSlotOverlap(h, t.hora_inicio, t.hora_fin) > 0;
    });

    const isCurrent = currentLiveHour != null && currentLiveHour === h;
    const isPast = currentLiveHour != null ? h < currentLiveHour : true;
    const isFuture = currentLiveHour != null ? h > currentLiveHour : false;

    slots.push({
      hora: h,
      horaLabel,
      rangoLabel,
      minutosFoco: minutosEnHora,
      minutosSueno: minutosSuenoEnSlot,
      minutosEjercicio: minutosEjercicioEnSlot,
      puntosComida: puntosComidaEnSlot,
      horasNetas: Number((minutosEnHora / 60).toFixed(2)),
      sesiones: sesionesEnSlot,
      suenos: suenosEnSlot,
      comidas: comidasEnSlot,
      ejercicios: ejerciciosEnSlot,
      tareas: tareasEnSlot,
      intensidadPredominante,
      incomodidadPredominante,
      esHoraActual: isCurrent,
      esPasada: isPast,
      esFutura: isFuture,
    });
  }

  return slots;
}

export const VisualStats: React.FC<VisualStatsProps> = ({
  fechaHoy,
  sesionesHoy,
  suenosHoy = [],
  comidasHoy = [],
  ejerciciosHoy = [],
  tareasHoy = [],
  onTaskUpdated,
  onTaskCreated,
  onTaskDeleted,
  onGoToDailyLog,
  onGoToTasks,
}) => {
  const [stats, setStats] = useState<EstadisticasResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rangoDias, setRangoDias] = useState<7 | 14 | 30>(14);
  const [modoGraficoHist, setModoGraficoHist] = useState<'montana' | 'columnas'>('montana');
  const [hoveredDay, setHoveredDay] = useState<TendenciaDia | null>(null);
  const [mostrarModalHistorico, setMostrarModalHistorico] = useState<boolean>(false);
  const [selectedHora, setSelectedHora] = useState<number | null>(null);

  // Filtro de tareas en el panel diario ('todas' | 'por_cumplir' | 'cumplidas')
  const [filtroTareasVisual, setFiltroTareasVisual] = useState<'todas' | 'por_cumplir' | 'cumplidas'>('todas');
  // Modal rápido para agregar tarea en el panel diario
  const [isQuickCreateTaskOpen, setIsQuickCreateTaskOpen] = useState<boolean>(false);
  const [quickTaskDesc, setQuickTaskDesc] = useState<string>('');
  const [quickTaskInicio, setQuickTaskInicio] = useState<string>('09:00');
  const [quickTaskFin, setQuickTaskFin] = useState<string>('10:30');
  const [quickTaskTipo, setQuickTaskTipo] = useState<TipoTrabajo>('PROFUNDO');
  const [quickTaskHoras, setQuickTaskHoras] = useState<number>(1.5);
  const [creatingQuickTask, setCreatingQuickTask] = useState<boolean>(false);
  const [visualTaskFeedback, setVisualTaskFeedback] = useState<string | null>(null);

  const showVisualTaskToast = (msg: string) => {
    setVisualTaskFeedback(msg);
    setTimeout(() => setVisualTaskFeedback(null), 3500);
  };

  const handleHorasQuickTask = (ini: string, fin: string) => {
    setQuickTaskInicio(ini);
    setQuickTaskFin(fin);
    try {
      const [h1, m1] = ini.split(':').map(Number);
      const [h2, m2] = fin.split(':').map(Number);
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      const hours = Math.round((diff / 60) * 10) / 10;
      if (hours > 0) setQuickTaskHoras(hours);
    } catch {
      // Ignorar
    }
  };

  const handleToggleTareaRapida = async (tarea: TareaPlanificada) => {
    const nextStatus: EstadoTarea = tarea.estado === 'hecho' ? 'pendiente' : 'hecho';
    try {
      const res = await fetch(`/api/tareas/${tarea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: nextStatus,
          motivo_desvio: null,
        }),
      });
      if (!res.ok) throw new Error('Error al actualizar tarea');
      const data = await res.json();
      if (onTaskUpdated) {
        onTaskUpdated(data.tarea);
      }
      showVisualTaskToast(nextStatus === 'hecho' ? '✓ Tarea marcada como cumplida' : 'Tarea devuelta a pendientes');
    } catch (err) {
      console.error(err);
      alert('No se pudo actualizar la tarea');
    }
  };

  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskDesc.trim()) return;
    try {
      setCreatingQuickTask(true);
      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_objetivo: targetFechaStr,
          descripcion: quickTaskDesc.trim(),
          hora_inicio: quickTaskInicio,
          hora_fin: quickTaskFin,
          tipo_trabajo: quickTaskTipo,
          horas_netas_estimadas: quickTaskHoras,
        }),
      });
      if (!res.ok) throw new Error('Error al registrar tarea');
      const data = await res.json();
      if (onTaskCreated) {
        onTaskCreated(data.tareas || [data.tarea]);
      }
      setQuickTaskDesc('');
      setIsQuickCreateTaskOpen(false);
      showVisualTaskToast('✓ Tarea agregada al plan de hoy');
    } catch (err) {
      console.error(err);
      alert('No se pudo crear la tarea');
    } finally {
      setCreatingQuickTask(false);
    }
  };

  // Selector de aspecto circadiano (Trabajo, Sueño, Alimentación, Ejercicio, Comparativa)
  const [aspectoCircadiano, setAspectoCircadiano] = useState<
    'trabajo' | 'sueno' | 'alimentacion' | 'ejercicio' | 'comparativa'
  >('trabajo');
  const [hoveredSlotHora, setHoveredSlotHora] = useState<number | null>(null);

  // Estado para la inspección y selección de un día específico en el histórico
  const [fechaSeleccionadaHist, setFechaSeleccionadaHist] = useState<string>('');
  const [detalleDiaHist, setDetalleDiaHist] = useState<DetalleDiaHistorico | null>(null);
  const [loadingDiaHist, setLoadingDiaHist] = useState<boolean>(false);
  const [selectedHoraHist, setSelectedHoraHist] = useState<number | null>(null);

  // Reloj en tiempo real
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Escape key handler para modal histórico
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mostrarModalHistorico) {
        setMostrarModalHistorico(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mostrarModalHistorico]);

  const targetFechaStr = fechaHoy || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/estadisticas?fecha=${targetFechaStr}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al obtener estadísticas');
      }
      const data: EstadisticasResponse = await res.json();
      setStats(data);

      if (!fechaSeleccionadaHist) {
        if (data.diasHistoricosConActividad && data.diasHistoricosConActividad.length > 0) {
          const pastWithActivity = data.diasHistoricosConActividad.find((d) => d.fecha !== targetFechaStr);
          setFechaSeleccionadaHist(pastWithActivity ? pastWithActivity.fecha : data.diasHistoricosConActividad[0].fecha);
        } else {
          setFechaSeleccionadaHist(targetFechaStr);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [fechaHoy]);

  const fetchDetalleDiaHistorico = async (fecha: string) => {
    if (!fecha) return;
    try {
      setLoadingDiaHist(true);
      const res = await fetch(`/api/dia/historico?fecha=${fecha}`);
      if (!res.ok) throw new Error('Error al cargar detalle del día');
      const data: DetalleDiaHistorico = await res.json();
      setDetalleDiaHist(data);
    } catch (err) {
      console.error('Error in fetchDetalleDiaHistorico:', err);
    } finally {
      setLoadingDiaHist(false);
    }
  };

  useEffect(() => {
    if (fechaSeleccionadaHist) {
      fetchDetalleDiaHistorico(fechaSeleccionadaHist);
      setSelectedHoraHist(null);
    }
  }, [fechaSeleccionadaHist]);

  const handleSeleccionarDia = (fecha: string) => {
    if (!fecha) return;
    setFechaSeleccionadaHist(fecha);
  };

  const handlePasoDia = (delta: -1 | 1) => {
    try {
      const base = fechaSeleccionadaHist || targetFechaStr;
      const [y, m, d] = base.split('-').map(Number);
      const cur = new Date(y, m - 1, d);
      cur.setDate(cur.getDate() + delta);
      const nextStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      handleSeleccionarDia(nextStr);
    } catch (e) {
      console.error(e);
    }
  };

  // Cálculos de tiempo real y ciclo de 365 días
  const diaCiclo = getDiaDelCiclo(now);
  const horaActual = now.getHours();
  const minutoActual = now.getMinutes();
  const segundoActual = now.getSeconds();

  const tiempoExactoStr = `${String(horaActual).padStart(2, '0')}:${String(minutoActual).padStart(2, '0')}:${String(segundoActual).padStart(2, '0')}`;
  const fechaFormateada = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const fechaFormateadaCapital = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);

  // Progreso de la jornada
  const minutosTranscurridosHoy = horaActual * 60 + minutoActual;
  const pctDiaTranscurrido = Math.min(100, Math.round((minutosTranscurridosHoy / 1440) * 100));
  const minutosRestantesHoy = Math.max(0, 1440 - minutosTranscurridosHoy);
  const horasRestantesHoy = Math.floor(minutosRestantesHoy / 60);
  const minRestantesHoy = minutosRestantesHoy % 60;

  // Progreso del ciclo
  const pctCiclo = ((diaCiclo / 365) * 100).toFixed(1);
  const diasRestantesCiclo = Math.max(0, 365 - diaCiclo);

  // Sesiones activas de hoy
  const activeSesionesHoy = useMemo(() => {
    if (sesionesHoy && sesionesHoy.length > 0) return sesionesHoy;
    return stats?.hoy?.sesiones || [];
  }, [sesionesHoy, stats?.hoy?.sesiones]);

  // Tareas de Hoy y métricas para el Panel Diario
  const tareasList = useMemo(() => tareasHoy || [], [tareasHoy]);
  const porCumplirList = useMemo(
    () => tareasList.filter((t) => t.estado === 'pendiente' || t.estado === 'incompleto' || t.estado === 'no_hecho'),
    [tareasList]
  );
  const cumplidasList = useMemo(() => tareasList.filter((t) => t.estado === 'hecho'), [tareasList]);
  const totalTareasCount = tareasList.length;
  const pctTareasCumplidas = totalTareasCount > 0 ? Math.round((cumplidasList.length / totalTareasCount) * 100) : 0;
  const horasTareasPlanificadas = useMemo(
    () => tareasList.reduce((acc, t) => acc + (parseFloat(String(t.horas_netas_estimadas)) || 0), 0),
    [tareasList]
  );
  const horasTareasCumplidas = useMemo(
    () => cumplidasList.reduce((acc, t) => acc + (parseFloat(String(t.horas_netas_estimadas)) || 0), 0),
    [cumplidasList]
  );
  const horasTareasPorCumplir = useMemo(
    () => porCumplirList.reduce((acc, t) => acc + (parseFloat(String(t.horas_netas_estimadas)) || 0), 0),
    [porCumplirList]
  );

  // Cronograma de 24 Horas de HOY
  const horasSlotsHoy: HoraSlot24[] = useMemo(() => {
    return compute24hSlots(targetFechaStr, activeSesionesHoy, suenosHoy, comidasHoy, ejerciciosHoy, horaActual, tareasHoy);
  }, [activeSesionesHoy, suenosHoy, comidasHoy, ejerciciosHoy, targetFechaStr, horaActual, tareasHoy]);

  const horasConFocoCount = horasSlotsHoy.filter((s) => s.minutosFoco > 0).length;
  const picoSlotHoy = useMemo(() => {
    return [...horasSlotsHoy].sort((a, b) => b.minutosFoco - a.minutosFoco)[0];
  }, [horasSlotsHoy]);

  const slotActivoHoy = horasSlotsHoy[selectedHora !== null ? selectedHora : horaActual] || horasSlotsHoy[0];

  // Curvas de Montaña Circadiana de Hoy para cada aspecto independiente (24 puntos cada una)
  const mountainTrabajo = useMemo(() => {
    return buildMountainData(horasSlotsHoy, (s) => s.minutosFoco, 60, 900, 145);
  }, [horasSlotsHoy]);

  const mountainSueno = useMemo(() => {
    return buildMountainData(horasSlotsHoy, (s) => s.minutosSueno, 60, 900, 145);
  }, [horasSlotsHoy]);

  const mountainComida = useMemo(() => {
    return buildMountainData(horasSlotsHoy, (s) => s.puntosComida, 60, 900, 145);
  }, [horasSlotsHoy]);

  const mountainEjercicio = useMemo(() => {
    return buildMountainData(horasSlotsHoy, (s) => s.minutosEjercicio, 60, 900, 145);
  }, [horasSlotsHoy]);

  // Mini-montañas para la vista comparativa (4 pistas sincronizadas en paralelo)
  const miniMountainTrabajo = useMemo(() => {
    return buildMountainData(horasSlotsHoy, (s) => s.minutosFoco, 60, 900, 48);
  }, [horasSlotsHoy]);

  const miniMountainSueno = useMemo(() => {
    return buildMountainData(horasSlotsHoy, (s) => s.minutosSueno, 60, 900, 48);
  }, [horasSlotsHoy]);

  const miniMountainComida = useMemo(() => {
    return buildMountainData(horasSlotsHoy, (s) => s.puntosComida, 60, 900, 48);
  }, [horasSlotsHoy]);

  const miniMountainEjercicio = useMemo(() => {
    return buildMountainData(horasSlotsHoy, (s) => s.minutosEjercicio, 60, 900, 48);
  }, [horasSlotsHoy]);

  // Cronograma de 24 Horas del DÍA HISTÓRICO SELECCIONADO
  const sesionesDiaHist = useMemo(() => {
    if (detalleDiaHist?.sesiones && detalleDiaHist.sesiones.length > 0) {
      return detalleDiaHist.sesiones;
    }
    const matchInActive = stats?.diasHistoricosConActividad?.find((d) => d.fecha === fechaSeleccionadaHist);
    if (matchInActive?.sesiones) return matchInActive.sesiones;
    const matchInTrend = stats?.tendenciaDias?.find((d) => d.fecha === fechaSeleccionadaHist);
    if (matchInTrend?.sesiones) return matchInTrend.sesiones;
    return [];
  }, [detalleDiaHist?.sesiones, stats?.diasHistoricosConActividad, stats?.tendenciaDias, fechaSeleccionadaHist]);

  const isSelectedToday = fechaSeleccionadaHist === targetFechaStr;
  const horasSlotsHist: HoraSlot24[] = useMemo(() => {
    if (!fechaSeleccionadaHist) return [];
    return compute24hSlots(
      fechaSeleccionadaHist,
      sesionesDiaHist,
      detalleDiaHist?.suenos || [],
      detalleDiaHist?.comidas || [],
      detalleDiaHist?.ejercicios || [],
      isSelectedToday ? horaActual : null,
      detalleDiaHist?.tareas || []
    );
  }, [fechaSeleccionadaHist, sesionesDiaHist, detalleDiaHist?.suenos, detalleDiaHist?.comidas, detalleDiaHist?.ejercicios, detalleDiaHist?.tareas, isSelectedToday, horaActual]);

  const slotActivoHist = useMemo(() => {
    if (!horasSlotsHist.length) return null;
    if (selectedHoraHist !== null) {
      return horasSlotsHist[selectedHoraHist] || horasSlotsHist[0];
    }
    const firstWithFocus = horasSlotsHist.find((s) => s.minutosFoco > 0);
    return firstWithFocus || horasSlotsHist[12] || horasSlotsHist[0];
  }, [horasSlotsHist, selectedHoraHist]);

  // Helpers
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const getSessionTimeRange = (s: SesionFlujo) => {
    const durMin = Math.round((parseFloat(String(s.horas_netas)) || 0) * 60);
    if (s.hora_inicio && s.hora_fin) {
      return {
        inicio: s.hora_inicio,
        fin: s.hora_fin,
        durMin,
        exacta: s.hora_fin,
      };
    }
    if (!s.registrado_a) return { inicio: '--:--', fin: '--:--', durMin: 0, exacta: '--:--' };
    try {
      const end = new Date(s.registrado_a);
      const start = new Date(end.getTime() - durMin * 60 * 1000);
      return {
        inicio: start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        fin: end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        durMin,
        exacta: end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    } catch {
      return { inicio: '--:--', fin: '--:--', durMin: 0, exacta: '--:--' };
    }
  };

  const formatFechaLargaEspanol = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const formatted = dt.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      return `${parts[2]}/${parts[1]}`;
    } catch {
      return dateStr;
    }
  };

  const getDiaCicloParaFecha = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return getDiaDelCiclo(dt);
    } catch {
      return 1;
    }
  };

  if (loading && !stats) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#0d1a3d] border border-[#5b9bd5]/30 shadow-midnight flex items-center justify-center text-[#e5c179] font-serif text-2xl animate-pulse">
          ✦
        </div>
        <p className="text-xs font-serif italic tracking-wide text-[#94a3b8]">
          Calculando ritmo circadiano y métricas de la jornada...
        </p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="w-full">
        <div className="card-midnight p-8 text-center space-y-4 border border-rose-500/30">
          <span className="text-3xl">⚠️</span>
          <p className="text-sm font-serif font-bold text-rose-300 tracking-wide">
            No se pudieron obtener las estadísticas
          </p>
          <p className="text-xs text-[#94a3b8]">{error}</p>
          <button
            onClick={fetchStats}
            className="btn-formal px-5 py-2.5 rounded-full text-xs font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Filter trend days para modal histórico
  const filteredTrend = stats.tendenciaDias.slice(-rangoDias);
  const maxHoursInTrend = Math.max(...filteredTrend.map((d) => d.horasNetas), 4.5);
  const totalHorasEnRango = filteredTrend.reduce((acc, d) => acc + d.horasNetas, 0);

  // Curva de Montañas Históricas (Spline Bézier para el modal)
  const svgTrendWidth = 840;
  const svgTrendHeight = 180;
  const svgTrendPaddingX = 28;
  const svgTrendBaselineY = svgTrendHeight - 24;
  const svgTrendTopY = 20;
  const svgTrendUsableHeight = svgTrendBaselineY - svgTrendTopY;

  const mountainTrendPoints = filteredTrend.map((d, idx) => {
    const step = (svgTrendWidth - svgTrendPaddingX * 2) / Math.max(1, filteredTrend.length - 1);
    const x = svgTrendPaddingX + idx * step;
    const ratio = Math.min(1, Math.max(0, d.horasNetas / maxHoursInTrend));
    const y = svgTrendBaselineY - ratio * svgTrendUsableHeight;
    return { x, y, day: d };
  });

  const { linePath: mountainTrendLine, areaPath: mountainTrendArea } = generateSmoothAreaPath(
    mountainTrendPoints.map((p) => ({ x: p.x, y: p.y })),
    svgTrendBaselineY
  );

  const newportGoalY = svgTrendBaselineY - (4.0 / maxHoursInTrend) * svgTrendUsableHeight;

  // Umbrales
  const UMBRAL_TRABAJO_MIN_H = 3.0;
  const UMBRAL_EXIGENCIA_MIN_PCT = 50;
  const UMBRAL_EJERCICIO_MIN_H = 0.75;

  // Métricas reales de HOY integradas con las nuevas modalidades
  const horasHoy = stats.hoy?.horasNetas ?? 0;

  const ejercicioHoy =
    ejerciciosHoy && ejerciciosHoy.length > 0
      ? ejerciciosHoy.reduce((acc, e) => acc + (parseFloat(String(e.duracion_horas)) || 0), 0)
      : (stats.hoy?.ejercicioHoras ?? 0);

  const horasSuenoHoy =
    suenosHoy && suenosHoy.length > 0
      ? suenosHoy.reduce((acc, s) => acc + (parseFloat(String(s.horas)) || 0), 0)
      : 0;

  const totalComidasHoy = comidasHoy ? comidasHoy.length : 0;
  const comidasLimpiasHoy = comidasHoy ? comidasHoy.filter((c) => c.calidad.includes('Limpio')).length : 0;

  const cierreHoy = stats.hoy?.cierreRealizado ?? false;

  const incomodidadHoy = stats.hoy?.distribucionIncomodidad || { Alta: 0, Media: 0, Baja: 0 };
  const intensidadHoy = stats.hoy?.distribucionIntensidad || { Alta: 0, Media: 0, Baja: 0 };

  const horasFriccionHoy = incomodidadHoy.Alta + incomodidadHoy.Media;
  const pctExigenteHoy = horasHoy > 0 ? Math.round((horasFriccionHoy / horasHoy) * 100) : 0;

  // Alertas
  const alertaTrabajo = horasHoy < UMBRAL_TRABAJO_MIN_H;
  const deficitTrabajoHoy = Math.max(0, UMBRAL_TRABAJO_MIN_H - horasHoy);
  const alertaEstudio = horasHoy === 0 || pctExigenteHoy < UMBRAL_EXIGENCIA_MIN_PCT || incomodidadHoy.Alta === 0;
  const alertaEntrenamiento = ejercicioHoy < UMBRAL_EJERCICIO_MIN_H;
  const deficitEjercicioHoy = Math.max(0, UMBRAL_EJERCICIO_MIN_H - ejercicioHoy);
  const alertaCierre = !cierreHoy;
  const totalAlertas = (alertaTrabajo ? 1 : 0) + (alertaEstudio ? 1 : 0) + (alertaEntrenamiento ? 1 : 0) + (alertaCierre ? 1 : 0);

  // Matriz HOY
  const matrizHoy = stats.matrizCalidadHoy || { Alta: { Alta: 0, Media: 0, Baja: 0 }, Media: { Alta: 0, Media: 0, Baja: 0 }, Baja: { Alta: 0, Media: 0, Baja: 0 } };
  const totalIncomodidadHoy = incomodidadHoy.Alta + incomodidadHoy.Media + incomodidadHoy.Baja;
  const pctIncomodidadAltaHoy = totalIncomodidadHoy > 0 ? Number(((incomodidadHoy.Alta / totalIncomodidadHoy) * 100).toFixed(1)) : 0;
  const pctIncomodidadMediaHoy = totalIncomodidadHoy > 0 ? Number(((incomodidadHoy.Media / totalIncomodidadHoy) * 100).toFixed(1)) : 0;
  const pctIncomodidadBajaHoy = totalIncomodidadHoy > 0 ? Number(((incomodidadHoy.Baja / totalIncomodidadHoy) * 100).toFixed(1)) : 0;

  const totalIntensidadHoy = intensidadHoy.Alta + intensidadHoy.Media + intensidadHoy.Baja;
  const pctIntensidadAltaHoy = totalIntensidadHoy > 0 ? Number(((intensidadHoy.Alta / totalIntensidadHoy) * 100).toFixed(1)) : 0;
  const pctIntensidadMediaHoy = totalIntensidadHoy > 0 ? Number(((intensidadHoy.Media / totalIntensidadHoy) * 100).toFixed(1)) : 0;
  const pctIntensidadBajaHoy = totalIntensidadHoy > 0 ? Number(((intensidadHoy.Baja / totalIntensidadHoy) * 100).toFixed(1)) : 0;

  // Matriz HISTÓRICO
  const matrizHistorica = stats.matrizCalidad || { Alta: { Alta: 0, Media: 0, Baja: 0 }, Media: { Alta: 0, Media: 0, Baja: 0 }, Baja: { Alta: 0, Media: 0, Baja: 0 } };
  const totalIncomodidadHist = stats.distribucionIncomodidad.Alta + stats.distribucionIncomodidad.Media + stats.distribucionIncomodidad.Baja;
  const pctIncomodidadAltaHist = totalIncomodidadHist > 0 ? Number(((stats.distribucionIncomodidad.Alta / totalIncomodidadHist) * 100).toFixed(1)) : 0;
  const pctIncomodidadMediaHist = totalIncomodidadHist > 0 ? Number(((stats.distribucionIncomodidad.Media / totalIncomodidadHist) * 100).toFixed(1)) : 0;
  const pctIncomodidadBajaHist = totalIncomodidadHist > 0 ? Number(((stats.distribucionIncomodidad.Baja / totalIncomodidadHist) * 100).toFixed(1)) : 0;

  const totalIntensidadHist = stats.distribucionIntensidad.Alta + stats.distribucionIntensidad.Media + stats.distribucionIntensidad.Baja;
  const pctIntensidadAltaHist = totalIntensidadHist > 0 ? Number(((stats.distribucionIntensidad.Alta / totalIntensidadHist) * 100).toFixed(1)) : 0;
  const pctIntensidadMediaHist = totalIntensidadHist > 0 ? Number(((stats.distribucionIntensidad.Media / totalIntensidadHist) * 100).toFixed(1)) : 0;
  const pctIntensidadBajaHist = totalIntensidadHist > 0 ? Number(((stats.distribucionIntensidad.Baja / totalIntensidadHist) * 100).toFixed(1)) : 0;

  const diasConActividadLista = stats.diasHistoricosConActividad || [];

  // Configuración temática y métricas por cada dimensión circadiana
  const ASPECTO_CONFIGS = {
    trabajo: {
      id: 'trabajo',
      label: 'Trabajo Profundo',
      icono: '🧠',
      colorPrincipal: '#60a5fa',
      colorAcento: '#eed59b',
      gradienteId: 'gradTrabajoCircadiano',
      strokeId: 'strokeTrabajoCircadiano',
      fillStart: '#3b82f6',
      fillMid: '#1d4ed8',
      strokeStart: '#60a5fa',
      strokeMid: '#eed59b',
      strokeEnd: '#93c5fd',
      hasData: horasHoy > 0,
      totalStr: `${horasHoy.toFixed(1)}h`,
      metaStr: '3.0h meta',
      progresoPct: Math.min(100, Math.round((horasHoy / 3.0) * 100)),
    },
    sueno: {
      id: 'sueno',
      label: 'Sueño & Descanso',
      icono: '🌙',
      colorPrincipal: '#a78bfa',
      colorAcento: '#c084fc',
      gradienteId: 'gradSuenoCircadiano',
      strokeId: 'strokeSuenoCircadiano',
      fillStart: '#8b5cf6',
      fillMid: '#5b21b6',
      strokeStart: '#a78bfa',
      strokeMid: '#c084fc',
      strokeEnd: '#e9d5ff',
      hasData: horasSuenoHoy > 0,
      totalStr: `${horasSuenoHoy.toFixed(1)}h`,
      metaStr: '8.0h ideal',
      progresoPct: Math.min(100, Math.round((horasSuenoHoy / 8.0) * 100)),
    },
    alimentacion: {
      id: 'alimentacion',
      label: 'Alimentación',
      icono: '🥗',
      colorPrincipal: '#34d399',
      colorAcento: '#6ee7b7',
      gradienteId: 'gradComidaCircadiano',
      strokeId: 'strokeComidaCircadiano',
      fillStart: '#10b981',
      fillMid: '#047857',
      strokeStart: '#34d399',
      strokeMid: '#6ee7b7',
      strokeEnd: '#a7f3d0',
      hasData: totalComidasHoy > 0,
      totalStr: `${totalComidasHoy} comidas`,
      metaStr: '3 comidas limpias',
      progresoPct: Math.min(100, Math.round((comidasLimpiasHoy / 3) * 100)),
    },
    ejercicio: {
      id: 'ejercicio',
      label: 'Ejercicio Físico',
      icono: '🏃',
      colorPrincipal: '#fb923c',
      colorAcento: '#f59e0b',
      gradienteId: 'gradEjercicioCircadiano',
      strokeId: 'strokeEjercicioCircadiano',
      fillStart: '#f59e0b',
      fillMid: '#b45309',
      strokeStart: '#fb923c',
      strokeMid: '#f59e0b',
      strokeEnd: '#fed7aa',
      hasData: ejercicioHoy > 0,
      totalStr: `${ejercicioHoy.toFixed(1)}h`,
      metaStr: '0.75h meta',
      progresoPct: Math.min(100, Math.round((ejercicioHoy / 0.75) * 100)),
    },
  };

  const activeConfig =
    aspectoCircadiano === 'sueno'
      ? ASPECTO_CONFIGS.sueno
      : aspectoCircadiano === 'alimentacion'
      ? ASPECTO_CONFIGS.alimentacion
      : aspectoCircadiano === 'ejercicio'
      ? ASPECTO_CONFIGS.ejercicio
      : ASPECTO_CONFIGS.trabajo;

  const activeMountain =
    aspectoCircadiano === 'sueno'
      ? mountainSueno
      : aspectoCircadiano === 'alimentacion'
      ? mountainComida
      : aspectoCircadiano === 'ejercicio'
      ? mountainEjercicio
      : mountainTrabajo;

  const handleSvgMouseMove = (e: React.MouseEvent<HTMLElement | SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, mouseX / rect.width));
    const h = Math.min(23, Math.max(0, Math.round(pct * 23)));
    setHoveredSlotHora(h);
  };

  const renderVisualTaskCard = (tarea: TareaPlanificada) => {
    const isDone = tarea.estado === 'hecho';
    const isProfundo = tarea.tipo_trabajo === 'PROFUNDO';

    return (
      <div
        key={tarea.id}
        className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDone
            ? 'bg-[#06241a]/50 border-[#10b981]/40'
            : 'bg-[#081229]/80 border-[#5b9bd5]/20 hover:border-[#60a5fa]/40'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          {/* Checkbox Interactivo de 1 Clic */}
          <button
            type="button"
            onClick={() => handleToggleTareaRapida(tarea)}
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all border ${
              isDone
                ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : 'bg-[#0d1a3d] border-[#5b9bd5]/40 text-transparent hover:border-emerald-400 hover:text-emerald-400'
            }`}
            title={isDone ? 'Tarea cumplida (Clic para desmarcar)' : 'Marcar como cumplida'}
          >
            <span className="font-bold text-xs">✓</span>
          </button>

          {/* Información de la Tarea */}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-semibold text-[#eed59b] bg-[#0d1733] px-2 py-0.5 rounded border border-[#5b9bd5]/25">
                {tarea.hora_inicio} — {tarea.hora_fin}
              </span>

              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isProfundo
                    ? 'bg-[#1e3a8a]/70 text-[#93c5fd] border border-[#60a5fa]/40'
                    : 'bg-[#334155]/60 text-[#cbd5e1] border border-slate-600/40'
                }`}
              >
                {isProfundo ? '🧠 PROFUNDO' : '⚡ SUPERFICIAL'}
              </span>

              <span className="text-[10px] text-[#94a3b8] font-mono">
                {tarea.horas_netas_estimadas}h netas
              </span>

              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                }`}
              >
                {isDone ? '✓ CUMPLIDA' : '⏳ POR CUMPLIR'}
              </span>
            </div>

            <p
              className={`text-sm font-medium transition-all ${
                isDone ? 'line-through text-[#94a3b8]' : 'text-white'
              }`}
            >
              {tarea.descripcion}
            </p>

            {tarea.motivo_desvio && (
              <div className="text-[11px] text-amber-300/90 italic bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/20">
                Motivo desvío: {tarea.motivo_desvio}
              </div>
            )}
          </div>
        </div>

        {/* Botón de Acción Rápida a la Derecha */}
        <div className="self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => handleToggleTareaRapida(tarea)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              isDone
                ? 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                : 'bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white hover:brightness-110 border border-[#60a5fa]/40 shadow-sm'
            }`}
          >
            <span>{isDone ? '↩ Desmarcar' : '✓ Cumplir'}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ========================================================= */}
      {/* 1. ZONA HERO PANORÁMICA: GRAN MONTAÑA CIRCADIANA + HUD KPIs */}
      {/* ========================================================= */}
      <section className="card-midnight p-5 sm:p-7 space-y-6 border border-[#5b9bd5]/25 relative overflow-hidden">
        {/* Glow de fondo superior etéreo */}
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-[#3b82f6]/15 rounded-full blur-[140px] pointer-events-none"></div>

        {/* Header de la Zona Hero */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10 pb-3 border-b border-[#5b9bd5]/15">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag-formal px-3 py-1 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                Ritmo en Vivo
              </span>
              <span className="text-xs font-sans text-[#94a3b8] font-medium">
                {fechaFormateadaCapital}
              </span>
              <span className="text-xs font-sans text-[#eed59b]">
                • {horasRestantesHoy}h {minRestantesHoy}m para medianoche
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide">
              Ritmo y Concentración Circadiana
            </h2>
            <p className="text-xs sm:text-sm font-sans text-[#94a3b8] max-w-2xl">
              Curva continua de inmersión hora a hora (00:00 — 23:59). Registro limpio y enfocado exclusivamente en la jornada de hoy.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
            {/* Botón para Abrir Archivo Histórico */}
            <button
              type="button"
              onClick={() => setMostrarModalHistorico(true)}
              className="btn-formal-outline px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2"
              title="Abrir ventana del archivo histórico y auditoría de días anteriores"
            >
              <span className="text-[#eed59b]">🏛️</span>
              <span>Archivo Histórico</span>
            </button>

            {onGoToDailyLog && (
              <button
                onClick={onGoToDailyLog}
                className="btn-formal px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5"
              >
                <span>+ Registrar Sesión</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RELIEVE CIRCADIANO 24 HORAS POR ASPECTO (CON VISTAS SEPARADAS Y MODO COMPARATIVO) */}
        {/* ========================================================= */}
        <div className="p-4 sm:p-6 rounded-2xl bg-[#081229]/90 border border-[#5b9bd5]/25 shadow-xl space-y-4 relative">
          {/* Barra Superior: Título Dinámico + Selector de Pestañas por Dimensión */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#5b9bd5]/15">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full animate-ping"
                  style={{
                    backgroundColor:
                      aspectoCircadiano === 'trabajo'
                        ? '#60a5fa'
                        : aspectoCircadiano === 'sueno'
                        ? '#a78bfa'
                        : aspectoCircadiano === 'alimentacion'
                        ? '#34d399'
                        : aspectoCircadiano === 'ejercicio'
                        ? '#fb923c'
                        : '#eed59b',
                  }}
                />
                <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
                  {aspectoCircadiano === 'trabajo' && 'Relieve de Trabajo Profundo (24 Horas)'}
                  {aspectoCircadiano === 'sueno' && 'Relieve de Sueño & Descanso (24 Horas)'}
                  {aspectoCircadiano === 'alimentacion' && 'Relieve de Alimentación (24 Horas)'}
                  {aspectoCircadiano === 'ejercicio' && 'Relieve de Ejercicio Físico (24 Horas)'}
                  {aspectoCircadiano === 'comparativa' && 'Panorama Circadiano — 4 Dimensiones en Paralelo'}
                </h3>
              </div>
              <p className="text-xs text-[#94a3b8]">
                {aspectoCircadiano === 'trabajo' && (
                  <span>
                    {horasHoy > 0
                      ? `${(horasHoy * 60).toFixed(0)} min de inmersión hoy (${pctExigenteHoy}% en alta/media incomodidad) • Meta: 3.0h`
                      : 'Esperando primera sesión de inmersión mental • Meta: 3.0h'}
                  </span>
                )}
                {aspectoCircadiano === 'sueno' && (
                  <span>
                    {horasSuenoHoy > 0
                      ? `${horasSuenoHoy.toFixed(1)}h de reposo registradas (${suenosHoy?.[0]?.calidad_sueno || 'Registrado'}) • Ideal: 8.0h`
                      : 'Sin registro de descanso nocturno para hoy • Ideal: 8.0h'}
                  </span>
                )}
                {aspectoCircadiano === 'alimentacion' && (
                  <span>
                    {totalComidasHoy > 0
                      ? `${totalComidasHoy} comidas registradas (${comidasLimpiasHoy} limpias / nutritivas) • Meta: 3 limpias`
                      : 'Sin ingestas registradas hoy • Meta: 3 comidas limpias'}
                  </span>
                )}
                {aspectoCircadiano === 'ejercicio' && (
                  <span>
                    {ejercicioHoy > 0
                      ? `${(ejercicioHoy * 60).toFixed(0)} min de entrenamiento (${ejerciciosHoy?.[0]?.tipo_ejercicio || 'Físico'}) • Meta: 45 min`
                      : 'Sin entrenamiento físico registrado hoy • Meta: 45 min (0.75h)'}
                  </span>
                )}
                {aspectoCircadiano === 'comparativa' && (
                  <span>
                    Pistas horizontales sincronizadas hora a hora (00:00 — 23:59). Pasa el cursor para ver el impacto conjunto.
                  </span>
                )}
              </p>
            </div>

            {/* Pestañas de Selección de Aspecto */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#050b18] border border-[#5b9bd5]/20 text-xs">
              <button
                type="button"
                onClick={() => setAspectoCircadiano('trabajo')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  aspectoCircadiano === 'trabajo'
                    ? 'bg-[#1e3a8a] text-white shadow-md border border-[#60a5fa]/60'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🧠</span>
                <span>Trabajo</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-[#93c5fd]">
                  {horasHoy.toFixed(1)}h
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAspectoCircadiano('sueno')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  aspectoCircadiano === 'sueno'
                    ? 'bg-[#4c1d95] text-white shadow-md border border-[#a78bfa]/60'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🌙</span>
                <span>Sueño</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-[#c084fc]">
                  {horasSuenoHoy.toFixed(1)}h
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAspectoCircadiano('alimentacion')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  aspectoCircadiano === 'alimentacion'
                    ? 'bg-[#064e3b] text-white shadow-md border border-[#34d399]/60'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🥗</span>
                <span>Comida</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-[#6ee7b7]">
                  {totalComidasHoy}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAspectoCircadiano('ejercicio')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  aspectoCircadiano === 'ejercicio'
                    ? 'bg-[#78350f] text-white shadow-md border border-[#fb923c]/60'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🏃</span>
                <span>Ejercicio</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-[#fed7aa]">
                  {ejercicioHoy.toFixed(1)}h
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAspectoCircadiano('comparativa')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  aspectoCircadiano === 'comparativa'
                    ? 'bg-[#1e293b] text-[#eed59b] shadow-md border border-[#eed59b]/60'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                }`}
                title="Ver las 4 dimensiones apiladas en simultáneo"
              >
                <span>📊</span>
                <span className="hidden sm:inline">4 en Paralelo</span>
              </button>
            </div>
          </div>

          {/* VISTA INDIVIDUAL DE CADA ASPECTO */}
          {aspectoCircadiano !== 'comparativa' && (
            <div className="relative w-full overflow-hidden select-none">
              <svg
                viewBox={`0 0 ${activeMountain.width} ${activeMountain.height}`}
                className="w-full h-36 sm:h-48 overflow-visible cursor-crosshair"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={() => setHoveredSlotHora(null)}
              >
                <defs>
                  <linearGradient id={activeConfig.gradienteId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeConfig.fillStart} stopOpacity="0.45" />
                    <stop offset="60%" stopColor={activeConfig.fillMid} stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#070e1e" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id={activeConfig.strokeId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={activeConfig.strokeStart} />
                    <stop offset="50%" stopColor={activeConfig.strokeMid} />
                    <stop offset="100%" stopColor={activeConfig.strokeEnd} />
                  </linearGradient>
                </defs>

                {/* Guías horizontales limpias (sin cortes) */}
                <line
                  x1="0"
                  y1={activeMountain.baselineY}
                  x2={activeMountain.width}
                  y2={activeMountain.baselineY}
                  stroke="#152642"
                  strokeWidth="1.5"
                />
                <line
                  x1="0"
                  y1={activeMountain.baselineY - 55}
                  x2={activeMountain.width}
                  y2={activeMountain.baselineY - 55}
                  stroke="#19336e"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                  opacity="0.45"
                />

                {/* Área de la Montaña (solo cuando hay datos) */}
                {activeConfig.hasData && (
                  <path
                    d={activeMountain.areaPath}
                    fill={`url(#${activeConfig.gradienteId})`}
                    className="transition-all duration-500"
                  />
                )}

                {/* Línea Continua de Cresta */}
                <path
                  d={activeMountain.linePath}
                  fill="none"
                  stroke={activeConfig.hasData ? `url(#${activeConfig.strokeId})` : '#19336e'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />

                {/* Puntos de Cima: Únicamente donde hay actividad real > 0 */}
                {activeMountain.points
                  .filter((pt) => pt.value > 0)
                  .map((pt) => {
                    const isHovered = hoveredSlotHora === pt.slot.hora;
                    const isSelected = selectedHora === pt.slot.hora;
                    return (
                      <circle
                        key={pt.slot.hora}
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered || isSelected ? 5.5 : 3.5}
                        fill={activeConfig.colorPrincipal}
                        stroke="#ffffff"
                        strokeWidth={isHovered || isSelected ? 2 : 1.5}
                        className="cursor-pointer transition-all duration-150"
                        onClick={() => setSelectedHora(pt.slot.hora)}
                      />
                    );
                  })}

                {/* Marcador del Tiempo Real (Hora Actual) */}
                {activeMountain.points
                  .filter((pt) => pt.slot.esHoraActual)
                  .map((pt) => (
                    <g key="live-beacon">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="8"
                        fill="none"
                        stroke="#eed59b"
                        strokeWidth="1.5"
                        className="animate-ping opacity-75"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill="#eed59b"
                        stroke="#070e1e"
                        strokeWidth="1.5"
                      />
                    </g>
                  ))}

                {/* Línea Guía Láser de Hover y Nodo Activo */}
                {hoveredSlotHora !== null && activeMountain.points[hoveredSlotHora] && (
                  <g key="hover-guide">
                    <line
                      x1={activeMountain.points[hoveredSlotHora].x}
                      y1={activeMountain.topY}
                      x2={activeMountain.points[hoveredSlotHora].x}
                      y2={activeMountain.baselineY}
                      stroke={activeConfig.colorPrincipal}
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                      opacity="0.8"
                    />
                    <circle
                      cx={activeMountain.points[hoveredSlotHora].x}
                      cy={activeMountain.points[hoveredSlotHora].y}
                      r="6"
                      fill="#ffffff"
                      stroke={activeConfig.colorPrincipal}
                      strokeWidth="2.5"
                    />
                  </g>
                )}
              </svg>

              {/* Tooltip Flotante Informativo para el aspecto activo */}
              {hoveredSlotHora !== null && activeMountain.points[hoveredSlotHora] && (
                <div
                  className="absolute z-30 pointer-events-none transition-all duration-150 ease-out p-3.5 rounded-xl bg-[#060c1d]/95 backdrop-blur-md border border-[#5b9bd5]/40 shadow-2xl text-xs w-72 space-y-2"
                  style={{
                    left: `${Math.min(78, Math.max(22, (activeMountain.points[hoveredSlotHora].x / activeMountain.width) * 100))}%`,
                    top: '12px',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#5b9bd5]/20">
                    <div className="flex items-center gap-1.5 font-medium text-white">
                      <span className="text-sm">{activeConfig.icono}</span>
                      <span className="font-serif font-bold">{activeConfig.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-[#eed59b] bg-[#1e293b]/90 px-2 py-0.5 rounded border border-[#5b9bd5]/20 font-semibold">
                        {activeMountain.points[hoveredSlotHora].slot.rangoLabel}
                      </span>
                      {activeMountain.points[hoveredSlotHora].slot.esHoraActual && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold tracking-wider">
                          AHORA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalle específico de este aspecto en esta hora */}
                  {aspectoCircadiano === 'trabajo' && (
                    <div className="space-y-1.5">
                      {activeMountain.points[hoveredSlotHora].slot.minutosFoco > 0 ? (
                        <>
                          <div className="flex items-baseline justify-between">
                            <span className="text-base font-serif font-bold text-white">
                              {activeMountain.points[hoveredSlotHora].slot.minutosFoco} min
                            </span>
                            <span className="text-[10px] text-[#93c5fd]">
                              Intensidad {activeMountain.points[hoveredSlotHora].slot.intensidadPredominante || 'Normal'}
                            </span>
                          </div>
                          {activeMountain.points[hoveredSlotHora].slot.sesiones.map((s, idx) => (
                            <div key={idx} className="p-1.5 rounded bg-[#0b1633] border border-[#5b9bd5]/20 text-[11px] space-y-0.5">
                              <p className="font-medium text-white truncate">{s.sesion.tipo}</p>
                              {s.sesion.calidad && (
                                <p className="text-[10px] text-[#eed59b] truncate">Detalle: {s.sesion.calidad}</p>
                              )}
                            </div>
                          ))}
                          <div className="pt-1 flex items-center justify-between text-[10px] text-[#94a3b8] border-t border-white/5">
                            <span>Progreso diario:</span>
                            <span className="text-[#eed59b] font-medium font-mono">
                              {horasHoy.toFixed(1)}h / 3.0h meta ({Math.min(100, Math.round((horasHoy / 3) * 100))}%)
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-1 text-[#94a3b8] italic text-[11px]">
                          Sin sesiones de trabajo en esta franja horaria.
                        </div>
                      )}
                    </div>
                  )}

                  {aspectoCircadiano === 'sueno' && (
                    <div className="space-y-1.5">
                      {activeMountain.points[hoveredSlotHora].slot.minutosSueno > 0 ? (
                        <>
                          <div className="flex items-baseline justify-between">
                            <span className="text-base font-serif font-bold text-white">
                              {activeMountain.points[hoveredSlotHora].slot.minutosSueno} min
                            </span>
                            <span className="text-[10px] text-[#c084fc]">Periodo de sueño</span>
                          </div>
                          {activeMountain.points[hoveredSlotHora].slot.suenos.map((sn, idx) => (
                            <div key={idx} className="p-1.5 rounded bg-[#1a1033] border border-[#8b5cf6]/25 text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#c084fc] font-medium">{sn.sueno.hora_inicio} — {sn.sueno.hora_fin}</span>
                                <span className="text-white font-bold">{sn.sueno.horas}h totales</span>
                              </div>
                              <p className="text-white font-medium">Calidad: {sn.sueno.calidad_sueno}</p>
                              {sn.sueno.sensacion && (
                                <p className="text-[10px] text-[#94a3b8]">Sensación: {sn.sueno.sensacion}</p>
                              )}
                              {sn.sueno.notas && <p className="text-[10px] text-[#eed59b] italic">"{sn.sueno.notas}"</p>}
                            </div>
                          ))}
                          <div className="pt-1 flex items-center justify-between text-[10px] text-[#94a3b8] border-t border-white/5">
                            <span>Total dormido hoy:</span>
                            <span className="text-[#c084fc] font-medium font-mono">
                              {horasSuenoHoy.toFixed(1)}h / 8.0h ideal
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-1 text-[#94a3b8] italic text-[11px]">
                          Periodo de vigilia (sin sueño registrado).
                        </div>
                      )}
                    </div>
                  )}

                  {aspectoCircadiano === 'alimentacion' && (
                    <div className="space-y-1.5">
                      {activeMountain.points[hoveredSlotHora].slot.comidas.length > 0 ? (
                        <>
                          <div className="flex items-baseline justify-between">
                            <span className="text-base font-serif font-bold text-white">
                              {activeMountain.points[hoveredSlotHora].slot.comidas.length} comida(s)
                            </span>
                            <span className="text-[10px] text-[#34d399]">Ventana de nutrición</span>
                          </div>
                          {activeMountain.points[hoveredSlotHora].slot.comidas.map((c, idx) => (
                            <div key={idx} className="p-1.5 rounded bg-[#072418] border border-[#10b981]/30 text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#34d399] font-bold">{c.tipo_comida} ({c.hora})</span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${c.calidad.includes('Limpio') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                  {c.calidad}
                                </span>
                              </div>
                              <p className="text-white font-medium">{c.descripcion || 'Comida registrada'}</p>
                            </div>
                          ))}
                          <div className="pt-1 flex items-center justify-between text-[10px] text-[#94a3b8] border-t border-white/5">
                            <span>Balance del día:</span>
                            <span className="text-[#34d399] font-medium font-mono">
                              {comidasLimpiasHoy}/{totalComidasHoy} limpias
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-1 text-[#94a3b8] italic text-[11px]">
                          Ventana de digestión / ayuno en este bloque.
                        </div>
                      )}
                    </div>
                  )}

                  {aspectoCircadiano === 'ejercicio' && (
                    <div className="space-y-1.5">
                      {activeMountain.points[hoveredSlotHora].slot.minutosEjercicio > 0 ? (
                        <>
                          <div className="flex items-baseline justify-between">
                            <span className="text-base font-serif font-bold text-white">
                              {activeMountain.points[hoveredSlotHora].slot.minutosEjercicio} min
                            </span>
                            <span className="text-[10px] text-[#fb923c]">Actividad Física</span>
                          </div>
                          {activeMountain.points[hoveredSlotHora].slot.ejercicios.map((e, idx) => (
                            <div key={idx} className="p-1.5 rounded bg-[#2b1406] border border-[#f59e0b]/30 text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#fb923c] font-bold">{e.ejercicio.tipo_ejercicio}</span>
                                <span className="text-white font-bold">{e.ejercicio.duracion_horas}h ({e.ejercicio.intensidad})</span>
                              </div>
                              <p className="text-white font-medium">{e.ejercicio.descripcion || 'Entrenamiento ejecutado'}</p>
                            </div>
                          ))}
                          <div className="pt-1 flex items-center justify-between text-[10px] text-[#94a3b8] border-t border-white/5">
                            <span>Total entrenado hoy:</span>
                            <span className="text-[#fb923c] font-medium font-mono">
                              {ejercicioHoy.toFixed(1)}h / 0.75h meta
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-1 text-[#94a3b8] italic text-[11px]">
                          Sin actividad deportiva en este intervalo.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VISTA COMPARATIVA: 4 PISTAS SINCRONIZADAS EN PARALELO */}
          {aspectoCircadiano === 'comparativa' && (
            <div
              className="space-y-2 relative select-none"
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => setHoveredSlotHora(null)}
            >
              {/* Pista 1: Trabajo Profundo */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-[#061026]/70 border border-[#3b82f6]/25">
                <div className="w-24 sm:w-28 shrink-0 text-left">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#60a5fa]">
                    <span>🧠</span>
                    <span>Trabajo</span>
                  </div>
                  <p className="text-xs font-serif font-bold text-white tabular-nums">{horasHoy.toFixed(1)}h / 3h</p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <svg viewBox="0 0 900 48" className="w-full h-10 overflow-visible">
                    <line x1="0" y1="42" x2="900" y2="42" stroke="#172554" strokeWidth="1" />
                    {horasHoy > 0 && (
                      <path d={miniMountainTrabajo.areaPath} fill="#3b82f6" fillOpacity="0.3" />
                    )}
                    <path d={miniMountainTrabajo.linePath} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
                    {hoveredSlotHora !== null && miniMountainTrabajo.points[hoveredSlotHora] && (
                      <circle cx={miniMountainTrabajo.points[hoveredSlotHora].x} cy={miniMountainTrabajo.points[hoveredSlotHora].y} r="4" fill="#ffffff" stroke="#60a5fa" strokeWidth="2" />
                    )}
                  </svg>
                </div>
              </div>

              {/* Pista 2: Sueño */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-[#140b29]/70 border border-[#8b5cf6]/25">
                <div className="w-24 sm:w-28 shrink-0 text-left">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#a78bfa]">
                    <span>🌙</span>
                    <span>Sueño</span>
                  </div>
                  <p className="text-xs font-serif font-bold text-white tabular-nums">{horasSuenoHoy.toFixed(1)}h / 8h</p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <svg viewBox="0 0 900 48" className="w-full h-10 overflow-visible">
                    <line x1="0" y1="42" x2="900" y2="42" stroke="#2e1065" strokeWidth="1" />
                    {horasSuenoHoy > 0 && (
                      <path d={miniMountainSueno.areaPath} fill="#8b5cf6" fillOpacity="0.3" />
                    )}
                    <path d={miniMountainSueno.linePath} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
                    {hoveredSlotHora !== null && miniMountainSueno.points[hoveredSlotHora] && (
                      <circle cx={miniMountainSueno.points[hoveredSlotHora].x} cy={miniMountainSueno.points[hoveredSlotHora].y} r="4" fill="#ffffff" stroke="#a78bfa" strokeWidth="2" />
                    )}
                  </svg>
                </div>
              </div>

              {/* Pista 3: Comida */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-[#051c14]/70 border border-[#10b981]/25">
                <div className="w-24 sm:w-28 shrink-0 text-left">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#34d399]">
                    <span>🥗</span>
                    <span>Comida</span>
                  </div>
                  <p className="text-xs font-serif font-bold text-white tabular-nums">{totalComidasHoy} comidas</p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <svg viewBox="0 0 900 48" className="w-full h-10 overflow-visible">
                    <line x1="0" y1="42" x2="900" y2="42" stroke="#064e3b" strokeWidth="1" />
                    {totalComidasHoy > 0 && (
                      <path d={miniMountainComida.areaPath} fill="#10b981" fillOpacity="0.3" />
                    )}
                    <path d={miniMountainComida.linePath} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
                    {hoveredSlotHora !== null && miniMountainComida.points[hoveredSlotHora] && (
                      <circle cx={miniMountainComida.points[hoveredSlotHora].x} cy={miniMountainComida.points[hoveredSlotHora].y} r="4" fill="#ffffff" stroke="#34d399" strokeWidth="2" />
                    )}
                  </svg>
                </div>
              </div>

              {/* Pista 4: Ejercicio */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-[#241105]/70 border border-[#f59e0b]/25">
                <div className="w-24 sm:w-28 shrink-0 text-left">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#fb923c]">
                    <span>🏃</span>
                    <span>Ejercicio</span>
                  </div>
                  <p className="text-xs font-serif font-bold text-white tabular-nums">{ejercicioHoy.toFixed(1)}h / 0.75h</p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <svg viewBox="0 0 900 48" className="w-full h-10 overflow-visible">
                    <line x1="0" y1="42" x2="900" y2="42" stroke="#451a03" strokeWidth="1" />
                    {ejercicioHoy > 0 && (
                      <path d={miniMountainEjercicio.areaPath} fill="#f59e0b" fillOpacity="0.3" />
                    )}
                    <path d={miniMountainEjercicio.linePath} fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" />
                    {hoveredSlotHora !== null && miniMountainEjercicio.points[hoveredSlotHora] && (
                      <circle cx={miniMountainEjercicio.points[hoveredSlotHora].x} cy={miniMountainEjercicio.points[hoveredSlotHora].y} r="4" fill="#ffffff" stroke="#fb923c" strokeWidth="2" />
                    )}
                  </svg>
                </div>
              </div>

              {/* Eje de Horas Compartido */}
              <div className="flex justify-between text-[10px] text-[#94a3b8] font-mono px-3 pt-1 border-t border-white/10">
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>23:59</span>
              </div>

              {/* Tooltip Multidimensional en modo Comparativa */}
              {hoveredSlotHora !== null && horasSlotsHoy[hoveredSlotHora] && (
                <div
                  className="absolute z-30 pointer-events-none p-3 rounded-xl bg-[#060c1d]/95 backdrop-blur-md border border-[#eed59b]/40 shadow-2xl text-xs w-72 space-y-1.5"
                  style={{
                    left: `${Math.min(75, Math.max(25, (miniMountainTrabajo.points[hoveredSlotHora].x / miniMountainTrabajo.width) * 100))}%`,
                    top: '20px',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="flex items-center justify-between pb-1 border-b border-white/10 text-white font-serif font-bold">
                    <span>{horasSlotsHoy[hoveredSlotHora].rangoLabel}</span>
                    {horasSlotsHoy[hoveredSlotHora].esHoraActual && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">AHORA</span>
                    )}
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-[#93c5fd]">
                      <span>🧠 Foco Mental:</span>
                      <span className="font-bold text-white font-mono">{horasSlotsHoy[hoveredSlotHora].minutosFoco} min</span>
                    </div>
                    <div className="flex items-center justify-between text-[#c084fc]">
                      <span>🌙 Sueño:</span>
                      <span className="font-bold text-white font-mono">{horasSlotsHoy[hoveredSlotHora].minutosSueno} min</span>
                    </div>
                    <div className="flex items-center justify-between text-[#6ee7b7]">
                      <span>🥗 Comidas:</span>
                      <span className="font-bold text-white">
                        {horasSlotsHoy[hoveredSlotHora].comidas.length > 0
                          ? horasSlotsHoy[hoveredSlotHora].comidas.map((c) => c.tipo_comida).join(', ')
                          : 'Ninguna'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#fed7aa]">
                      <span>🏃 Ejercicio:</span>
                      <span className="font-bold text-white font-mono">{horasSlotsHoy[hoveredSlotHora].minutosEjercicio} min</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* HUD DE LOS 4 PILARES INTEGRALES DEL DÍA (INTERACTIVOS PARA SELECCIONAR ASPECTO) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Pilar 1: Foco Mental */}
          <div
            onClick={() => setAspectoCircadiano('trabajo')}
            className={`card-elevated p-4 border space-y-1 relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01] ${
              aspectoCircadiano === 'trabajo'
                ? 'border-[#60a5fa] ring-1 ring-[#60a5fa]/50 shadow-lg bg-[#0d1c3a]/70'
                : 'border-[#5b9bd5]/25 hover:border-[#60a5fa]/40'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-[#94a3b8]">
              <span>TRABAJO PROFUNDO</span>
              <span className="text-[#60a5fa]">🧠</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-serif font-bold text-white tabular-nums">
                {horasHoy.toFixed(1)}
              </span>
              <span className="text-xs text-[#94a3b8]">/ 3.0h meta</span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {horasHoy > 0
                ? `${pctExigenteHoy}% en alta o media incomodidad`
                : 'Sin sesiones de foco hoy'}
            </p>
          </div>

          {/* Pilar 2: Ejercicio Físico */}
          <div
            onClick={() => setAspectoCircadiano('ejercicio')}
            className={`card-elevated p-4 border space-y-1 relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01] ${
              aspectoCircadiano === 'ejercicio'
                ? 'border-[#fb923c] ring-1 ring-[#fb923c]/50 shadow-lg bg-[#271507]/70'
                : 'border-[#f59e0b]/25 hover:border-[#fb923c]/40'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-[#94a3b8]">
              <span>EJERCICIO FÍSICO</span>
              <span className="text-[#f59e0b]">🏃</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-serif font-bold text-white tabular-nums">
                {ejercicioHoy.toFixed(1)}
              </span>
              <span className="text-xs text-[#94a3b8]">/ 0.75h meta</span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
                ? '✓ Exigencia física cumplida'
                : deficitEjercicioHoy > 0
                ? `Resta ${deficitEjercicioHoy.toFixed(1)}h de actividad`
                : 'Sin entrenamiento hoy'}
            </p>
          </div>

          {/* Pilar 3: Sueño y Recuperación */}
          <div
            onClick={() => setAspectoCircadiano('sueno')}
            className={`card-elevated p-4 border space-y-1 relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01] ${
              aspectoCircadiano === 'sueno'
                ? 'border-[#a78bfa] ring-1 ring-[#a78bfa]/50 shadow-lg bg-[#1a0f30]/70'
                : 'border-[#818cf8]/25 hover:border-[#a78bfa]/40'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-[#94a3b8]">
              <span>SUEÑO &amp; DESCANSO</span>
              <span className="text-[#818cf8]">🌙</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-serif font-bold text-white tabular-nums">
                {horasSuenoHoy > 0 ? horasSuenoHoy.toFixed(1) : '--'}
              </span>
              <span className="text-xs text-[#94a3b8]">/ 8.0h ideal</span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {suenosHoy && suenosHoy.length > 0
                ? `Calidad: ${suenosHoy[0].calidad_sueno}`
                : 'Pendiente registro de sueño'}
            </p>
          </div>

          {/* Pilar 4: Alimentación */}
          <div
            onClick={() => setAspectoCircadiano('alimentacion')}
            className={`card-elevated p-4 border space-y-1 relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01] ${
              aspectoCircadiano === 'alimentacion'
                ? 'border-[#34d399] ring-1 ring-[#34d399]/50 shadow-lg bg-[#072418]/70'
                : 'border-[#10b981]/25 hover:border-[#34d399]/40'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-[#94a3b8]">
              <span>ALIMENTACIÓN</span>
              <span className="text-[#10b981]">🥗</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-serif font-bold text-white tabular-nums">
                {totalComidasHoy}
              </span>
              <span className="text-xs text-[#94a3b8]">{totalComidasHoy === 1 ? 'comida' : 'comidas'}</span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {totalComidasHoy > 0
                ? `${comidasLimpiasHoy} de ${totalComidasHoy} comidas limpias`
                : 'Sin ingestas registradas hoy'}
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECCIÓN FORMAL: PLAN DE VUELO & TAREAS DE LA JORNADA     */}
      {/* (Tareas que tengo, las que debo cumplir y las ya cumplidas) */}
      {/* ========================================================= */}
      <section className="card-midnight p-5 sm:p-7 border border-[#5b9bd5]/25 shadow-midnight space-y-5 rounded-2xl relative">
        {/* Toast Local de Tareas */}
        {visualTaskFeedback && (
          <div className="absolute top-4 right-4 z-30 px-3.5 py-1.5 rounded-full bg-[#064e3b] text-emerald-200 border border-[#10b981]/40 text-xs font-medium shadow-lg animate-fade-in flex items-center gap-1.5">
            <span>✓</span>
            <span>{visualTaskFeedback}</span>
          </div>
        )}

        {/* Cabecera y Resumen */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#5b9bd5]/15">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                Plan de Vuelo • Jornada Activa
              </span>
              <span className="text-xs text-[#eed59b] font-serif font-medium">
                Control de Tareas y Objetivos
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide flex items-center gap-2">
              <span>📋</span>
              <span>Tareas de Hoy: Por Cumplir y Cumplidas</span>
            </h3>
            <p className="text-xs text-[#94a3b8] max-w-2xl">
              Revisa los compromisos de tu jornada. Marca tus tareas con un clic para registrar su cumplimiento en tiempo real.
            </p>
          </div>

          {/* Acciones de Cabecera */}
          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            {onGoToTasks && (
              <button
                type="button"
                onClick={onGoToTasks}
                className="btn-formal-outline px-3.5 py-2 rounded-full text-xs font-medium flex items-center gap-1.5"
                title="Ver módulo completo de tareas para hoy y mañana"
              >
                <span>📋</span>
                <span className="hidden sm:inline">Gestionar Plan</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsQuickCreateTaskOpen(true)}
              className="btn-formal px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md"
            >
              <span>+</span>
              <span>Agregar Tarea</span>
            </button>
          </div>
        </div>

        {/* HUD de Cumplimiento de Tareas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#070e1e]/80 border border-[#5b9bd5]/20 space-y-0.5">
            <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-medium">Total Programadas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-serif font-bold text-white tabular-nums">{totalTareasCount}</span>
              <span className="text-[10px] text-[#94a3b8]">bloques</span>
            </div>
            <span className="text-[10px] text-[#eed59b] font-mono block">
              {horasTareasPlanificadas.toFixed(1)}h estimadas
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#06241a]/80 border border-[#10b981]/30 space-y-0.5">
            <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-medium">Ya Cumplidas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-serif font-bold text-emerald-200 tabular-nums">{cumplidasList.length}</span>
              <span className="text-[10px] text-emerald-400 font-mono">({pctTareasCumplidas}%)</span>
            </div>
            <span className="text-[10px] text-emerald-400/80 font-mono block">
              {horasTareasCumplidas.toFixed(1)}h logradas
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b1633]/80 border border-[#3b82f6]/30 space-y-0.5">
            <span className="text-[10px] text-[#93c5fd] uppercase tracking-wider font-medium">Por Cumplir</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-serif font-bold text-[#93c5fd] tabular-nums">{porCumplirList.length}</span>
              <span className="text-[10px] text-[#94a3b8]">pendientes</span>
            </div>
            <span className="text-[10px] text-[#93c5fd]/80 font-mono block">
              {horasTareasPorCumplir.toFixed(1)}h restantes
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1733]/80 border border-[#e5c179]/30 space-y-1.5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-[#eed59b] font-medium">
              <span>Cumplimiento</span>
              <span className="font-mono font-bold">{pctTareasCumplidas}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#070e1e] overflow-hidden border border-[#5b9bd5]/20 p-0.5">
              <div
                style={{ width: `${pctTareasCumplidas}%` }}
                className="h-full bg-gradient-to-r from-[#2563eb] to-[#10b981] rounded-full transition-all duration-500"
              ></div>
            </div>
            <span className="text-[9px] text-[#94a3b8] italic">
              {pctTareasCumplidas === 100
                ? '✓ 100% de la agenda conquistada'
                : porCumplirList.length > 0
                ? `${porCumplirList.length} objetivos por concretar`
                : 'Sin tareas pendientes'}
            </span>
          </div>
        </div>

        {/* Selector de Pestañas de Visualización */}
        {totalTareasCount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#5b9bd5]/15 flex-wrap">
            <span className="text-[11px] font-sans text-[#94a3b8] uppercase tracking-wider font-semibold mr-1">
              Mostrar:
            </span>
            <button
              type="button"
              onClick={() => setFiltroTareasVisual('todas')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                filtroTareasVisual === 'todas'
                  ? 'bg-[#1e3a8a] text-white border border-[#60a5fa]/50 shadow-sm'
                  : 'bg-[#0d1733] text-[#94a3b8] border border-[#5b9bd5]/20 hover:text-white'
              }`}
            >
              <span>📋 Todas las Tareas</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-white">
                {totalTareasCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTareasVisual('por_cumplir')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                filtroTareasVisual === 'por_cumplir'
                  ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/60 shadow-sm ring-1 ring-blue-400/40'
                  : 'bg-[#0d1733] text-[#93c5fd] border border-blue-500/30 hover:bg-[#1e3a8a]/40'
              }`}
            >
              <span>⏳ Por Cumplir</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-blue-900/50 text-[#93c5fd]">
                {porCumplirList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTareasVisual('cumplidas')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                filtroTareasVisual === 'cumplidas'
                  ? 'bg-[#064e3b] text-emerald-100 border border-emerald-400 shadow-sm ring-1 ring-emerald-400/40'
                  : 'bg-[#06241a] text-emerald-300 border border-emerald-500/30 hover:bg-[#064e3b]/40'
              }`}
            >
              <span>✅ Ya Cumplidas</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300">
                {cumplidasList.length}
              </span>
            </button>
          </div>
        )}

        {/* Listado de Tareas */}
        <div className="space-y-3 pt-1">
          {totalTareasCount === 0 ? (
            <div className="p-8 sm:p-10 rounded-2xl bg-[#070e1e]/60 border border-dashed border-[#5b9bd5]/25 text-center space-y-3">
              <span className="text-3xl">📋</span>
              <div className="space-y-1">
                <p className="text-sm font-serif font-bold text-white">
                  No hay tareas programadas para la jornada de hoy
                </p>
                <p className="text-xs text-[#94a3b8] max-w-md mx-auto">
                  Si no alcanzaste a registrar tu plan en el ritual nocturno de ayer, puedes definir ahora mismo tus tareas clave para enfocar tu trabajo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickCreateTaskOpen(true)}
                className="btn-formal px-5 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shadow-md"
              >
                <span>+</span>
                <span>Programar Primera Tarea de Hoy</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* VISTA 1: SOLO POR CUMPLIR */}
              {filtroTareasVisual === 'por_cumplir' && (
                porCumplirList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#94a3b8] bg-[#070e1e]/60 rounded-xl border border-dashed border-emerald-500/30 space-y-1">
                    <p className="font-serif font-bold text-emerald-300 text-sm">🎉 ¡Extraordinario! No tienes tareas pendientes</p>
                    <p>Has cumplido todos los objetivos planificados para la jornada de hoy.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="px-1 text-xs font-serif font-bold text-[#93c5fd] uppercase tracking-wider flex items-center gap-1.5">
                      <span>⏳</span> Tareas Que Debes Cumplir ({porCumplirList.length})
                    </div>
                    {porCumplirList.map((tarea) => renderVisualTaskCard(tarea))}
                  </div>
                )
              )}

              {/* VISTA 2: SOLO YA CUMPLIDAS */}
              {filtroTareasVisual === 'cumplidas' && (
                cumplidasList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#94a3b8] bg-[#070e1e]/60 rounded-xl border border-dashed border-[#5b9bd5]/20 space-y-1">
                    <p className="font-serif font-bold text-white text-sm">Aún no has marcado tareas como cumplidas hoy</p>
                    <p>Ejecuta tu bloque de trabajo y pulsa el recuadro para marcarla completada.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="px-1 text-xs font-serif font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>✅</span> Tareas Ya Cumplidas ({cumplidasList.length})
                    </div>
                    {cumplidasList.map((tarea) => renderVisualTaskCard(tarea))}
                  </div>
                )
              )}

              {/* VISTA 3: TODAS (DIVISIÓN LIMPIA DE POR CUMPLIR VS YA CUMPLIDAS) */}
              {filtroTareasVisual === 'todas' && (
                <div className="space-y-5">
                  {/* Bloque: Las que debo cumplir */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-serif font-bold text-[#eed59b] uppercase tracking-wider flex items-center gap-1.5">
                        <span>⏳</span> Tareas Que Debes Cumplir ({porCumplirList.length})
                      </span>
                      <span className="text-[11px] text-[#94a3b8]">
                        {horasTareasPorCumplir.toFixed(1)}h netas pendientes
                      </span>
                    </div>
                    {porCumplirList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-emerald-300 bg-[#06241a]/40 rounded-xl border border-emerald-500/25">
                        ✓ Todas las tareas de hoy han sido completadas.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {porCumplirList.map((tarea) => renderVisualTaskCard(tarea))}
                      </div>
                    )}
                  </div>

                  {/* Bloque: Las ya cumplidas */}
                  <div className="space-y-2.5 pt-3 border-t border-[#5b9bd5]/15">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-serif font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>✅</span> Tareas Ya Cumplidas ({cumplidasList.length})
                      </span>
                      <span className="text-[11px] text-emerald-400 font-mono">
                        {horasTareasCumplidas.toFixed(1)}h logradas ({pctTareasCumplidas}%)
                      </span>
                    </div>
                    {cumplidasList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#94a3b8] bg-[#070e1e]/40 rounded-xl border border-dashed border-[#5b9bd5]/20">
                        Aún no has marcado tareas completadas hoy.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cumplidasList.map((tarea) => renderVisualTaskCard(tarea))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. GRID ASIMÉTRICO: COLUMNA CRONOGRAMA 24H (65%) + COLUMNA EXIGENCIA (35%) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA PRINCIPAL (65% -> col-span-8): CRONOGRAMA 24H & MATRIZ 2D */}
        <div className="lg:col-span-8 space-y-6">
          {/* CRONOGRAMA DE 24 RANURAS HORARIAS */}
          <section className="card-midnight p-5 sm:p-6 space-y-5 border border-[#5b9bd5]/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#5b9bd5]/15">
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide flex items-center gap-2">
                  <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                    24 Horas
                  </span>
                  Distribución Horaria del Día (00:00 — 23:59)
                </h3>
                <p className="text-xs text-[#94a3b8]">
                  Selecciona cualquier franja para revisar las sesiones ejecutadas y su nivel de concentración.
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <span className="tag-formal px-3 py-1 rounded-full bg-[#0d1733] text-[#f8fafc] border border-[#5b9bd5]/25">
                  Activas: <strong className="text-[#eed59b] font-mono">{horasConFocoCount}</strong> / 24h
                </span>
                <span className="tag-formal px-3 py-1 rounded-full bg-[#1e3a8a]/50 text-[#93c5fd] border border-[#60a5fa]/30">
                  Ahora: <strong className="font-mono">{String(horaActual).padStart(2, '0')}:00</strong>
                </span>
              </div>
            </div>

            {/* Pista de las 24 Columnas */}
            <div className="overflow-x-auto pb-2 pt-1">
              <div className="min-w-[620px]">
                <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-32 border-b border-[#5b9bd5]/20 px-1">
                  {horasSlotsHoy.map((slot) => {
                    const isSelected = (selectedHora !== null ? selectedHora : horaActual) === slot.hora;
                    const hasWork = slot.minutosFoco > 0;
                    const hasExercise = slot.ejercicios && slot.ejercicios.length > 0;
                    const hasFood = slot.comidas && slot.comidas.length > 0;
                    const hasSleep = slot.suenos && slot.suenos.length > 0;
                    const hasAnyActivity = hasWork || hasExercise || hasFood || hasSleep;

                    // Icono / Marcador Superior
                    let topElement = null;
                    if (hasWork) {
                      if (slot.incomodidadPredominante === 'Alta' && slot.intensidadPredominante === 'Alta') {
                        topElement = (
                          <span className="text-[10px] animate-pulse" title="⚡ Máxima Fricción e Intensidad">
                            ⚡
                          </span>
                        );
                      } else if (slot.incomodidadPredominante === 'Alta') {
                        topElement = (
                          <span
                            className="w-2 h-2 rounded-full bg-[#eed59b] shadow-[0_0_6px_#eed59b]"
                            title="Incomodidad Alta"
                          />
                        );
                      } else if (slot.incomodidadPredominante === 'Media') {
                        topElement = (
                          <span className="w-2 h-2 rounded-full bg-[#60a5fa]" title="Incomodidad Media" />
                        );
                      } else {
                        topElement = <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />;
                      }
                    } else if (hasExercise) {
                      topElement = (
                        <span className="text-[10px]" title="🏃 Ejercicio Físico">
                          🏃
                        </span>
                      );
                    } else if (hasFood) {
                      topElement = (
                        <span className="text-[10px]" title="🥗 Comida">
                          🥗
                        </span>
                      );
                    } else if (hasSleep) {
                      topElement = (
                        <span className="text-[10px]" title="🌙 Sueño">
                          🌙
                        </span>
                      );
                    } else {
                      topElement = <span className="w-1 h-1 rounded-full bg-white/10" />;
                    }

                    // Altura y Color de la Barra según Actividad
                    let fillPercent = 0;
                    let barColor = 'bg-[#11224d]';

                    if (hasWork) {
                      fillPercent = Math.max(20, Math.round((slot.minutosFoco / 60) * 100));
                      if (slot.incomodidadPredominante === 'Alta' && slot.intensidadPredominante === 'Alta') {
                        barColor =
                          'bg-gradient-to-t from-[#1d4ed8] via-[#2563eb] to-[#eed59b] border border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.5)]';
                      } else if (slot.incomodidadPredominante === 'Alta') {
                        barColor =
                          'bg-gradient-to-t from-[#1e3a8a] to-[#60a5fa] border border-[#eed59b]/50 shadow-[0_0_8px_rgba(238,213,155,0.3)]';
                      } else if (slot.intensidadPredominante === 'Alta') {
                        barColor =
                          'bg-gradient-to-t from-[#2563eb] to-[#60a5fa] shadow-[0_0_10px_rgba(96,165,250,0.35)]';
                      } else if (slot.intensidadPredominante === 'Media') {
                        barColor = 'bg-gradient-to-t from-[#1e3a8a] to-[#3b82f6]';
                      } else {
                        barColor = 'bg-[#19336e]';
                      }
                    } else if (hasExercise) {
                      fillPercent = 80;
                      barColor =
                        'bg-gradient-to-t from-[#c2410c] to-[#f59e0b] border border-[#f97316]/50 shadow-[0_0_8px_rgba(249,115,22,0.4)]';
                    } else if (hasSleep) {
                      fillPercent = 55;
                      barColor =
                        'bg-gradient-to-t from-[#3730a3] to-[#818cf8] border border-[#6366f1]/40';
                    } else if (hasFood) {
                      fillPercent = 35;
                      barColor =
                        'bg-gradient-to-t from-[#065f46] to-[#10b981] border border-[#34d399]/40';
                    }

                    return (
                      <div
                        key={slot.hora}
                        onClick={() => setSelectedHora(slot.hora)}
                        className={`flex-1 flex flex-col items-center justify-end h-full cursor-pointer group transition-all relative ${
                          slot.esHoraActual ? 'z-10' : ''
                        }`}
                        title={`${slot.rangoLabel}: ${slot.minutosFoco} min foco`}
                      >
                        {slot.esHoraActual && (
                          <span className="tag-formal absolute -top-6 text-[8px] px-1.5 py-0.5 rounded-full bg-[#eed59b] text-[#070e1e] border-none whitespace-nowrap font-bold shadow-sm">
                            AHORA
                          </span>
                        )}

                        <div className="h-3 flex items-center justify-center mb-1">
                          {topElement}
                        </div>

                        <div
                          className={`w-full max-w-[26px] h-20 rounded-lg flex flex-col justify-end p-0.5 transition-all duration-200 border ${
                            slot.esHoraActual
                              ? 'bg-[#0d1a3d] border-[#eed59b] shadow-midnight-glow'
                              : isSelected
                              ? 'bg-[#132247] border-white shadow-md'
                              : hasAnyActivity
                              ? 'bg-[#0d1a3d] border-[#5b9bd5]/40 hover:border-[#60a5fa]'
                              : slot.esFutura
                              ? 'bg-[#070e1e]/60 border-dashed border-[#5b9bd5]/15'
                              : 'bg-[#070e1e]/80 border-[#5b9bd5]/15 hover:border-[#5b9bd5]/35'
                          } ${isSelected ? 'scale-105' : ''}`}
                        >
                          {hasAnyActivity ? (
                            <div
                              style={{ height: `${fillPercent}%` }}
                              className={`w-full rounded-md transition-all duration-300 ${barColor}`}
                            />
                          ) : (
                            <div className="w-full h-0.5 bg-transparent" />
                          )}
                        </div>

                        <span
                          className={`mt-1.5 text-[10px] font-mono leading-none transition-colors ${
                            slot.esHoraActual
                              ? 'text-[#eed59b] font-bold'
                              : isSelected
                              ? 'text-white font-bold'
                              : hasAnyActivity
                              ? 'text-[#f8fafc] font-medium'
                              : 'text-[#94a3b8]/60'
                          }`}
                        >
                          {String(slot.hora).padStart(2, '0')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Inspección de la Franja Horaria Seleccionada */}
            <div className="p-4 rounded-2xl bg-[#081229]/80 border border-[#5b9bd5]/20 shadow-inner space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#5b9bd5]/15">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm sm:text-base font-serif font-bold text-white">
                    Franja: {slotActivoHoy.rangoLabel}
                  </span>
                  {slotActivoHoy.esHoraActual && (
                    <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#eed59b]/20 text-[#eed59b] border border-[#eed59b]/40 font-medium">
                      Hora en Curso
                    </span>
                  )}
                  {slotActivoHoy.minutosFoco > 0 && !slotActivoHoy.esHoraActual && (
                    <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                      🧠 Trabajo Profundo
                    </span>
                  )}
                  {slotActivoHoy.ejercicios && slotActivoHoy.ejercicios.length > 0 && (
                    <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#d97706]/30 text-[#fed7aa] border border-[#f59e0b]/40 font-medium">
                      🏃 Ejercicio Físico
                    </span>
                  )}
                  {slotActivoHoy.comidas && slotActivoHoy.comidas.length > 0 && (
                    <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#059669]/30 text-[#a7f3d0] border border-[#10b981]/40 font-medium">
                      🥗 Comida
                    </span>
                  )}
                  {slotActivoHoy.suenos && slotActivoHoy.suenos.length > 0 && (
                    <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#4f46e5]/30 text-[#c7d2fe] border border-[#6366f1]/40 font-medium">
                      🌙 Sueño
                    </span>
                  )}
                </div>

                <span className="text-xs text-[#eed59b] font-mono font-semibold">
                  {slotActivoHoy.minutosFoco > 0 ? `${slotActivoHoy.minutosFoco} min foco` : `${slotActivoHoy.horaLabel}`}
                </span>
              </div>

              {/* Contenido Desglosado de la Franja */}
              {slotActivoHoy.sesiones.length > 0 ||
              (slotActivoHoy.ejercicios && slotActivoHoy.ejercicios.length > 0) ||
              (slotActivoHoy.comidas && slotActivoHoy.comidas.length > 0) ||
              (slotActivoHoy.suenos && slotActivoHoy.suenos.length > 0) ||
              (slotActivoHoy.tareas && slotActivoHoy.tareas.length > 0) ? (
                <div className="space-y-2.5">
                  {/* 1. Sesiones de Foco */}
                  {slotActivoHoy.sesiones.map((item, idx) => {
                    const isUltraDeep = item.sesion.incomodidad === 'Alta' && item.sesion.intensidad === 'Alta';
                    return (
                      <div
                        key={item.sesion.id || idx}
                        className={`p-3.5 rounded-xl bg-[#0d1733]/90 border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isUltraDeep
                            ? 'border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                            : 'border-[#5b9bd5]/25'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-white text-sm">🧠 {item.sesion.tipo}</span>
                            <span className="tag-formal text-[10px] px-2 py-0.5 rounded-full bg-[#1e3a8a]/50 text-[#93c5fd] border border-[#60a5fa]/30">
                              {item.minutos} min en este tramo
                            </span>
                            {isUltraDeep && (
                              <span className="tag-formal text-[10px] px-2 py-0.5 rounded-full bg-[#78350f] text-[#fde68a] border border-[#f59e0b]/60 font-semibold">
                                ⚡ Máxima Fricción Cognitiva
                              </span>
                            )}
                          </div>
                          {item.sesion.calidad && (
                            <p className="text-xs text-[#94a3b8] italic font-serif">
                              &ldquo;{item.sesion.calidad}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] shrink-0">
                          <span className="tag-formal px-2.5 py-1 rounded-full bg-[#070e1e] text-[#94a3b8] border border-[#5b9bd5]/25">
                            Intensidad: <b className="text-[#60a5fa]">{item.sesion.intensidad}</b>
                          </span>
                          <span
                            className={`tag-formal px-2.5 py-1 rounded-full bg-[#070e1e] border ${
                              item.sesion.incomodidad === 'Alta'
                                ? 'text-[#fde68a] border-[#f59e0b]/50'
                                : 'text-[#94a3b8] border-[#5b9bd5]/25'
                            }`}
                          >
                            Incomodidad: <b className="text-[#eed59b]">{item.sesion.incomodidad}</b>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* 2. Ejercicio Físico */}
                  {slotActivoHoy.ejercicios &&
                    slotActivoHoy.ejercicios.map((item, idx) => (
                      <div
                        key={item.ejercicio.id || idx}
                        className="p-3.5 rounded-xl bg-[#0d1733]/90 border border-[#f59e0b]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-[#fed7aa] text-sm">
                              🏃 {item.ejercicio.tipo_ejercicio}
                            </span>
                            <span className="tag-formal text-[10px] px-2 py-0.5 rounded-full bg-[#7c2d12]/40 text-[#fed7aa] border border-[#f97316]/30">
                              {item.minutos} min activos
                            </span>
                          </div>
                          {item.ejercicio.descripcion && (
                            <p className="text-xs text-[#fed7aa]/80 italic">
                              Rutina: &ldquo;{item.ejercicio.descripcion}&rdquo;
                            </p>
                          )}
                        </div>
                        <span className="tag-formal text-[10px] px-2.5 py-1 rounded-full bg-[#070e1e] text-[#fed7aa] border border-[#f59e0b]/30">
                          Intensidad: <b>{item.ejercicio.intensidad}</b>
                        </span>
                      </div>
                    ))}

                  {/* 3. Alimentación */}
                  {slotActivoHoy.comidas &&
                    slotActivoHoy.comidas.map((comida, idx) => (
                      <div
                        key={comida.id || idx}
                        className="p-3.5 rounded-xl bg-[#0d1733]/90 border border-[#10b981]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-[#a7f3d0] text-sm">
                              🥗 {comida.tipo_comida}
                            </span>
                            <span className="text-[11px] font-mono text-[#94a3b8]">{comida.hora}</span>
                          </div>
                          <p className="text-xs text-[#a7f3d0]/90">
                            Ingesta: &ldquo;{comida.descripcion}&rdquo;
                          </p>
                        </div>
                        <span className="tag-formal text-[10px] px-2.5 py-1 rounded-full bg-[#070e1e] text-[#a7f3d0] border border-[#10b981]/30">
                          Calidad: <b>{comida.calidad}</b>
                        </span>
                      </div>
                    ))}

                  {/* 4. Sueño */}
                  {slotActivoHoy.suenos &&
                    slotActivoHoy.suenos.map((item, idx) => (
                      <div
                        key={item.sueno.id || idx}
                        className="p-3.5 rounded-xl bg-[#0d1733]/90 border border-[#6366f1]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-[#c7d2fe] text-sm">
                              🌙 Período de Sueño ({item.sueno.hora_inicio} — {item.sueno.hora_fin})
                            </span>
                            <span className="tag-formal text-[10px] px-2 py-0.5 rounded-full bg-[#312e81]/40 text-[#c7d2fe] border border-[#6366f1]/30">
                              Calidad: {item.sueno.calidad_sueno}
                            </span>
                          </div>
                          {item.sueno.notas && (
                            <p className="text-xs text-[#c7d2fe]/80 italic">&ldquo;{item.sueno.notas}&rdquo;</p>
                          )}
                        </div>
                        {item.sueno.sensacion && (
                          <span className="tag-formal text-[10px] px-2.5 py-1 rounded-full bg-[#070e1e] text-[#c7d2fe] border border-[#6366f1]/30">
                            Despertar: <b>{item.sueno.sensacion}</b>
                          </span>
                        )}
                      </div>
                    ))}

                  {/* 5. Tareas Planificadas en esta Franja */}
                  {slotActivoHoy.tareas && slotActivoHoy.tareas.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#5b9bd5]/15">
                      <div className="flex items-center justify-between text-[11px] font-sans font-bold uppercase tracking-wider text-[#eed59b]">
                        <span>📋 Tareas Programadas en este Horario ({slotActivoHoy.tareas.length})</span>
                      </div>
                      {slotActivoHoy.tareas.map((t, idx) => {
                        const isDone = t.estado === 'hecho';
                        return (
                          <div
                            key={t.id || idx}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                              isDone
                                ? 'bg-[#06241a]/60 border-[#10b981]/40'
                                : 'bg-[#0d1733]/90 border-[#3b82f6]/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleTareaRapida(t)}
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs border ${
                                  isDone
                                    ? 'bg-emerald-500 border-emerald-400 text-black font-bold'
                                    : 'bg-[#070e1e] border-[#5b9bd5]/40 text-transparent hover:border-emerald-400'
                                }`}
                                title={isDone ? 'Cumplida (Clic para desmarcar)' : 'Pendiente (Clic para marcar cumplida)'}
                              >
                                {isDone ? '✓' : ''}
                              </button>
                              <div className="min-w-0">
                                <span className={`block truncate ${isDone ? 'line-through text-[#94a3b8]' : 'text-white font-medium'}`}>
                                  📋 {t.descripcion}
                                </span>
                                <span className="text-[10px] text-[#94a3b8] font-mono">
                                  {t.hora_inicio} — {t.hora_fin} • {t.tipo_trabajo} ({t.horas_netas_estimadas}h)
                                </span>
                              </div>
                            </div>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                                isDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {isDone ? '✓ Cumplida' : '⏳ Por Cumplir'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-[#94a3b8]">
                  {slotActivoHoy.esHoraActual
                    ? 'Franja activa en este momento. Registra trabajo, comida o ejercicio.'
                    : slotActivoHoy.esPasada
                    ? 'Sin actividades registradas en este intervalo.'
                    : 'Franja futura de la jornada.'}
                </div>
              )}
            </div>
          </section>

          {/* MATRIZ DE CALIDAD COGNITIVA & ESPECTRO */}
          <section className="card-midnight p-5 sm:p-6 space-y-5 border border-[#5b9bd5]/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#5b9bd5]/15">
              <div className="space-y-0.5">
                <h3 className="text-base font-serif font-bold text-white tracking-wide flex items-center gap-2">
                  <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                    Espectro
                  </span>
                  Matriz de Esfuerzo e Incomodidad
                </h3>
                <p className="text-xs text-[#94a3b8]">
                  Distribución cruzada de profundidad mental y fricción cognitiva de la jornada de hoy
                </p>
              </div>
              <span className="tag-formal text-xs text-[#eed59b] px-3.5 py-1 rounded-full bg-[#0d1733] border border-[#e5c179]/30 font-semibold font-mono">
                Total Hoy: {horasHoy.toFixed(1)}h
              </span>
            </div>

            {/* Espectros Proporcionales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#081229]/80 border border-[#5b9bd5]/20 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white font-medium">Incomodidad Cognitiva</span>
                  <span className="text-[#eed59b] font-mono font-medium">{incomodidadHoy.Alta.toFixed(1)}h Alta / {totalIncomodidadHoy.toFixed(1)}h</span>
                </div>
                <div className="h-3 w-full rounded-full bg-[#070e1e] overflow-hidden flex border border-[#5b9bd5]/25 p-0.5">
                  <div style={{ width: `${pctIncomodidadAltaHoy}%` }} className="h-full bg-[#eed59b] rounded-l-full" title={`Alta: ${incomodidadHoy.Alta.toFixed(1)}h`}></div>
                  <div style={{ width: `${pctIncomodidadMediaHoy}%` }} className="h-full bg-[#60a5fa]" title={`Media: ${incomodidadHoy.Media.toFixed(1)}h`}></div>
                  <div style={{ width: `${pctIncomodidadBajaHoy}%` }} className="h-full bg-[#3b82f6] rounded-r-full" title={`Baja: ${incomodidadHoy.Baja.toFixed(1)}h`}></div>
                </div>
                <div className="flex justify-between text-[11px] text-[#94a3b8]">
                  <span>Alta: {incomodidadHoy.Alta.toFixed(1)}h</span>
                  <span>Media: {incomodidadHoy.Media.toFixed(1)}h</span>
                  <span>Baja: {incomodidadHoy.Baja.toFixed(1)}h</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#081229]/80 border border-[#5b9bd5]/20 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white font-medium">Intensidad de Foco</span>
                  <span className="text-[#60a5fa] font-mono font-medium">{intensidadHoy.Alta.toFixed(1)}h Alta / {totalIntensidadHoy.toFixed(1)}h</span>
                </div>
                <div className="h-3 w-full rounded-full bg-[#070e1e] overflow-hidden flex border border-[#5b9bd5]/25 p-0.5">
                  <div style={{ width: `${pctIntensidadAltaHoy}%` }} className="h-full bg-[#60a5fa] rounded-l-full" title={`Alta: ${intensidadHoy.Alta.toFixed(1)}h`}></div>
                  <div style={{ width: `${pctIntensidadMediaHoy}%` }} className="h-full bg-[#3b82f6]" title={`Media: ${intensidadHoy.Media.toFixed(1)}h`}></div>
                  <div style={{ width: `${pctIntensidadBajaHoy}%` }} className="h-full bg-[#1e3a8a] rounded-r-full" title={`Baja: ${intensidadHoy.Baja.toFixed(1)}h`}></div>
                </div>
                <div className="flex justify-between text-[11px] text-[#94a3b8]">
                  <span>Alta: {intensidadHoy.Alta.toFixed(1)}h</span>
                  <span>Media: {intensidadHoy.Media.toFixed(1)}h</span>
                  <span>Baja: {intensidadHoy.Baja.toFixed(1)}h</span>
                </div>
              </div>
            </div>

            {/* Matriz 2D Elegante */}
            <div className="overflow-x-auto pt-1">
              <div className="min-w-[380px] space-y-2 font-sans">
                <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-[#94a3b8]">
                  <div className="text-left font-medium text-white self-center">Intensidad \ Incomodidad</div>
                  <div className="p-1.5 rounded-lg bg-[#0d1733] text-[#eed59b] font-medium border border-[#eed59b]/25">Alta (Frontera)</div>
                  <div className="p-1.5 rounded-lg bg-[#0d1733] text-[#60a5fa] font-medium border border-[#60a5fa]/25">Media (Esfuerzo)</div>
                  <div className="p-1.5 rounded-lg bg-[#0d1733] text-[#94a3b8] font-medium border border-[#5b9bd5]/20">Baja (Confort)</div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="flex items-center text-left text-xs font-serif font-bold text-[#eed59b]">Alta</div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Alta.Alta > 0 ? 'bg-[#1e3a8a]/80 border-[#eed59b] text-[#eed59b] shadow-sm' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Alta.Alta.toFixed(1)}h</span>
                    <span className="text-[10px]">Maestría</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Alta.Media > 0 ? 'bg-[#1e3a8a]/60 border-[#60a5fa] text-[#93c5fd]' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Alta.Media.toFixed(1)}h</span>
                    <span className="text-[10px]">Inmersión</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Alta.Baja > 0 ? 'bg-[#0d1733] border-[#5b9bd5]/30 text-[#94a3b8]' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Alta.Baja.toFixed(1)}h</span>
                    <span className="text-[10px]">Mecánico</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="flex items-center text-left text-xs font-serif font-bold text-[#60a5fa]">Media</div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Media.Alta > 0 ? 'bg-[#0d1733] border-[#eed59b]/40 text-[#eed59b]' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Media.Alta.toFixed(1)}h</span>
                    <span className="text-[10px]">Desafío</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Media.Media > 0 ? 'bg-[#0d1733] border-[#5b9bd5]/35 text-white' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Media.Media.toFixed(1)}h</span>
                    <span className="text-[10px]">Sostenible</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Media.Baja > 0 ? 'bg-[#081229] border-[#5b9bd5]/20 text-[#94a3b8]' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Media.Baja.toFixed(1)}h</span>
                    <span className="text-[10px]">Rutinario</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="flex items-center text-left text-xs font-serif font-bold text-[#94a3b8]">Baja</div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Baja.Alta > 0 ? 'bg-[#081229] border-rose-500/40 text-rose-300' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Baja.Alta.toFixed(1)}h</span>
                    <span className="text-[10px]">Fatiga</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Baja.Media > 0 ? 'bg-[#081229] border-[#5b9bd5]/20 text-[#94a3b8]' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Baja.Media.toFixed(1)}h</span>
                    <span className="text-[10px]">Distracción</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${matrizHoy.Baja.Baja > 0 ? 'bg-[#081229] border-rose-500/20 text-rose-300' : 'bg-[#081229] border-[#5b9bd5]/15 text-[#94a3b8]/40'}`}>
                    <span className="font-bold font-mono block">{matrizHoy.Baja.Baja.toFixed(1)}h</span>
                    <span className="text-[10px]">Superficial</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* COLUMNA LATERAL (35% -> col-span-4): EVALUACIÓN DE COMPROMISO & SEMÁFORO FORMAL */}
        <div className="lg:col-span-4 space-y-6">
          {/* TARJETA DE CONSTANCIA Y RACHA */}
          <div className="card-midnight p-5 border border-[#5b9bd5]/25 shadow-midnight space-y-3">
            <div className="flex items-center justify-between">
              <span className="tag-formal text-[10px] px-3 py-1 rounded-full bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                Continuidad
              </span>
              <span className="text-xl">{stats.rachaActual > 0 ? '✨' : '🕯️'}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-serif font-bold text-[#eed59b]">
                {stats.rachaActual}
              </span>
              <span className="text-xs text-[#94a3b8] font-medium tracking-wide uppercase">
                {stats.rachaActual === 1 ? 'Día Consecutivo' : 'Días Consecutivos'}
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              La racha premia la consistencia real: solo suma cuando la jornada concluye con al menos 75% de cumplimiento en los pilares.
            </p>
          </div>

          {/* SEMÁFORO DE COMPROMISO DIARIO CON CITAS DE AUTORES */}
          <section className="card-midnight p-5 space-y-4 border border-[#5b9bd5]/25">
            <div className="flex items-center justify-between pb-3 border-b border-[#5b9bd5]/15">
              <div className="space-y-0.5">
                <h3 className="text-sm font-serif font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>⚖️</span>
                  Compromiso Diario
                </h3>
                <p className="text-[11px] text-[#94a3b8]">
                  4 Pilares de Excelencia
                </p>
              </div>

              {totalAlertas === 0 ? (
                <span className="tag-formal px-3 py-1 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium">
                  ✓ Al Día
                </span>
              ) : (
                <span className="tag-formal px-3 py-1 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium">
                  {totalAlertas} {totalAlertas === 1 ? 'recordatorio' : 'recordatorios'}
                </span>
              )}
            </div>

            {totalAlertas > 0 ? (
              <div className="space-y-3 font-sans">
                {/* Alerta 1: Trabajo Profundo */}
                {alertaTrabajo && (
                  <div className="p-4 rounded-2xl bg-[#081229]/80 border border-blue-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#93c5fd]">
                      <span>Tiempo de Foco Requerido</span>
                      <span className="font-mono">{horasHoy.toFixed(1)}h / 3.0h</span>
                    </div>
                    <p className="text-xs text-[#f8fafc]">
                      Aún restan {deficitTrabajoHoy.toFixed(1)}h para completar la meta de inmersión cognitiva.
                    </p>
                    <blockquote className="p-3 rounded-xl bg-[#0d1733]/90 border-l-2 border-[#eed59b] text-xs text-[#94a3b8] italic font-serif">
                      &ldquo;No es que tengamos poco tiempo, sino que perdemos mucho.&rdquo;
                      <span className="block text-[10px] font-sans text-[#eed59b] font-medium not-italic mt-1">— Séneca</span>
                    </blockquote>
                  </div>
                )}

                {/* Alerta 2: Fricción Cognitiva */}
                {alertaEstudio && (
                  <div className="p-4 rounded-2xl bg-[#081229]/80 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                      <span>Incomodidad Cognitiva</span>
                      <span className="font-mono">{pctExigenteHoy}% / 50%</span>
                    </div>
                    <p className="text-xs text-[#f8fafc]">
                      {horasHoy === 0 ? 'Sin sesiones con desafío mental aún.' : 'Poco tiempo invertido en la frontera de dificultad.'}
                    </p>
                    <blockquote className="p-3 rounded-xl bg-[#0d1733]/90 border-l-2 border-amber-400 text-xs text-[#94a3b8] italic font-serif">
                      &ldquo;Empieza siempre por la tarea más difícil y no titubees.&rdquo;
                      <span className="block text-[10px] font-sans text-amber-300 font-medium not-italic mt-1">— Brian Tracy</span>
                    </blockquote>
                  </div>
                )}

                {/* Alerta 3: Entrenamiento */}
                {alertaEntrenamiento && (
                  <div className="p-4 rounded-2xl bg-[#081229]/80 border border-rose-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                      <span>Entrenamiento Físico</span>
                      <span className="font-mono">{ejercicioHoy.toFixed(1)}h / 0.75h</span>
                    </div>
                    <p className="text-xs text-[#f8fafc]">
                      {ejercicioHoy === 0 ? 'No has registrado actividad física hoy.' : `Faltan ${deficitEjercicioHoy.toFixed(1)}h de entrenamiento.`}
                    </p>
                    <blockquote className="p-3 rounded-xl bg-[#0d1733]/90 border-l-2 border-rose-400 text-xs text-[#94a3b8] italic font-serif">
                      &ldquo;Cuando tu mente dice basta, apenas has rozado tu potencial.&rdquo;
                      <span className="block text-[10px] font-sans text-rose-300 font-medium not-italic mt-1">— David Goggins</span>
                    </blockquote>
                  </div>
                )}

                {/* Alerta 4: Cierre */}
                {alertaCierre && (
                  <div className="p-4 rounded-2xl bg-[#081229]/80 border border-[#5b9bd5]/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#93c5fd]">
                      <span>Cierre de Jornada</span>
                      <span className="font-mono">Pendiente</span>
                    </div>
                    <p className="text-xs text-[#f8fafc]">
                      Realiza el protocolo formal antes de medianoche para liberar la mente de pendientes.
                    </p>
                    <blockquote className="p-3 rounded-xl bg-[#0d1733]/90 border-l-2 border-[#5b9bd5] text-xs text-[#94a3b8] italic font-serif">
                      &ldquo;Al anochecer, confina tus pensamientos y haz las paces con lo inacabado.&rdquo;
                      <span className="block text-[10px] font-sans text-[#93c5fd] font-medium not-italic mt-1">— Marco Aurelio</span>
                    </blockquote>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-[#081229]/80 border border-emerald-500/40 text-center space-y-2.5">
                <span className="text-2xl">🏆</span>
                <h4 className="text-sm font-serif font-bold text-[#eed59b]">
                  Jornada Ejemplar Cumplida
                </h4>
                <p className="text-xs text-[#94a3b8]">
                  Todos los objetivos de foco profundo, esfuerzo intelectual, cuerpo y cierre han sido completados hoy.
                </p>
                <blockquote className="p-2.5 rounded-xl bg-[#0d1733]/80 text-[11px] text-[#eed59b] italic font-serif">
                  &ldquo;La excelencia no es un acto aislado, sino un hábito cotidiano.&rdquo;
                  <span className="block text-[9px] font-sans text-[#94a3b8] not-italic mt-1">— Aristóteles</span>
                </blockquote>
              </div>
            )}
          </section>

          {/* ACCESO A BÓVEDA HISTÓRICA */}
          <div className="card-elevated p-5 border border-[#5b9bd5]/25 space-y-3">
            <span className="text-sm font-serif font-bold text-white block">
              Archivo Histórico Retrospectivo
            </span>
            <p className="text-xs text-[#94a3b8]">
              Consulta el rendimiento de cualquier fecha del calendario con detalle horario de sesiones.
            </p>
            <button
              type="button"
              onClick={() => setMostrarModalHistorico(true)}
              className="btn-formal w-full py-2.5 rounded-full text-xs font-medium text-center block"
            >
              🏛️ Abrir Archivo Histórico
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. MODAL DE AUDITORÍA HISTÓRICA RETROSPECTIVA             */}
      {/* ========================================================= */}
      {mostrarModalHistorico && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-historico-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMostrarModalHistorico(false);
          }}
        >
          <div className="relative w-full max-w-6xl max-h-[94vh] bg-[#081229] border border-[#5b9bd5]/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#5b9bd5]/20 bg-[#081229] sticky top-0 z-30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                    Archivo Histórico
                  </span>
                  <span className="text-xs text-[#eed59b] font-medium uppercase tracking-wider">
                    Auditoría Retrospectiva
                  </span>
                </div>
                <h3 id="modal-historico-title" className="text-lg sm:text-2xl font-serif font-bold text-white tracking-wide">
                  Consulta de Jornadas &amp; Montañas Acumuladas
                </h3>
              </div>

              <button
                onClick={() => setMostrarModalHistorico(false)}
                className="btn-formal-outline px-4 py-1.5 rounded-full text-xs font-medium"
                title="Cerrar ventana histórica (Esc)"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-7">
              {/* SELECTOR Y AUDITORÍA DE DÍA ESPECÍFICO */}
              <section className="card-elevated p-4 sm:p-6 border border-[#5b9bd5]/25 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#5b9bd5]/15">
                  <div className="space-y-0.5">
                    <h4 className="text-sm sm:text-base font-serif font-bold text-white">
                      Auditar Día Específico
                    </h4>
                    <p className="text-xs text-[#94a3b8]">
                      Selecciona una fecha en el calendario o haz clic en cualquier jornada con actividad registrada.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handlePasoDia(-1)}
                      className="btn-formal-outline px-3 py-1.5 rounded-full text-xs"
                      title="Ir al día anterior"
                    >
                      ◀ Ant
                    </button>

                    <input
                      type="date"
                      value={fechaSeleccionadaHist}
                      onChange={(e) => handleSeleccionarDia(e.target.value)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-mono font-medium bg-[#070e1e] text-[#eed59b] border border-[#5b9bd5]/40 focus:outline-none focus:border-[#eed59b]"
                    />

                    <button
                      type="button"
                      onClick={() => handlePasoDia(1)}
                      className="btn-formal-outline px-3 py-1.5 rounded-full text-xs"
                      title="Ir al día siguiente"
                    >
                      Sig ▶
                    </button>
                  </div>
                </div>

                {/* Días con actividad */}
                {diasConActividadLista.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] text-[#94a3b8] uppercase font-medium tracking-wide block">
                      Días con actividad registrada:
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5">
                      {diasConActividadLista.map((dItem) => {
                        const isSelected = fechaSeleccionadaHist === dItem.fecha;
                        const isToday = dItem.fecha === targetFechaStr;
                        return (
                          <button
                            key={dItem.fecha}
                            type="button"
                            onClick={() => handleSeleccionarDia(dItem.fecha)}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                              isSelected
                                ? 'bg-[#2563eb] text-white font-semibold shadow-midnight'
                                : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                            }`}
                          >
                            <span>📅 {formatShortDate(dItem.fecha)}</span>
                            {isToday && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#eed59b] text-[#070e1e] font-bold">
                                Hoy
                              </span>
                            )}
                            <span className="font-mono font-bold text-[#eed59b]">
                              {dItem.horasNetas.toFixed(1)}h
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detalle del día seleccionado */}
                {loadingDiaHist ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <div className="w-8 h-8 rounded-full border-2 border-[#eed59b] border-t-transparent animate-spin"></div>
                    <span className="text-xs text-[#94a3b8]">
                      Cargando auditoría histórica para {fechaSeleccionadaHist}...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-5 animate-fade-in">
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#081229]/80 border border-[#5b9bd5]/20 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="tag-formal px-2.5 py-0.5 rounded-full text-xs bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                              {fechaSeleccionadaHist >= FECHA_INICIO_CICLO
                                ? `Día ${getDiaCicloParaFecha(fechaSeleccionadaHist)} de 365`
                                : 'Previo al Ciclo'}
                            </span>
                          </div>
                          <h5 className="text-lg sm:text-2xl font-serif font-bold text-white">
                            {formatFechaLargaEspanol(fechaSeleccionadaHist)}
                          </h5>
                        </div>

                        <span className="tag-formal px-3.5 py-1.5 rounded-full bg-[#0d1733] border border-[#e5c179]/30 text-[#eed59b] font-serif font-bold text-xs">
                          Total: {(detalleDiaHist?.totalHorasNetas ?? 0).toFixed(2)}h netas
                        </span>
                      </div>

                      {/* Micro KPIs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs">
                        <div className="p-3 rounded-xl bg-[#0d1733]/70 border border-[#5b9bd5]/20 space-y-1">
                          <span className="text-[10px] text-[#94a3b8] block uppercase font-medium">Tiempo de Foco</span>
                          <span className="text-lg font-serif font-bold text-[#eed59b]">
                            {(detalleDiaHist?.totalHorasNetas ?? 0).toFixed(1)}h
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0d1733]/70 border border-[#5b9bd5]/20 space-y-1">
                          <span className="text-[10px] text-[#94a3b8] block uppercase font-medium">Entrenamiento</span>
                          <span className="text-lg font-serif font-bold text-white">
                            {detalleDiaHist?.ejercicioHoras != null ? `${Number(detalleDiaHist.ejercicioHoras).toFixed(1)}h` : '0h'}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0d1733]/70 border border-[#5b9bd5]/20 space-y-1">
                          <span className="text-[10px] text-[#94a3b8] block uppercase font-medium">Alimentación</span>
                          <span className="text-lg font-serif font-bold text-[#60a5fa]">
                            {detalleDiaHist?.alimento != null ? `${detalleDiaHist.alimento}/5 ⭐` : '—'}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0d1733]/70 border border-[#5b9bd5]/20 space-y-1">
                          <span className="text-[10px] text-[#94a3b8] block uppercase font-medium">Cierre Diario</span>
                          <span className={`text-base font-serif font-bold ${detalleDiaHist?.cierreRealizado ? 'text-emerald-300' : 'text-[#94a3b8]'}`}>
                            {detalleDiaHist?.cierreRealizado ? 'Concluido' : 'Sin Cierre'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bloques de Foco Auditados con hora exacta */}
                    <div className="space-y-3">
                      <h6 className="text-xs sm:text-sm font-serif font-bold uppercase tracking-wide text-white">
                        Sesiones de Concentración Ejecutadas ({sesionesDiaHist.length})
                      </h6>

                      {sesionesDiaHist.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-[#081229]/60 border border-dashed border-[#5b9bd5]/20 text-center text-xs text-[#94a3b8]">
                          No se registraron sesiones de trabajo profundo en esta fecha.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sesionesDiaHist.map((sesion, idx) => {
                            const timeInfo = getSessionTimeRange(sesion);
                            return (
                              <div
                                key={sesion.id || idx}
                                className="p-4 rounded-2xl bg-[#081229]/90 border border-[#5b9bd5]/25 space-y-2.5"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#5b9bd5]/15">
                                  <div className="flex items-center gap-2">
                                    <span className="tag-formal px-2.5 py-0.5 rounded-full text-xs bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30">
                                      🕒 {timeInfo.inicio} — {timeInfo.fin}
                                    </span>
                                    <span className="text-xs text-white font-medium">
                                      ({timeInfo.durMin} min / {sesion.horas_netas}h netas)
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-[#94a3b8]">
                                    Registrado a las <strong>{timeInfo.exacta}</strong>
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-base font-serif font-bold text-white">
                                    {sesion.tipo}
                                  </span>
                                  <div className="flex items-center gap-2 text-[10px]">
                                    <span className="tag-formal px-2.5 py-0.5 rounded-full bg-[#0d1733] text-[#60a5fa] border border-[#5b9bd5]/25">
                                      Intensidad: {sesion.intensidad}
                                    </span>
                                    <span className="tag-formal px-2.5 py-0.5 rounded-full bg-[#0d1733] text-[#eed59b] border border-[#e5c179]/30">
                                      Incomodidad: {sesion.incomodidad}
                                    </span>
                                  </div>
                                </div>

                                {sesion.calidad && (
                                  <blockquote className="p-3 rounded-xl bg-[#0d1733]/80 border-l-2 border-[#eed59b] text-xs text-[#94a3b8] italic font-serif">
                                    &ldquo;{sesion.calidad}&rdquo;
                                  </blockquote>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* GRÁFICO HISTÓRICO: MONTAÑAS DE FOCO SPLINE (7D / 14D / 30D) */}
              <section className="card-elevated p-5 sm:p-6 border border-[#5b9bd5]/25 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#5b9bd5]/15">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-serif font-bold text-white">
                      Relieve Temporal Acumulado
                    </h4>
                    <p className="text-xs text-[#94a3b8]">
                      Total de inmersión en el período: <strong className="text-[#eed59b] font-mono">{totalHorasEnRango.toFixed(1)}h</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#070e1e] p-1 rounded-full border border-[#5b9bd5]/25">
                      <button
                        type="button"
                        onClick={() => setModoGraficoHist('montana')}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${
                          modoGraficoHist === 'montana' ? 'bg-[#2563eb] text-white font-medium' : 'text-[#94a3b8]'
                        }`}
                      >
                        ⛰️ Montañas
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoGraficoHist('columnas')}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${
                          modoGraficoHist === 'columnas' ? 'bg-[#2563eb] text-white font-medium' : 'text-[#94a3b8]'
                        }`}
                      >
                        📊 Columnas
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-[#070e1e] p-1 rounded-full border border-[#5b9bd5]/25">
                      {([7, 14, 30] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRangoDias(r)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                            rangoDias === r ? 'bg-[#1e3a8a] text-[#eed59b] font-bold' : 'text-[#94a3b8]'
                          }`}
                        >
                          {r}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Montañas Históricas SVG */}
                {modoGraficoHist === 'montana' ? (
                  <div className="p-4 rounded-2xl bg-[#081229]/80 border border-[#5b9bd5]/20 overflow-x-auto">
                    <div className="min-w-[620px] relative">
                      <svg viewBox={`0 0 ${svgTrendWidth} ${svgTrendHeight}`} className="w-full h-44 overflow-visible">
                        <defs>
                          <linearGradient id="histMountainAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                            <stop offset="50%" stopColor="#1e3a8a" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#070e1e" stopOpacity="0.0" />
                          </linearGradient>
                          <linearGradient id="histMountainLineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#5b9bd5" />
                            <stop offset="50%" stopColor="#eed59b" />
                            <stop offset="100%" stopColor="#5b9bd5" />
                          </linearGradient>
                        </defs>

                        <line x1="0" y1={svgTrendBaselineY} x2={svgTrendWidth} y2={svgTrendBaselineY} stroke="#11224d" strokeWidth="1.5" />
                        <line x1="0" y1={newportGoalY} x2={svgTrendWidth} y2={newportGoalY} stroke="#5b9bd5" strokeDasharray="4 4" strokeWidth="1.2" opacity="0.6" />
                        <text x={svgTrendWidth - 10} y={newportGoalY - 6} textAnchor="end" fill="#93c5fd" fontSize="10" fontFamily="sans-serif">
                          Meta Newport: 4.0h
                        </text>

                        <path d={mountainTrendArea} fill="url(#histMountainAreaGrad)" className="transition-all duration-500" />
                        <path d={mountainTrendLine} fill="none" stroke="url(#histMountainLineGrad)" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-500" />

                        {mountainTrendPoints.map((pt) => {
                          const isSelected = fechaSeleccionadaHist === pt.day.fecha;
                          const hasHours = pt.day.horasNetas > 0;

                          return (
                            <g
                              key={pt.day.fecha}
                              className="cursor-pointer group"
                              onClick={() => handleSeleccionarDia(pt.day.fecha)}
                              onMouseEnter={() => setHoveredDay(pt.day)}
                              onMouseLeave={() => setHoveredDay(null)}
                            >
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isSelected ? 6.5 : hasHours ? 4.5 : 2.5}
                                fill={isSelected ? '#eed59b' : hasHours ? '#60a5fa' : '#11224d'}
                                stroke="#070e1e"
                                strokeWidth="2"
                                className="transition-all duration-200"
                              />
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="relative pt-4 pb-2 overflow-x-auto">
                    <div className="min-w-[480px]">
                      <div className="relative h-44 w-full border-b border-[#5b9bd5]/20 flex items-end justify-between gap-1.5 px-2">
                        {filteredTrend.map((day, idx) => {
                          const heightPercent = maxHoursInTrend > 0
                            ? Math.min(100, Math.max(day.horasNetas > 0 ? 8 : 2, (day.horasNetas / maxHoursInTrend) * 100))
                            : 4;
                          const isSelectedDate = fechaSeleccionadaHist === day.fecha;
                          const hasHours = day.horasNetas > 0;

                          return (
                            <div
                              key={day.fecha || idx}
                              onClick={() => handleSeleccionarDia(day.fecha)}
                              className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group relative z-10"
                            >
                              <div
                                style={{ height: `${heightPercent}%` }}
                                className={`w-full max-w-[28px] rounded-t-lg transition-all duration-200 ${
                                  isSelectedDate
                                    ? 'bg-[#eed59b] shadow-midnight-glow'
                                    : hasHours
                                    ? 'bg-[#2563eb] hover:bg-[#3b82f6]'
                                    : 'bg-[#0d1733]'
                                }`}
                              ></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-5 border-t border-[#5b9bd5]/20 bg-[#081229] sticky bottom-0 z-30">
              <p className="text-xs text-[#94a3b8] italic font-serif hidden sm:block">
                &ldquo;El pasado ya murió; el futuro aún no nace; la única victoria posible ocurre hoy.&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setMostrarModalHistorico(false)}
                className="btn-formal w-full sm:w-auto px-6 py-2.5 rounded-full text-xs font-semibold ml-auto"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MODAL RÁPIDO PARA AGREGAR TAREA EN EL PANEL DIARIO     */}
      {/* ========================================================= */}
      {isQuickCreateTaskOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsQuickCreateTaskOpen(false);
          }}
        >
          <div className="card-midnight p-5 sm:p-6 rounded-2xl border border-[#5b9bd5]/30 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#5b9bd5]/15">
              <div className="space-y-0.5">
                <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#eed59b]">
                  Plan de Vuelo
                </span>
                <h4 className="text-base font-serif font-bold text-white">
                  Programar Tarea para Hoy
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickCreateTaskOpen(false)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuickTask} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[#94a3b8] font-medium block">
                  Descripción del Objetivo / Tarea
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Implementar arquitectura del nuevo módulo"
                  value={quickTaskDesc}
                  onChange={(e) => setQuickTaskDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070e1e] text-white border border-[#5b9bd5]/30 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#94a3b8] font-medium block">Hora Inicio</label>
                  <input
                    type="time"
                    required
                    value={quickTaskInicio}
                    onChange={(e) => handleHorasQuickTask(e.target.value, quickTaskFin)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070e1e] text-[#eed59b] border border-[#5b9bd5]/30 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[#94a3b8] font-medium block">Hora Fin</label>
                  <input
                    type="time"
                    required
                    value={quickTaskFin}
                    onChange={(e) => handleHorasQuickTask(quickTaskInicio, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070e1e] text-[#eed59b] border border-[#5b9bd5]/30 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#94a3b8] font-medium block">Tipo de Trabajo</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQuickTaskTipo('PROFUNDO')}
                      className={`py-2 px-2 rounded-xl text-center font-bold text-[11px] transition-all border ${
                        quickTaskTipo === 'PROFUNDO'
                          ? 'bg-[#1e3a8a] text-white border-[#60a5fa]'
                          : 'bg-[#070e1e] text-[#94a3b8] border-[#5b9bd5]/20'
                      }`}
                    >
                      🧠 Profundo
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickTaskTipo('SUPERFICIAL')}
                      className={`py-2 px-2 rounded-xl text-center font-bold text-[11px] transition-all border ${
                        quickTaskTipo === 'SUPERFICIAL'
                          ? 'bg-[#334155] text-white border-slate-500'
                          : 'bg-[#070e1e] text-[#94a3b8] border-[#5b9bd5]/20'
                      }`}
                    >
                      ⚡ Superficial
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[#94a3b8] font-medium block">Horas Estimadas</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="24"
                    required
                    value={quickTaskHoras}
                    onChange={(e) => setQuickTaskHoras(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070e1e] text-white border border-[#5b9bd5]/30 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#5b9bd5]/15">
                <button
                  type="button"
                  onClick={() => setIsQuickCreateTaskOpen(false)}
                  className="btn-formal-outline px-4 py-2 rounded-full text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingQuickTask}
                  className="btn-formal px-5 py-2 rounded-full text-xs font-semibold"
                >
                  {creatingQuickTask ? 'Guardando...' : 'Guardar Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

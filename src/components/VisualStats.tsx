import React, { useState, useEffect, useMemo } from 'react';
import type {
  EstadisticasResponse,
  TendenciaDia,
  SesionFlujo,
  Intensidad,
  Incomodidad,
  DetalleDiaHistorico,
} from '../types/database';
import { getDiaDelCiclo, FECHA_INICIO_CICLO } from '../data/reflections';

interface VisualStatsProps {
  fechaHoy?: string;
  sesionesHoy?: SesionFlujo[];
  onGoToDailyLog?: () => void;
}

export interface HoraSlot24 {
  hora: number;
  horaLabel: string;
  rangoLabel: string;
  minutosFoco: number;
  horasNetas: number;
  sesiones: { sesion: SesionFlujo; minutos: number }[];
  intensidadPredominante: Intensidad | null;
  incomodidadPredominante: Incomodidad | null;
  esHoraActual: boolean;
  esPasada: boolean;
  esFutura: boolean;
}

// Algoritmo para generar curvas de Montaña Bézier Cúbica Suavizada (Catmull-Rom a Bézier)
function generateSmoothAreaPath(
  points: { x: number; y: number }[],
  baselineY: number
): { linePath: string; areaPath: string } {
  if (points.length === 0) return { linePath: '', areaPath: '' };
  if (points.length === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      areaPath: `M ${p.x.toFixed(1)} ${baselineY} L ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${p.x.toFixed(1)} ${baselineY} Z`,
    };
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const linePath = d;
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${d} L ${last.x.toFixed(1)} ${baselineY} L ${first.x.toFixed(1)} ${baselineY} Z`;

  return { linePath, areaPath };
}

// Función pura para construir las 24 ranuras horarias de cualquier jornada (Hoy o Histórica)
function compute24hSlots(
  targetDate: string,
  sessions: SesionFlujo[],
  currentLiveHour?: number | null
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

    let intAltaMins = 0;
    let intMediaMins = 0;
    let intBajaMins = 0;

    let incAltaMins = 0;
    let incMediaMins = 0;
    let incBajaMins = 0;

    sessions.forEach((s) => {
      if (!s.registrado_a) return;
      const regDate = new Date(s.registrado_a);
      const sessionEndMs = regDate.getTime();
      const durationMin = Math.round((parseFloat(String(s.horas_netas)) || 0) * 60);
      const sessionStartMs = sessionEndMs - durationMin * 60 * 1000;

      const overlapStart = Math.max(sessionStartMs, hourStartMs);
      const overlapEnd = Math.min(sessionEndMs, hourEndMs);

      let overlapMins = 0;
      if (overlapEnd > overlapStart) {
        overlapMins = Math.round((overlapEnd - overlapStart) / 60000);
      } else if (regDate.getHours() === h && durationMin > 0) {
        overlapMins = Math.min(60, durationMin);
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

    const isCurrent = currentLiveHour != null && currentLiveHour === h;
    const isPast = currentLiveHour != null ? h < currentLiveHour : true;
    const isFuture = currentLiveHour != null ? h > currentLiveHour : false;

    slots.push({
      hora: h,
      horaLabel,
      rangoLabel,
      minutosFoco: minutosEnHora,
      horasNetas: Number((minutosEnHora / 60).toFixed(2)),
      sesiones: sesionesEnSlot,
      intensidadPredominante,
      incomodidadPredominante,
      esHoraActual: isCurrent,
      esPasada: isPast,
      esFutura: isFuture,
    });
  }

  return slots;
}

export const VisualStats: React.FC<VisualStatsProps> = ({ fechaHoy, sesionesHoy, onGoToDailyLog }) => {
  const [stats, setStats] = useState<EstadisticasResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rangoDias, setRangoDias] = useState<7 | 14 | 30>(14);
  const [modoGraficoHist, setModoGraficoHist] = useState<'montana' | 'columnas'>('montana');
  const [hoveredDay, setHoveredDay] = useState<TendenciaDia | null>(null);
  const [mostrarModalHistorico, setMostrarModalHistorico] = useState<boolean>(false);
  const [selectedHora, setSelectedHora] = useState<number | null>(null);

  // Estado para la inspección y selección de un día específico en el histórico
  const [fechaSeleccionadaHist, setFechaSeleccionadaHist] = useState<string>('');
  const [detalleDiaHist, setDetalleDiaHist] = useState<DetalleDiaHistorico | null>(null);
  const [loadingDiaHist, setLoadingDiaHist] = useState<boolean>(false);
  const [selectedHoraHist, setSelectedHoraHist] = useState<number | null>(null);

  // Reloj en tiempo real que se actualiza cada segundo
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Manejador de teclado para cerrar el modal histórico con Escape
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

      // Si aún no hay fecha histórica seleccionada, inicializar con el día con actividad más relevante
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

  // Carga de detalle completo del día histórico seleccionado
  const fetchDetalleDiaHistorico = async (fecha: string) => {
    if (!fecha) return;
    try {
      setLoadingDiaHist(true);
      const res = await fetch(`/api/dia/historico?fecha=${fecha}`);
      if (!res.ok) {
        throw new Error('Error al cargar detalle del día');
      }
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

  // Progreso de la jornada de 24 horas (0 a 1440 minutos)
  const minutosTranscurridosHoy = horaActual * 60 + minutoActual;
  const pctDiaTranscurrido = Math.min(100, Math.round((minutosTranscurridosHoy / 1440) * 100));
  const minutosRestantesHoy = Math.max(0, 1440 - minutosTranscurridosHoy);
  const horasRestantesHoy = Math.floor(minutosRestantesHoy / 60);
  const minRestantesHoy = minutosRestantesHoy % 60;

  // Progreso del ciclo de 365 días
  const pctCiclo = ((diaCiclo / 365) * 100).toFixed(1);
  const diasRestantesCiclo = Math.max(0, 365 - diaCiclo);

  // Sesiones activas de hoy para el cronograma 24 horas
  const activeSesionesHoy = useMemo(() => {
    if (sesionesHoy && sesionesHoy.length > 0) return sesionesHoy;
    return stats?.hoy?.sesiones || [];
  }, [sesionesHoy, stats?.hoy?.sesiones]);

  // Construcción del Cronograma de 24 Horas de HOY
  const horasSlotsHoy: HoraSlot24[] = useMemo(() => {
    return compute24hSlots(targetFechaStr, activeSesionesHoy, horaActual);
  }, [activeSesionesHoy, targetFechaStr, horaActual]);

  const horasConFocoCount = horasSlotsHoy.filter((s) => s.minutosFoco > 0).length;
  const picoSlotHoy = useMemo(() => {
    return [...horasSlotsHoy].sort((a, b) => b.minutosFoco - a.minutosFoco)[0];
  }, [horasSlotsHoy]);

  const slotActivoHoy = horasSlotsHoy[selectedHora !== null ? selectedHora : horaActual] || horasSlotsHoy[0];

  // Curva de Montaña Circadiana de Hoy (24 puntos)
  const mountainHoyData = useMemo(() => {
    const width = 800;
    const height = 110;
    const paddingX = 18;
    const baselineY = height - 12;
    const topY = 12;
    const usableHeight = baselineY - topY;

    const step = (width - paddingX * 2) / 23;
    const points = horasSlotsHoy.map((slot, idx) => {
      const x = paddingX + idx * step;
      // Proporción de 0 a 60 minutos
      const ratio = Math.min(1, slot.minutosFoco / 60);
      const y = baselineY - ratio * usableHeight;
      return { x, y, slot };
    });

    const { linePath, areaPath } = generateSmoothAreaPath(points, baselineY);
    return { width, height, baselineY, points, linePath, areaPath };
  }, [horasSlotsHoy]);

  // Construcción del Cronograma de 24 Horas del DÍA HISTÓRICO SELECCIONADO
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
    return compute24hSlots(fechaSeleccionadaHist, sesionesDiaHist, isSelectedToday ? horaActual : null);
  }, [fechaSeleccionadaHist, sesionesDiaHist, isSelectedToday, horaActual]);

  const slotActivoHist = useMemo(() => {
    if (!horasSlotsHist.length) return null;
    if (selectedHoraHist !== null) {
      return horasSlotsHist[selectedHoraHist] || horasSlotsHist[0];
    }
    const firstWithFocus = horasSlotsHist.find((s) => s.minutosFoco > 0);
    return firstWithFocus || horasSlotsHist[12] || horasSlotsHist[0];
  }, [horasSlotsHist, selectedHoraHist]);

  // Helpers de formateo
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
    if (!s.registrado_a) return { inicio: '--:--', fin: '--:--', durMin: 0, exacta: '--:--' };
    try {
      const end = new Date(s.registrado_a);
      const durMin = Math.round((parseFloat(String(s.horas_netas)) || 0) * 60);
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

  // Render mientras carga
  if (loading && !stats) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-10 flex flex-col items-center justify-center min-h-[45vh] space-y-4">
        <div className="w-12 h-12 rounded-xl bg-midnight-900 border-2 border-retro-coral shadow-brutal animate-bounce flex items-center justify-center">
          <span className="text-xl">⛰️</span>
        </div>
        <p className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
          Trazando relieve acrílico de la jornada...
        </p>
      </div>
    );
  }

  // Render si hay error
  if (error && !stats) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-10">
        <div className="card-acrylic p-6 sm:p-8 text-center space-y-4 border-2 border-retro-coral">
          <span className="text-3xl">⚠️</span>
          <p className="text-sm font-display font-bold text-retro-coral uppercase tracking-wider">
            No se pudieron sincronizar las estadísticas
          </p>
          <p className="text-xs font-mono text-slate-400">{error}</p>
          <button
            onClick={fetchStats}
            className="btn-neo px-5 py-2.5 rounded-xl text-xs font-mono font-bold bg-retro-mint text-midnight-950 uppercase"
          >
            Reintentar Lectura
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Filter trend days according to selected range (para modal histórico)
  const filteredTrend = stats.tendenciaDias.slice(-rangoDias);
  const maxHoursInTrend = Math.max(...filteredTrend.map((d) => d.horasNetas), 4.5);
  const totalHorasEnRango = filteredTrend.reduce((acc, d) => acc + d.horasNetas, 0);

  // Curva de Montañas Históricas (Spline Bézier Suavizado para el modal histórico)
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

  // Estándares Mínimos de Exigencia y Disciplina
  const UMBRAL_TRABAJO_MIN_H = 3.0; // 3.0h netas mínimas diarias (Cal Newport)
  const UMBRAL_EXIGENCIA_MIN_PCT = 50; // Mínimo 50% de incomodidad Alta o Media
  const UMBRAL_EJERCICIO_MIN_H = 0.75; // 45 min (0.75h) diarias de entrenamiento físico

  // Métricas reales y exclusivas de HOY
  const horasHoy = stats.hoy?.horasNetas ?? 0;
  const ejercicioHoy = stats.hoy?.ejercicioHoras ?? 0;
  const cierreHoy = stats.hoy?.cierreRealizado ?? false;

  const incomodidadHoy = stats.hoy?.distribucionIncomodidad || { Alta: 0, Media: 0, Baja: 0 };
  const intensidadHoy = stats.hoy?.distribucionIntensidad || { Alta: 0, Media: 0, Baja: 0 };

  const horasFriccionHoy = incomodidadHoy.Alta + incomodidadHoy.Media;
  const pctExigenteHoy = horasHoy > 0 ? Math.round((horasFriccionHoy / horasHoy) * 100) : 0;

  // Lógica de Alertas para HOY
  const alertaTrabajo = horasHoy < UMBRAL_TRABAJO_MIN_H;
  const deficitTrabajoHoy = Math.max(0, UMBRAL_TRABAJO_MIN_H - horasHoy);

  const alertaEstudio = horasHoy === 0 || pctExigenteHoy < UMBRAL_EXIGENCIA_MIN_PCT || incomodidadHoy.Alta === 0;

  const alertaEntrenamiento = ejercicioHoy < UMBRAL_EJERCICIO_MIN_H;
  const deficitEjercicioHoy = Math.max(0, UMBRAL_EJERCICIO_MIN_H - ejercicioHoy);

  const alertaCierre = !cierreHoy;

  const totalAlertas = (alertaTrabajo ? 1 : 0) + (alertaEstudio ? 1 : 0) + (alertaEntrenamiento ? 1 : 0) + (alertaCierre ? 1 : 0);

  // Matriz y espectros para HOY
  const matrizHoy = stats.matrizCalidadHoy || { Alta: { Alta: 0, Media: 0, Baja: 0 }, Media: { Alta: 0, Media: 0, Baja: 0 }, Baja: { Alta: 0, Media: 0, Baja: 0 } };
  const totalIncomodidadHoy = incomodidadHoy.Alta + incomodidadHoy.Media + incomodidadHoy.Baja;
  const pctIncomodidadAltaHoy = totalIncomodidadHoy > 0 ? Number(((incomodidadHoy.Alta / totalIncomodidadHoy) * 100).toFixed(1)) : 0;
  const pctIncomodidadMediaHoy = totalIncomodidadHoy > 0 ? Number(((incomodidadHoy.Media / totalIncomodidadHoy) * 100).toFixed(1)) : 0;
  const pctIncomodidadBajaHoy = totalIncomodidadHoy > 0 ? Number(((incomodidadHoy.Baja / totalIncomodidadHoy) * 100).toFixed(1)) : 0;

  const totalIntensidadHoy = intensidadHoy.Alta + intensidadHoy.Media + intensidadHoy.Baja;
  const pctIntensidadAltaHoy = totalIntensidadHoy > 0 ? Number(((intensidadHoy.Alta / totalIntensidadHoy) * 100).toFixed(1)) : 0;
  const pctIntensidadMediaHoy = totalIntensidadHoy > 0 ? Number(((intensidadHoy.Media / totalIntensidadHoy) * 100).toFixed(1)) : 0;
  const pctIntensidadBajaHoy = totalIntensidadHoy > 0 ? Number(((intensidadHoy.Baja / totalIntensidadHoy) * 100).toFixed(1)) : 0;

  // Matriz y espectros para HISTÓRICO
  const matrizHistorica = stats.matrizCalidad || { Alta: { Alta: 0, Media: 0, Baja: 0 }, Media: { Alta: 0, Media: 0, Baja: 0 }, Baja: { Alta: 0, Media: 0, Baja: 0 } };
  const totalIncomodidadHist = stats.distribucionIncomodidad.Alta + stats.distribucionIncomodidad.Media + stats.distribucionIncomodidad.Baja;
  const pctIncomodidadAltaHist = totalIncomodidadHist > 0 ? Number(((stats.distribucionIncomodidad.Alta / totalIncomodidadHist) * 100).toFixed(1)) : 0;
  const pctIncomodidadMediaHist = totalIncomodidadHist > 0 ? Number(((stats.distribucionIncomodidad.Media / totalIncomodidadHist) * 100).toFixed(1)) : 0;
  const pctIncomodidadBajaHist = totalIncomodidadHist > 0 ? Number(((stats.distribucionIncomodidad.Baja / totalIncomodidadHist) * 100).toFixed(1)) : 0;

  const totalIntensidadHist = stats.distribucionIntensidad.Alta + stats.distribucionIntensidad.Media + stats.distribucionIntensidad.Baja;
  const pctIntensidadAltaHist = totalIntensidadHist > 0 ? Number(((stats.distribucionIntensidad.Alta / totalIntensidadHist) * 100).toFixed(1)) : 0;
  const pctIntensidadMediaHist = totalIntensidadHist > 0 ? Number(((stats.distribucionIntensidad.Media / totalIntensidadHist) * 100).toFixed(1)) : 0;
  const pctIntensidadBajaHist = totalIntensidadHist > 0 ? Number(((stats.distribucionIntensidad.Baja / totalIntensidadHist) * 100).toFixed(1)) : 0;

  // Días con actividad histórica para navegación rápida
  const diasConActividadLista = stats.diasHistoricosConActividad || [];

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 my-4 space-y-6">
      {/* 1. TOP HEADER ESTILO PIZARRA ACRÍLICA & RETRO-PRESS */}
      <div className="card-acrylic p-5 sm:p-7 space-y-5 border-2 border-white/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Lado Izquierdo: Momento Temporal Exacto & Ciclo 365 */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag-retro inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-retro-peach text-midnight-950">
                <span className="w-2 h-2 rounded-full bg-midnight-950 animate-ping"></span>
                <span>DÍA {diaCiclo} / 365</span>
              </span>

              <span className="tag-retro inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-midnight-950 text-slate-200 border-white/20">
                <span className="text-retro-mint">⏱</span>
                <span className="text-retro-mint font-mono font-bold tracking-wider">{tiempoExactoStr}</span>
                <span className="text-[10px] text-slate-400 font-normal">EN VIVO</span>
              </span>

              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-bold px-1.5">
                • {fechaFormateadaCapital}
              </span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight text-white uppercase">
              Tablero de Estadísticas
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl font-mono">
              Pizarra oscura acrílica de control diario. El marcador se resetea a cero cada medianoche. Conquista exclusivamente las 24 horas de hoy.
            </p>
          </div>

          {/* Lado Derecho: Racha Élite en la Esquina & Botón de Ventana Histórica */}
          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
            {/* Racha Élite Bonita en la Esquina (Mínimo 75% en los 4 pilares) */}
            <div
              className={`tag-retro flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all ${
                stats.rachaActual > 0
                  ? 'bg-retro-amber text-midnight-950 shadow-brutal'
                  : 'bg-midnight-900 text-slate-300'
              }`}
              title="La racha solo se forja cuando el día concluye con esfuerzo riguroso (≥75% en trabajo profundo, incomodidad mental, entrenamiento físico y cierre sellado)"
            >
              <span className="text-xl">{stats.rachaActual > 0 ? '🔥' : '🕯️'}</span>
              <div className="text-left">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-display font-extrabold leading-none">
                    {stats.rachaActual}
                  </span>
                  <span className="text-[10px] font-mono font-extrabold uppercase">
                    {stats.rachaActual === 1 ? 'DÍA RACHA' : 'DÍAS RACHA'}
                  </span>
                </div>
                <span className="text-[9px] font-mono block leading-tight font-semibold opacity-85">
                  ESFUERZO ÉLITE ≥75%
                </span>
              </div>
            </div>

            {/* Botón para Abrir Ventana / Modal Histórico */}
            <button
              type="button"
              onClick={() => setMostrarModalHistorico(true)}
              className="btn-neo inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold bg-retro-lavender text-midnight-950 uppercase"
              title="Abrir ventana flotante con el histórico acumulado y auditoría por día"
            >
              <span className="text-base">🏛️</span>
              <span>Ver Histórico</span>
            </button>

            {onGoToDailyLog && (
              <button
                onClick={onGoToDailyLog}
                className="btn-neo inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-retro-mint text-midnight-950 uppercase"
              >
                <span>+ Registrar Bloque</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Progreso Temporal de Hoy y del Ciclo 365 con diseño Neo-Brutalista */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t-2 border-white/10 text-xs font-mono">
          {/* Progreso de la Jornada (24 horas) */}
          <div className="p-3.5 rounded-xl bg-midnight-950/90 border-2 border-white/10 shadow-brutal-sm space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span className="text-slate-300 flex items-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-retro-mint"></span>
                Jornada de Hoy: {pctDiaTranscurrido}%
              </span>
              <span className="text-retro-mint font-mono">
                {horasRestantesHoy}h {minRestantesHoy}m para 23:59
              </span>
            </div>
            <div className="h-2.5 w-full rounded-md bg-midnight-900 overflow-hidden border border-white/15 p-0.5">
              <div
                style={{ width: `${pctDiaTranscurrido}%` }}
                className="h-full bg-retro-mint rounded-sm transition-all duration-700"
              ></div>
            </div>
          </div>

          {/* Progreso del Ciclo de 365 días */}
          <div className="p-3.5 rounded-xl bg-midnight-950/90 border-2 border-white/10 shadow-brutal-sm space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span className="text-slate-300 flex items-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-retro-lavender"></span>
                Ciclo Anual: Día {diaCiclo}/365 ({pctCiclo}%)
              </span>
              <span className="text-retro-lavender font-mono">
                {diasRestantesCiclo} días por conquistar
              </span>
            </div>
            <div className="h-2.5 w-full rounded-md bg-midnight-900 overflow-hidden border border-white/15 p-0.5">
              <div
                style={{ width: `${Math.min(100, Math.max(0.5, (diaCiclo / 365) * 100))}%` }}
                className="h-full bg-retro-lavender rounded-sm transition-all duration-700"
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI CARDS ESTILO BLOQUE EDITORIAL DE ATELIER: ESTRICTAMENTE DEL DÍA DE HOY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Horas Netas de Hoy */}
        <div
          className={`card-acrylic p-4 sm:p-5 border-2 space-y-1 transition-all ${
            horasHoy >= UMBRAL_TRABAJO_MIN_H
              ? 'border-retro-mint shadow-brutal-mint'
              : horasHoy > 0
              ? 'border-retro-amber shadow-brutal'
              : 'border-white/15 shadow-brutal'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              01 / DEEP WORK
            </span>
            <span className="text-xs">⚡</span>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span
              className={`text-3xl sm:text-4xl font-display font-extrabold tabular-nums ${
                horasHoy >= UMBRAL_TRABAJO_MIN_H
                  ? 'text-retro-mint'
                  : horasHoy > 0
                  ? 'text-retro-amber'
                  : 'text-retro-coral'
              }`}
            >
              {horasHoy.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400 font-bold uppercase">/ 3.0h meta</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono font-medium pt-1">
            {horasHoy >= UMBRAL_TRABAJO_MIN_H
              ? '✓ Umbral Newport superado'
              : deficitTrabajoHoy > 0
              ? `Faltan ${deficitTrabajoHoy.toFixed(1)}h hoy`
              : '0.0h registradas hoy'}
          </p>
        </div>

        {/* KPI 2: Fricción Cognitiva de Hoy */}
        <div
          className={`card-acrylic p-4 sm:p-5 border-2 space-y-1 transition-all ${
            pctExigenteHoy >= UMBRAL_EXIGENCIA_MIN_PCT && horasHoy > 0
              ? 'border-retro-coral shadow-brutal-coral'
              : 'border-white/15 shadow-brutal'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              02 / FRICCIÓN MENTAL
            </span>
            <span className="text-xs">🔥</span>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span
              className={`text-3xl sm:text-4xl font-display font-extrabold tabular-nums ${
                pctExigenteHoy >= UMBRAL_EXIGENCIA_MIN_PCT && horasHoy > 0
                  ? 'text-retro-coral'
                  : horasHoy > 0
                  ? 'text-retro-amber'
                  : 'text-slate-500'
              }`}
            >
              {horasHoy > 0 ? `${pctExigenteHoy}%` : '0%'}
            </span>
            <span className="text-xs font-mono text-slate-400 font-bold uppercase">/ 50% min</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono font-medium pt-1">
            {horasHoy > 0
              ? `${horasFriccionHoy.toFixed(1)}h en incomodidad alta/media`
              : 'Sin bloques desafiantes hoy'}
          </p>
        </div>

        {/* KPI 3: Entrenamiento de Hoy */}
        <div
          className={`card-acrylic p-4 sm:p-5 border-2 space-y-1 transition-all ${
            ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
              ? 'border-retro-mint shadow-brutal-mint'
              : 'border-white/15 shadow-brutal'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              03 / TEMPLO FÍSICO
            </span>
            <span className="text-xs">🏃</span>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span
              className={`text-3xl sm:text-4xl font-display font-extrabold tabular-nums ${
                ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
                  ? 'text-retro-mint'
                  : ejercicioHoy > 0
                  ? 'text-retro-amber'
                  : 'text-retro-coral'
              }`}
            >
              {ejercicioHoy.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400 font-bold uppercase">/ 0.75h min</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono font-medium pt-1">
            {ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
              ? '✓ Templo forjado con rigor'
              : deficitEjercicioHoy > 0
              ? `Faltan ${deficitEjercicioHoy.toFixed(1)}h de entreno`
              : 'Sin entrenamiento hoy'}
          </p>
        </div>

        {/* KPI 4: Ritual de Cierre */}
        <div
          className={`card-acrylic p-4 sm:p-5 border-2 space-y-1 transition-all ${
            cierreHoy
              ? 'border-retro-lavender shadow-brutal-lavender'
              : 'border-white/15 shadow-brutal'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              04 / RITUAL CIERRE
            </span>
            <span className="text-xs">🌙</span>
          </div>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span
              className={`text-2xl sm:text-3xl font-display font-extrabold ${
                cierreHoy ? 'text-retro-lavender' : 'text-slate-500'
              }`}
            >
              {cierreHoy ? 'SELLADO' : 'ABIERTO'}
            </span>
            <span className="text-xs font-mono text-slate-400 font-bold">
              {cierreHoy ? '✓' : '11:59 PM'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono font-medium pt-1">
            {cierreHoy ? 'Día confinado con rigor' : 'Pendiente antes de medianoche'}
          </p>
        </div>
      </div>

      {/* 3. MONTAÑA CIRCADIANA Y CRONOGRAMA DE 24 HORAS DE HOY */}
      <section className="card-acrylic p-5 sm:p-7 space-y-6 border-2 border-white/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-white/10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-mint text-midnight-950">
                CIRCADIANO
              </span>
              <h3 className="text-base sm:text-xl font-display font-bold text-white uppercase tracking-tight">
                Montaña de Foco &amp; Cronograma 24 Horas de Hoy
              </h3>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Curva continua de relieve circadiano: picos de inmersión hora a hora desde las 00:00 hasta las 23:59.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap text-[11px] font-mono">
            <span className="tag-retro px-2.5 py-1 rounded-md bg-midnight-950 text-slate-200 border-white/20">
              Activas: <strong className="text-retro-mint font-mono">{horasConFocoCount}</strong>/24h
            </span>
            <span className="tag-retro px-2.5 py-1 rounded-md bg-midnight-950 text-retro-lavender border-retro-lavender/40">
              📍 HORA ACTUAL: <strong>{String(horaActual).padStart(2, '0')}:00</strong>
            </span>
          </div>
        </div>

        {/* GRÁFICO SVG DE MONTAÑA CIRCADIANA DE HOY (Ondas de relieve) */}
        <div className="p-4 rounded-2xl bg-midnight-950/90 border-2 border-white/10 shadow-brutal space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <span>⛰️</span> Relieve Montañoso de Concentración (24h)
            </span>
            <span className="text-retro-mint font-bold">
              {horasHoy > 0 ? `${(horasHoy * 60).toFixed(0)} min netos acumulados hoy` : 'Esperando primer bloque'}
            </span>
          </div>

          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${mountainHoyData.width} ${mountainHoyData.height}`}
              className="w-full h-28 sm:h-36 overflow-visible"
            >
              <defs>
                <linearGradient id="circadianGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#86EFAC" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#86EFAC" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#86EFAC" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="circadianStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#C4B5FD" />
                  <stop offset="50%" stopColor="#86EFAC" />
                  <stop offset="100%" stopColor="#FDA4AF" />
                </linearGradient>
              </defs>

              {/* Líneas horizontales de guía */}
              <line
                x1="0"
                y1={mountainHoyData.baselineY}
                x2={mountainHoyData.width}
                y2={mountainHoyData.baselineY}
                stroke="#1E293B"
                strokeWidth="1.5"
              />
              <line
                x1="0"
                y1={mountainHoyData.baselineY - 45}
                x2={mountainHoyData.width}
                y2={mountainHoyData.baselineY - 45}
                stroke="#1E293B"
                strokeDasharray="4 4"
                strokeWidth="1"
              />

              {/* Área de la montaña con gradiente acrílico */}
              {horasHoy > 0 && (
                <path
                  d={mountainHoyData.areaPath}
                  fill="url(#circadianGrad)"
                  className="transition-all duration-700"
                />
              )}

              {/* Trazo continuo de la cresta montañosa */}
              <path
                d={mountainHoyData.linePath}
                fill="none"
                stroke={horasHoy > 0 ? 'url(#circadianStroke)' : '#334155'}
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-700"
              />

              {/* Marcadores de cumbres en cada hora */}
              {mountainHoyData.points.map((pt) => {
                const isCurrent = pt.slot.esHoraActual;
                const isSelected = (selectedHora !== null ? selectedHora : horaActual) === pt.slot.hora;
                const hasFocus = pt.slot.minutosFoco > 0;

                return (
                  <g
                    key={pt.slot.hora}
                    className="cursor-pointer group"
                    onClick={() => setSelectedHora(pt.slot.hora)}
                  >
                    {isCurrent && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="8"
                        fill="none"
                        stroke="#C4B5FD"
                        strokeWidth="2"
                        className="animate-ping opacity-75"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : hasFocus ? 4.5 : 2.5}
                      fill={
                        isSelected
                          ? '#FFFFFF'
                          : isCurrent
                          ? '#C4B5FD'
                          : hasFocus
                          ? '#86EFAC'
                          : '#1E293B'
                      }
                      stroke="#000000"
                      strokeWidth="1.5"
                      className="transition-all duration-200 group-hover:scale-150"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Guía Visual Rápida de Convenciones Neo-Brutalista */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono px-3 py-2 rounded-xl bg-midnight-950/80 border-2 border-white/10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400 uppercase font-bold">Intensidad:</span>
            <span className="flex items-center gap-1.5 text-retro-mint font-bold">
              <span className="w-2.5 h-2.5 rounded-sm bg-retro-mint border border-black"></span> Alta
            </span>
            <span className="flex items-center gap-1.5 text-retro-amber font-bold">
              <span className="w-2.5 h-2.5 rounded-sm bg-retro-amber border border-black"></span> Media
            </span>
            <span className="flex items-center gap-1.5 text-retro-ice font-bold">
              <span className="w-2.5 h-2.5 rounded-sm bg-retro-ice border border-black"></span> Baja
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400 uppercase font-bold">Incomodidad:</span>
            <span className="flex items-center gap-1.5 text-retro-coral font-bold">
              <span className="w-2 h-2 rounded-full bg-retro-coral border border-black"></span> Alta (Frontera)
            </span>
            <span className="flex items-center gap-1.5 text-retro-amber font-bold">
              <span className="w-2 h-2 rounded-full bg-retro-amber border border-black"></span> Media (Esfuerzo)
            </span>
            <span className="flex items-center gap-1.5 text-retro-ice font-bold">
              <span className="w-2 h-2 rounded-full bg-retro-ice border border-black"></span> Baja (Confort)
            </span>
          </div>
        </div>

        {/* Pista Gráfica Interactiva de las 24 Columnas */}
        <div className="overflow-x-auto pb-3 pt-2">
          <div className="min-w-[660px]">
            <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-32 border-b-2 border-white/10 px-1">
              {horasSlotsHoy.map((slot) => {
                const isSelected = (selectedHora !== null ? selectedHora : horaActual) === slot.hora;
                const hasFocus = slot.minutosFoco > 0;
                const fillPercent = Math.max(hasFocus ? 16 : 0, Math.round((slot.minutosFoco / 60) * 100));

                let barColor = 'bg-slate-700';
                if (slot.intensidadPredominante === 'Alta') barColor = 'bg-retro-mint';
                else if (slot.intensidadPredominante === 'Media') barColor = 'bg-retro-amber';
                else if (slot.intensidadPredominante === 'Baja') barColor = 'bg-retro-ice';

                let dotColor = null;
                if (slot.incomodidadPredominante === 'Alta') dotColor = 'bg-retro-coral';
                else if (slot.incomodidadPredominante === 'Media') dotColor = 'bg-retro-amber';
                else if (slot.incomodidadPredominante === 'Baja') dotColor = 'bg-retro-ice';

                return (
                  <div
                    key={slot.hora}
                    onClick={() => setSelectedHora(slot.hora)}
                    className={`flex-1 flex flex-col items-center justify-end h-full cursor-pointer group transition-all relative ${
                      slot.esHoraActual ? 'z-10' : ''
                    }`}
                    title={`${slot.rangoLabel}: ${slot.minutosFoco} min foco (${slot.intensidadPredominante || 'Sin foco'})`}
                  >
                    {/* Indicador de Hora Actual Arriba */}
                    {slot.esHoraActual && (
                      <span className="tag-retro absolute -top-6 text-[8px] px-1 py-0.5 rounded bg-retro-lavender text-midnight-950 whitespace-nowrap animate-bounce">
                        📍 AHORA
                      </span>
                    )}

                    {/* Indicador de Incomodidad (Punto superior) */}
                    <div className="h-3 flex items-center justify-center mb-1">
                      {dotColor ? (
                        <span className={`w-2 h-2 rounded-full ${dotColor} border border-black shadow-sm`}></span>
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-white/10"></span>
                      )}
                    </div>

                    {/* Contenedor de la Barra de la Hora con Sombra Neo-Brutalista */}
                    <div
                      className={`w-full max-w-[26px] h-20 rounded-lg flex flex-col justify-end p-0.5 transition-all duration-200 border-2 ${
                        slot.esHoraActual
                          ? 'bg-midnight-900 border-retro-lavender shadow-brutal-lavender'
                          : isSelected
                          ? 'bg-midnight-800 border-white shadow-brutal'
                          : hasFocus
                          ? 'bg-midnight-900 border-white/20 hover:border-retro-mint'
                          : slot.esFutura
                          ? 'bg-midnight-950/40 border-dashed border-white/10'
                          : 'bg-midnight-950/80 border-white/10 hover:border-white/30'
                      } ${isSelected ? 'scale-105' : ''}`}
                    >
                      {/* Relleno de concentración proporcional a minutosFoco (0-60m) */}
                      {hasFocus ? (
                        <div
                          style={{ height: `${fillPercent}%` }}
                          className={`w-full rounded-md border border-black/40 transition-all duration-300 ${barColor}`}
                        ></div>
                      ) : (
                        <div className="w-full h-1 rounded-full bg-transparent"></div>
                      )}
                    </div>

                    {/* Etiqueta de la Hora */}
                    <span
                      className={`mt-1.5 text-[10px] font-mono leading-none transition-colors ${
                        slot.esHoraActual
                          ? 'text-retro-lavender font-bold'
                          : isSelected
                          ? 'text-white font-bold'
                          : hasFocus
                          ? 'text-slate-200 font-semibold'
                          : 'text-slate-500'
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

        {/* 4. TARJETA DE INSPECCIÓN INTERACTIVA DE LA HORA SELECCIONADA (HOY) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/90 border-2 border-white/15 shadow-brutal space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b-2 border-white/10">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base font-display font-bold text-white uppercase">
                🕒 Tramo Horario: {slotActivoHoy.rangoLabel}
              </span>
              {slotActivoHoy.esHoraActual && (
                <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-lavender text-midnight-950">
                  📍 HORA EN CURSO (TIEMPO REAL)
                </span>
              )}
              {slotActivoHoy.minutosFoco > 0 && !slotActivoHoy.esHoraActual && (
                <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-mint text-midnight-950">
                  ✓ FOCO EJECUTADO
                </span>
              )}
              {slotActivoHoy.minutosFoco === 0 && slotActivoHoy.esPasada && (
                <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-midnight-900 text-slate-400">
                  INTERVALO INACTIVO
                </span>
              )}
              {slotActivoHoy.esFutura && (
                <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-midnight-900 text-slate-500">
                  ⏳ TRAMO FUTURO
                </span>
              )}
            </div>

            <span className="text-xs font-mono text-retro-mint font-bold self-start sm:self-auto">
              {slotActivoHoy.minutosFoco} min netos ({slotActivoHoy.horasNetas.toFixed(2)}h)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Intensidad del Tramo */}
            <div className="p-3 rounded-xl bg-midnight-900/90 border border-white/10 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Intensidad</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-sm border border-black ${
                    slotActivoHoy.intensidadPredominante === 'Alta'
                      ? 'bg-retro-mint'
                      : slotActivoHoy.intensidadPredominante === 'Media'
                      ? 'bg-retro-amber'
                      : slotActivoHoy.intensidadPredominante === 'Baja'
                      ? 'bg-retro-ice'
                      : 'bg-slate-700'
                  }`}
                ></span>
                <span className="font-semibold text-white">
                  {slotActivoHoy.intensidadPredominante
                    ? `${slotActivoHoy.intensidadPredominante} Inmersión`
                    : 'Sin foco en esta hora'}
                </span>
              </div>
            </div>

            {/* Incomodidad del Tramo */}
            <div className="p-3 rounded-xl bg-midnight-900/90 border border-white/10 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Incomodidad Cognitiva</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full border border-black ${
                    slotActivoHoy.incomodidadPredominante === 'Alta'
                      ? 'bg-retro-coral'
                      : slotActivoHoy.incomodidadPredominante === 'Media'
                      ? 'bg-retro-amber'
                      : slotActivoHoy.incomodidadPredominante === 'Baja'
                      ? 'bg-retro-ice'
                      : 'bg-slate-700'
                  }`}
                ></span>
                <span className="font-semibold text-white">
                  {slotActivoHoy.incomodidadPredominante
                    ? `${slotActivoHoy.incomodidadPredominante} Fricción`
                    : 'Sin resistencia'}
                </span>
              </div>
            </div>

            {/* Pico de la Jornada */}
            <div className="p-3 rounded-xl bg-midnight-900/90 border border-white/10 space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Pico de la Jornada</span>
              <span className="font-semibold text-white block">
                {picoSlotHoy && picoSlotHoy.minutosFoco > 0
                  ? `${picoSlotHoy.horaLabel} (${picoSlotHoy.minutosFoco} min a tope)`
                  : 'Aún sin bloques registrados'}
              </span>
            </div>
          </div>

          {/* Bloques de Foco Detallados en esta Hora */}
          {slotActivoHoy.sesiones.length > 0 ? (
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-mono font-bold text-slate-400 block uppercase">
                Bloques desarrollados durante este tramo ({slotActivoHoy.sesiones.length}):
              </span>
              <div className="space-y-2">
                {slotActivoHoy.sesiones.map((item, idx) => (
                  <div
                    key={item.sesion.id || idx}
                    className="p-3.5 rounded-xl bg-midnight-900 border-2 border-white/10 shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-white text-sm">{item.sesion.tipo}</span>
                        <span className="tag-retro text-[9px] px-1.5 py-0.5 rounded bg-retro-mint text-midnight-950">
                          {item.minutos} min en este tramo ({item.sesion.horas_netas}h total)
                        </span>
                      </div>
                      {item.sesion.calidad && (
                        <p className="text-[11px] text-slate-300 italic font-serif">
                          &ldquo;{item.sesion.calidad}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                      <span className="tag-retro px-2 py-0.5 rounded bg-midnight-950 text-slate-200">
                        Intensidad: <b className="text-retro-mint">{item.sesion.intensidad}</b>
                      </span>
                      <span className="tag-retro px-2 py-0.5 rounded bg-midnight-950 text-slate-200">
                        Incomodidad: <b className="text-retro-coral">{item.sesion.incomodidad}</b>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-midnight-900/60 border-2 border-dashed border-white/10 text-center text-xs text-slate-400 font-mono">
              {slotActivoHoy.esHoraActual ? (
                <span>
                  Estás en esta hora ahora mismo. ¿Qué tarea vas a conquistar? Registra un bloque de foco para pintar esta cumbre.
                </span>
              ) : slotActivoHoy.esPasada ? (
                <span>No se registraron sesiones durante este tramo horario.</span>
              ) : (
                <span>Tramo futuro de la jornada. Tu disciplina definirá la altura de esta cumbre.</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 4. SEMÁFORO DE EXIGENCIA Y DISCIPLINA DE HOY */}
      <section className="card-acrylic p-5 sm:p-7 space-y-6 border-2 border-white/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-white/10">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-xl font-display font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-amber text-midnight-950">
                RIGOR
              </span>
              Semáforo de Exigencia &amp; Disciplina Diaria
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Evaluación estricta de los 4 pilares no negociables de la jornada actual
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {totalAlertas === 0 ? (
              <span className="tag-retro px-3 py-1.5 rounded-lg text-xs bg-retro-mint text-midnight-950 shadow-brutal-mint">
                ✓ 100% ESTÁNDARES SUPERADOS
              </span>
            ) : (
              <span className="tag-retro px-3 py-1.5 rounded-lg text-xs bg-retro-coral text-midnight-950 shadow-brutal-coral">
                ⚠ {totalAlertas} {totalAlertas === 1 ? 'PILAR PENDIENTE' : 'PILARES PENDIENTES'}
              </span>
            )}
          </div>
        </div>

        {totalAlertas > 0 ? (
          <div className="space-y-4">
            {/* Alerta 1: Trabajo Profundo Newport */}
            {alertaTrabajo && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border-2 border-retro-coral/60 shadow-brutal space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="tag-retro px-2.5 py-0.5 rounded text-[10px] bg-retro-coral text-midnight-950">
                    ⚠ DÉFICIT DE TRABAJO PROFUNDO
                  </span>
                  <span className="text-xs font-mono text-retro-coral font-bold">
                    {horasHoy.toFixed(1)}h / 3.0h meta
                  </span>
                </div>
                <h4 className="text-base font-display font-bold text-white tracking-tight">
                  No estás cumpliendo el umbral mínimo de Deep Work de Cal Newport
                </h4>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">
                  Has registrado {horasHoy.toFixed(1)}h de trabajo neto hoy. El estándar mínimo para un trabajador del conocimiento de élite son 3.0 horas netas. Te faltan {deficitTrabajoHoy.toFixed(1)}h para conquistar la jornada.
                </p>
                <blockquote className="p-3.5 rounded-xl bg-midnight-900 border-l-4 border-retro-coral border-2 border-white/10 text-xs text-slate-200 space-y-1">
                  <p className="italic font-serif text-[11px] sm:text-xs text-slate-200 leading-relaxed">
                    &ldquo;No es que tengamos poco tiempo, sino que perdemos mucho. La vida es suficientemente larga para quien sabe emplearla con rigor.&rdquo;
                  </p>
                  <span className="block text-[10px] font-mono text-retro-coral font-bold uppercase">
                    — Séneca <span className="text-slate-400 font-normal">(De la brevedad de la vida)</span>
                  </span>
                </blockquote>
              </div>
            )}

            {/* Alerta 2: Fricción Cognitiva y Estudio */}
            {alertaEstudio && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border-2 border-retro-amber/60 shadow-brutal space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="tag-retro px-2.5 py-0.5 rounded text-[10px] bg-retro-amber text-midnight-950">
                    ⚠ CONFORT INTELECTUAL EXCESIVO
                  </span>
                  <span className="text-xs font-mono text-retro-amber font-bold">
                    {pctExigenteHoy}% / 50% min exigencia
                  </span>
                </div>
                <h4 className="text-base font-display font-bold text-white tracking-tight">
                  Nivel de incomodidad mental insuficiente: Evita las tareas rutinarias
                </h4>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">
                  {horasHoy === 0
                    ? 'Aún no has registrado bloques de estudio o resolución de problemas desafiantes.'
                    : `Solo el ${pctExigenteHoy}% de tu tiempo de hoy estuvo en la frontera de dificultad (Incomodidad Alta/Media). Si el trabajo no te exige esfuerzo cognitivo genuino, no estás expandiendo tu mente.`}
                </p>
                <blockquote className="p-3.5 rounded-xl bg-midnight-900 border-l-4 border-retro-amber border-2 border-white/10 text-xs text-slate-200 space-y-1">
                  <p className="italic font-serif text-[11px] sm:text-xs text-slate-200 leading-relaxed">
                    &ldquo;Si tienes que comerte un sapo vivo, no te sirve de nada quedarte mirándolo mucho rato. Cómetelo a primera hora y sin titubear.&rdquo;
                  </p>
                  <span className="block text-[10px] font-mono text-retro-amber font-bold uppercase">
                    — Brian Tracy <span className="text-slate-400 font-normal">(Trágate ese sapo)</span>
                  </span>
                </blockquote>
              </div>
            )}

            {/* Alerta 3: Entrenamiento Físico */}
            {alertaEntrenamiento && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border-2 border-retro-coral/60 shadow-brutal space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="tag-retro px-2.5 py-0.5 rounded text-[10px] bg-retro-coral text-midnight-950">
                    ⚠ ALERTA DE DUREZA FÍSICA
                  </span>
                  <span className="text-xs font-mono text-retro-coral font-bold">
                    {ejercicioHoy.toFixed(1)}h / 0.75h min
                  </span>
                </div>
                <h4 className="text-base font-display font-bold text-white tracking-tight">
                  Templo Físico sin Entrenar: No descuides el pilar biológico
                </h4>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">
                  {ejercicioHoy === 0
                    ? 'Hoy no has registrado entrenamiento físico. La claridad mental y la resistencia de foco exigen forjar el cuerpo a diario.'
                    : `Llevas ${ejercicioHoy.toFixed(1)}h de entreno hoy. Te faltan ${deficitEjercicioHoy.toFixed(1)}h para completar los 45 minutos mínimos exigidos.`}
                </p>
                <blockquote className="p-3.5 rounded-xl bg-midnight-900 border-l-4 border-retro-coral border-2 border-white/10 text-xs text-slate-200 space-y-1">
                  <p className="italic font-serif text-[11px] sm:text-xs text-slate-200 leading-relaxed">
                    &ldquo;Cuando tu mente te dice que estás agotado y no puedes más, en realidad solo estás al 40% de tu capacidad real. Empújate.&rdquo;
                  </p>
                  <span className="block text-[10px] font-mono text-retro-coral font-bold uppercase">
                    — David Goggins <span className="text-slate-400 font-normal">(Can&apos;t Hurt Me)</span>
                  </span>
                </blockquote>
              </div>
            )}

            {/* Alerta 4: Ritual de Cierre Pendiente */}
            {alertaCierre && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border-2 border-retro-lavender/60 shadow-brutal space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="tag-retro px-2.5 py-0.5 rounded text-[10px] bg-retro-lavender text-midnight-950">
                    🌙 ALERTA DE DESCONEXIÓN
                  </span>
                  <span className="text-xs font-mono text-retro-lavender font-bold">
                    Cierre pendiente
                  </span>
                </div>
                <h4 className="text-base font-display font-bold text-white tracking-tight">
                  Ritual de Cierre Diario Pendiente: Riesgo de bucles cognitivos residuales
                </h4>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">
                  Cal Newport insiste en que el trabajo debe tener un límite estricto al anochecer. Si no realizas el cierre formal antes de las 11:59 PM, las tareas inacabadas continuarán fragmentando tu descanso nocturno.
                </p>
                <blockquote className="p-3.5 rounded-xl bg-midnight-900 border-l-4 border-retro-lavender border-2 border-white/10 text-xs text-slate-200 space-y-1">
                  <p className="italic font-serif text-[11px] sm:text-xs text-slate-200 leading-relaxed">
                    &ldquo;Al anochecer, confina tus pensamientos y haz las paces con lo inacabado. Quien no descansa con rigor, no trabaja con genialidad.&rdquo;
                  </p>
                  <span className="block text-[10px] font-mono text-retro-lavender font-bold uppercase">
                    — Marco Aurelio <span className="text-slate-400 font-normal">(Meditaciones, Libro IV)</span>
                  </span>
                </blockquote>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 sm:p-6 rounded-2xl bg-midnight-950/90 border-2 border-retro-mint shadow-brutal-mint space-y-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-retro-mint text-2xl">🏆</span>
                <span className="tag-retro px-2.5 py-0.5 rounded text-xs bg-retro-mint text-midnight-950">
                  ESTÁNDAR ÉLITE CONQUISTADO
                </span>
              </div>
              <h4 className="text-lg font-display font-bold text-white tracking-tight uppercase">
                Disciplina y Exigencia Impecables: Todos los mínimos de hoy superados
              </h4>
              <p className="text-xs font-mono text-slate-300 leading-relaxed">
                Has cumplido con los umbrales de Trabajo Profundo (≥3.0h), Fricción Cognitiva (≥50%), Entrenamiento Físico y Cierre. Mantén el estándar y no permitas que la autocomplacencia debilite tu línea.
              </p>
            </div>
            <blockquote className="p-3.5 rounded-xl bg-midnight-900 border-2 border-retro-mint/40 text-xs text-slate-200 max-w-xs text-left shrink-0 shadow-brutal-sm">
              <p className="italic font-serif text-[11px] text-retro-mint leading-relaxed">
                &ldquo;La excelencia no es un acto aislado, sino un hábito forjado día a día.&rdquo;
              </p>
              <span className="block text-[10px] font-mono text-slate-400 mt-1 font-bold">— Aristóteles</span>
            </blockquote>
          </div>
        )}
      </section>

      {/* 5. CALIDAD COGNITIVA DE HOY: INTENSIDAD & INCOMODIDAD */}
      <section className="card-acrylic p-5 sm:p-7 space-y-6 border-2 border-white/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-white/10">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-xl font-display font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-coral text-midnight-950">
                ESPECTRO
              </span>
              Calidad Cognitiva de Hoy: Intensidad &amp; Incomodidad
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Distribución de fricción mental y potencia de inmersión en la jornada actual
            </p>
          </div>
          <span className="tag-retro text-[11px] text-midnight-950 px-3 py-1 rounded-lg bg-retro-mint self-start sm:self-auto">
            TOTAL HOY: {horasHoy.toFixed(1)}h
          </span>
        </div>

        {horasHoy === 0 ? (
          <div className="p-6 rounded-2xl bg-midnight-950/70 border-2 border-dashed border-white/15 text-center space-y-2">
            <p className="text-sm font-display font-bold text-slate-300 uppercase">
              Sin bloques registrados en la jornada de hoy
            </p>
            <p className="text-xs font-mono text-slate-500 max-w-md mx-auto">
              La matriz se encuentra limpia en ceros. Cuando registres sesiones de Deep Work, se mapearán en tiempo real según su grado de dificultad e inmersión.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Espectros Proporcionales de Hoy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Incomodidad de Hoy */}
              <div className="p-4 rounded-xl bg-midnight-950/80 border-2 border-white/10 shadow-brutal space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5 uppercase font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-retro-coral border border-black"></span>
                    Incomodidad Hoy (Frontera Mental)
                  </span>
                  <span className="font-mono text-retro-coral font-bold">
                    {incomodidadHoy.Alta.toFixed(1)}h Alta / {totalIncomodidadHoy.toFixed(1)}h
                  </span>
                </div>
                <div className="h-4 w-full rounded-md bg-midnight-900 overflow-hidden flex border-2 border-white/15 p-0.5">
                  <div
                    style={{ width: `${pctIncomodidadAltaHoy}%` }}
                    className="h-full bg-retro-coral rounded-l-sm transition-all duration-500"
                    title={`Alta: ${incomodidadHoy.Alta.toFixed(1)}h (${pctIncomodidadAltaHoy}%)`}
                  ></div>
                  <div
                    style={{ width: `${pctIncomodidadMediaHoy}%` }}
                    className="h-full bg-retro-amber transition-all duration-500"
                    title={`Media: ${incomodidadHoy.Media.toFixed(1)}h (${pctIncomodidadMediaHoy}%)`}
                  ></div>
                  <div
                    style={{ width: `${pctIncomodidadBajaHoy}%` }}
                    className="h-full bg-retro-ice rounded-r-sm transition-all duration-500"
                    title={`Baja: ${incomodidadHoy.Baja.toFixed(1)}h (${pctIncomodidadBajaHoy}%)`}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                  <span>ALTA: {incomodidadHoy.Alta.toFixed(1)}h</span>
                  <span>MEDIA: {incomodidadHoy.Media.toFixed(1)}h</span>
                  <span>BAJA: {incomodidadHoy.Baja.toFixed(1)}h</span>
                </div>
              </div>

              {/* Intensidad de Hoy */}
              <div className="p-4 rounded-xl bg-midnight-950/80 border-2 border-white/10 shadow-brutal space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5 uppercase font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-retro-mint border border-black"></span>
                    Intensidad Hoy (Inmersión de Foco)
                  </span>
                  <span className="font-mono text-retro-mint font-bold">
                    {intensidadHoy.Alta.toFixed(1)}h Alta / {totalIntensidadHoy.toFixed(1)}h
                  </span>
                </div>
                <div className="h-4 w-full rounded-md bg-midnight-900 overflow-hidden flex border-2 border-white/15 p-0.5">
                  <div
                    style={{ width: `${pctIntensidadAltaHoy}%` }}
                    className="h-full bg-retro-mint rounded-l-sm transition-all duration-500"
                    title={`Alta: ${intensidadHoy.Alta.toFixed(1)}h (${pctIntensidadAltaHoy}%)`}
                  ></div>
                  <div
                    style={{ width: `${pctIntensidadMediaHoy}%` }}
                    className="h-full bg-retro-amber transition-all duration-500"
                    title={`Media: ${intensidadHoy.Media.toFixed(1)}h (${pctIntensidadMediaHoy}%)`}
                  ></div>
                  <div
                    style={{ width: `${pctIntensidadBajaHoy}%` }}
                    className="h-full bg-slate-700 rounded-r-sm transition-all duration-500"
                    title={`Baja: ${intensidadHoy.Baja.toFixed(1)}h (${pctIntensidadBajaHoy}%)`}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                  <span>ALTA: {intensidadHoy.Alta.toFixed(1)}h</span>
                  <span>MEDIA: {intensidadHoy.Media.toFixed(1)}h</span>
                  <span>BAJA: {intensidadHoy.Baja.toFixed(1)}h</span>
                </div>
              </div>
            </div>

            {/* Matriz 2D de Hoy Neo-Brutalista */}
            <div className="p-4 rounded-xl bg-midnight-950/90 border-2 border-white/10 shadow-brutal space-y-3">
              <h4 className="text-xs font-display font-bold uppercase tracking-wider text-white">
                Matriz 2D de la Jornada (Intensidad × Incomodidad)
              </h4>
              <div className="overflow-x-auto">
                <div className="min-w-[400px] space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono text-slate-400">
                    <div className="text-left font-bold text-slate-400 self-center uppercase">Intensidad \ Incomodidad</div>
                    <div className="p-1 rounded bg-retro-coral/20 text-retro-coral font-bold border border-retro-coral/40">Alta (Frontera)</div>
                    <div className="p-1 rounded bg-retro-amber/20 text-retro-amber font-bold border border-retro-amber/40">Media (Esfuerzo)</div>
                    <div className="p-1 rounded bg-retro-ice/20 text-retro-ice font-bold border border-retro-ice/40">Baja (Confort)</div>
                  </div>

                  {/* Fila Alta */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="flex items-center text-left text-[11px] font-mono text-retro-mint font-bold px-1 uppercase">
                      Alta
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Alta.Alta > 0 ? 'bg-retro-coral/20 border-retro-coral shadow-brutal-coral' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Alta.Alta.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono font-bold text-retro-coral uppercase">Élite</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Alta.Media > 0 ? 'bg-retro-mint/20 border-retro-mint shadow-brutal-mint' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Alta.Media.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono font-bold text-retro-mint uppercase">Flujo</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Alta.Baja > 0 ? 'bg-retro-ice/20 border-retro-ice' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Alta.Baja.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono font-bold text-retro-ice uppercase">Mecánico</span>
                    </div>
                  </div>

                  {/* Fila Media */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="flex items-center text-left text-[11px] font-mono text-retro-amber font-bold px-1 uppercase">
                      Media
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Media.Alta > 0 ? 'bg-retro-amber/20 border-retro-amber shadow-brutal' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Media.Alta.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono font-bold text-retro-amber uppercase">Desafío</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Media.Media > 0 ? 'bg-retro-ice/20 border-retro-ice' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Media.Media.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono font-bold text-retro-ice uppercase">Sostenible</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Media.Baja > 0 ? 'bg-slate-800/80 border-white/20' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHoy.Media.Baja.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Rutinario</span>
                    </div>
                  </div>

                  {/* Fila Baja */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="flex items-center text-left text-[11px] font-mono text-slate-400 font-bold px-1 uppercase">
                      Baja
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Baja.Alta > 0 ? 'bg-slate-800/80 border-white/20' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHoy.Baja.Alta.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Sobrecarga</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Baja.Media > 0 ? 'bg-slate-800/80 border-white/20' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHoy.Baja.Media.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Distracción</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border-2 ${matrizHoy.Baja.Baja > 0 ? 'bg-slate-900 border-retro-coral/50' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                      <span className="text-xs font-bold font-mono text-slate-400 block">{matrizHoy.Baja.Baja.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Superficial</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 6. MODAL / VENTANA FLOTANTE DE LA BÓVEDA HISTÓRICA ACUMULADA */}
      {mostrarModalHistorico && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-historico-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-midnight-950/90 backdrop-blur-md overflow-hidden animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMostrarModalHistorico(false);
          }}
        >
          <div className="relative w-full max-w-5xl max-h-[94vh] bg-midnight-950 border-2 border-retro-lavender rounded-3xl shadow-brutal flex flex-col overflow-hidden">
            {/* Modal Sticky Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b-2 border-white/15 bg-midnight-950 sticky top-0 z-30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-lavender text-midnight-950">
                    BÓVEDA HISTÓRICA
                  </span>
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
                    AUDITORÍA RETROSPECTIVA
                  </span>
                </div>
                <h3 id="modal-historico-title" className="text-lg sm:text-2xl font-display font-extrabold text-white tracking-tight uppercase">
                  Consulta Día por Día &amp; Montañas Acumuladas
                </h3>
              </div>

              <button
                onClick={() => setMostrarModalHistorico(false)}
                className="btn-neo inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-mono font-bold text-midnight-950 bg-retro-coral uppercase"
                title="Cerrar ventana histórica (Esc)"
              >
                <span>✕ Cerrar (Esc)</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-7">
              {/* SECCIÓN A: AUDITORÍA DE DÍA ESPECÍFICO (SELECTOR Y DETALLE CON HORA Y TODO) */}
              <section className="card-acrylic p-4 sm:p-6 border-2 border-retro-lavender/50 bg-midnight-900/95 space-y-5">
                {/* Selector Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-white/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔍</span>
                      <h4 className="text-sm sm:text-base font-display font-bold text-white uppercase tracking-tight">
                        Auditar Día en Específico
                      </h4>
                    </div>
                    <p className="text-xs font-mono text-slate-400">
                      Cambia la fecha con el selector o haz clic en cualquier día con actividad.
                    </p>
                  </div>

                  {/* Controles de Navegación de Fecha Neo-Brutalistas */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handlePasoDia(-1)}
                      className="btn-neo px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-midnight-950 hover:bg-midnight-800 text-slate-200 border-white/20 uppercase"
                      title="Ir al día anterior"
                    >
                      ◀ Ant
                    </button>

                    <div className="relative">
                      <input
                        type="date"
                        value={fechaSeleccionadaHist}
                        onChange={(e) => handleSeleccionarDia(e.target.value)}
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-midnight-950 text-retro-mint border-2 border-retro-mint shadow-brutal-sm focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePasoDia(1)}
                      className="btn-neo px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-midnight-950 hover:bg-midnight-800 text-slate-200 border-white/20 uppercase"
                      title="Ir al día siguiente"
                    >
                      Sig ▶
                    </button>
                  </div>
                </div>

                {/* Píldoras de Acceso Rápido a Días con Actividad Registrada */}
                {diasConActividadLista.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold block">
                      Días con actividad registrada en el sistema:
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
                            className={`btn-neo shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono ${
                              isSelected
                                ? 'bg-retro-lavender text-midnight-950 font-bold shadow-brutal-sm'
                                : 'bg-midnight-950 text-slate-300 border-white/20'
                            }`}
                          >
                            <span>📅 {formatShortDate(dItem.fecha)}</span>
                            {isToday && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-retro-mint text-midnight-950 font-bold">
                                HOY
                              </span>
                            )}
                            <span className="font-bold text-retro-mint">
                              {dItem.horasNetas.toFixed(1)}h
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DETALLE COMPLETO DEL DÍA SELECCIONADO */}
                {loadingDiaHist ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <div className="w-8 h-8 rounded-xl bg-retro-lavender border-2 border-black animate-spin"></div>
                    <span className="text-xs font-mono text-slate-400 uppercase">
                      Cargando auditoría histórica para {fechaSeleccionadaHist}...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-5 animate-fade-in">
                    {/* Header del Día Auditado */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/90 border-2 border-white/10 shadow-brutal space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="tag-retro px-2.5 py-0.5 rounded text-xs bg-retro-lavender text-midnight-950">
                              {fechaSeleccionadaHist >= FECHA_INICIO_CICLO
                                ? `DÍA ${getDiaCicloParaFecha(fechaSeleccionadaHist)} / 365`
                                : 'PREVIO AL CICLO'}
                            </span>
                            {fechaSeleccionadaHist === targetFechaStr && (
                              <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-mint text-midnight-950">
                                JORNADA EN CURSO
                              </span>
                            )}
                          </div>
                          <h5 className="text-lg sm:text-2xl font-display font-bold text-white tracking-tight">
                            {formatFechaLargaEspanol(fechaSeleccionadaHist)}
                          </h5>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="tag-retro px-3 py-1.5 rounded-xl bg-midnight-900 border-retro-mint text-retro-mint font-bold">
                            Total: {(detalleDiaHist?.totalHorasNetas ?? 0).toFixed(2)}h netas
                          </span>
                        </div>
                      </div>

                      {/* Micro-KPIs de la fecha */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-midnight-900 border-2 border-white/10 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Deep Work</span>
                          <span className="text-base font-bold font-display text-retro-mint">
                            {(detalleDiaHist?.totalHorasNetas ?? 0).toFixed(1)}h
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {detalleDiaHist?.sesionesCount ?? 0} {detalleDiaHist?.sesionesCount === 1 ? 'bloque' : 'bloques'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-midnight-900 border-2 border-white/10 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Entrenamiento</span>
                          <span className="text-base font-bold font-display text-retro-ice">
                            {detalleDiaHist?.ejercicioHoras ? `${detalleDiaHist.ejercicioHoras.toFixed(1)}h` : '0h'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {detalleDiaHist?.ejercicioIntensidad ? `Intensidad ${detalleDiaHist.ejercicioIntensidad}` : 'Sin entreno'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-midnight-900 border-2 border-white/10 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Alimento / Mente</span>
                          <span className="text-base font-bold font-display text-retro-amber">
                            {detalleDiaHist?.alimento ? `${detalleDiaHist.alimento}/5 ⭐` : '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {detalleDiaHist?.frioMental ? detalleDiaHist.frioMental : 'Sin registro'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-midnight-900 border-2 border-white/10 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Ritual Cierre</span>
                          <span className={`text-base font-bold font-display ${detalleDiaHist?.cierreRealizado ? 'text-retro-lavender' : 'text-slate-500'}`}>
                            {detalleDiaHist?.cierreRealizado ? '✓ SELLADO' : 'SIN CIERRE'}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {detalleDiaHist?.cierreTimestamp ? formatTime(detalleDiaHist.cierreTimestamp) : 'No realizado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* CRONOGRAMA GRÁFICO 24 HORAS DE ESTE DÍA HISTÓRICO */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/90 border-2 border-white/10 shadow-brutal space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-mint text-midnight-950">
                            24H
                          </span>
                          <h6 className="text-xs sm:text-sm font-display font-bold uppercase tracking-wider text-white">
                            Cronograma de 24 Horas de este Día ({fechaSeleccionadaHist})
                          </h6>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          Haz clic en cualquier hora para ver el desglose
                        </span>
                      </div>

                      {/* Pista Gráfica 24h del Día Histórico */}
                      <div className="overflow-x-auto pb-2 pt-1">
                        <div className="min-w-[620px]">
                          <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-28 border-b-2 border-white/10 px-1">
                            {horasSlotsHist.map((slot) => {
                              const isSelected = slotActivoHist?.hora === slot.hora;
                              const hasFocus = slot.minutosFoco > 0;
                              const fillPercent = Math.max(hasFocus ? 16 : 0, Math.round((slot.minutosFoco / 60) * 100));

                              let barColor = 'bg-slate-700';
                              if (slot.intensidadPredominante === 'Alta') barColor = 'bg-retro-mint';
                              else if (slot.intensidadPredominante === 'Media') barColor = 'bg-retro-amber';
                              else if (slot.intensidadPredominante === 'Baja') barColor = 'bg-retro-ice';

                              let dotColor = null;
                              if (slot.incomodidadPredominante === 'Alta') dotColor = 'bg-retro-coral';
                              else if (slot.incomodidadPredominante === 'Media') dotColor = 'bg-retro-amber';
                              else if (slot.incomodidadPredominante === 'Baja') dotColor = 'bg-retro-ice';

                              return (
                                <div
                                  key={slot.hora}
                                  onClick={() => setSelectedHoraHist(slot.hora)}
                                  className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group transition-all"
                                  title={`${slot.rangoLabel}: ${slot.minutosFoco} min foco`}
                                >
                                  {/* Dot */}
                                  <div className="h-2.5 flex items-center justify-center mb-0.5">
                                    {dotColor ? (
                                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} border border-black`}></span>
                                    ) : (
                                      <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                    )}
                                  </div>

                                  {/* Bar container */}
                                  <div
                                    className={`w-full max-w-[22px] h-20 rounded-md flex flex-col justify-end p-0.5 transition-all border-2 ${
                                      isSelected
                                        ? 'bg-midnight-800 border-white scale-105 shadow-brutal'
                                        : hasFocus
                                        ? 'bg-midnight-900 border-white/20 hover:border-retro-mint'
                                        : 'bg-midnight-950/70 border-white/10'
                                    }`}
                                  >
                                    {hasFocus ? (
                                      <div
                                        style={{ height: `${fillPercent}%` }}
                                        className={`w-full rounded-sm ${barColor}`}
                                      ></div>
                                    ) : (
                                      <div className="w-full h-0.5 bg-transparent"></div>
                                    )}
                                  </div>

                                  <span className={`mt-1 text-[9px] font-mono leading-none ${isSelected ? 'text-white font-bold' : hasFocus ? 'text-slate-200' : 'text-slate-500'}`}>
                                    {String(slot.hora).padStart(2, '0')}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Info de la hora seleccionada en el día histórico */}
                      {slotActivoHist && (
                        <div className="p-3 rounded-xl bg-midnight-900 border-2 border-white/10 flex items-center justify-between text-xs font-mono">
                          <span className="text-white font-semibold">
                            Tramo {slotActivoHist.rangoLabel}: <strong className="text-retro-mint">{slotActivoHist.minutosFoco} min foco ({slotActivoHist.horasNetas.toFixed(2)}h)</strong>
                          </span>
                          <span className="text-slate-400">
                            {slotActivoHist.intensidadPredominante ? `Intensidad ${slotActivoHist.intensidadPredominante}` : 'Sin foco'}
                            {slotActivoHist.incomodidadPredominante ? ` • Incomodidad ${slotActivoHist.incomodidadPredominante}` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* LISTA COMPLETA DE BLOQUES DE FOCO CON HORA Y TODO */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-1 border-b-2 border-white/10">
                        <h6 className="text-xs sm:text-sm font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
                          <span>📋 Bloques de Concentración Ejecutados ({sesionesDiaHist.length})</span>
                        </h6>
                        <span className="text-xs font-mono text-retro-mint font-semibold">
                          Con hora estimada y hora exacta de guardado
                        </span>
                      </div>

                      {sesionesDiaHist.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-midnight-950/70 border-2 border-dashed border-white/10 text-center space-y-1.5">
                          <p className="text-sm font-display font-bold text-slate-300 uppercase">
                            No se registraron bloques de trabajo profundo en esta fecha ({fechaSeleccionadaHist}).
                          </p>
                          <p className="text-xs font-mono text-slate-500">
                            El marcador de Deep Work se mantuvo en 0.0h.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sesionesDiaHist.map((sesion, idx) => {
                            const timeInfo = getSessionTimeRange(sesion);
                            return (
                              <div
                                key={sesion.id || idx}
                                className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border-2 border-white/15 shadow-brutal space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b-2 border-white/10">
                                  {/* Rango de Horas */}
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="tag-retro px-2.5 py-1 rounded-lg text-xs bg-retro-lavender text-midnight-950">
                                      🕒 {timeInfo.inicio} — {timeInfo.fin}
                                    </span>
                                    <span className="text-xs font-mono text-slate-300 font-bold">
                                      ({timeInfo.durMin} min / {sesion.horas_netas}h netas)
                                    </span>
                                  </div>

                                  {/* Hora exacta de guardado */}
                                  <span className="text-[11px] font-mono text-slate-400">
                                    💾 Guardado a las: <strong className="text-slate-200">{timeInfo.exacta}</strong>
                                  </span>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  {/* Tipo */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-display font-bold text-white uppercase">
                                      {sesion.tipo}
                                    </span>
                                  </div>

                                  {/* Badges de Calidad e Intensidad */}
                                  <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                                    <span className="tag-retro px-2.5 py-1 rounded-lg bg-midnight-900 text-slate-200 border-white/20 flex items-center gap-1.5">
                                      <span
                                        className={`w-2 h-2 rounded-sm border border-black ${
                                          sesion.intensidad === 'Alta'
                                            ? 'bg-retro-mint'
                                            : sesion.intensidad === 'Media'
                                            ? 'bg-retro-amber'
                                            : 'bg-retro-ice'
                                        }`}
                                      ></span>
                                      Intensidad: <b className="text-white">{sesion.intensidad}</b>
                                    </span>

                                    <span className="tag-retro px-2.5 py-1 rounded-lg bg-midnight-900 text-slate-200 border-white/20 flex items-center gap-1.5">
                                      <span
                                        className={`w-2 h-2 rounded-full border border-black ${
                                          sesion.incomodidad === 'Alta'
                                            ? 'bg-retro-coral'
                                            : sesion.incomodidad === 'Media'
                                            ? 'bg-retro-amber'
                                            : 'bg-retro-ice'
                                        }`}
                                      ></span>
                                      Incomodidad: <b className="text-white">{sesion.incomodidad}</b>
                                    </span>
                                  </div>
                                </div>

                                {/* Reflexión Cualitativa (calidad) */}
                                {sesion.calidad ? (
                                  <blockquote className="p-3.5 sm:p-4 rounded-xl bg-midnight-900 border-l-4 border-retro-mint border-2 border-white/10 text-xs text-slate-200 italic font-serif leading-relaxed">
                                    &ldquo;{sesion.calidad}&rdquo;
                                  </blockquote>
                                ) : (
                                  <span className="text-[11px] font-mono text-slate-500 italic block">
                                    Sin nota cualitativa registrada para este bloque.
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* TAREAS PLANIFICADAS DE ESTE DÍA */}
                    {detalleDiaHist?.tareas && detalleDiaHist.tareas.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <h6 className="text-xs sm:text-sm font-display font-bold uppercase tracking-wider text-white">
                          🎯 Tareas Planificadas para este Día ({detalleDiaHist.tareas.length})
                        </h6>
                        <div className="space-y-2">
                          {detalleDiaHist.tareas.map((t, idx) => (
                            <div
                              key={t.id || idx}
                              className="p-3.5 rounded-xl bg-midnight-950 border-2 border-white/10 shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-retro-ice font-bold">
                                    {t.hora_inicio} — {t.hora_fin}
                                  </span>
                                  <span className="font-bold text-white font-display">{t.descripcion}</span>
                                </div>
                                {t.motivo_desvio && (
                                  <p className="text-[11px] text-retro-coral font-mono">
                                    Desvío: {t.motivo_desvio}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`tag-retro px-2 py-0.5 rounded text-[10px] self-start sm:self-auto ${
                                  t.estado === 'hecho'
                                    ? 'bg-retro-mint text-midnight-950'
                                    : t.estado === 'incompleto'
                                    ? 'bg-retro-amber text-midnight-950'
                                    : t.estado === 'no_hecho'
                                    ? 'bg-retro-coral text-midnight-950'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {t.estado}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* SECCIÓN B: MACROMÉTRICAS HISTÓRICAS & MONTAÑAS DE FOCO */}
              <div className="pt-2 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-base sm:text-xl font-display font-extrabold text-white tracking-tight flex items-center gap-2 uppercase">
                    <span>⛰️ Montañas de Foco &amp; Tendencias Acumuladas</span>
                  </h4>
                  <p className="text-xs font-mono text-slate-400">
                    Relieve longitudinal de concentración a través de los días y evolución macro de productividad.
                  </p>
                </div>

                {/* KPI Cards Históricas Neo-Brutalistas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
                  <div className="card-acrylic p-4 sm:p-5 border-2 border-white/15 shadow-brutal space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                      Horas Netas Totales
                    </span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-display font-extrabold text-retro-mint tabular-nums">
                        {stats.totalHorasNetas.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-retro-mint font-bold">h</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      En {stats.diasActivosCount} días con actividad
                    </p>
                  </div>

                  <div className="card-acrylic p-4 sm:p-5 border-2 border-white/15 shadow-brutal space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                      Promedio Diario Activo
                    </span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-display font-extrabold text-retro-ice tabular-nums">
                        {stats.promedioHorasDiarias.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-retro-ice font-bold">h / día</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {stats.totalSesiones} bloques registrados
                    </p>
                  </div>

                  <div className="card-acrylic p-4 sm:p-5 border-2 border-white/15 shadow-brutal space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                      Racha Máxima Élite
                    </span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-display font-extrabold text-retro-amber tabular-nums">
                        {stats.rachaMaxima}
                      </span>
                      <span className="text-xs font-mono text-retro-amber font-bold">días</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Días continuos esfuerzo ≥75%
                    </p>
                  </div>

                  <div className="card-acrylic p-4 sm:p-5 border-2 border-white/15 shadow-brutal space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                      Tasa Cierre Global
                    </span>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="text-3xl font-display font-extrabold text-retro-lavender tabular-nums">
                        {stats.tasaCierre.toFixed(0)}%
                      </span>
                      <span className="text-xs font-mono text-retro-lavender font-bold">tasa</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Cierres sellados
                    </p>
                  </div>
                </div>

                {/* GRÁFICO HISTÓRICO: MONTAÑAS DE FOCO O COLUMNAS */}
                <div className="card-acrylic p-5 sm:p-6 shadow-brutal border-2 border-white/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-white/10">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-display font-bold text-white tracking-tight uppercase flex items-center gap-2">
                        <span>⛰️</span>
                        Relieve Temporal Histórico (Haz clic en una cumbre para auditarla)
                      </h4>
                      <p className="text-xs font-mono text-slate-400">
                        Total acumulado en el período: <span className="text-retro-mint font-bold">{totalHorasEnRango.toFixed(1)}h</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      {/* Toggle Montañas vs Columnas */}
                      <div className="flex items-center gap-1 bg-midnight-950 p-1 rounded-xl border border-white/15">
                        <button
                          type="button"
                          onClick={() => setModoGraficoHist('montana')}
                          className={`btn-neo px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase ${
                            modoGraficoHist === 'montana'
                              ? 'bg-retro-mint text-midnight-950'
                              : 'bg-transparent text-slate-400 border-none shadow-none'
                          }`}
                        >
                          ⛰️ Montañas
                        </button>
                        <button
                          type="button"
                          onClick={() => setModoGraficoHist('columnas')}
                          className={`btn-neo px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase ${
                            modoGraficoHist === 'columnas'
                              ? 'bg-retro-mint text-midnight-950'
                              : 'bg-transparent text-slate-400 border-none shadow-none'
                          }`}
                        >
                          📊 Columnas
                        </button>
                      </div>

                      {/* Selector de Rango */}
                      <div className="flex items-center gap-1 bg-midnight-950 p-1 rounded-xl border border-white/15">
                        {([7, 14, 30] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => setRangoDias(r)}
                            className={`btn-neo px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                              rangoDias === r
                                ? 'bg-retro-lavender text-midnight-950'
                                : 'bg-transparent text-slate-400 border-none shadow-none hover:text-white'
                            }`}
                          >
                            {r}d
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Banner de información de día en Hover */}
                  <div className="min-h-8 flex flex-wrap items-center justify-between text-xs font-mono px-2 gap-2">
                    {hoveredDay ? (
                      <div className="flex items-center gap-3 animate-fade-in flex-wrap">
                        <span className="tag-retro px-2 py-0.5 rounded bg-midnight-950 text-white">
                          📅 {hoveredDay.fecha}
                        </span>
                        <span className="text-retro-mint font-bold">{hoveredDay.horasNetas.toFixed(2)}h netas</span>
                        <span className="text-slate-400">({hoveredDay.sesionesCount} bloques)</span>
                        {hoveredDay.horasNetas > 0 && (
                          <div className="flex items-center gap-2 text-[11px] bg-midnight-950 px-2.5 py-0.5 rounded-lg border border-white/15">
                            <span className="text-slate-400">Intensidad:</span>
                            <span className="text-retro-mint font-bold">{hoveredDay.distribucionIntensidad?.Alta || 0}h A</span>
                            <span className="text-retro-amber font-bold">{hoveredDay.distribucionIntensidad?.Media || 0}h M</span>
                            <span className="text-slate-400">{hoveredDay.distribucionIntensidad?.Baja || 0}h B</span>
                          </div>
                        )}
                        {hoveredDay.cierreRealizado ? (
                          <span className="tag-retro px-2 py-0.5 rounded bg-retro-mint text-midnight-950 text-[10px]">
                            ✓ Cierre sellado
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Sin cierre</span>
                        )}
                        <span className="text-retro-lavender font-bold text-[11px]">
                          (Clic para auditar en el panel superior)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">
                        Pasa el cursor por las cumbres para inspeccionar o haz clic para auditar ese día en el visor.
                      </span>
                    )}
                  </div>

                  {/* MODO 1: GRÁFICO DE MONTAÑAS SUAVIZADAS (SPLINE BÉZIER) */}
                  {modoGraficoHist === 'montana' ? (
                    <div className="p-4 rounded-2xl bg-midnight-950/90 border-2 border-white/10 shadow-brutal space-y-2 overflow-x-auto">
                      <div className="min-w-[620px] relative">
                        <svg
                          viewBox={`0 0 ${svgTrendWidth} ${svgTrendHeight}`}
                          className="w-full h-44 overflow-visible"
                        >
                          <defs>
                            <linearGradient id="mountainAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#86EFAC" stopOpacity="0.45" />
                              <stop offset="40%" stopColor="#C4B5FD" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#121826" stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="mountainLineGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#86EFAC" />
                              <stop offset="50%" stopColor="#C4B5FD" />
                              <stop offset="100%" stopColor="#FDA4AF" />
                            </linearGradient>
                          </defs>

                          {/* Línea base */}
                          <line
                            x1="0"
                            y1={svgTrendBaselineY}
                            x2={svgTrendWidth}
                            y2={svgTrendBaselineY}
                            stroke="#1E293B"
                            strokeWidth="2"
                          />

                          {/* Línea horizontal de meta Newport 4.0h */}
                          <line
                            x1="0"
                            y1={newportGoalY}
                            x2={svgTrendWidth}
                            y2={newportGoalY}
                            stroke="#C4B5FD"
                            strokeDasharray="5 5"
                            strokeWidth="1.5"
                            opacity="0.5"
                          />
                          <text
                            x={svgTrendWidth - 10}
                            y={newportGoalY - 6}
                            textAnchor="end"
                            fill="#C4B5FD"
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                            opacity="0.8"
                          >
                            Meta Newport: 4.0h
                          </text>

                          {/* Línea vertical hairline para el día hovered */}
                          {hoveredDay && (() => {
                            const matchPt = mountainTrendPoints.find((p) => p.day.fecha === hoveredDay.fecha);
                            if (!matchPt) return null;
                            return (
                              <g>
                                <line
                                  x1={matchPt.x}
                                  y1={svgTrendTopY}
                                  x2={matchPt.x}
                                  y2={svgTrendBaselineY}
                                  stroke="#C4B5FD"
                                  strokeWidth="1.5"
                                  strokeDasharray="3 3"
                                />
                                <circle
                                  cx={matchPt.x}
                                  cy={matchPt.y}
                                  r="9"
                                  fill="none"
                                  stroke="#C4B5FD"
                                  strokeWidth="2"
                                  className="animate-ping"
                                />
                              </g>
                            );
                          })()}

                          {/* Relleno de Montañas con gradiente acrílico */}
                          <path
                            d={mountainTrendArea}
                            fill="url(#mountainAreaGrad)"
                            className="transition-all duration-500"
                          />

                          {/* Trazo continuo de la cresta montañosa */}
                          <path
                            d={mountainTrendLine}
                            fill="none"
                            stroke="url(#mountainLineGrad)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            className="transition-all duration-500"
                          />

                          {/* Cumbres y puntos interactivos */}
                          {mountainTrendPoints.map((pt) => {
                            const isSelected = fechaSeleccionadaHist === pt.day.fecha;
                            const isHovered = hoveredDay?.fecha === pt.day.fecha;
                            const hasHours = pt.day.horasNetas > 0;

                            return (
                              <g
                                key={pt.day.fecha}
                                className="cursor-pointer group"
                                onClick={() => handleSeleccionarDia(pt.day.fecha)}
                                onMouseEnter={() => setHoveredDay(pt.day)}
                                onMouseLeave={() => setHoveredDay(null)}
                              >
                                {isSelected && (
                                  <polygon
                                    points={`${pt.x},${pt.y - 14} ${pt.x - 5},${pt.y - 22} ${pt.x + 5},${pt.y - 22}`}
                                    fill="#C4B5FD"
                                  />
                                )}

                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={isSelected ? 7 : isHovered ? 6 : hasHours ? 4.5 : 2.5}
                                  fill={
                                    isSelected
                                      ? '#C4B5FD'
                                      : isHovered
                                      ? '#FFFFFF'
                                      : hasHours
                                      ? pt.day.cierreRealizado
                                        ? '#86EFAC'
                                        : '#C4B5FD'
                                      : '#1E293B'
                                  }
                                  stroke="#000000"
                                  strokeWidth="2"
                                  className="transition-all duration-200"
                                />

                                {hasHours && (
                                  <text
                                    x={pt.x}
                                    y={pt.y - 8}
                                    textAnchor="middle"
                                    fill="#F1F5F9"
                                    fontSize="9"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                  >
                                    {pt.day.horasNetas.toFixed(1)}h
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>

                        {/* Etiquetas de fechas en la base */}
                        <div className="flex items-center justify-between px-4 pt-2 text-[10px] font-mono text-slate-400">
                          {filteredTrend.map((day, idx) => {
                            const showLabel =
                              rangoDias === 7 ||
                              (rangoDias === 14 && idx % 2 === 0) ||
                              (rangoDias === 30 && idx % 4 === 0) ||
                              idx === filteredTrend.length - 1;

                            const isSelected = fechaSeleccionadaHist === day.fecha;

                            return (
                              <div
                                key={day.fecha}
                                onClick={() => handleSeleccionarDia(day.fecha)}
                                className={`cursor-pointer hover:text-white transition-colors truncate ${
                                  isSelected ? 'text-retro-lavender font-bold' : ''
                                }`}
                              >
                                {showLabel ? formatShortDate(day.fecha) : ''}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* MODO 2: COLUMNAS NEO-BRUTALISTAS */
                    <div className="relative pt-4 pb-2 overflow-x-auto">
                      <div className="min-w-[480px]">
                        <div className="relative h-44 w-full border-b-2 border-white/10 flex items-end justify-between gap-1.5 px-2">
                          <div
                            className="absolute left-0 right-0 border-b border-dashed border-retro-lavender/40 pointer-events-none z-0"
                            style={{ bottom: `${(4.0 / maxHoursInTrend) * 100}%` }}
                          >
                            <span className="absolute right-0 -top-4 text-[10px] font-mono text-retro-lavender/80 font-bold">
                              Meta Newport: 4.0h
                            </span>
                          </div>

                          {filteredTrend.map((day, idx) => {
                            const heightPercent = maxHoursInTrend > 0
                              ? Math.min(100, Math.max(day.horasNetas > 0 ? 8 : 2, (day.horasNetas / maxHoursInTrend) * 100))
                              : 4;

                            const isHovered = hoveredDay?.fecha === day.fecha;
                            const isSelectedDate = fechaSeleccionadaHist === day.fecha;
                            const hasHours = day.horasNetas > 0;

                            return (
                              <div
                                key={day.fecha || idx}
                                onClick={() => handleSeleccionarDia(day.fecha)}
                                onMouseEnter={() => setHoveredDay(day)}
                                onMouseLeave={() => setHoveredDay(null)}
                                className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group relative z-10"
                                title={`Hacer clic para auditar el día ${day.fecha}`}
                              >
                                {isSelectedDate && (
                                  <span className="absolute -top-6 text-[10px] text-retro-lavender font-bold animate-bounce">
                                    ▼
                                  </span>
                                )}

                                <div
                                  style={{ height: `${heightPercent}%` }}
                                  className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 border-2 border-black ${
                                    isSelectedDate
                                      ? 'bg-retro-lavender shadow-brutal-lavender'
                                      : hasHours
                                      ? day.cierreRealizado
                                        ? 'bg-retro-mint hover:brightness-110 shadow-brutal-mint'
                                        : 'bg-retro-lavender hover:brightness-110 shadow-brutal-lavender'
                                      : 'bg-midnight-800/80 hover:bg-slate-700/80 border-white/10'
                                  } ${isHovered ? 'scale-105 brightness-125' : ''}`}
                                ></div>

                                {hasHours && (
                                  <span className="absolute -top-5 text-[9px] font-mono font-bold text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {day.horasNetas.toFixed(1)}h
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between gap-1.5 px-2 pt-2 text-[10px] font-mono text-slate-400">
                          {filteredTrend.map((day, idx) => {
                            const showLabel =
                              rangoDias === 7 ||
                              (rangoDias === 14 && idx % 2 === 0) ||
                              (rangoDias === 30 && idx % 4 === 0) ||
                              idx === filteredTrend.length - 1;

                            const isSelected = fechaSeleccionadaHist === day.fecha;

                            return (
                              <div
                                key={day.fecha}
                                className={`flex-1 text-center truncate ${isSelected ? 'text-retro-lavender font-bold' : ''}`}
                              >
                                {showLabel ? formatShortDate(day.fecha) : ''}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Matriz 2D y Espectros Históricos Acumulados */}
                <div className="card-acrylic p-5 sm:p-6 border-2 border-white/15 shadow-brutal space-y-5">
                  <div className="space-y-0.5 pb-2 border-b-2 border-white/10">
                    <h4 className="text-sm font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <span>⚡</span>
                      Calidad Cognitiva Histórica Acumulada (Intensidad × Incomodidad)
                    </h4>
                    <p className="text-[11px] font-mono text-slate-400">
                      Espectros y matriz de calor de todas las sesiones registradas en la historia de la aplicación
                    </p>
                  </div>

                  {/* Espectros Históricos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-midnight-900/90 border-2 border-white/10 shadow-brutal-sm space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-bold uppercase">Incomodidad Histórica</span>
                        <span className="text-retro-coral font-bold">{stats.distribucionIncomodidad.Alta.toFixed(1)}h Alta / {totalIncomodidadHist.toFixed(1)}h</span>
                      </div>
                      <div className="h-3.5 w-full rounded-md bg-midnight-950 overflow-hidden flex border border-white/15 p-0.5">
                        <div style={{ width: `${pctIncomodidadAltaHist}%` }} className="h-full bg-retro-coral rounded-l-sm" title={`Alta: ${stats.distribucionIncomodidad.Alta.toFixed(1)}h`}></div>
                        <div style={{ width: `${pctIncomodidadMediaHist}%` }} className="h-full bg-retro-amber" title={`Media: ${stats.distribucionIncomodidad.Media.toFixed(1)}h`}></div>
                        <div style={{ width: `${pctIncomodidadBajaHist}%` }} className="h-full bg-retro-ice rounded-r-sm" title={`Baja: ${stats.distribucionIncomodidad.Baja.toFixed(1)}h`}></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                        <span>ALTA: {pctIncomodidadAltaHist}%</span>
                        <span>MEDIA: {pctIncomodidadMediaHist}%</span>
                        <span>BAJA: {pctIncomodidadBajaHist}%</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-midnight-900/90 border-2 border-white/10 shadow-brutal-sm space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-bold uppercase">Intensidad Histórica</span>
                        <span className="text-retro-mint font-bold">{stats.distribucionIntensidad.Alta.toFixed(1)}h Alta / {totalIntensidadHist.toFixed(1)}h</span>
                      </div>
                      <div className="h-3.5 w-full rounded-md bg-midnight-950 overflow-hidden flex border border-white/15 p-0.5">
                        <div style={{ width: `${pctIntensidadAltaHist}%` }} className="h-full bg-retro-mint rounded-l-sm" title={`Alta: ${stats.distribucionIntensidad.Alta.toFixed(1)}h`}></div>
                        <div style={{ width: `${pctIntensidadMediaHist}%` }} className="h-full bg-retro-amber" title={`Media: ${stats.distribucionIntensidad.Media.toFixed(1)}h`}></div>
                        <div style={{ width: `${pctIntensidadBajaHist}%` }} className="h-full bg-slate-700 rounded-r-sm" title={`Baja: ${stats.distribucionIntensidad.Baja.toFixed(1)}h`}></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                        <span>ALTA: {pctIntensidadAltaHist}%</span>
                        <span>MEDIA: {pctIntensidadMediaHist}%</span>
                        <span>BAJA: {pctIntensidadBajaHist}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Matriz 2D Histórica */}
                  <div className="overflow-x-auto pt-1">
                    <div className="min-w-[400px] space-y-1.5">
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono text-slate-400">
                        <div className="text-left font-bold text-slate-400 self-center uppercase">Intensidad \ Incomodidad</div>
                        <div className="p-1 rounded bg-retro-coral/20 text-retro-coral font-bold border border-retro-coral/40">Alta (Frontera)</div>
                        <div className="p-1 rounded bg-retro-amber/20 text-retro-amber font-bold border border-retro-amber/40">Media (Esfuerzo)</div>
                        <div className="p-1 rounded bg-retro-ice/20 text-retro-ice font-bold border border-retro-ice/40">Baja (Confort)</div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="flex items-center text-left text-[11px] font-mono text-retro-mint font-bold px-1 uppercase">Alta</div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Alta.Alta > 0 ? 'bg-retro-coral/20 border-retro-coral shadow-brutal-coral' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Alta.Alta.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono font-bold text-retro-coral uppercase">Élite</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Alta.Media > 0 ? 'bg-retro-mint/20 border-retro-mint shadow-brutal-mint' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Alta.Media.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono font-bold text-retro-mint uppercase">Flujo</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Alta.Baja > 0 ? 'bg-retro-ice/20 border-retro-ice' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Alta.Baja.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono font-bold text-retro-ice uppercase">Mecánico</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="flex items-center text-left text-[11px] font-mono text-retro-amber font-bold px-1 uppercase">Media</div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Media.Alta > 0 ? 'bg-retro-amber/20 border-retro-amber shadow-brutal' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Media.Alta.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono font-bold text-retro-amber uppercase">Desafío</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Media.Media > 0 ? 'bg-retro-ice/20 border-retro-ice' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Media.Media.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono font-bold text-retro-ice uppercase">Sostenible</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Media.Baja > 0 ? 'bg-slate-800/80 border-white/20' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHistorica.Media.Baja.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Rutinario</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="flex items-center text-left text-[11px] font-mono text-slate-400 font-bold px-1 uppercase">Baja</div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Baja.Alta > 0 ? 'bg-slate-800/80 border-white/20' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHistorica.Baja.Alta.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Sobrecarga</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Baja.Media > 0 ? 'bg-slate-800/80 border-white/20' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHistorica.Baja.Media.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Distracción</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border-2 ${matrizHistorica.Baja.Baja > 0 ? 'bg-slate-900 border-retro-coral/50' : 'bg-midnight-900/60 border-white/10 text-slate-500'}`}>
                          <span className="text-xs font-bold font-mono text-slate-400 block">{matrizHistorica.Baja.Baja.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Superficial</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tipos y Hábitos Históricos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tipos de Enfoque */}
                  <div className="card-acrylic p-5 sm:p-6 border-2 border-white/15 shadow-brutal space-y-4">
                    <h4 className="text-sm font-display font-bold text-white tracking-tight uppercase flex items-center gap-2">
                      <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-ice text-midnight-950">
                        CATEGORÍAS
                      </span>
                      Distribución Histórica por Tipo
                    </h4>
                    <div className="space-y-3">
                      {stats.distribucionTipos.map((item, idx) => {
                        const colors = ['bg-retro-lavender', 'bg-retro-mint', 'bg-retro-ice', 'bg-retro-amber', 'bg-retro-coral'];
                        const barColor = colors[idx % colors.length];
                        return (
                          <div key={item.tipo} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="font-bold text-slate-200 uppercase">{item.tipo}</span>
                              <span className="text-white font-bold">{item.horas.toFixed(1)}h ({item.porcentaje}%)</span>
                            </div>
                            <div className="h-2.5 w-full rounded-md bg-midnight-900 overflow-hidden border border-white/10 p-0.5">
                              <div style={{ width: `${Math.min(100, item.porcentaje)}%` }} className={`h-full rounded-sm ${barColor}`}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hábitos e Indicadores Psicofísicos Históricos */}
                  <div className="card-acrylic p-5 sm:p-6 border-2 border-white/15 shadow-brutal space-y-4">
                    <h4 className="text-sm font-display font-bold text-white tracking-tight uppercase flex items-center gap-2">
                      <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-mint text-midnight-950">
                        BIOLOGÍA
                      </span>
                      Hábitos y Cuerpo (Histórico)
                    </h4>
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-midnight-900 border-2 border-white/10 shadow-brutal-sm flex justify-between items-center font-mono">
                        <span className="text-xs text-slate-300 font-bold uppercase">Alimentación Promedio:</span>
                        <span className="text-base font-bold text-retro-mint">{stats.salud.promedioAlimento.toFixed(1)} / 5.0</span>
                      </div>
                      <div className="p-3 rounded-xl bg-midnight-900 border-2 border-white/10 shadow-brutal-sm flex justify-between items-center font-mono">
                        <span className="text-xs text-slate-300 font-bold uppercase">Entrenamiento Acumulado:</span>
                        <span className="text-base font-bold text-retro-ice">{stats.salud.totalEjercicioHoras.toFixed(1)}h ({stats.salud.diasConEjercicio} días)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-midnight-900 border-2 border-white/10 shadow-brutal-sm flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300">Inspirado: <b className="text-retro-lavender">{stats.salud.distribucionFrioMental['Inspirado'] || 0}</b></span>
                        <span className="text-slate-300">Frío: <b className="text-retro-ice">{stats.salud.distribucionFrioMental['Frio total'] || 0}</b></span>
                        <span className="text-slate-300">Ávido: <b className="text-retro-amber">{stats.salud.distribucionFrioMental['Avido'] || 0}</b></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-5 border-t-2 border-white/15 bg-midnight-950 sticky bottom-0 z-30">
              <p className="text-xs text-slate-400 font-mono italic hidden sm:block">
                &ldquo;El pasado ya murió; el futuro aún no nace; la única victoria posible ocurre hoy.&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setMostrarModalHistorico(false)}
                className="btn-neo w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-mono font-bold text-midnight-950 bg-retro-lavender uppercase ml-auto"
              >
                Cerrar Ventana (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

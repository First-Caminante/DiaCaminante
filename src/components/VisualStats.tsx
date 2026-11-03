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
          // Si hay días pasados con actividad, preferir el más reciente
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

  // Construcción del Cronograma de 24 Horas del DÍA HISTÓRICO SELECCIONADO
  const sesionesDiaHist = useMemo(() => {
    if (detalleDiaHist?.sesiones && detalleDiaHist.sesiones.length > 0) {
      return detalleDiaHist.sesiones;
    }
    // Fallback con datos en caché de stats
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
    // Si no hay seleccionado, buscar la primera hora con foco o la hora 12
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

  if (loading && !stats) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-10 flex flex-col items-center justify-center min-h-[45vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-pastel-lavender/20 border-t-pastel-lavender animate-spin"></div>
        <p className="text-xs font-mono text-slate-400">Calculando métricas del día de hoy...</p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-10">
        <div className="p-6 rounded-2xl bg-midnight-950 border border-pastel-coral/30 text-center space-y-3">
          <p className="text-sm font-semibold text-pastel-coral">No se pudieron cargar las estadísticas</p>
          <p className="text-xs text-slate-400">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700"
          >
            Reintentar
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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-4 space-y-6 animate-fade-in">
      {/* 1. TOP HEADER: RELOJ EN TIEMPO REAL, DÍA DEL CICLO DE 365 Y ACCIÓN DE HISTÓRICO */}
      <div className="card-midnight rounded-3xl p-5 sm:p-7 shadow-2xl border border-white/10 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Lado Izquierdo: Momento Temporal Exacto & Ciclo 365 */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-pastel-lavender/15 text-pastel-lavender border border-pastel-lavender/30 shadow-glow-lavender">
                <span className="w-2 h-2 rounded-full bg-pastel-lavender animate-pulse"></span>
                <span>Día {diaCiclo} de 365 días</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-midnight-950 text-slate-300 border border-white/10">
                <span>📍</span>
                <span className="text-pastel-mint font-mono font-bold tracking-wider">{tiempoExactoStr}</span>
                <span className="text-[10px] text-slate-500 font-normal">hora local</span>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Estadísticas de la Jornada
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 flex-wrap">
              <span className="text-slate-300 font-medium">{fechaFormateadaCapital}</span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-400">
                El marcador se resetea a cero cada amanecer. Conquista exclusivamente el día de hoy.
              </span>
            </p>
          </div>

          {/* Lado Derecho: Racha Élite en la Esquina & Botón de Ventana Histórica */}
          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
            {/* Racha Élite Bonita en la Esquina (Mínimo 75% en los 4 pilares) */}
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all ${
                stats.rachaActual > 0
                  ? 'bg-midnight-950 border-pastel-amber/40 shadow-glow-amber'
                  : 'bg-midnight-950/70 border-white/10'
              }`}
              title="La racha solo se forja cuando el día concluye con esfuerzo riguroso (≥75% en trabajo profundo, incomodidad mental, entrenamiento físico y cierre sellado)"
            >
              <span className="text-lg">{stats.rachaActual > 0 ? '🔥' : '🕯️'}</span>
              <div className="text-left">
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold font-mono text-pastel-amber leading-none">
                    {stats.rachaActual}
                  </span>
                  <span className="text-[10px] font-mono text-pastel-amber/80 font-bold uppercase">
                    {stats.rachaActual === 1 ? 'día racha' : 'días racha'}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-slate-400 block leading-tight">
                  Esfuerzo Élite ≥75%
                </span>
              </div>
            </div>

            {/* Botón para Abrir Ventana / Modal Histórico */}
            <button
              type="button"
              onClick={() => setMostrarModalHistorico(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-mono font-semibold bg-midnight-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/15 transition-all active:scale-95 shadow-md"
              title="Abrir ventana flotante con el histórico acumulado y auditoría por día"
            >
              <span className="text-base">🏛️</span>
              <span>Ver Histórico</span>
            </button>

            {onGoToDailyLog && (
              <button
                onClick={onGoToDailyLog}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-semibold text-midnight-950 bg-pastel-mint hover:bg-pastel-mint/90 shadow-glow-mint transition-all active:scale-95"
              >
                <span>+ Registrar Bloque</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Progreso Temporal de Hoy y del Ciclo 365 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/5 text-xs font-mono">
          {/* Progreso de la Jornada (24 horas) */}
          <div className="p-3 rounded-xl bg-midnight-950/70 border border-white/5 space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pastel-mint"></span>
                Jornada de Hoy: {pctDiaTranscurrido}% transcurrido
              </span>
              <span className="text-pastel-mint font-semibold">
                {horasRestantesHoy}h {minRestantesHoy}m para 23:59
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-midnight-900 overflow-hidden border border-white/5">
              <div
                style={{ width: `${pctDiaTranscurrido}%` }}
                className="h-full bg-pastel-mint transition-all duration-1000 shadow-glow-mint"
              ></div>
            </div>
          </div>

          {/* Progreso del Ciclo de 365 días */}
          <div className="p-3 rounded-xl bg-midnight-950/70 border border-white/5 space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pastel-lavender"></span>
                Ciclo Anual: Día {diaCiclo} / 365 ({pctCiclo}%)
              </span>
              <span className="text-pastel-lavender font-semibold">
                {diasRestantesCiclo} días por conquistar
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-midnight-900 overflow-hidden border border-white/5">
              <div
                style={{ width: `${Math.min(100, Math.max(0.5, (diaCiclo / 365) * 100))}%` }}
                className="h-full bg-pastel-lavender transition-all duration-1000 shadow-glow-lavender"
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI CARDS: ESTRICTAMENTE DEL DÍA DE HOY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Horas Netas de Hoy */}
        <div className={`card-midnight rounded-2xl p-4 sm:p-5 border transition-all space-y-1 ${
          horasHoy >= UMBRAL_TRABAJO_MIN_H
            ? 'border-pastel-mint/40 shadow-glow-mint'
            : horasHoy > 0
            ? 'border-pastel-amber/30'
            : 'border-white/5'
        }`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Horas Netas de Hoy
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
              horasHoy >= UMBRAL_TRABAJO_MIN_H
                ? 'text-pastel-mint'
                : horasHoy > 0
                ? 'text-pastel-amber'
                : 'text-pastel-coral'
            }`}>
              {horasHoy.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400 font-semibold">/ 3.0h meta</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {horasHoy >= UMBRAL_TRABAJO_MIN_H
              ? '✓ Meta Newport lograda'
              : deficitTrabajoHoy > 0
              ? `Faltan ${deficitTrabajoHoy.toFixed(1)}h hoy`
              : '0h registradas hoy'
            }
          </p>
        </div>

        {/* KPI 2: Fricción Cognitiva de Hoy */}
        <div className={`card-midnight rounded-2xl p-4 sm:p-5 border transition-all space-y-1 ${
          pctExigenteHoy >= UMBRAL_EXIGENCIA_MIN_PCT && horasHoy > 0
            ? 'border-pastel-mint/40'
            : 'border-white/5'
        }`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Fricción Mental de Hoy
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
              pctExigenteHoy >= UMBRAL_EXIGENCIA_MIN_PCT && horasHoy > 0
                ? 'text-pastel-mint'
                : horasHoy > 0
                ? 'text-pastel-amber'
                : 'text-slate-500'
            }`}>
              {horasHoy > 0 ? `${pctExigenteHoy}%` : '0%'}
            </span>
            <span className="text-xs font-mono text-slate-400 font-semibold">/ 50% min</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {horasHoy > 0
              ? `${horasFriccionHoy.toFixed(1)}h en fricción alta/media`
              : 'Sin bloques de estudio hoy'
            }
          </p>
        </div>

        {/* KPI 3: Entrenamiento de Hoy */}
        <div className={`card-midnight rounded-2xl p-4 sm:p-5 border transition-all space-y-1 ${
          ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
            ? 'border-pastel-mint/40 shadow-glow-mint'
            : 'border-white/5'
        }`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Entrenamiento de Hoy
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
              ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
                ? 'text-pastel-mint'
                : ejercicioHoy > 0
                ? 'text-pastel-amber'
                : 'text-pastel-coral'
            }`}>
              {ejercicioHoy.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400 font-semibold">/ 0.75h min</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
              ? '✓ Templo físico entrenado'
              : deficitEjercicioHoy > 0
              ? `Faltan ${deficitEjercicioHoy.toFixed(1)}h de entreno`
              : 'Sin entrenamiento hoy'
            }
          </p>
        </div>

        {/* KPI 4: Ritual de Cierre */}
        <div className={`card-midnight rounded-2xl p-4 sm:p-5 border transition-all space-y-1 ${
          cierreHoy
            ? 'border-pastel-lavender/40 shadow-glow-lavender'
            : 'border-white/5'
        }`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Ritual de Cierre
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-bold font-mono ${
              cierreHoy ? 'text-pastel-lavender' : 'text-slate-500'
            }`}>
              {cierreHoy ? 'Sellado' : 'Abierto'}
            </span>
            <span className="text-xs font-mono text-slate-400 font-semibold">
              {cierreHoy ? '✓' : '11:59 PM'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {cierreHoy ? 'Mente liberada del día' : 'Pendiente antes de medianoche'}
          </p>
        </div>
      </div>

      {/* 3. CRONOGRAMA GRÁFICO DE 24 HORAS DE HOY (00:00 A 23:59) */}
      <section className="card-midnight rounded-3xl p-5 sm:p-7 shadow-xl border border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-pastel-mint/10 text-pastel-mint">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Cronograma Gráfico de 24 Horas de Hoy (00:00 — 23:59)
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Mapeo horario en tiempo real de intensidad, incomodidad y concentración hora a hora
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-midnight-950 border border-white/10 text-slate-300">
              Activas: <strong className="text-pastel-mint font-mono">{horasConFocoCount}</strong>/24h
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-midnight-950 border border-pastel-lavender/30 text-pastel-lavender">
              📍 Hora Actual: <strong>{String(horaActual).padStart(2, '0')}:00</strong>
            </span>
          </div>
        </div>

        {/* Guía Visual Rápida de Convenciones */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono px-2 py-2 rounded-xl bg-midnight-950/60 border border-white/5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400">Intensidad (Barra):</span>
            <span className="flex items-center gap-1 text-pastel-mint font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-pastel-mint"></span> Alta
            </span>
            <span className="flex items-center gap-1 text-pastel-amber font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-pastel-amber"></span> Media
            </span>
            <span className="flex items-center gap-1 text-pastel-ice font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-pastel-ice"></span> Baja
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400">Incomodidad (Punto):</span>
            <span className="flex items-center gap-1 text-pastel-coral font-medium">
              <span className="w-2 h-2 rounded-full bg-pastel-coral"></span> Alta (Frontera)
            </span>
            <span className="flex items-center gap-1 text-pastel-amber font-medium">
              <span className="w-2 h-2 rounded-full bg-pastel-amber"></span> Media (Esfuerzo)
            </span>
            <span className="flex items-center gap-1 text-pastel-ice font-medium">
              <span className="w-2 h-2 rounded-full bg-pastel-ice"></span> Baja (Confort)
            </span>
          </div>
        </div>

        {/* Pista Gráfica Interactiva de las 24 Horas */}
        <div className="overflow-x-auto pb-3 pt-2">
          <div className="min-w-[660px]">
            {/* Contenedor de las 24 Columnas */}
            <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-36 border-b border-white/10 px-1">
              {horasSlotsHoy.map((slot) => {
                const isSelected = (selectedHora !== null ? selectedHora : horaActual) === slot.hora;
                const hasFocus = slot.minutosFoco > 0;
                const fillPercent = Math.max(hasFocus ? 16 : 0, Math.round((slot.minutosFoco / 60) * 100));

                let barColor = 'bg-slate-700';
                if (slot.intensidadPredominante === 'Alta') barColor = 'bg-pastel-mint shadow-glow-mint';
                else if (slot.intensidadPredominante === 'Media') barColor = 'bg-pastel-amber';
                else if (slot.intensidadPredominante === 'Baja') barColor = 'bg-pastel-ice';

                let dotColor = null;
                if (slot.incomodidadPredominante === 'Alta') dotColor = 'bg-pastel-coral shadow-sm';
                else if (slot.incomodidadPredominante === 'Media') dotColor = 'bg-pastel-amber';
                else if (slot.incomodidadPredominante === 'Baja') dotColor = 'bg-pastel-ice';

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
                      <span className="absolute -top-6 text-[9px] font-mono font-bold text-pastel-lavender bg-midnight-950 px-1 py-0.5 rounded border border-pastel-lavender/40 shadow-glow-lavender animate-bounce whitespace-nowrap">
                        📍 AHORA
                      </span>
                    )}

                    {/* Indicador de Incomodidad (Punto superior) */}
                    <div className="h-3 flex items-center justify-center mb-1">
                      {dotColor ? (
                        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-white/5"></span>
                      )}
                    </div>

                    {/* Contenedor de la Barra de la Hora */}
                    <div
                      className={`w-full max-w-[26px] h-24 rounded-lg flex flex-col justify-end p-0.5 transition-all duration-200 ${
                        slot.esHoraActual
                          ? 'bg-midnight-900 border-2 border-pastel-lavender shadow-glow-lavender ring-2 ring-pastel-lavender/30'
                          : isSelected
                          ? 'bg-midnight-800 border-2 border-white'
                          : hasFocus
                          ? 'bg-midnight-900/90 border border-white/15 hover:border-pastel-mint/50'
                          : slot.esFutura
                          ? 'bg-midnight-950/40 border border-dashed border-white/5'
                          : 'bg-midnight-950/80 border border-white/5 hover:border-white/20'
                      } ${isSelected ? 'scale-105' : ''}`}
                    >
                      {/* Relleno de concentración proporcional a minutosFoco (0-60m) */}
                      {hasFocus ? (
                        <div
                          style={{ height: `${fillPercent}%` }}
                          className={`w-full rounded-md transition-all duration-300 ${barColor}`}
                        ></div>
                      ) : (
                        <div className="w-full h-1 rounded-full bg-transparent"></div>
                      )}
                    </div>

                    {/* Etiqueta de la Hora */}
                    <span
                      className={`mt-1.5 text-[10px] font-mono leading-none transition-colors ${
                        slot.esHoraActual
                          ? 'text-pastel-lavender font-bold'
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
        <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/90 border border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base font-bold font-mono text-white">
                🕒 Tramo: {slotActivoHoy.rangoLabel}
              </span>
              {slotActivoHoy.esHoraActual && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/30 animate-pulse">
                  📍 Hora en Curso (Tiempo Real)
                </span>
              )}
              {slotActivoHoy.minutosFoco > 0 && !slotActivoHoy.esHoraActual && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-pastel-mint/20 text-pastel-mint border border-pastel-mint/30">
                  ✓ Foco Ejecutado
                </span>
              )}
              {slotActivoHoy.minutosFoco === 0 && slotActivoHoy.esPasada && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-400 bg-midnight-900 border border-white/5">
                  Intervalo Inactivo / Descanso
                </span>
              )}
              {slotActivoHoy.esFutura && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-500 bg-midnight-900 border border-white/5">
                  ⏳ Tramo Futuro por Llegar
                </span>
              )}
            </div>

            <span className="text-xs font-mono text-pastel-mint font-bold self-start sm:self-auto">
              {slotActivoHoy.minutosFoco} min netos ({slotActivoHoy.horasNetas.toFixed(2)}h)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Intensidad del Tramo */}
            <div className="p-3 rounded-xl bg-midnight-900/70 border border-white/5 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Intensidad</span>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm ${
                  slotActivoHoy.intensidadPredominante === 'Alta' ? 'bg-pastel-mint' :
                  slotActivoHoy.intensidadPredominante === 'Media' ? 'bg-pastel-amber' :
                  slotActivoHoy.intensidadPredominante === 'Baja' ? 'bg-pastel-ice' : 'bg-slate-700'
                }`}></span>
                <span className="font-semibold text-white">
                  {slotActivoHoy.intensidadPredominante ? `${slotActivoHoy.intensidadPredominante} Inmersión` : 'Sin foco en esta hora'}
                </span>
              </div>
            </div>

            {/* Incomodidad del Tramo */}
            <div className="p-3 rounded-xl bg-midnight-900/70 border border-white/5 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Incomodidad Cognitiva</span>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  slotActivoHoy.incomodidadPredominante === 'Alta' ? 'bg-pastel-coral' :
                  slotActivoHoy.incomodidadPredominante === 'Media' ? 'bg-pastel-amber' :
                  slotActivoHoy.incomodidadPredominante === 'Baja' ? 'bg-pastel-ice' : 'bg-slate-700'
                }`}></span>
                <span className="font-semibold text-white">
                  {slotActivoHoy.incomodidadPredominante ? `${slotActivoHoy.incomodidadPredominante} Fricción` : 'Sin resistencia'}
                </span>
              </div>
            </div>

            {/* Pico y Resumen General */}
            <div className="p-3 rounded-xl bg-midnight-900/70 border border-white/5 space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Pico de la Jornada</span>
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
              <span className="text-[11px] font-mono text-slate-400 block">
                Bloques desarrollados durante este tramo ({slotActivoHoy.sesiones.length}):
              </span>
              <div className="space-y-1.5">
                {slotActivoHoy.sesiones.map((item, idx) => (
                  <div
                    key={item.sesion.id || idx}
                    className="p-3 rounded-xl bg-midnight-900 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.sesion.tipo}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-pastel-mint/15 text-pastel-mint border border-pastel-mint/30">
                          {item.minutos} min en este tramo ({item.sesion.horas_netas}h total)
                        </span>
                      </div>
                      {item.sesion.calidad && (
                        <p className="text-[11px] text-slate-400 italic">
                          &ldquo;{item.sesion.calidad}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                      <span className="px-2 py-0.5 rounded bg-midnight-950 border border-white/10 text-slate-300">
                        Intensidad: <b className="text-pastel-mint">{item.sesion.intensidad}</b>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-midnight-950 border border-white/10 text-slate-300">
                        Incomodidad: <b className="text-pastel-coral">{item.sesion.incomodidad}</b>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-midnight-900/50 border border-dashed border-white/5 text-center text-xs text-slate-500">
              {slotActivoHoy.esHoraActual ? (
                <span>
                  Estás en esta hora ahora mismo. ¿Qué tarea vas a conquistar? Registra un bloque de foco para pintar esta barra.
                </span>
              ) : slotActivoHoy.esPasada ? (
                <span>No se registraron sesiones durante este tramo horario.</span>
              ) : (
                <span>Tramo futuro de la jornada. Tu disciplina definirá el color de esta barra.</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 4. SEMÁFORO DE EXIGENCIA Y DISCIPLINA DE HOY */}
      <section className="card-midnight rounded-3xl p-5 sm:p-7 shadow-xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span className="p-1 rounded-md bg-pastel-amber/10 text-pastel-amber">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              Semáforo de Exigencia &amp; Disciplina Diaria
            </h3>
            <p className="text-xs text-slate-400">
              Evaluación estricta de los 4 pilares no negociables de la jornada actual
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {totalAlertas === 0 ? (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-pastel-mint/15 text-pastel-mint border border-pastel-mint/30 shadow-glow-mint">
                ✓ 100% Estándares Superados
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-pastel-coral/15 text-pastel-coral border border-pastel-coral/30">
                ⚠ {totalAlertas} {totalAlertas === 1 ? 'Pilar Pendiente' : 'Pilares Pendientes'}
              </span>
            )}
          </div>
        </div>

        {totalAlertas > 0 ? (
          <div className="space-y-4">
            {/* Alerta 1: Trabajo Profundo Newport */}
            {alertaTrabajo && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border border-pastel-coral/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-pastel-coral/20 text-pastel-coral border border-pastel-coral/30">
                    ⚠ Déficit de Trabajo Profundo
                  </span>
                  <span className="text-xs font-mono text-pastel-coral font-bold">
                    {horasHoy.toFixed(1)}h / 3.0h meta
                  </span>
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  No estás cumpliendo el umbral mínimo de Deep Work de Cal Newport
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Has registrado {horasHoy.toFixed(1)}h de trabajo neto hoy. El estándar mínimo para un trabajador del conocimiento de élite son 3.0 horas netas. Te faltan {deficitTrabajoHoy.toFixed(1)}h para conquistar la jornada.
                </p>
                <blockquote className="p-3 rounded-xl bg-midnight-900 border-l-2 border-pastel-coral border border-white/5 text-xs text-slate-300 space-y-1">
                  <p className="italic font-serif text-[11px] sm:text-xs text-slate-200">
                    &ldquo;No es que tengamos poco tiempo, sino que perdemos mucho. La vida es suficientemente larga para quien sabe emplearla con rigor.&rdquo;
                  </p>
                  <span className="block text-[10px] font-mono text-pastel-coral font-semibold">
                    — Séneca <span className="text-slate-500 font-normal">(De la brevedad de la vida)</span>
                  </span>
                </blockquote>
              </div>
            )}

            {/* Alerta 2: Fricción Cognitiva y Estudio */}
            {alertaEstudio && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border border-pastel-amber/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-pastel-amber/20 text-pastel-amber border border-pastel-amber/30">
                    ⚠ Confort Intelectual Excesivo
                  </span>
                  <span className="text-xs font-mono text-pastel-amber font-bold">
                    {pctExigenteHoy}% / 50% min exigencia
                  </span>
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  Nivel de incomodidad mental insuficiente: Evita las tareas rutinarias
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {horasHoy === 0
                    ? 'Aún no has registrado bloques de estudio o resolución de problemas desafiantes.'
                    : `Solo el ${pctExigenteHoy}% de tu tiempo de hoy estuvo en la frontera de dificultad (Incomodidad Alta/Media). Si el trabajo no te exige esfuerzo cognitivo genuino, no estás expandiendo tu mente.`}
                </p>
                <blockquote className="p-3 rounded-xl bg-midnight-900 border-l-2 border-pastel-amber border border-white/5 text-xs text-slate-300 space-y-1">
                  <p className="italic font-serif text-[11px] sm:text-xs text-slate-200">
                    &ldquo;Si tienes que comerte un sapo vivo, no te sirve de nada quedarte mirándolo mucho rato. Cómetelo a primera hora y sin titubear.&rdquo;
                  </p>
                  <span className="block text-[10px] font-mono text-pastel-amber font-semibold">
                    — Brian Tracy <span className="text-slate-500 font-normal">(Trágate ese sapo)</span>
                  </span>
                </blockquote>
              </div>
            )}

            {/* Alerta 3: Entrenamiento Físico */}
            {alertaEntrenamiento && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border border-pastel-coral/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-pastel-coral/20 text-pastel-coral border border-pastel-coral/30">
                    ⚠ Alerta de Salud y Dureza Física
                  </span>
                  <span className="text-xs font-mono text-pastel-coral font-bold">
                    {ejercicioHoy.toFixed(1)}h / 0.75h min
                  </span>
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  Templo Físico sin Entrenar: No descuides el pilar biológico
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {ejercicioHoy === 0
                    ? 'Hoy no has registrado entrenamiento físico. La claridad mental y la resistencia de foco exigen forjar el cuerpo a diario.'
                    : `Llevas ${ejercicioHoy.toFixed(1)}h de entreno hoy. Te faltan ${deficitEjercicioHoy.toFixed(1)}h para completar los 45 minutos mínimos exigidos.`}
                </p>
                <blockquote className="p-3 rounded-xl bg-midnight-900 border-l-2 border-pastel-coral border border-white/5 text-xs text-slate-300 space-y-1">
                  <p className="italic font-serif text-[11px] sm:text-xs text-slate-200">
                    &ldquo;Cuando tu mente te dice que estás agotado y no puedes más, en realidad solo estás al 40% de tu capacidad real. Empújate.&rdquo;
                  </p>
                  <span className="block text-[10px] font-mono text-pastel-coral font-semibold">
                    — David Goggins <span className="text-slate-500 font-normal">(Can&apos;t Hurt Me)</span>
                  </span>
                </blockquote>
              </div>
            )}

            {/* Alerta 4: Ritual de Cierre Pendiente */}
            {alertaCierre && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border border-pastel-lavender/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/30">
                    🌙 Alerta de Desconexión
                  </span>
                  <span className="text-xs font-mono text-pastel-lavender font-bold">
                    Cierre de hoy pendiente
                  </span>
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  Ritual de Cierre Diario Pendiente: Riesgo de bucles cognitivos residuales
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Cal Newport insiste en que el trabajo debe tener un límite estricto al anochecer. Si no realizas el cierre formal antes de las 11:59 PM, las tareas inacabadas continuarán fragmentando tu descanso nocturno.
                </p>
                <blockquote className="p-3 rounded-xl bg-midnight-900 border-l-2 border-pastel-lavender border border-white/5 text-xs text-slate-300 space-y-1">
                  <p className="italic font-serif text-[11px] sm:text-xs text-slate-200">
                    &ldquo;Al anochecer, confina tus pensamientos y haz las paces con lo inacabado. Quien no descansa con rigor, no trabaja con genialidad.&rdquo;
                  </p>
                  <span className="block text-[10px] font-mono text-pastel-lavender font-semibold">
                    — Marco Aurelio <span className="text-slate-500 font-normal">(Meditaciones, Libro IV)</span>
                  </span>
                </blockquote>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 sm:p-6 rounded-2xl bg-midnight-950/80 border-2 border-pastel-mint/40 shadow-glow-mint space-y-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-pastel-mint text-xl">🏆</span>
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-pastel-mint">
                  Estándar Élite Conquistado
                </span>
              </div>
              <h4 className="text-lg font-bold text-white tracking-tight">
                Disciplina y Exigencia Impecables: Todos los mínimos de hoy superados
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Has cumplido con los umbrales de Trabajo Profundo (≥3.0h), Fricción Cognitiva (≥50%), Entrenamiento Físico y Cierre. Mantén el estándar y no permitas que la autocomplacencia debilite tu línea.
              </p>
            </div>
            <blockquote className="p-3 rounded-xl bg-midnight-900 border border-pastel-mint/20 text-xs text-slate-300 max-w-xs text-left shrink-0">
              <p className="italic font-serif text-[11px] text-pastel-mint">
                &ldquo;La excelencia no es un acto aislado, sino un hábito forjado día a día.&rdquo;
              </p>
              <span className="block text-[10px] font-mono text-slate-400 mt-1">— Aristóteles</span>
            </blockquote>
          </div>
        )}
      </section>

      {/* 5. CALIDAD COGNITIVA DE HOY: INTENSIDAD & INCOMODIDAD */}
      <section className="card-midnight rounded-3xl p-5 sm:p-7 shadow-xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span className="p-1 rounded-md bg-pastel-coral/10 text-pastel-coral">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </span>
              Calidad Cognitiva de Hoy: Intensidad &amp; Incomodidad
            </h3>
            <p className="text-xs text-slate-400">
              Distribución de fricción mental y potencia de inmersión en la jornada actual
            </p>
          </div>
          <span className="text-[11px] font-mono text-pastel-mint px-2.5 py-1 rounded-lg bg-midnight-950 border border-pastel-mint/20 self-start sm:self-auto">
            Total Hoy: {horasHoy.toFixed(1)}h
          </span>
        </div>

        {horasHoy === 0 ? (
          <div className="p-6 rounded-2xl bg-midnight-950/70 border border-white/5 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-300">
              Sin bloques registrados en la jornada de hoy
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              La matriz se encuentra limpia en ceros. Cuando registres sesiones de Deep Work, se mapearán en tiempo real según su grado de dificultad e inmersión.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Espectros Proporcionales de Hoy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Incomodidad de Hoy */}
              <div className="p-4 rounded-xl bg-midnight-950/80 border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pastel-coral"></span>
                    Incomodidad Hoy (Frontera Mental)
                  </span>
                  <span className="font-mono text-pastel-coral font-bold">
                    {incomodidadHoy.Alta.toFixed(1)}h Alta / {totalIncomodidadHoy.toFixed(1)}h
                  </span>
                </div>
                <div className="h-3.5 w-full rounded-full bg-midnight-900 overflow-hidden flex border border-white/10 relative">
                  <div
                    style={{ width: `${pctIncomodidadAltaHoy}%` }}
                    className="h-full bg-pastel-coral transition-all duration-500"
                    title={`Alta: ${incomodidadHoy.Alta.toFixed(1)}h (${pctIncomodidadAltaHoy}%)`}
                  ></div>
                  <div
                    style={{ width: `${pctIncomodidadMediaHoy}%` }}
                    className="h-full bg-pastel-amber transition-all duration-500"
                    title={`Media: ${incomodidadHoy.Media.toFixed(1)}h (${pctIncomodidadMediaHoy}%)`}
                  ></div>
                  <div
                    style={{ width: `${pctIncomodidadBajaHoy}%` }}
                    className="h-full bg-pastel-ice transition-all duration-500"
                    title={`Baja: ${incomodidadHoy.Baja.toFixed(1)}h (${pctIncomodidadBajaHoy}%)`}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Alta: {incomodidadHoy.Alta.toFixed(1)}h</span>
                  <span>Media: {incomodidadHoy.Media.toFixed(1)}h</span>
                  <span>Baja: {incomodidadHoy.Baja.toFixed(1)}h</span>
                </div>
              </div>

              {/* Intensidad de Hoy */}
              <div className="p-4 rounded-xl bg-midnight-950/80 border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pastel-mint"></span>
                    Intensidad Hoy (Inmersión de Foco)
                  </span>
                  <span className="font-mono text-pastel-mint font-bold">
                    {intensidadHoy.Alta.toFixed(1)}h Alta / {totalIntensidadHoy.toFixed(1)}h
                  </span>
                </div>
                <div className="h-3.5 w-full rounded-full bg-midnight-900 overflow-hidden flex border border-white/10 relative">
                  <div
                    style={{ width: `${pctIntensidadAltaHoy}%` }}
                    className="h-full bg-pastel-mint transition-all duration-500"
                    title={`Alta: ${intensidadHoy.Alta.toFixed(1)}h (${pctIntensidadAltaHoy}%)`}
                  ></div>
                  <div
                    style={{ width: `${pctIntensidadMediaHoy}%` }}
                    className="h-full bg-pastel-amber transition-all duration-500"
                    title={`Media: ${intensidadHoy.Media.toFixed(1)}h (${pctIntensidadMediaHoy}%)`}
                  ></div>
                  <div
                    style={{ width: `${pctIntensidadBajaHoy}%` }}
                    className="h-full bg-slate-700 transition-all duration-500"
                    title={`Baja: ${intensidadHoy.Baja.toFixed(1)}h (${pctIntensidadBajaHoy}%)`}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Alta: {intensidadHoy.Alta.toFixed(1)}h</span>
                  <span>Media: {intensidadHoy.Media.toFixed(1)}h</span>
                  <span>Baja: {intensidadHoy.Baja.toFixed(1)}h</span>
                </div>
              </div>
            </div>

            {/* Matriz 2D de Hoy */}
            <div className="p-4 rounded-xl bg-midnight-950/80 border border-white/5 space-y-3">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                Matriz 2D de la Jornada (Intensidad × Incomodidad)
              </h4>
              <div className="overflow-x-auto">
                <div className="min-w-[400px] space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono text-slate-400">
                    <div className="text-left font-semibold text-slate-500 self-center">Intensidad \ Incomodidad</div>
                    <div className="p-1 rounded bg-pastel-coral/10 text-pastel-coral font-bold">Alta (Frontera)</div>
                    <div className="p-1 rounded bg-pastel-amber/10 text-pastel-amber font-bold">Media (Esfuerzo)</div>
                    <div className="p-1 rounded bg-pastel-ice/10 text-pastel-ice font-bold">Baja (Confort)</div>
                  </div>

                  {/* Fila Alta */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="flex items-center text-left text-[11px] font-mono text-pastel-mint font-bold px-1">
                      Alta
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Alta.Alta > 0 ? 'bg-pastel-coral/20 border-pastel-coral/60' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Alta.Alta.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-pastel-coral">Élite</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Alta.Media > 0 ? 'bg-pastel-mint/20 border-pastel-mint/60' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Alta.Media.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-pastel-mint">Flujo</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Alta.Baja > 0 ? 'bg-pastel-ice/15 border-pastel-ice/40' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Alta.Baja.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-pastel-ice">Mecánico</span>
                    </div>
                  </div>

                  {/* Fila Media */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="flex items-center text-left text-[11px] font-mono text-pastel-amber font-bold px-1">
                      Media
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Media.Alta > 0 ? 'bg-pastel-amber/20 border-pastel-amber/50' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Media.Alta.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-pastel-amber">Desafío</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Media.Media > 0 ? 'bg-pastel-ice/20 border-pastel-ice/50' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-white block">{matrizHoy.Media.Media.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-pastel-ice">Sostenible</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Media.Baja > 0 ? 'bg-slate-800/60 border-white/10' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHoy.Media.Baja.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-slate-500">Rutinario</span>
                    </div>
                  </div>

                  {/* Fila Baja */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="flex items-center text-left text-[11px] font-mono text-slate-400 font-semibold px-1">
                      Baja
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Baja.Alta > 0 ? 'bg-slate-800/70 border-white/10' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHoy.Baja.Alta.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-slate-500">Sobrecarga</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Baja.Media > 0 ? 'bg-slate-800/70 border-white/10' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHoy.Baja.Media.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-slate-500">Distracción</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${matrizHoy.Baja.Baja > 0 ? 'bg-slate-900 border-pastel-coral/30' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                      <span className="text-xs font-bold font-mono text-slate-400 block">{matrizHoy.Baja.Baja.toFixed(1)}h</span>
                      <span className="text-[10px] font-mono text-slate-500">Superficial</span>
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
          <div className="relative w-full max-w-5xl max-h-[94vh] bg-midnight-950 border-2 border-pastel-lavender/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Sticky Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-midnight-950/95 sticky top-0 z-30 backdrop-blur-md">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏛️</span>
                  <span className="text-xs font-mono uppercase tracking-widest text-pastel-lavender font-semibold">
                    Bóveda Histórica &amp; Auditoría Diaria
                  </span>
                </div>
                <h3 id="modal-historico-title" className="text-lg sm:text-2xl font-bold text-white tracking-tight">
                  Consulta Retrospectiva Día por Día
                </h3>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Selecciona cualquier día del calendario o haz clic en las barras para inspeccionar cada hora y reflexión ejecutada.
                </p>
              </div>

              <button
                onClick={() => setMostrarModalHistorico(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-white bg-midnight-800 hover:bg-midnight-700 border border-white/10 transition-all active:scale-95 shadow-md"
                title="Cerrar ventana histórica (Esc)"
              >
                <span>✕ Cerrar (Esc)</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-7">
              {/* SECCIÓN A: AUDITORÍA DE DÍA ESPECÍFICO (SELECTOR Y DETALLE CON HORA Y TODO) */}
              <section className="card-midnight rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-pastel-lavender/30 bg-midnight-900/90 shadow-xl space-y-5">
                {/* Selector Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔍</span>
                      <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                        Auditar Día en Específico
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Cambia la fecha con el selector o salta a cualquier día con actividad registrada.
                    </p>
                  </div>

                  {/* Controles de Navegación de Fecha */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handlePasoDia(-1)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold bg-midnight-950 hover:bg-midnight-800 text-slate-300 border border-white/10 transition-all active:scale-95"
                      title="Ir al día anterior"
                    >
                      ◀ Anterior
                    </button>

                    <div className="relative">
                      <input
                        type="date"
                        value={fechaSeleccionadaHist}
                        onChange={(e) => handleSeleccionarDia(e.target.value)}
                        className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-midnight-950 text-pastel-mint border border-pastel-mint/30 shadow-glow-mint focus:outline-none focus:border-pastel-lavender"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePasoDia(1)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold bg-midnight-950 hover:bg-midnight-800 text-slate-300 border border-white/10 transition-all active:scale-95"
                      title="Ir al día siguiente"
                    >
                      Siguiente ▶
                    </button>
                  </div>
                </div>

                {/* Píldoras de Acceso Rápido a Días con Actividad Registrada */}
                {diasConActividadLista.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                      Días con actividad registrada en el sistema:
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
                      {diasConActividadLista.map((dItem) => {
                        const isSelected = fechaSeleccionadaHist === dItem.fecha;
                        const isToday = dItem.fecha === targetFechaStr;
                        return (
                          <button
                            key={dItem.fecha}
                            type="button"
                            onClick={() => handleSeleccionarDia(dItem.fecha)}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all duration-200 active:scale-95 ${
                              isSelected
                                ? 'bg-pastel-lavender text-midnight-950 font-bold shadow-glow-lavender border border-pastel-lavender'
                                : 'bg-midnight-950 text-slate-300 hover:text-white hover:bg-midnight-800 border border-white/10'
                            }`}
                          >
                            <span>📅 {formatShortDate(dItem.fecha)}</span>
                            {isToday && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-pastel-mint/20 text-pastel-mint font-bold">
                                Hoy
                              </span>
                            )}
                            <span className="font-semibold text-pastel-mint">
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
                    <div className="w-8 h-8 rounded-full border-2 border-pastel-lavender/30 border-t-pastel-lavender animate-spin"></div>
                    <span className="text-xs font-mono text-slate-400">
                      Cargando auditoría histórica para {fechaSeleccionadaHist}...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-5 animate-fade-in">
                    {/* Header del Día Auditado */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/80 border border-white/10 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/30">
                              {fechaSeleccionadaHist >= FECHA_INICIO_CICLO
                                ? `Día ${getDiaCicloParaFecha(fechaSeleccionadaHist)} de 365 días`
                                : 'Jornada Previa al Ciclo Anual'}
                            </span>
                            {fechaSeleccionadaHist === targetFechaStr && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pastel-mint/20 text-pastel-mint border border-pastel-mint/30">
                                Jornada en Curso
                              </span>
                            )}
                          </div>
                          <h5 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                            {formatFechaLargaEspanol(fechaSeleccionadaHist)}
                          </h5>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="px-3 py-1.5 rounded-xl bg-midnight-900 border border-pastel-mint/30 text-pastel-mint font-bold">
                            Total: {(detalleDiaHist?.totalHorasNetas ?? 0).toFixed(2)}h netas
                          </span>
                        </div>
                      </div>

                      {/* Micro-KPIs de la fecha */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-midnight-900 border border-white/5 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase">Deep Work</span>
                          <span className="text-sm font-bold text-pastel-mint">
                            {(detalleDiaHist?.totalHorasNetas ?? 0).toFixed(1)}h
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {detalleDiaHist?.sesionesCount ?? 0} {detalleDiaHist?.sesionesCount === 1 ? 'bloque' : 'bloques'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-midnight-900 border border-white/5 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase">Entrenamiento</span>
                          <span className="text-sm font-bold text-pastel-ice">
                            {detalleDiaHist?.ejercicioHoras ? `${detalleDiaHist.ejercicioHoras.toFixed(1)}h` : '0h'}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {detalleDiaHist?.ejercicioIntensidad ? `Intensidad ${detalleDiaHist.ejercicioIntensidad}` : 'Sin entreno'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-midnight-900 border border-white/5 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase">Alimento / Mente</span>
                          <span className="text-sm font-bold text-pastel-amber">
                            {detalleDiaHist?.alimento ? `${detalleDiaHist.alimento}/5 ⭐` : '—'}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {detalleDiaHist?.frioMental ? detalleDiaHist.frioMental : 'Sin registro'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-midnight-900 border border-white/5 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase">Ritual Cierre</span>
                          <span className={`text-sm font-bold ${detalleDiaHist?.cierreRealizado ? 'text-pastel-lavender' : 'text-slate-500'}`}>
                            {detalleDiaHist?.cierreRealizado ? '✓ Sellado' : 'Sin Cierre'}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {detalleDiaHist?.cierreTimestamp ? formatTime(detalleDiaHist.cierreTimestamp) : 'No realizado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* CRONOGRAMA GRÁFICO 24 HORAS DE ESTE DÍA HISTÓRICO */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/80 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded bg-pastel-mint/10 text-pastel-mint text-xs">🕒</span>
                          <h6 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-white">
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
                          <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-28 border-b border-white/10 px-1">
                            {horasSlotsHist.map((slot) => {
                              const isSelected = slotActivoHist?.hora === slot.hora;
                              const hasFocus = slot.minutosFoco > 0;
                              const fillPercent = Math.max(hasFocus ? 16 : 0, Math.round((slot.minutosFoco / 60) * 100));

                              let barColor = 'bg-slate-700';
                              if (slot.intensidadPredominante === 'Alta') barColor = 'bg-pastel-mint shadow-glow-mint';
                              else if (slot.intensidadPredominante === 'Media') barColor = 'bg-pastel-amber';
                              else if (slot.intensidadPredominante === 'Baja') barColor = 'bg-pastel-ice';

                              let dotColor = null;
                              if (slot.incomodidadPredominante === 'Alta') dotColor = 'bg-pastel-coral';
                              else if (slot.incomodidadPredominante === 'Media') dotColor = 'bg-pastel-amber';
                              else if (slot.incomodidadPredominante === 'Baja') dotColor = 'bg-pastel-ice';

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
                                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                                    ) : (
                                      <span className="w-1 h-1 rounded-full bg-white/5"></span>
                                    )}
                                  </div>

                                  {/* Bar container */}
                                  <div
                                    className={`w-full max-w-[22px] h-20 rounded-md flex flex-col justify-end p-0.5 transition-all ${
                                      isSelected
                                        ? 'bg-midnight-800 border-2 border-white scale-105'
                                        : hasFocus
                                        ? 'bg-midnight-900 border border-white/15 hover:border-pastel-mint/50'
                                        : 'bg-midnight-950/70 border border-white/5 hover:border-white/20'
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
                        <div className="p-3 rounded-xl bg-midnight-900 border border-white/5 flex items-center justify-between text-xs font-mono">
                          <span className="text-white font-semibold">
                            Tramo {slotActivoHist.rangoLabel}: <strong className="text-pastel-mint">{slotActivoHist.minutosFoco} min foco ({slotActivoHist.horasNetas.toFixed(2)}h)</strong>
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
                      <div className="flex items-center justify-between pb-1 border-b border-white/5">
                        <h6 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-white flex items-center gap-2">
                          <span>📋 Bloques de Concentración Ejecutados ({sesionesDiaHist.length})</span>
                        </h6>
                        <span className="text-xs font-mono text-pastel-mint font-semibold">
                          Con hora estimada y hora exacta de registro
                        </span>
                      </div>

                      {sesionesDiaHist.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-midnight-950/70 border border-dashed border-white/10 text-center space-y-1.5">
                          <p className="text-sm font-medium text-slate-300">
                            No se registraron bloques de trabajo profundo en esta fecha ({fechaSeleccionadaHist}).
                          </p>
                          <p className="text-xs text-slate-500">
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
                                className="p-4 sm:p-5 rounded-2xl bg-midnight-950 border border-white/10 shadow-lg space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                                  {/* Rango de Horas */}
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-pastel-lavender/15 text-pastel-lavender border border-pastel-lavender/30">
                                      🕒 Horario: {timeInfo.inicio} — {timeInfo.fin}
                                    </span>
                                    <span className="text-xs font-mono text-slate-400">
                                      ({timeInfo.durMin} min / {sesion.horas_netas}h netas)
                                    </span>
                                  </div>

                                  {/* Hora exacta de guardado */}
                                  <span className="text-[11px] font-mono text-slate-400">
                                    💾 Registrado a las <strong>{timeInfo.exacta}</strong>
                                  </span>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  {/* Tipo */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white font-mono">
                                      {sesion.tipo}
                                    </span>
                                  </div>

                                  {/* Badges de Calidad e Intensidad */}
                                  <div className="flex items-center gap-2 text-[11px] font-mono flex-wrap">
                                    <span className="px-2.5 py-1 rounded-lg bg-midnight-900 border border-white/10 text-slate-300 flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-sm ${
                                        sesion.intensidad === 'Alta' ? 'bg-pastel-mint' :
                                        sesion.intensidad === 'Media' ? 'bg-pastel-amber' : 'bg-pastel-ice'
                                      }`}></span>
                                      Intensidad: <b className="text-white">{sesion.intensidad}</b>
                                    </span>

                                    <span className="px-2.5 py-1 rounded-lg bg-midnight-900 border border-white/10 text-slate-300 flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${
                                        sesion.incomodidad === 'Alta' ? 'bg-pastel-coral' :
                                        sesion.incomodidad === 'Media' ? 'bg-pastel-amber' : 'bg-pastel-ice'
                                      }`}></span>
                                      Incomodidad: <b className="text-white">{sesion.incomodidad}</b>
                                    </span>
                                  </div>
                                </div>

                                {/* Reflexión Cualitativa (calidad) */}
                                {sesion.calidad ? (
                                  <blockquote className="p-3 sm:p-4 rounded-xl bg-midnight-900/90 border border-white/5 border-l-2 border-l-pastel-mint text-xs text-slate-200 italic font-serif leading-relaxed">
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
                        <h6 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-white">
                          🎯 Tareas Planificadas para este Día ({detalleDiaHist.tareas.length})
                        </h6>
                        <div className="space-y-2">
                          {detalleDiaHist.tareas.map((t, idx) => (
                            <div
                              key={t.id || idx}
                              className="p-3 rounded-xl bg-midnight-950 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-pastel-ice font-semibold">
                                    {t.hora_inicio} — {t.hora_fin}
                                  </span>
                                  <span className="font-bold text-white">{t.descripcion}</span>
                                </div>
                                {t.motivo_desvio && (
                                  <p className="text-[11px] text-pastel-coral font-mono">
                                    Desvío: {t.motivo_desvio}
                                  </p>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase self-start sm:self-auto ${
                                t.estado === 'hecho' ? 'bg-pastel-mint/20 text-pastel-mint border border-pastel-mint/30' :
                                t.estado === 'incompleto' ? 'bg-pastel-amber/20 text-pastel-amber border border-pastel-amber/30' :
                                t.estado === 'no_hecho' ? 'bg-pastel-coral/20 text-pastel-coral border border-pastel-coral/30' :
                                'bg-slate-800 text-slate-300'
                              }`}>
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

              {/* SECCIÓN B: MACROMÉTRICAS HISTÓRICAS CONSOLIDADAS */}
              <div className="pt-2 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span>📊 Macrométricas y Tendencias Acumuladas</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Resumen global del rendimiento histórico y evolución longitudinal.
                  </p>
                </div>

                {/* KPI Cards Históricas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
                  <div className="card-midnight rounded-2xl p-4 sm:p-5 border border-white/10 space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Horas Netas Totales
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold font-mono text-pastel-mint tabular-nums">
                        {stats.totalHorasNetas.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-pastel-mint/70 font-semibold">h</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      En {stats.diasActivosCount} días con actividad
                    </p>
                  </div>

                  <div className="card-midnight rounded-2xl p-4 sm:p-5 border border-white/10 space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Promedio Diario Activo
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold font-mono text-pastel-ice tabular-nums">
                        {stats.promedioHorasDiarias.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-pastel-ice/70 font-semibold">h / día</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {stats.totalSesiones} bloques registrados
                    </p>
                  </div>

                  <div className="card-midnight rounded-2xl p-4 sm:p-5 border border-white/10 space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Racha Máxima Élite
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold font-mono text-pastel-amber tabular-nums">
                        {stats.rachaMaxima}
                      </span>
                      <span className="text-xs font-mono text-pastel-amber/70 font-semibold">días</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Días continuos con esfuerzo ≥75%
                    </p>
                  </div>

                  <div className="card-midnight rounded-2xl p-4 sm:p-5 border border-white/10 space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Tasa Cierre Global
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold font-mono text-pastel-lavender tabular-nums">
                        {stats.tasaCierre.toFixed(0)}%
                      </span>
                      <span className="text-xs font-mono text-pastel-lavender/70 font-semibold">tasa</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Cierres sellados
                    </p>
                  </div>
                </div>

                {/* Gráfico de Tendencia Temporal Histórica (Interactivo: click para seleccionar) */}
                <div className="card-midnight rounded-2xl p-5 sm:p-6 shadow-xl border border-white/7 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                        <svg className="w-4 h-4 text-pastel-mint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 3v18h18" />
                          <path d="m19 9-5 5-4-4-3 3" />
                        </svg>
                        Tendencia Temporal Histórica (Haz clic en una barra para auditarla)
                      </h4>
                      <p className="text-xs text-slate-400">
                        Total acumulado en el período: <span className="text-pastel-mint font-mono font-semibold">{totalHorasEnRango.toFixed(1)}h</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 bg-midnight-950 p-1 rounded-xl border border-white/5 self-start sm:self-auto">
                      {([7, 14, 30] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRangoDias(r)}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                            rangoDias === r
                              ? 'bg-pastel-lavender text-midnight-950 font-bold shadow-glow-lavender'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {r}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hovered bar info banner */}
                  <div className="min-h-8 flex flex-wrap items-center justify-between text-xs font-mono px-2 gap-2">
                    {hoveredDay ? (
                      <div className="flex items-center gap-3 animate-fade-in flex-wrap">
                        <span className="text-white font-semibold">📅 {hoveredDay.fecha}</span>
                        <span className="text-pastel-mint font-bold">{hoveredDay.horasNetas.toFixed(2)}h netas</span>
                        <span className="text-slate-400">({hoveredDay.sesionesCount} bloques)</span>
                        {hoveredDay.horasNetas > 0 && (
                          <div className="flex items-center gap-2 text-[11px] bg-midnight-950 px-2.5 py-0.5 rounded-lg border border-white/10">
                            <span className="text-slate-400">Intensidad:</span>
                            <span className="text-pastel-mint font-semibold">{hoveredDay.distribucionIntensidad?.Alta || 0}h A</span>
                            <span className="text-pastel-amber font-semibold">{hoveredDay.distribucionIntensidad?.Media || 0}h M</span>
                            <span className="text-slate-400">{hoveredDay.distribucionIntensidad?.Baja || 0}h B</span>
                          </div>
                        )}
                        {hoveredDay.cierreRealizado ? (
                          <span className="text-pastel-mint text-[11px]">✓ Cierre sellado</span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Sin cierre</span>
                        )}
                        <span className="text-pastel-lavender font-semibold text-[11px]">
                          (Clic para auditar en el panel superior)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">
                        Pasa el cursor para ver el resumen o haz clic en cualquier barra para seleccionarla.
                      </span>
                    )}
                  </div>

                  {/* SVG Continuous Bar Chart */}
                  <div className="relative pt-4 pb-2 overflow-x-auto">
                    <div className="min-w-[480px]">
                      <div className="relative h-44 w-full border-b border-white/10 flex items-end justify-between gap-1.5 px-2">
                        <div
                          className="absolute left-0 right-0 border-b border-dashed border-pastel-lavender/30 pointer-events-none z-0"
                          style={{ bottom: `${(4.0 / maxHoursInTrend) * 100}%` }}
                        >
                          <span className="absolute right-0 -top-4 text-[10px] font-mono text-pastel-lavender/60">
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
                              {/* Marcador de día seleccionado */}
                              {isSelectedDate && (
                                <span className="absolute -top-6 text-[10px] text-pastel-lavender font-bold animate-bounce">
                                  ▼
                                </span>
                              )}

                              <div
                                style={{ height: `${heightPercent}%` }}
                                className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                                  isSelectedDate
                                    ? 'bg-pastel-lavender ring-2 ring-white shadow-glow-lavender brightness-125'
                                    : hasHours
                                    ? day.cierreRealizado
                                      ? 'bg-pastel-mint hover:bg-pastel-mint/90 shadow-glow-mint'
                                      : 'bg-pastel-lavender hover:bg-pastel-lavenderDark shadow-glow-lavender'
                                    : 'bg-midnight-800/80 hover:bg-slate-700/80 border border-white/5'
                                } ${isHovered ? 'scale-105 brightness-125' : ''}`}
                              ></div>

                              {hasHours && (
                                <span className="absolute -top-5 text-[9px] font-mono font-semibold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  {day.horasNetas.toFixed(1)}h
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-1.5 px-2 pt-2 text-[10px] font-mono text-slate-500">
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
                              className={`flex-1 text-center truncate ${isSelected ? 'text-pastel-lavender font-bold' : ''}`}
                            >
                              {showLabel ? formatShortDate(day.fecha) : ''}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Matriz 2D y Espectros Históricos Acumulados */}
                <div className="card-midnight rounded-2xl p-5 sm:p-6 border border-white/7 space-y-5">
                  <div className="space-y-0.5 pb-2 border-b border-white/5">
                    <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-white flex items-center gap-2">
                      <span>⚡ Calidad Cognitiva Histórica Acumulada (Intensidad × Incomodidad)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Espectros y matriz de calor de todas las sesiones registradas en la historia de la aplicación
                    </p>
                  </div>

                  {/* Espectros Históricos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-midnight-900/80 border border-white/5 space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-semibold">Incomodidad Histórica</span>
                        <span className="text-pastel-coral font-bold">{stats.distribucionIncomodidad.Alta.toFixed(1)}h Alta / {totalIncomodidadHist.toFixed(1)}h</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-midnight-950 overflow-hidden flex border border-white/10">
                        <div style={{ width: `${pctIncomodidadAltaHist}%` }} className="h-full bg-pastel-coral" title={`Alta: ${stats.distribucionIncomodidad.Alta.toFixed(1)}h`}></div>
                        <div style={{ width: `${pctIncomodidadMediaHist}%` }} className="h-full bg-pastel-amber" title={`Media: ${stats.distribucionIncomodidad.Media.toFixed(1)}h`}></div>
                        <div style={{ width: `${pctIncomodidadBajaHist}%` }} className="h-full bg-pastel-ice" title={`Baja: ${stats.distribucionIncomodidad.Baja.toFixed(1)}h`}></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>Alta: {pctIncomodidadAltaHist}%</span>
                        <span>Media: {pctIncomodidadMediaHist}%</span>
                        <span>Baja: {pctIncomodidadBajaHist}%</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-midnight-900/80 border border-white/5 space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-semibold">Intensidad Histórica</span>
                        <span className="text-pastel-mint font-bold">{stats.distribucionIntensidad.Alta.toFixed(1)}h Alta / {totalIntensidadHist.toFixed(1)}h</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-midnight-950 overflow-hidden flex border border-white/10">
                        <div style={{ width: `${pctIntensidadAltaHist}%` }} className="h-full bg-pastel-mint" title={`Alta: ${stats.distribucionIntensidad.Alta.toFixed(1)}h`}></div>
                        <div style={{ width: `${pctIntensidadMediaHist}%` }} className="h-full bg-pastel-amber" title={`Media: ${stats.distribucionIntensidad.Media.toFixed(1)}h`}></div>
                        <div style={{ width: `${pctIntensidadBajaHist}%` }} className="h-full bg-slate-700" title={`Baja: ${stats.distribucionIntensidad.Baja.toFixed(1)}h`}></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>Alta: {pctIntensidadAltaHist}%</span>
                        <span>Media: {pctIntensidadMediaHist}%</span>
                        <span>Baja: {pctIntensidadBajaHist}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Matriz 2D Histórica */}
                  <div className="overflow-x-auto pt-1">
                    <div className="min-w-[400px] space-y-1.5">
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono text-slate-400">
                        <div className="text-left font-semibold text-slate-500 self-center">Intensidad \ Incomodidad</div>
                        <div className="p-1 rounded bg-pastel-coral/10 text-pastel-coral font-bold">Alta (Frontera)</div>
                        <div className="p-1 rounded bg-pastel-amber/10 text-pastel-amber font-bold">Media (Esfuerzo)</div>
                        <div className="p-1 rounded bg-pastel-ice/10 text-pastel-ice font-bold">Baja (Confort)</div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="flex items-center text-left text-[11px] font-mono text-pastel-mint font-bold px-1">Alta</div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Alta.Alta > 0 ? 'bg-pastel-coral/20 border-pastel-coral/60' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Alta.Alta.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-pastel-coral">Élite</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Alta.Media > 0 ? 'bg-pastel-mint/20 border-pastel-mint/60' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Alta.Media.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-pastel-mint">Flujo</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Alta.Baja > 0 ? 'bg-pastel-ice/15 border-pastel-ice/40' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Alta.Baja.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-pastel-ice">Mecánico</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="flex items-center text-left text-[11px] font-mono text-pastel-amber font-bold px-1">Media</div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Media.Alta > 0 ? 'bg-pastel-amber/20 border-pastel-amber/50' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Media.Alta.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-pastel-amber">Desafío</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Media.Media > 0 ? 'bg-pastel-ice/20 border-pastel-ice/50' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-white block">{matrizHistorica.Media.Media.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-pastel-ice">Sostenible</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Media.Baja > 0 ? 'bg-slate-800/60 border-white/10' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHistorica.Media.Baja.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-slate-500">Rutinario</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="flex items-center text-left text-[11px] font-mono text-slate-400 font-semibold px-1">Baja</div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Baja.Alta > 0 ? 'bg-slate-800/70 border-white/10' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHistorica.Baja.Alta.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-slate-500">Sobrecarga</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Baja.Media > 0 ? 'bg-slate-800/70 border-white/10' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-slate-300 block">{matrizHistorica.Baja.Media.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-slate-500">Distracción</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${matrizHistorica.Baja.Baja > 0 ? 'bg-slate-900 border-pastel-coral/30' : 'bg-midnight-900/60 border-white/5 text-slate-600'}`}>
                          <span className="text-xs font-bold font-mono text-slate-400 block">{matrizHistorica.Baja.Baja.toFixed(1)}h</span>
                          <span className="text-[10px] font-mono text-slate-500">Superficial</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tipos y Hábitos Históricos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tipos de Enfoque */}
                  <div className="card-midnight rounded-2xl p-5 sm:p-6 border border-white/7 space-y-4">
                    <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                      <span className="p-1 rounded-md bg-pastel-ice/10 text-pastel-ice">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      </span>
                      Distribución Histórica por Tipo
                    </h4>
                    <div className="space-y-3">
                      {stats.distribucionTipos.map((item, idx) => {
                        const colors = ['bg-pastel-lavender', 'bg-pastel-mint', 'bg-pastel-ice', 'bg-pastel-amber', 'bg-pastel-coral'];
                        const barColor = colors[idx % colors.length];
                        return (
                          <div key={item.tipo} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-200">{item.tipo}</span>
                              <span className="font-mono text-white font-bold">{item.horas.toFixed(1)}h ({item.porcentaje}%)</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-midnight-900 overflow-hidden">
                              <div style={{ width: `${Math.min(100, item.porcentaje)}%` }} className={`h-full ${barColor}`}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hábitos e Indicadores Psicofísicos Históricos */}
                  <div className="card-midnight rounded-2xl p-5 sm:p-6 border border-white/7 space-y-4">
                    <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                      <span className="p-1 rounded-md bg-pastel-mint/10 text-pastel-mint">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      </span>
                      Hábitos y Cuerpo (Histórico)
                    </h4>
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-midnight-900/80 border border-white/5 flex justify-between items-center">
                        <span className="text-xs text-slate-300">Alimentación Promedio:</span>
                        <span className="text-base font-bold font-mono text-pastel-mint">{stats.salud.promedioAlimento.toFixed(1)} / 5.0</span>
                      </div>
                      <div className="p-3 rounded-xl bg-midnight-900/80 border border-white/5 flex justify-between items-center">
                        <span className="text-xs text-slate-300">Entrenamiento Acumulado:</span>
                        <span className="text-base font-bold font-mono text-pastel-ice">{stats.salud.totalEjercicioHoras.toFixed(1)}h ({stats.salud.diasConEjercicio} días)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-midnight-900/80 border border-white/5 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300">Inspirado: <b className="text-pastel-lavender">{stats.salud.distribucionFrioMental['Inspirado'] || 0}</b></span>
                        <span className="text-slate-300">Frío: <b className="text-pastel-ice">{stats.salud.distribucionFrioMental['Frio total'] || 0}</b></span>
                        <span className="text-slate-300">Ávido: <b className="text-pastel-amber">{stats.salud.distribucionFrioMental['Avido'] || 0}</b></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-5 border-t border-white/10 bg-midnight-950/95 sticky bottom-0 z-30 backdrop-blur-md">
              <p className="text-xs text-slate-400 font-mono italic hidden sm:block">
                &ldquo;El pasado ya murió; el futuro aún no nace; la única victoria posible ocurre hoy.&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setMostrarModalHistorico(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-pastel-lavender hover:bg-pastel-lavenderDark shadow-glow-lavender transition-all ml-auto active:scale-95"
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

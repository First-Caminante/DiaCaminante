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

  // Cronograma de 24 Horas de HOY
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
    const width = 900;
    const height = 130;
    const paddingX = 20;
    const baselineY = height - 15;
    const topY = 15;
    const usableHeight = baselineY - topY;

    const step = (width - paddingX * 2) / 23;
    const points = horasSlotsHoy.map((slot, idx) => {
      const x = paddingX + idx * step;
      const ratio = Math.min(1, slot.minutosFoco / 60);
      const y = baselineY - ratio * usableHeight;
      return { x, y, slot };
    });

    const { linePath, areaPath } = generateSmoothAreaPath(points, baselineY);
    return { width, height, baselineY, points, linePath, areaPath };
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
      <div className="w-full flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#121c13] border-2 border-[#74a47b] shadow-[0_0_20px_rgba(217,242,196,0.3)] animate-pulse flex items-center justify-center text-[#d9f2c4] font-mono text-xl">
          ▲
        </div>
        <p className="text-xs font-mono font-bold tracking-widest text-[#92aa95] uppercase">
          Trazando telemetría y relieve de la jornada...
        </p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="w-full">
        <div className="card-tactical p-8 text-center space-y-4 border-2 border-[#e28080]">
          <span className="text-3xl">⚠️</span>
          <p className="text-sm font-display font-bold text-[#e28080] uppercase tracking-wider">
            Fallo en la lectura de métricas
          </p>
          <p className="text-xs font-mono text-[#92aa95]">{error}</p>
          <button
            onClick={fetchStats}
            className="btn-tactical px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase"
          >
            Reconectar
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

  // Métricas reales de HOY
  const horasHoy = stats.hoy?.horasNetas ?? 0;
  const ejercicioHoy = stats.hoy?.ejercicioHoras ?? 0;
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ========================================================= */}
      {/* 1. ZONA HERO PANORÁMICA: GRAN MONTAÑA CIRCADIANA + HUD KPIs */}
      {/* ========================================================= */}
      <section className="card-tactical p-5 sm:p-7 space-y-6 border-2 border-[#74a47b]/40 relative overflow-hidden">
        {/* Glow de fondo superior */}
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-[#215e28]/25 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Header de la Zona Hero */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10 pb-2 border-b border-[#74a47b]/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag-tactical px-2.5 py-0.5 rounded text-[10px] bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                TELEMETRÍA EN VIVO
              </span>
              <span className="text-xs font-mono text-[#92aa95] font-semibold">
                {fechaFormateadaCapital}
              </span>
              <span className="text-xs font-mono text-[#74a47b]">
                • {horasRestantesHoy}h {minRestantesHoy}m para medianoche
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-extrabold text-[#f8fafc] uppercase tracking-tight">
              Relieve Circadiano de Hoy
            </h1>
            <p className="text-xs sm:text-sm font-mono text-[#92aa95] max-w-2xl">
              Curva spline de concentración hora a hora (00:00 — 23:59). Cero distracciones: el marcador se resetea al inicio de cada jornada.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
            {/* Botón Flotante para Abrir Bóveda Histórica */}
            <button
              type="button"
              onClick={() => setMostrarModalHistorico(true)}
              className="btn-tactical-ghost px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2"
              title="Abrir ventana flotante con el histórico acumulado y auditoría por día"
            >
              <span className="text-[#d9f2c4]">🏛️</span>
              <span>Bóveda Histórica</span>
            </button>

            {onGoToDailyLog && (
              <button
                onClick={onGoToDailyLog}
                className="btn-tactical px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <span>+ Registrar Bloque</span>
              </button>
            )}
          </div>
        </div>

        {/* GRAN MONTAÑA CIRCADIANA SVG (PANORÁMICA DE CLASE MUNDIAL) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#000000] border-2 border-[#74a47b]/30 shadow-inner space-y-2 relative">
          <div className="flex items-center justify-between text-xs font-mono text-[#92aa95] pb-1">
            <span className="flex items-center gap-2 font-bold text-[#f8fafc] uppercase">
              <span className="w-2 h-2 rounded-full bg-[#d9f2c4] animate-ping"></span>
              Relieve de Flujo 24 Horas
            </span>
            <span className="text-[#d9f2c4] font-bold">
              {horasHoy > 0 ? `${(horasHoy * 60).toFixed(0)} min netos de inmersión hoy` : 'Esperando primer bloque del día'}
            </span>
          </div>

          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${mountainHoyData.width} ${mountainHoyData.height}`}
              className="w-full h-32 sm:h-44 overflow-visible"
            >
              <defs>
                <linearGradient id="tacticalCircadianGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9f2c4" stopOpacity="0.45" />
                  <stop offset="45%" stopColor="#215e28" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="tacticalCircadianStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#74a47b" />
                  <stop offset="50%" stopColor="#d9f2c4" />
                  <stop offset="100%" stopColor="#74a47b" />
                </linearGradient>
              </defs>

              {/* Guías horizontales */}
              <line
                x1="0"
                y1={mountainHoyData.baselineY}
                x2={mountainHoyData.width}
                y2={mountainHoyData.baselineY}
                stroke="#1a281b"
                strokeWidth="2"
              />
              <line
                x1="0"
                y1={mountainHoyData.baselineY - 50}
                x2={mountainHoyData.width}
                y2={mountainHoyData.baselineY - 50}
                stroke="#215e28"
                strokeDasharray="4 4"
                strokeWidth="1.2"
                opacity="0.6"
              />

              {/* Área spline continua */}
              {horasHoy > 0 && (
                <path
                  d={mountainHoyData.areaPath}
                  fill="url(#tacticalCircadianGrad)"
                  className="transition-all duration-700"
                />
              )}

              {/* Cresta de la montaña */}
              <path
                d={mountainHoyData.linePath}
                fill="none"
                stroke={horasHoy > 0 ? 'url(#tacticalCircadianStroke)' : '#215e28'}
                strokeWidth="3"
                strokeLinecap="round"
                className="transition-all duration-700"
              />

              {/* Cumbres y puntos */}
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
                        r="10"
                        fill="none"
                        stroke="#d9f2c4"
                        strokeWidth="2"
                        className="animate-ping opacity-75"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6.5 : hasFocus ? 5 : 2.5}
                      fill={
                        isSelected
                          ? '#ffffff'
                          : isCurrent
                          ? '#d9f2c4'
                          : hasFocus
                          ? '#74a47b'
                          : '#1a281b'
                      }
                      stroke="#000000"
                      strokeWidth="2"
                      className="transition-all duration-200 group-hover:scale-150"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* HUD DE 4 MÉTRICAS CLAVE (HEADS-UP DISPLAY EN PIE DE MONTAÑA) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Horas Netas de Hoy */}
          <div className="card-elevated p-4 border border-[#74a47b]/40 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-[#92aa95]">
              <span>[01] DEEP WORK HOY</span>
              <span className="text-[#d9f2c4]">⚡</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-display font-extrabold text-[#d9f2c4] tabular-nums">
                {horasHoy.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-[#92aa95] font-bold">/ 3.0h meta</span>
            </div>
            <p className="text-[11px] font-mono text-[#92aa95]">
              {horasHoy >= UMBRAL_TRABAJO_MIN_H
                ? '✓ Meta Newport superada'
                : deficitTrabajoHoy > 0
                ? `Faltan ${deficitTrabajoHoy.toFixed(1)}h hoy`
                : '0.0h registradas hoy'}
            </p>
          </div>

          {/* KPI 2: Fricción Mental de Hoy */}
          <div className="card-elevated p-4 border border-[#74a47b]/40 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-[#92aa95]">
              <span>[02] FRICCIÓN MENTAL</span>
              <span className="text-[#e28080]">🔥</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-display font-extrabold text-[#f8fafc] tabular-nums">
                {horasHoy > 0 ? `${pctExigenteHoy}%` : '0%'}
              </span>
              <span className="text-xs font-mono text-[#92aa95] font-bold">/ 50% min</span>
            </div>
            <p className="text-[11px] font-mono text-[#92aa95]">
              {horasHoy > 0
                ? `${horasFriccionHoy.toFixed(1)}h en incomodidad alta/media`
                : 'Sin bloques desafiantes hoy'}
            </p>
          </div>

          {/* KPI 3: Entrenamiento de Hoy */}
          <div className="card-elevated p-4 border border-[#74a47b]/40 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-[#92aa95]">
              <span>[03] TEMPLO FÍSICO</span>
              <span className="text-[#74a47b]">🏃</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-display font-extrabold text-[#f8fafc] tabular-nums">
                {ejercicioHoy.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-[#92aa95] font-bold">/ 0.75h min</span>
            </div>
            <p className="text-[11px] font-mono text-[#92aa95]">
              {ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
                ? '✓ Templo forjado con rigor'
                : deficitEjercicioHoy > 0
                ? `Faltan ${deficitEjercicioHoy.toFixed(1)}h de entreno`
                : 'Sin entrenamiento hoy'}
            </p>
          </div>

          {/* KPI 4: Ritual de Cierre */}
          <div className="card-elevated p-4 border border-[#74a47b]/40 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-[#92aa95]">
              <span>[04] RITUAL CIERRE</span>
              <span className="text-[#d9f2c4]">🌙</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className={`text-2xl sm:text-3xl font-display font-extrabold ${cierreHoy ? 'text-[#d9f2c4]' : 'text-[#92aa95]'}`}>
                {cierreHoy ? 'SELLADO' : 'ABIERTO'}
              </span>
              <span className="text-xs font-mono text-[#92aa95] font-bold">
                {cierreHoy ? '✓' : '11:59 PM'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-[#92aa95]">
              {cierreHoy ? 'Día confinado con rigor' : 'Pendiente antes de medianoche'}
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. GRID ASIMÉTRICO: COLUMNA CRONOGRAMA 24H (65%) + COLUMNA EXIGENCIA (35%) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA PRINCIPAL (65% -> col-span-8): CRONOGRAMA 24H & MATRIZ 2D */}
        <div className="lg:col-span-8 space-y-6">
          {/* CRONOGRAMA DE 24 RANURAS HORARIAS */}
          <section className="card-tactical p-5 sm:p-6 space-y-5 border-2 border-[#74a47b]/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#74a47b]/20">
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-display font-bold text-[#f8fafc] uppercase tracking-tight flex items-center gap-2">
                  <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                    24H
                  </span>
                  Ranuras Circadianas de Hoy (00:00 — 23:59)
                </h3>
                <p className="text-xs font-mono text-[#92aa95]">
                  Haz clic en cualquier tramo para auditar su intensidad, incomodidad y sesiones ejecutadas.
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="tag-tactical px-2.5 py-1 rounded bg-[#000000] text-[#f8fafc] border-[#74a47b]/40">
                  Activas: <strong className="text-[#d9f2c4] font-mono">{horasConFocoCount}</strong>/24h
                </span>
                <span className="tag-tactical px-2.5 py-1 rounded bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                  📍 AHORA: <strong>{String(horaActual).padStart(2, '0')}:00</strong>
                </span>
              </div>
            </div>

            {/* Pista de las 24 Columnas */}
            <div className="overflow-x-auto pb-2 pt-1">
              <div className="min-w-[620px]">
                <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-32 border-b-2 border-[#74a47b]/30 px-1">
                  {horasSlotsHoy.map((slot) => {
                    const isSelected = (selectedHora !== null ? selectedHora : horaActual) === slot.hora;
                    const hasFocus = slot.minutosFoco > 0;
                    const fillPercent = Math.max(hasFocus ? 16 : 0, Math.round((slot.minutosFoco / 60) * 100));

                    let barColor = 'bg-[#1a281b]';
                    if (slot.intensidadPredominante === 'Alta') barColor = 'bg-[#d9f2c4] shadow-[0_0_10px_rgba(217,242,196,0.4)]';
                    else if (slot.intensidadPredominante === 'Media') barColor = 'bg-[#74a47b]';
                    else if (slot.intensidadPredominante === 'Baja') barColor = 'bg-[#215e28]';

                    let dotColor = null;
                    if (slot.incomodidadPredominante === 'Alta') dotColor = 'bg-[#e28080]';
                    else if (slot.incomodidadPredominante === 'Media') dotColor = 'bg-[#fde68a]';
                    else if (slot.incomodidadPredominante === 'Baja') dotColor = 'bg-[#74a47b]';

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
                          <span className="tag-tactical absolute -top-6 text-[8px] px-1 py-0.5 rounded bg-[#d9f2c4] text-[#000000] border-[#74a47b] whitespace-nowrap animate-bounce font-bold">
                            📍 AHORA
                          </span>
                        )}

                        <div className="h-2.5 flex items-center justify-center mb-1">
                          {dotColor ? (
                            <span className={`w-2 h-2 rounded-full ${dotColor} border border-black shadow-sm`}></span>
                          ) : (
                            <span className="w-1 h-1 rounded-full bg-white/10"></span>
                          )}
                        </div>

                        <div
                          className={`w-full max-w-[26px] h-20 rounded-md flex flex-col justify-end p-0.5 transition-all duration-200 border-2 ${
                            slot.esHoraActual
                              ? 'bg-[#121c13] border-[#d9f2c4] shadow-[0_0_12px_rgba(217,242,196,0.35)]'
                              : isSelected
                              ? 'bg-[#1a281b] border-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                              : hasFocus
                              ? 'bg-[#121c13] border-[#74a47b]/60 hover:border-[#d9f2c4]'
                              : slot.esFutura
                              ? 'bg-[#000000] border-dashed border-[#74a47b]/20'
                              : 'bg-[#000000] border-[#74a47b]/20 hover:border-[#74a47b]/50'
                          } ${isSelected ? 'scale-105' : ''}`}
                        >
                          {hasFocus ? (
                            <div
                              style={{ height: `${fillPercent}%` }}
                              className={`w-full rounded-sm transition-all duration-300 ${barColor}`}
                            ></div>
                          ) : (
                            <div className="w-full h-0.5 bg-transparent"></div>
                          )}
                        </div>

                        <span
                          className={`mt-1.5 text-[10px] font-mono leading-none transition-colors ${
                            slot.esHoraActual
                              ? 'text-[#d9f2c4] font-bold'
                              : isSelected
                              ? 'text-white font-bold'
                              : hasFocus
                              ? 'text-[#f8fafc] font-semibold'
                              : 'text-[#92aa95]/60'
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

            {/* Inspección de la Hora Seleccionada */}
            <div className="p-4 rounded-xl bg-[#000000] border-2 border-[#74a47b]/40 shadow-inner space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#74a47b]/20">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-base font-display font-bold text-[#f8fafc] uppercase">
                    🕒 Tramo: {slotActivoHoy.rangoLabel}
                  </span>
                  {slotActivoHoy.esHoraActual && (
                    <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                      📍 HORA EN CURSO
                    </span>
                  )}
                  {slotActivoHoy.minutosFoco > 0 && !slotActivoHoy.esHoraActual && (
                    <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#1a281b] text-[#d9f2c4] border-[#74a47b]">
                      ✓ FOCO EJECUTADO
                    </span>
                  )}
                </div>

                <span className="text-xs font-mono text-[#d9f2c4] font-bold">
                  {slotActivoHoy.minutosFoco} min netos ({slotActivoHoy.horasNetas.toFixed(2)}h)
                </span>
              </div>

              {/* Sesiones del tramo */}
              {slotActivoHoy.sesiones.length > 0 ? (
                <div className="space-y-2">
                  {slotActivoHoy.sesiones.map((item, idx) => (
                    <div
                      key={item.sesion.id || idx}
                      className="p-3 rounded-lg bg-[#121c13] border border-[#74a47b]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#f8fafc]">{item.sesion.tipo}</span>
                          <span className="tag-tactical text-[9px] px-1.5 py-0.5 rounded bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                            {item.minutos} min en este tramo
                          </span>
                        </div>
                        {item.sesion.calidad && (
                          <p className="text-[11px] text-[#92aa95] italic font-serif">
                            &ldquo;{item.sesion.calidad}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] shrink-0">
                        <span className="tag-tactical px-2 py-0.5 rounded bg-[#000000] text-[#92aa95] border-[#74a47b]/40">
                          Int: <b className="text-[#d9f2c4]">{item.sesion.intensidad}</b>
                        </span>
                        <span className="tag-tactical px-2 py-0.5 rounded bg-[#000000] text-[#92aa95] border-[#74a47b]/40">
                          Incom: <b className="text-[#e28080]">{item.sesion.incomodidad}</b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2 text-xs font-mono text-[#92aa95]">
                  {slotActivoHoy.esHoraActual
                    ? 'Estás en este tramo ahora mismo. Conquístalo registrando un bloque de foco.'
                    : slotActivoHoy.esPasada
                    ? 'Sin bloques registrados en este intervalo.'
                    : 'Tramo futuro de la jornada.'}
                </div>
              )}
            </div>
          </section>

          {/* MATRIZ 2D DE CALIDAD COGNITIVA & ESPECTRO */}
          <section className="card-tactical p-5 sm:p-6 space-y-5 border-2 border-[#74a47b]/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#74a47b]/20">
              <div className="space-y-0.5">
                <h3 className="text-base font-display font-bold text-[#f8fafc] uppercase tracking-tight flex items-center gap-2">
                  <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#1a281b] text-[#d9f2c4] border-[#74a47b]">
                    ESPECTRO
                  </span>
                  Calidad Cognitiva: Intensidad × Incomodidad
                </h3>
                <p className="text-xs font-mono text-[#92aa95]">
                  Distribución matricial de potencia de foco y fricción mental de la jornada actual
                </p>
              </div>
              <span className="tag-tactical text-[11px] text-[#000000] px-3 py-1 rounded-lg bg-[#d9f2c4] border-[#74a47b]">
                TOTAL HOY: {horasHoy.toFixed(1)}h
              </span>
            </div>

            {/* Espectros Proporcionales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-[#000000] border border-[#74a47b]/30 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#f8fafc] font-bold uppercase">Incomodidad Hoy</span>
                  <span className="text-[#d9f2c4] font-bold">{incomodidadHoy.Alta.toFixed(1)}h Alta / {totalIncomodidadHoy.toFixed(1)}h</span>
                </div>
                <div className="h-3.5 w-full rounded-md bg-[#121c13] overflow-hidden flex border border-[#74a47b]/40 p-0.5">
                  <div style={{ width: `${pctIncomodidadAltaHoy}%` }} className="h-full bg-[#e28080] rounded-l-sm" title={`Alta: ${incomodidadHoy.Alta.toFixed(1)}h`}></div>
                  <div style={{ width: `${pctIncomodidadMediaHoy}%` }} className="h-full bg-[#fde68a]" title={`Media: ${incomodidadHoy.Media.toFixed(1)}h`}></div>
                  <div style={{ width: `${pctIncomodidadBajaHoy}%` }} className="h-full bg-[#74a47b] rounded-r-sm" title={`Baja: ${incomodidadHoy.Baja.toFixed(1)}h`}></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#92aa95]">
                  <span>ALTA: {incomodidadHoy.Alta.toFixed(1)}h</span>
                  <span>MEDIA: {incomodidadHoy.Media.toFixed(1)}h</span>
                  <span>BAJA: {incomodidadHoy.Baja.toFixed(1)}h</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#000000] border border-[#74a47b]/30 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#f8fafc] font-bold uppercase">Intensidad Hoy</span>
                  <span className="text-[#d9f2c4] font-bold">{intensidadHoy.Alta.toFixed(1)}h Alta / {totalIntensidadHoy.toFixed(1)}h</span>
                </div>
                <div className="h-3.5 w-full rounded-md bg-[#121c13] overflow-hidden flex border border-[#74a47b]/40 p-0.5">
                  <div style={{ width: `${pctIntensidadAltaHoy}%` }} className="h-full bg-[#d9f2c4] rounded-l-sm" title={`Alta: ${intensidadHoy.Alta.toFixed(1)}h`}></div>
                  <div style={{ width: `${pctIntensidadMediaHoy}%` }} className="h-full bg-[#74a47b]" title={`Media: ${intensidadHoy.Media.toFixed(1)}h`}></div>
                  <div style={{ width: `${pctIntensidadBajaHoy}%` }} className="h-full bg-[#215e28] rounded-r-sm" title={`Baja: ${intensidadHoy.Baja.toFixed(1)}h`}></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#92aa95]">
                  <span>ALTA: {intensidadHoy.Alta.toFixed(1)}h</span>
                  <span>MEDIA: {intensidadHoy.Media.toFixed(1)}h</span>
                  <span>BAJA: {intensidadHoy.Baja.toFixed(1)}h</span>
                </div>
              </div>
            </div>

            {/* Matriz 2D */}
            <div className="overflow-x-auto pt-1">
              <div className="min-w-[380px] space-y-1.5 font-mono">
                <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-[#92aa95]">
                  <div className="text-left font-bold text-[#f8fafc] self-center uppercase">Intensidad \ Incomodidad</div>
                  <div className="p-1 rounded bg-[#1a281b] text-[#e28080] font-bold border border-[#e28080]/30">Alta (Frontera)</div>
                  <div className="p-1 rounded bg-[#1a281b] text-[#fde68a] font-bold border border-[#fde68a]/30">Media (Esfuerzo)</div>
                  <div className="p-1 rounded bg-[#1a281b] text-[#74a47b] font-bold border border-[#74a47b]/30">Baja (Confort)</div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="flex items-center text-left text-[11px] font-bold text-[#d9f2c4] uppercase">Alta</div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Alta.Alta > 0 ? 'bg-[#215e28] border-[#d9f2c4] text-[#d9f2c4]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Alta.Alta.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Élite</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Alta.Media > 0 ? 'bg-[#215e28]/60 border-[#74a47b] text-[#d9f2c4]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Alta.Media.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Flujo</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Alta.Baja > 0 ? 'bg-[#1a281b] border-[#74a47b] text-[#74a47b]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Alta.Baja.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Mecánico</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="flex items-center text-left text-[11px] font-bold text-[#74a47b] uppercase">Media</div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Media.Alta > 0 ? 'bg-[#1a281b] border-[#fde68a] text-[#fde68a]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Media.Alta.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Desafío</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Media.Media > 0 ? 'bg-[#1a281b] border-[#74a47b] text-[#92aa95]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Media.Media.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Sostenible</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Media.Baja > 0 ? 'bg-[#000000] border-[#74a47b]/40 text-[#92aa95]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Media.Baja.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Rutinario</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="flex items-center text-left text-[11px] font-bold text-[#92aa95] uppercase">Baja</div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Baja.Alta > 0 ? 'bg-[#000000] border-[#e28080]/50 text-[#e28080]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Baja.Alta.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Sobrecarga</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Baja.Media > 0 ? 'bg-[#000000] border-[#74a47b]/40 text-[#92aa95]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Baja.Media.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Distracción</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${matrizHoy.Baja.Baja > 0 ? 'bg-[#000000] border-[#e28080]/30 text-[#e28080]' : 'bg-[#000000] border-[#74a47b]/20 text-[#92aa95]/40'}`}>
                    <span className="font-bold block">{matrizHoy.Baja.Baja.toFixed(1)}h</span>
                    <span className="text-[9px] uppercase">Superficial</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* COLUMNA LATERAL (35% -> col-span-4): CONSOLA DE EXIGENCIA & SEMÁFORO NO NEGOCIABLE */}
        <div className="lg:col-span-4 space-y-6">
          {/* TARJETA DE RACHA ÉLITE */}
          <div className="card-tactical p-5 border-2 border-[#74a47b]/50 shadow-[0_10px_25px_rgba(0,0,0,0.8)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="tag-tactical text-[10px] px-2 py-0.5 rounded bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                DISCIPLINA ÉLITE
              </span>
              <span className="text-xl">{stats.rachaActual > 0 ? '🔥' : '🕯️'}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-display font-extrabold text-[#d9f2c4]">
                {stats.rachaActual}
              </span>
              <span className="text-sm font-mono text-[#92aa95] font-bold uppercase">
                {stats.rachaActual === 1 ? 'DÍA DE RACHA' : 'DÍAS DE RACHA'}
              </span>
            </div>
            <p className="text-xs font-mono text-[#92aa95] leading-relaxed">
              La racha solo se sella cuando la jornada concluye con esfuerzo riguroso (≥75% en los 4 pilares).
            </p>
          </div>

          {/* SEMÁFORO DE EXIGENCIA DIARIA */}
          <section className="card-tactical p-5 space-y-4 border-2 border-[#74a47b]/40">
            <div className="flex items-center justify-between pb-3 border-b border-[#74a47b]/20">
              <div className="space-y-0.5">
                <h3 className="text-sm font-display font-bold text-[#f8fafc] uppercase tracking-tight flex items-center gap-1.5">
                  <span>⚖️</span>
                  Semáforo de Exigencia
                </h3>
                <p className="text-[11px] font-mono text-[#92aa95]">
                  4 Pilares No Negociables
                </p>
              </div>

              {totalAlertas === 0 ? (
                <span className="tag-tactical px-2.5 py-1 rounded text-[10px] bg-[#d9f2c4] text-[#000000] border-[#74a47b]">
                  ✓ 100% OK
                </span>
              ) : (
                <span className="tag-tactical px-2.5 py-1 rounded text-[10px] bg-[#e28080] text-[#000000] border-[#74a47b]">
                  ⚠ {totalAlertas} PEND.
                </span>
              )}
            </div>

            {totalAlertas > 0 ? (
              <div className="space-y-3 font-mono">
                {/* Alerta 1: Trabajo Profundo */}
                {alertaTrabajo && (
                  <div className="p-3.5 rounded-xl bg-[#000000] border-2 border-[#e28080]/60 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#e28080]">
                      <span>⚠ DEEP WORK DEFICITARIO</span>
                      <span>{horasHoy.toFixed(1)}h / 3.0h</span>
                    </div>
                    <p className="text-xs text-[#f8fafc]">
                      Te faltan {deficitTrabajoHoy.toFixed(1)}h para el mínimo Newport de élite.
                    </p>
                    <blockquote className="p-2.5 rounded-lg bg-[#121c13] border-l-2 border-[#e28080] text-[11px] text-[#92aa95] italic font-serif">
                      &ldquo;No es que tengamos poco tiempo, sino que perdemos mucho.&rdquo;
                      <span className="block text-[9px] font-mono text-[#e28080] font-bold not-italic mt-1">— Séneca</span>
                    </blockquote>
                  </div>
                )}

                {/* Alerta 2: Fricción Cognitiva */}
                {alertaEstudio && (
                  <div className="p-3.5 rounded-xl bg-[#000000] border-2 border-[#fde68a]/60 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#fde68a]">
                      <span>⚠ CONFORT MENTAL</span>
                      <span>{pctExigenteHoy}% / 50%</span>
                    </div>
                    <p className="text-xs text-[#f8fafc]">
                      {horasHoy === 0 ? 'Sin bloques de estudio desafiante aún.' : 'Poco tiempo en la frontera de dificultad cognitiva.'}
                    </p>
                    <blockquote className="p-2.5 rounded-lg bg-[#121c13] border-l-2 border-[#fde68a] text-[11px] text-[#92aa95] italic font-serif">
                      &ldquo;Trágate ese sapo a primera hora y sin titubear.&rdquo;
                      <span className="block text-[9px] font-mono text-[#fde68a] font-bold not-italic mt-1">— Brian Tracy</span>
                    </blockquote>
                  </div>
                )}

                {/* Alerta 3: Entrenamiento */}
                {alertaEntrenamiento && (
                  <div className="p-3.5 rounded-xl bg-[#000000] border-2 border-[#e28080]/60 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#e28080]">
                      <span>⚠ TEMPLO FÍSICO</span>
                      <span>{ejercicioHoy.toFixed(1)}h / 0.75h</span>
                    </div>
                    <p className="text-xs text-[#f8fafc]">
                      {ejercicioHoy === 0 ? 'Hoy no has entrenado el cuerpo.' : `Faltan ${deficitEjercicioHoy.toFixed(1)}h de entreno.`}
                    </p>
                    <blockquote className="p-2.5 rounded-lg bg-[#121c13] border-l-2 border-[#e28080] text-[11px] text-[#92aa95] italic font-serif">
                      &ldquo;Cuando tu mente dice basta, estás apenas al 40%.&rdquo;
                      <span className="block text-[9px] font-mono text-[#e28080] font-bold not-italic mt-1">— David Goggins</span>
                    </blockquote>
                  </div>
                )}

                {/* Alerta 4: Cierre */}
                {alertaCierre && (
                  <div className="p-3.5 rounded-xl bg-[#000000] border-2 border-[#74a47b]/60 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#d9f2c4]">
                      <span>🌙 CIERRE PENDIENTE</span>
                      <span>23:59 LÍMITE</span>
                    </div>
                    <p className="text-xs text-[#f8fafc]">
                      Sella la jornada formalmente antes de medianoche para no arrastrar bucles.
                    </p>
                    <blockquote className="p-2.5 rounded-lg bg-[#121c13] border-l-2 border-[#74a47b] text-[11px] text-[#92aa95] italic font-serif">
                      &ldquo;Al anochecer, confina tus pensamientos y haz las paces con lo inacabado.&rdquo;
                      <span className="block text-[9px] font-mono text-[#d9f2c4] font-bold not-italic mt-1">— Marco Aurelio</span>
                    </blockquote>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#000000] border-2 border-[#d9f2c4] text-center space-y-2">
                <span className="text-2xl">🏆</span>
                <h4 className="text-sm font-display font-bold text-[#d9f2c4] uppercase">
                  Estándar Élite Conquistado
                </h4>
                <p className="text-xs font-mono text-[#92aa95]">
                  Todos los umbrales de trabajo profundo, fricción mental, entreno físico y cierre han sido conquistados hoy.
                </p>
                <blockquote className="p-2 rounded bg-[#121c13] text-[10px] text-[#d9f2c4] italic font-serif">
                  &ldquo;La excelencia no es un acto aislado, sino un hábito forjado día a día.&rdquo;
                  <span className="block text-[8px] font-mono text-[#92aa95] not-italic mt-0.5">— Aristóteles</span>
                </blockquote>
              </div>
            )}
          </section>

          {/* ACCESO A BÓVEDA HISTÓRICA */}
          <div className="card-elevated p-5 border border-[#74a47b]/40 space-y-3">
            <span className="text-xs font-display font-bold text-[#f8fafc] uppercase block">
              Auditoría Histórica Retrospectiva
            </span>
            <p className="text-xs font-mono text-[#92aa95]">
              Consulta el rendimiento de cualquier fecha del calendario con desglose horario exacto.
            </p>
            <button
              type="button"
              onClick={() => setMostrarModalHistorico(true)}
              className="btn-tactical w-full py-2.5 rounded-xl text-xs font-mono font-bold uppercase text-center block"
            >
              🏛️ Abrir Bóveda Histórica
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. MODAL MAXIMIZADO DE LA BÓVEDA HISTÓRICA Y AUDITORÍA    */}
      {/* ========================================================= */}
      {mostrarModalHistorico && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-historico-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/90 backdrop-blur-md overflow-hidden animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMostrarModalHistorico(false);
          }}
        >
          <div className="relative w-full max-w-6xl max-h-[94vh] bg-[#121c13] border-2 border-[#74a47b] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden">
            {/* Modal Sticky Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b-2 border-[#74a47b]/30 bg-[#121c13] sticky top-0 z-30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                    BÓVEDA HISTÓRICA
                  </span>
                  <span className="text-xs font-mono text-[#92aa95] font-bold uppercase">
                    AUDITORÍA RETROSPECTIVA
                  </span>
                </div>
                <h3 id="modal-historico-title" className="text-lg sm:text-2xl font-display font-extrabold text-[#f8fafc] uppercase tracking-tight">
                  Consulta Día por Día &amp; Montañas Acumuladas
                </h3>
              </div>

              <button
                onClick={() => setMostrarModalHistorico(false)}
                className="btn-tactical px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase"
                title="Cerrar ventana histórica (Esc)"
              >
                ✕ Cerrar (Esc)
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-7">
              {/* SELECTOR Y AUDITORÍA DE DÍA ESPECÍFICO */}
              <section className="card-elevated p-4 sm:p-6 border-2 border-[#74a47b]/40 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#74a47b]/20">
                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-display font-bold text-[#f8fafc] uppercase">
                      Auditar Día en Específico
                    </h4>
                    <p className="text-xs font-mono text-[#92aa95]">
                      Cambia la fecha con el selector o haz clic en cualquier día con actividad.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handlePasoDia(-1)}
                      className="btn-tactical-ghost px-3 py-1.5 rounded-xl text-xs font-mono uppercase"
                      title="Ir al día anterior"
                    >
                      ◀ Ant
                    </button>

                    <input
                      type="date"
                      value={fechaSeleccionadaHist}
                      onChange={(e) => handleSeleccionarDia(e.target.value)}
                      className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#000000] text-[#d9f2c4] border-2 border-[#74a47b] focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => handlePasoDia(1)}
                      className="btn-tactical-ghost px-3 py-1.5 rounded-xl text-xs font-mono uppercase"
                      title="Ir al día siguiente"
                    >
                      Sig ▶
                    </button>
                  </div>
                </div>

                {/* Días con actividad */}
                {diasConActividadLista.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-[#92aa95] uppercase font-bold block">
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
                            className={`btn-tactical-ghost shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono ${
                              isSelected
                                ? 'bg-[#d9f2c4] text-[#000000] font-bold border-[#d9f2c4]'
                                : 'bg-[#000000] text-[#92aa95]'
                            }`}
                          >
                            <span>📅 {formatShortDate(dItem.fecha)}</span>
                            {isToday && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-[#215e28] text-[#d9f2c4] font-bold">
                                HOY
                              </span>
                            )}
                            <span className="font-bold text-[#d9f2c4]">
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
                    <div className="w-8 h-8 rounded-xl bg-[#215e28] border-2 border-[#74a47b] animate-spin"></div>
                    <span className="text-xs font-mono text-[#92aa95] uppercase">
                      Cargando auditoría histórica para {fechaSeleccionadaHist}...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-5 animate-fade-in">
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#000000] border-2 border-[#74a47b]/40 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="tag-tactical px-2.5 py-0.5 rounded text-xs bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                              {fechaSeleccionadaHist >= FECHA_INICIO_CICLO
                                ? `DÍA ${getDiaCicloParaFecha(fechaSeleccionadaHist)} / 365`
                                : 'PREVIO AL CICLO'}
                            </span>
                          </div>
                          <h5 className="text-lg sm:text-2xl font-display font-bold text-[#f8fafc]">
                            {formatFechaLargaEspanol(fechaSeleccionadaHist)}
                          </h5>
                        </div>

                        <span className="tag-tactical px-3 py-1.5 rounded-xl bg-[#121c13] border-[#74a47b] text-[#d9f2c4] font-bold text-xs">
                          Total: {(detalleDiaHist?.totalHorasNetas ?? 0).toFixed(2)}h netas
                        </span>
                      </div>

                      {/* Micro KPIs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-[#121c13] border border-[#74a47b]/30 space-y-0.5">
                          <span className="text-[10px] text-[#92aa95] block uppercase font-bold">Deep Work</span>
                          <span className="text-base font-bold font-display text-[#d9f2c4]">
                            {(detalleDiaHist?.totalHorasNetas ?? 0).toFixed(1)}h
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#121c13] border border-[#74a47b]/30 space-y-0.5">
                          <span className="text-[10px] text-[#92aa95] block uppercase font-bold">Entrenamiento</span>
                          <span className="text-base font-bold font-display text-[#f8fafc]">
                            {detalleDiaHist?.ejercicioHoras ? `${detalleDiaHist.ejercicioHoras.toFixed(1)}h` : '0h'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#121c13] border border-[#74a47b]/30 space-y-0.5">
                          <span className="text-[10px] text-[#92aa95] block uppercase font-bold">Alimento</span>
                          <span className="text-base font-bold font-display text-[#fde68a]">
                            {detalleDiaHist?.alimento ? `${detalleDiaHist.alimento}/5 ⭐` : '—'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#121c13] border border-[#74a47b]/30 space-y-0.5">
                          <span className="text-[10px] text-[#92aa95] block uppercase font-bold">Ritual Cierre</span>
                          <span className={`text-base font-bold font-display ${detalleDiaHist?.cierreRealizado ? 'text-[#d9f2c4]' : 'text-[#92aa95]'}`}>
                            {detalleDiaHist?.cierreRealizado ? '✓ SELLADO' : 'SIN CIERRE'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bloques de Foco Auditados con hora exacta */}
                    <div className="space-y-3">
                      <h6 className="text-xs sm:text-sm font-display font-bold uppercase tracking-wider text-[#f8fafc]">
                        📋 Bloques de Concentración Ejecutados ({sesionesDiaHist.length})
                      </h6>

                      {sesionesDiaHist.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-[#000000] border-2 border-dashed border-[#74a47b]/30 text-center text-xs font-mono text-[#92aa95]">
                          No se registraron bloques de trabajo profundo en esta fecha.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sesionesDiaHist.map((sesion, idx) => {
                            const timeInfo = getSessionTimeRange(sesion);
                            return (
                              <div
                                key={sesion.id || idx}
                                className="p-4 rounded-2xl bg-[#000000] border-2 border-[#74a47b]/40 space-y-2.5"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#74a47b]/20">
                                  <div className="flex items-center gap-2">
                                    <span className="tag-tactical px-2 py-0.5 rounded text-xs bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                                      🕒 {timeInfo.inicio} — {timeInfo.fin}
                                    </span>
                                    <span className="text-xs font-mono text-[#f8fafc] font-bold">
                                      ({timeInfo.durMin} min / {sesion.horas_netas}h netas)
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-mono text-[#92aa95]">
                                    💾 Registrado a las <strong>{timeInfo.exacta}</strong>
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-base font-display font-bold text-[#f8fafc] uppercase">
                                    {sesion.tipo}
                                  </span>
                                  <div className="flex items-center gap-2 text-[10px] font-mono">
                                    <span className="tag-tactical px-2 py-0.5 rounded bg-[#121c13] text-[#d9f2c4] border-[#74a47b]">
                                      Int: {sesion.intensidad}
                                    </span>
                                    <span className="tag-tactical px-2 py-0.5 rounded bg-[#121c13] text-[#e28080] border-[#74a47b]">
                                      Incom: {sesion.incomodidad}
                                    </span>
                                  </div>
                                </div>

                                {sesion.calidad && (
                                  <blockquote className="p-3 rounded-xl bg-[#121c13] border-l-2 border-[#d9f2c4] text-xs text-[#92aa95] italic font-serif">
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
              <section className="card-elevated p-5 sm:p-6 border-2 border-[#74a47b]/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#74a47b]/20">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-display font-bold text-[#f8fafc] uppercase">
                      ⛰️ Relieve Temporal Histórico
                    </h4>
                    <p className="text-xs font-mono text-[#92aa95]">
                      Total acumulado en el período: <strong className="text-[#d9f2c4]">{totalHorasEnRango.toFixed(1)}h</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#000000] p-1 rounded-xl border border-[#74a47b]/40">
                      <button
                        type="button"
                        onClick={() => setModoGraficoHist('montana')}
                        className={`btn-tactical px-2.5 py-1 rounded-lg text-xs font-mono uppercase ${
                          modoGraficoHist === 'montana' ? 'bg-[#d9f2c4] text-[#000000]' : 'bg-transparent text-[#92aa95] border-none shadow-none'
                        }`}
                      >
                        ⛰️ Montañas
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoGraficoHist('columnas')}
                        className={`btn-tactical px-2.5 py-1 rounded-lg text-xs font-mono uppercase ${
                          modoGraficoHist === 'columnas' ? 'bg-[#d9f2c4] text-[#000000]' : 'bg-transparent text-[#92aa95] border-none shadow-none'
                        }`}
                      >
                        📊 Columnas
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-[#000000] p-1 rounded-xl border border-[#74a47b]/40">
                      {([7, 14, 30] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRangoDias(r)}
                          className={`btn-tactical-ghost px-2.5 py-1 rounded-lg text-xs font-mono ${
                            rangoDias === r ? 'bg-[#215e28] text-[#d9f2c4]' : 'text-[#92aa95]'
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
                  <div className="p-4 rounded-2xl bg-[#000000] border-2 border-[#74a47b]/30 overflow-x-auto">
                    <div className="min-w-[620px] relative">
                      <svg viewBox={`0 0 ${svgTrendWidth} ${svgTrendHeight}`} className="w-full h-44 overflow-visible">
                        <defs>
                          <linearGradient id="histMountainAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#d9f2c4" stopOpacity="0.4" />
                            <stop offset="45%" stopColor="#215e28" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
                          </linearGradient>
                          <linearGradient id="histMountainLineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#74a47b" />
                            <stop offset="50%" stopColor="#d9f2c4" />
                            <stop offset="100%" stopColor="#74a47b" />
                          </linearGradient>
                        </defs>

                        <line x1="0" y1={svgTrendBaselineY} x2={svgTrendWidth} y2={svgTrendBaselineY} stroke="#1a281b" strokeWidth="2" />
                        <line x1="0" y1={newportGoalY} x2={svgTrendWidth} y2={newportGoalY} stroke="#74a47b" strokeDasharray="5 5" strokeWidth="1.5" opacity="0.6" />
                        <text x={svgTrendWidth - 10} y={newportGoalY - 6} textAnchor="end" fill="#74a47b" fontSize="10" fontFamily="monospace" fontWeight="bold">
                          Meta Newport: 4.0h
                        </text>

                        <path d={mountainTrendArea} fill="url(#histMountainAreaGrad)" className="transition-all duration-500" />
                        <path d={mountainTrendLine} fill="none" stroke="url(#histMountainLineGrad)" strokeWidth="3" strokeLinecap="round" className="transition-all duration-500" />

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
                                r={isSelected ? 7 : hasHours ? 4.5 : 2.5}
                                fill={isSelected ? '#d9f2c4' : hasHours ? '#74a47b' : '#1a281b'}
                                stroke="#000000"
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
                      <div className="relative h-44 w-full border-b-2 border-[#74a47b]/30 flex items-end justify-between gap-1.5 px-2">
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
                                className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 border-2 border-black ${
                                  isSelectedDate
                                    ? 'bg-[#d9f2c4] shadow-[0_0_12px_rgba(217,242,196,0.4)]'
                                    : hasHours
                                    ? 'bg-[#215e28] hover:bg-[#74a47b]'
                                    : 'bg-[#121c13]'
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

            {/* Modal Sticky Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-5 border-t-2 border-[#74a47b]/30 bg-[#121c13] sticky bottom-0 z-30">
              <p className="text-xs text-[#92aa95] font-mono italic hidden sm:block">
                &ldquo;El pasado ya murió; el futuro aún no nace; la única victoria posible ocurre hoy.&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setMostrarModalHistorico(false)}
                className="btn-tactical w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-mono font-bold uppercase ml-auto"
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

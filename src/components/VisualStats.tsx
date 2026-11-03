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

        {/* GRAN MONTAÑA CIRCADIANA SVG (ESTILO NOCHE DE INVIERNO & BIBLIOTECA) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#081229]/80 border border-[#5b9bd5]/20 shadow-inner space-y-2 relative">
          <div className="flex items-center justify-between text-xs text-[#94a3b8] pb-1">
            <span className="flex items-center gap-2 font-medium text-[#f8fafc]">
              <span className="w-2 h-2 rounded-full bg-[#60a5fa] animate-ping"></span>
              Relieve de Concentración 24 Horas
            </span>
            <span className="text-[#eed59b] font-medium font-serif">
              {horasHoy > 0 ? `${(horasHoy * 60).toFixed(0)} minutos de inmersión hoy` : 'Esperando primera sesión del día'}
            </span>
          </div>

          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${mountainHoyData.width} ${mountainHoyData.height}`}
              className="w-full h-32 sm:h-44 overflow-visible"
            >
              <defs>
                <linearGradient id="midnightCircadianGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#1e3a8a" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#070e1e" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="midnightCircadianStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#5b9bd5" />
                  <stop offset="50%" stopColor="#eed59b" />
                  <stop offset="100%" stopColor="#5b9bd5" />
                </linearGradient>
              </defs>

              {/* Guías horizontales */}
              <line
                x1="0"
                y1={mountainHoyData.baselineY}
                x2={mountainHoyData.width}
                y2={mountainHoyData.baselineY}
                stroke="#11224d"
                strokeWidth="1.5"
              />
              <line
                x1="0"
                y1={mountainHoyData.baselineY - 50}
                x2={mountainHoyData.width}
                y2={mountainHoyData.baselineY - 50}
                stroke="#19336e"
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.6"
              />

              {/* Área spline continua */}
              {horasHoy > 0 && (
                <path
                  d={mountainHoyData.areaPath}
                  fill="url(#midnightCircadianGrad)"
                  className="transition-all duration-700"
                />
              )}

              {/* Cresta de la montaña */}
              <path
                d={mountainHoyData.linePath}
                fill="none"
                stroke={horasHoy > 0 ? 'url(#midnightCircadianStroke)' : '#19336e'}
                strokeWidth="2.5"
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
                        r="9"
                        fill="none"
                        stroke="#eed59b"
                        strokeWidth="1.5"
                        className="animate-ping opacity-75"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : hasFocus ? 4.5 : 2.5}
                      fill={
                        isSelected
                          ? '#ffffff'
                          : isCurrent
                          ? '#eed59b'
                          : hasFocus
                          ? '#60a5fa'
                          : '#11224d'
                      }
                      stroke="#070e1e"
                      strokeWidth="2"
                      className="transition-all duration-200 group-hover:scale-150"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* HUD DE 4 MÉTRICAS CLAVE (ESTILO FORMAL MEDIANOCHE) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Horas Netas de Hoy */}
          <div className="card-elevated p-4 border border-[#5b9bd5]/25 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-[#94a3b8]">
              <span>TIEMPO DE FOCO</span>
              <span className="text-[#eed59b]">✦</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-serif font-bold text-white tabular-nums">
                {horasHoy.toFixed(1)}
              </span>
              <span className="text-xs text-[#94a3b8]">/ 3.0h sugeridas</span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {horasHoy >= UMBRAL_TRABAJO_MIN_H
                ? '✓ Objetivo diario alcanzado'
                : deficitTrabajoHoy > 0
                ? `Resta ${deficitTrabajoHoy.toFixed(1)}h hoy`
                : 'Sin sesiones aún hoy'}
            </p>
          </div>

          {/* KPI 2: Fricción / Incomodidad de Hoy */}
          <div className="card-elevated p-4 border border-[#5b9bd5]/25 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-[#94a3b8]">
              <span>INCOMODIDAD MENTAL</span>
              <span className="text-[#60a5fa]">⚡</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-serif font-bold text-white tabular-nums">
                {horasHoy > 0 ? `${pctExigenteHoy}%` : '0%'}
              </span>
              <span className="text-xs text-[#94a3b8]">/ 50% ideal</span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {horasHoy > 0
                ? `${horasFriccionHoy.toFixed(1)}h en incomodidad alta o media`
                : 'Sin sesiones desafiantes hoy'}
            </p>
          </div>

          {/* KPI 3: Entrenamiento de Hoy */}
          <div className="card-elevated p-4 border border-[#5b9bd5]/25 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-[#94a3b8]">
              <span>EJERCICIO FÍSICO</span>
              <span className="text-[#4ecdc4]">🏃</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-3xl sm:text-4xl font-serif font-bold text-white tabular-nums">
                {ejercicioHoy.toFixed(1)}
              </span>
              <span className="text-xs text-[#94a3b8]">/ 0.75h meta</span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {ejercicioHoy >= UMBRAL_EJERCICIO_MIN_H
                ? '✓ Ejercicio completado'
                : deficitEjercicioHoy > 0
                ? `Resta ${deficitEjercicioHoy.toFixed(1)}h de actividad`
                : 'Sin entrenamiento hoy'}
            </p>
          </div>

          {/* KPI 4: Cierre de Jornada */}
          <div className="card-elevated p-4 border border-[#5b9bd5]/25 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-[#94a3b8]">
              <span>CIERRE DIARIO</span>
              <span className="text-[#eed59b]">🌙</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className={`text-2xl sm:text-3xl font-serif font-bold ${cierreHoy ? 'text-[#eed59b]' : 'text-[#94a3b8]'}`}>
                {cierreHoy ? 'Concluido' : 'En Curso'}
              </span>
              <span className="text-xs text-[#94a3b8]">
                {cierreHoy ? '✓' : '11:59 PM'}
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              {cierreHoy ? 'Jornada cerrada con serenidad' : 'Pendiente antes del descanso'}
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
                    const hasFocus = slot.minutosFoco > 0;
                    const fillPercent = Math.max(hasFocus ? 16 : 0, Math.round((slot.minutosFoco / 60) * 100));

                    let barColor = 'bg-[#11224d]';
                    if (slot.intensidadPredominante === 'Alta') barColor = 'bg-gradient-to-t from-[#2563eb] to-[#60a5fa] shadow-[0_0_10px_rgba(96,165,250,0.35)]';
                    else if (slot.intensidadPredominante === 'Media') barColor = 'bg-gradient-to-t from-[#1e3a8a] to-[#3b82f6]';
                    else if (slot.intensidadPredominante === 'Baja') barColor = 'bg-[#19336e]';

                    let dotColor = null;
                    if (slot.incomodidadPredominante === 'Alta') dotColor = 'bg-[#eed59b]';
                    else if (slot.incomodidadPredominante === 'Media') dotColor = 'bg-[#60a5fa]';
                    else if (slot.incomodidadPredominante === 'Baja') dotColor = 'bg-[#4ecdc4]';

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

                        <div className="h-2.5 flex items-center justify-center mb-1">
                          {dotColor ? (
                            <span className={`w-2 h-2 rounded-full ${dotColor} shadow-sm`}></span>
                          ) : (
                            <span className="w-1 h-1 rounded-full bg-white/10"></span>
                          )}
                        </div>

                        <div
                          className={`w-full max-w-[26px] h-20 rounded-lg flex flex-col justify-end p-0.5 transition-all duration-200 border ${
                            slot.esHoraActual
                              ? 'bg-[#0d1a3d] border-[#eed59b] shadow-midnight-glow'
                              : isSelected
                              ? 'bg-[#132247] border-white shadow-md'
                              : hasFocus
                              ? 'bg-[#0d1a3d] border-[#5b9bd5]/40 hover:border-[#60a5fa]'
                              : slot.esFutura
                              ? 'bg-[#070e1e]/60 border-dashed border-[#5b9bd5]/15'
                              : 'bg-[#070e1e]/80 border-[#5b9bd5]/15 hover:border-[#5b9bd5]/35'
                          } ${isSelected ? 'scale-105' : ''}`}
                        >
                          {hasFocus ? (
                            <div
                              style={{ height: `${fillPercent}%` }}
                              className={`w-full rounded-md transition-all duration-300 ${barColor}`}
                            ></div>
                          ) : (
                            <div className="w-full h-0.5 bg-transparent"></div>
                          )}
                        </div>

                        <span
                          className={`mt-1.5 text-[10px] font-mono leading-none transition-colors ${
                            slot.esHoraActual
                              ? 'text-[#eed59b] font-bold'
                              : isSelected
                              ? 'text-white font-bold'
                              : hasFocus
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
                      Sesión Registrada
                    </span>
                  )}
                </div>

                <span className="text-xs text-[#eed59b] font-mono font-semibold">
                  {slotActivoHoy.minutosFoco} min netos ({slotActivoHoy.horasNetas.toFixed(2)}h)
                </span>
              </div>

              {/* Sesiones del tramo */}
              {slotActivoHoy.sesiones.length > 0 ? (
                <div className="space-y-2">
                  {slotActivoHoy.sesiones.map((item, idx) => (
                    <div
                      key={item.sesion.id || idx}
                      className="p-3.5 rounded-xl bg-[#0d1733]/90 border border-[#5b9bd5]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-white text-sm">{item.sesion.tipo}</span>
                          <span className="tag-formal text-[10px] px-2 py-0.5 rounded-full bg-[#1e3a8a]/50 text-[#93c5fd] border border-[#60a5fa]/30">
                            {item.minutos} min en este tramo
                          </span>
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
                        <span className="tag-formal px-2.5 py-1 rounded-full bg-[#070e1e] text-[#94a3b8] border border-[#5b9bd5]/25">
                          Incomodidad: <b className="text-[#eed59b]">{item.sesion.incomodidad}</b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-[#94a3b8]">
                  {slotActivoHoy.esHoraActual
                    ? 'Franja activa en este momento. Aprovecha para registrar una sesión de foco.'
                    : slotActivoHoy.esPasada
                    ? 'Sin sesiones de trabajo en este intervalo.'
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
                            {detalleDiaHist?.ejercicioHoras ? `${detalleDiaHist.ejercicioHoras.toFixed(1)}h` : '0h'}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0d1733]/70 border border-[#5b9bd5]/20 space-y-1">
                          <span className="text-[10px] text-[#94a3b8] block uppercase font-medium">Alimentación</span>
                          <span className="text-lg font-serif font-bold text-[#60a5fa]">
                            {detalleDiaHist?.alimento ? `${detalleDiaHist.alimento}/5 ⭐` : '—'}
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
    </div>
  );
};

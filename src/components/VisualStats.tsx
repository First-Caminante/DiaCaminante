import React, { useState, useEffect } from 'react';
import type { EstadisticasResponse, TendenciaDia } from '../types/database';

interface VisualStatsProps {
  fechaHoy?: string;
  onGoToDailyLog?: () => void;
}

export const VisualStats: React.FC<VisualStatsProps> = ({ fechaHoy, onGoToDailyLog }) => {
  const [stats, setStats] = useState<EstadisticasResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rangoDias, setRangoDias] = useState<7 | 14 | 30>(14);
  const [hoveredDay, setHoveredDay] = useState<TendenciaDia | null>(null);
  const [mostrarHistorico, setMostrarHistorico] = useState<boolean>(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const targetFecha = fechaHoy || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      const res = await fetch(`/api/estadisticas?fecha=${targetFecha}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al obtener estadísticas');
      }
      const data: EstadisticasResponse = await res.json();
      setStats(data);
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

  // Filter trend days according to selected range (para vista histórica)
  const filteredTrend = stats.tendenciaDias.slice(-rangoDias);
  const maxHoursInTrend = Math.max(...filteredTrend.map((d) => d.horasNetas), 4.5);
  const totalHorasEnRango = filteredTrend.reduce((acc, d) => acc + d.horasNetas, 0);

  // Minimum Exigence Standards (Estándares Mínimos de Exigencia y Disciplina)
  const UMBRAL_TRABAJO_MIN_H = 3.0; // 3.0h netas mínimas diarias (Cal Newport)
  const UMBRAL_EXIGENCIA_MIN_PCT = 50; // Mínimo 50% de incomodidad Alta o Media
  const UMBRAL_EJERCICIO_MIN_H = 0.75; // 45 min (0.75h) diarias de entrenamiento físico
  const UMBRAL_CIERRE_MIN_PCT = 85; // 85% de cumplimiento en ritual de cierre

  // Métricas reales y exclusivas de HOY (Día actual reseteado)
  const horasHoy = stats.hoy?.horasNetas ?? 0;
  const ejercicioHoy = stats.hoy?.ejercicioHoras ?? 0;
  const cierreHoy = stats.hoy?.cierreRealizado ?? false;
  const sesionesHoyCount = stats.hoy?.sesionesCount ?? 0;

  const incomodidadHoy = stats.hoy?.distribucionIncomodidad || { Alta: 0, Media: 0, Baja: 0 };
  const intensidadHoy = stats.hoy?.distribucionIntensidad || { Alta: 0, Media: 0, Baja: 0 };

  const horasFriccionHoy = incomodidadHoy.Alta + incomodidadHoy.Media;
  const pctExigenteHoy = horasHoy > 0 ? Math.round((horasFriccionHoy / horasHoy) * 100) : 0;

  // Lógica de Alertas para HOY (Fiel a la jornada actual)
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

  const formatShortDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      return `${parts[2]}/${parts[1]}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-4 space-y-6 animate-fade-in">
      {/* Top Header con Racha Élite en la Esquina y Acción de Ver Histórico */}
      <div className="card-midnight rounded-2xl p-5 sm:p-7 shadow-xl border border-white/7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pastel-mint animate-pulse"></span>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                Enfoque Radical Día a Día
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Estadísticas de la Jornada
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              El marcador se resetea a cero cada mañana. Enfócate exclusivamente en conquistar el día de hoy.
            </p>
          </div>

          {/* Right Header: Racha en la Esquina y Botón Ver Histórico */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Racha Élite Bonita en la Esquina (Mínimo 75% en todo) */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                stats.rachaActual > 0
                  ? 'bg-midnight-950 border-pastel-amber/40 shadow-glow-amber'
                  : 'bg-midnight-950/70 border-white/10'
              }`}
              title="La racha solo se forja cuando el día concluye con esfuerzo riguroso (≥75% en trabajo, estudio, entrenamiento y cierre sellado)"
            >
              <span className="text-base">{stats.rachaActual > 0 ? '🔥' : '🕯️'}</span>
              <div className="text-left">
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold font-mono text-pastel-amber leading-none">
                    {stats.rachaActual}
                  </span>
                  <span className="text-[10px] font-mono text-pastel-amber/80 font-bold uppercase">
                    {stats.rachaActual === 1 ? 'día racha' : 'días racha'}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-slate-500 block leading-tight">
                  Esfuerzo Élite ≥75%
                </span>
              </div>
            </div>

            {/* Botón para ver/ocultar histórico acumulado */}
            <button
              type="button"
              onClick={() => setMostrarHistorico(!mostrarHistorico)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium border transition-all active:scale-95 ${
                mostrarHistorico
                  ? 'bg-pastel-lavender text-midnight-950 font-bold shadow-glow-lavender border-pastel-lavender'
                  : 'bg-midnight-800 text-slate-300 hover:text-white hover:bg-midnight-700 border-white/10'
              }`}
            >
              <span>{mostrarHistorico ? '✕ Ocultar Histórico' : '🏛️ Ver Histórico'}</span>
            </button>

            {onGoToDailyLog && (
              <button
                onClick={onGoToDailyLog}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-midnight-950 bg-pastel-mint hover:bg-pastel-mint/90 shadow-glow-mint transition-all"
              >
                <span>+ Registrar Bloque</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid: ESTRICTAMENTE DEL DÍA DE HOY (Sin falsos alivios pasados) */}
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
              : ejercicioHoy > 0
              ? `Faltan ${deficitEjercicioHoy.toFixed(1)}h`
              : '0h entrenadas hoy'
            }
          </p>
        </div>

        {/* KPI 4: Ritual de Cierre de Hoy */}
        <div className={`card-midnight rounded-2xl p-4 sm:p-5 border transition-all space-y-1 ${
          cierreHoy
            ? 'border-pastel-mint/40 shadow-glow-mint'
            : 'border-white/5'
        }`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Ritual de Cierre
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-bold font-mono ${
              cierreHoy ? 'text-pastel-mint' : 'text-pastel-lavender'
            }`}>
              {cierreHoy ? 'Sellado' : 'Pendiente'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {cierreHoy ? '✓ Mente liberada hasta mañana' : 'Cerrar antes de 11:59 PM'}
          </p>
        </div>
      </div>

      {/* Auditoría de Exigencia & Semáforo de Disciplina (EVALUACIÓN ESTRICTA DE HOY) */}
      <section className="card-midnight rounded-2xl p-5 sm:p-7 shadow-xl border border-white/7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${totalAlertas > 0 ? 'bg-pastel-coral animate-ping' : 'bg-pastel-mint'}`}></span>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                Auditoría del Día ({stats.hoy?.fecha || 'Hoy'})
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>{totalAlertas > 0 ? `🚨 ${totalAlertas} ${totalAlertas === 1 ? 'Alerta Crítica Activa' : 'Alertas Críticas Activas'}` : '🏆 Estándar de Alto Rendimiento Conquistado'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Evaluación estricta de la jornada actual contra umbrales mínimos de trabajo (≥3.0h), fricción cognitiva (≥50%) y entrenamiento (≥0.75h)
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
              totalAlertas === 0
                ? 'bg-pastel-mint/10 text-pastel-mint border-pastel-mint/30 shadow-glow-mint'
                : 'bg-pastel-coral/10 text-pastel-coral border-pastel-coral/30'
            }`}>
              {totalAlertas === 0 ? '✓ ESTÁNDAR ÉLITE' : `! ${totalAlertas} REQUERIMIENTOS INCUMPLIDOS`}
            </span>
          </div>
        </div>

        {/* 4 Mini Gauges / Benchmarks vs Real de HOY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Gauge 1: Trabajo Profundo */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            alertaTrabajo
              ? 'bg-midnight-950 border-pastel-coral/40'
              : 'bg-midnight-950/60 border-pastel-mint/30'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>TRABAJO HOY</span>
              <span className={alertaTrabajo ? 'text-pastel-coral font-bold' : 'text-pastel-mint font-bold'}>
                {alertaTrabajo ? 'DEFICIENTE' : 'CUMPLE'}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-white">{horasHoy.toFixed(1)}h</span>
              <span className="text-[11px] font-mono text-slate-400">/ 3.0h meta</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-midnight-900 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, (horasHoy / 3.0) * 100)}%` }}
                className={`h-full rounded-full ${alertaTrabajo ? 'bg-pastel-coral' : 'bg-pastel-mint'}`}
              ></div>
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-1">
              {horasHoy > 0 ? `${horasHoy.toFixed(1)}h (${sesionesHoyCount} ${sesionesHoyCount === 1 ? 'bloque' : 'bloques'})` : '0h registradas hoy'}
            </p>
          </div>

          {/* Gauge 2: Exigencia Cognitiva (Estudio) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            alertaEstudio
              ? 'bg-midnight-950 border-pastel-amber/40'
              : 'bg-midnight-950/60 border-pastel-mint/30'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>ESTUDIO / FRICCIÓN</span>
              <span className={alertaEstudio ? 'text-pastel-amber font-bold' : 'text-pastel-mint font-bold'}>
                {horasHoy === 0 ? 'SIN REGISTRO' : (alertaEstudio ? 'ZONA CONFORT' : 'FRICCIÓN OK')}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-white">{horasHoy > 0 ? `${pctExigenteHoy}%` : '0%'}</span>
              <span className="text-[11px] font-mono text-slate-400">/ 50% min</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-midnight-900 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, ((horasHoy > 0 ? pctExigenteHoy : 0) / 50) * 100)}%` }}
                className={`h-full rounded-full ${alertaEstudio ? 'bg-pastel-amber' : 'bg-pastel-mint'}`}
              ></div>
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-1">
              {horasHoy > 0 ? `${horasFriccionHoy.toFixed(1)}h fricción hoy` : '0h estudio hoy'}
            </p>
          </div>

          {/* Gauge 3: Entrenamiento */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            alertaEntrenamiento
              ? 'bg-midnight-950 border-pastel-coral/40'
              : 'bg-midnight-950/60 border-pastel-mint/30'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>ENTRENAMIENTO</span>
              <span className={alertaEntrenamiento ? 'text-pastel-coral font-bold' : 'text-pastel-mint font-bold'}>
                {alertaEntrenamiento ? 'INACTIVO' : 'CUMPLE'}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-white">{ejercicioHoy.toFixed(1)}h</span>
              <span className="text-[11px] font-mono text-slate-400">/ 0.75h min</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-midnight-900 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, (ejercicioHoy / 0.75) * 100)}%` }}
                className={`h-full rounded-full ${alertaEntrenamiento ? 'bg-pastel-coral' : 'bg-pastel-mint'}`}
              ></div>
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-1">
              {ejercicioHoy > 0 ? `${ejercicioHoy.toFixed(1)}h entrenadas hoy` : '0h registradas hoy'}
            </p>
          </div>

          {/* Gauge 4: Cierre Diario */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            alertaCierre
              ? 'bg-midnight-950 border-pastel-lavender/40'
              : 'bg-midnight-950/60 border-pastel-mint/30'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>RITUAL CIERRE</span>
              <span className={alertaCierre ? 'text-pastel-lavender font-bold' : 'text-pastel-mint font-bold'}>
                {cierreHoy ? 'SELLADO' : 'PENDIENTE'}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-white">{cierreHoy ? '100%' : '0%'}</span>
              <span className="text-[11px] font-mono text-slate-400">/ {UMBRAL_CIERRE_MIN_PCT}% meta</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-midnight-900 overflow-hidden">
              <div
                style={{ width: cierreHoy ? '100%' : '0%' }}
                className={`h-full rounded-full ${alertaCierre ? 'bg-pastel-lavender' : 'bg-pastel-mint'}`}
              ></div>
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-1">{cierreHoy ? '✓ Sellado hoy' : 'Sin cerrar hoy'}</p>
          </div>
        </div>

        {/* Detailed Alerts Cards or Victory Card */}
        {totalAlertas > 0 ? (
          <div className="space-y-4 pt-1">
            {/* ALERTA 1: ¡PONTE A TRABAJAR! */}
            {alertaTrabajo && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/90 border-l-4 border-pastel-coral border border-pastel-coral/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg animate-fade-in">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-pastel-coral/20 text-pastel-coral border border-pastel-coral/30">
                      ⚠️ Alerta de Rendimiento
                    </span>
                    <span className="text-xs font-mono text-pastel-coral font-bold">
                      Faltan {deficitTrabajoHoy.toFixed(1)}h hoy
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    ¡Ponte a trabajar! Rendimiento por debajo del umbral mínimo de Deep Work
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Un profesional del conocimiento requiere al menos <span className="text-pastel-mint font-semibold font-mono">3.0 horas netas</span> diarias de concentración sin distracciones. Tu registro de hoy es de solo <span className="text-pastel-coral font-bold font-mono">{horasHoy.toFixed(1)}h</span>. No procrastines más.
                  </p>
                  
                  {/* Author Quote */}
                  <blockquote className="p-2.5 rounded-xl bg-midnight-900/90 border-l-2 border-pastel-coral border border-white/5 text-xs text-slate-300 space-y-1">
                    <p className="italic font-serif text-[11px] sm:text-xs text-slate-200">
                      &ldquo;No te detengas cuando estés cansado; detente solo cuando hayas terminado. La motivación es una mentira; la disciplina de sentarte a producir es tu único deber.&rdquo;
                    </p>
                    <span className="block text-[10px] font-mono text-pastel-coral font-semibold">
                      — David Goggins <span className="text-slate-500 font-normal">(Can't Hurt Me)</span>
                    </span>
                  </blockquote>
                </div>

                {onGoToDailyLog && (
                  <button
                    onClick={onGoToDailyLog}
                    className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-pastel-coral hover:bg-pastel-coral/90 shadow-glow-coral transition-all active:scale-95"
                  >
                    <span>+ Iniciar Bloque de Trabajo</span>
                  </button>
                )}
              </div>
            )}

            {/* ALERTA 2: ¡PONTE A ESTUDIAR! */}
            {alertaEstudio && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/90 border-l-4 border-pastel-amber border border-pastel-amber/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg animate-fade-in">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-pastel-amber/20 text-pastel-amber border border-pastel-amber/30">
                      🧠 Alerta de Exigencia Intelectual
                    </span>
                    <span className="text-xs font-mono text-pastel-amber font-bold">
                      {horasHoy > 0 ? `${pctExigenteHoy}% de fricción hoy` : '0h registradas hoy'} (Mínimo: 50%)
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    ¡Ponte a estudiar! Zona de confort detectada: falta de fricción cognitiva
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {horasHoy === 0
                      ? 'No has registrado ningún bloque de estudio ni trabajo hoy. Comienza con una sesión de práctica deliberada.'
                      : `Solo el ${pctExigenteHoy}% de tu tiempo de hoy alcanza nivel de incomodidad Media o Alta. La frontera cognitiva exige resolver problemas densos y estudiar conceptos difíciles.`
                    }
                  </p>

                  {/* Author Quote */}
                  <blockquote className="p-2.5 rounded-xl bg-midnight-900/90 border-l-2 border-pastel-amber border border-white/5 text-xs text-slate-300 space-y-1">
                    <p className="italic font-serif text-[11px] sm:text-xs text-slate-200">
                      &ldquo;¿Cuánto tiempo más vas a esperar antes de exigir lo mejor de ti mismo? El dolor de estudiar y dominar lo difícil pesa onzas; el dolor de la mediocridad pesa toneladas.&rdquo;
                    </p>
                    <span className="block text-[10px] font-mono text-pastel-amber font-semibold">
                      — Epicteto <span className="text-slate-500 font-normal">(Disertaciones)</span>
                    </span>
                  </blockquote>
                </div>

                {onGoToDailyLog && (
                  <button
                    onClick={onGoToDailyLog}
                    className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-pastel-amber hover:bg-pastel-amber/90 shadow-sm transition-all active:scale-95"
                  >
                    <span>+ Registrar Sesión de Estudio</span>
                  </button>
                )}
              </div>
            )}

            {/* ALERTA 3: ¡PONTE A ENTRENAR! */}
            {alertaEntrenamiento && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/90 border-l-4 border-pastel-coral border border-pastel-coral/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg animate-fade-in">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-pastel-coral/20 text-pastel-coral border border-pastel-coral/30">
                      ⚡ Alerta de Condición Física
                    </span>
                    <span className="text-xs font-mono text-pastel-coral font-bold">
                      {ejercicioHoy > 0 ? `${ejercicioHoy.toFixed(1)}h hoy` : '0h entrenadas hoy'} (Faltan {deficitEjercicioHoy.toFixed(1)}h)
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    ¡Ponte a entrenar! El templo físico está siendo descuidado
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    El trabajo intelectual riguroso exige resistencia cardiovascular y oxigenación cerebral. Se requiere un mínimo de <span className="text-pastel-ice font-semibold font-mono">45 minutos (0.75h)</span> de ejercicio físico diario para disipar el estrés y sostener el rendimiento.
                  </p>

                  {/* Author Quote */}
                  <blockquote className="p-2.5 rounded-xl bg-midnight-900/90 border-l-2 border-pastel-coral border border-white/5 text-xs text-slate-300 space-y-1">
                    <p className="italic font-serif text-[11px] sm:text-xs text-slate-200">
                      &ldquo;El cuerpo es el templo que sostiene tu mente. Si no estás dispuesto a sufrir en el asfalto o en las pesas, tu cerebro claudicará ante la primera distracción. Entrena hoy.&rdquo;
                    </p>
                    <span className="block text-[10px] font-mono text-pastel-coral font-semibold">
                      — David Goggins <span className="text-slate-500 font-normal">(Never Finished)</span>
                    </span>
                  </blockquote>
                </div>

                {onGoToDailyLog && (
                  <button
                    onClick={onGoToDailyLog}
                    className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-pastel-coral hover:bg-pastel-coral/90 shadow-glow-coral transition-all active:scale-95"
                  >
                    <span>+ Registrar Entrenamiento</span>
                  </button>
                )}
              </div>
            )}

            {/* ALERTA 4: RITUAL DE CIERRE PENDIENTE */}
            {alertaCierre && (
              <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/90 border-l-4 border-pastel-lavender border border-pastel-lavender/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg animate-fade-in">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/30">
                      🌙 Alerta de Desconexión
                    </span>
                    <span className="text-xs font-mono text-pastel-lavender font-bold">
                      Cierre de hoy pendiente
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Ritual de Cierre Diario Pendiente: Riesgo de bucles cognitivos residuales
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Cal Newport insiste en que el trabajo debe tener un límite estricto al anochecer. Si no realizas el cierre formal antes de las 11:59 PM, las tareas inacabadas continuarán fragmentando tu descanso nocturno.
                  </p>

                  {/* Author Quote */}
                  <blockquote className="p-2.5 rounded-xl bg-midnight-900/90 border-l-2 border-pastel-lavender border border-white/5 text-xs text-slate-300 space-y-1">
                    <p className="italic font-serif text-[11px] sm:text-xs text-slate-200">
                      &ldquo;Al anochecer, confina tus pensamientos y haz las paces con lo inacabado. Quien no descansa con rigor, no trabaja con genialidad.&rdquo;
                    </p>
                    <span className="block text-[10px] font-mono text-pastel-lavender font-semibold">
                      — Marco Aurelio <span className="text-slate-500 font-normal">(Meditaciones, Libro IV)</span>
                    </span>
                  </blockquote>
                </div>

                {onGoToDailyLog && (
                  <button
                    onClick={onGoToDailyLog}
                    className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-pastel-lavender hover:bg-pastel-lavenderDark shadow-glow-lavender transition-all active:scale-95"
                  >
                    <span>Sellar Ritual de Cierre</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Victory Banner: All Minimum Standards Conquered */
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

      {/* SUITE GRÁFICA 2D DE LA JORNADA DE HOY (Intensidad x Incomodidad de Hoy) */}
      <section className="card-midnight rounded-2xl p-5 sm:p-7 shadow-xl border border-white/7 space-y-6">
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

      {/* DRAWER / SECCIÓN HISTÓRICA ACUMULADA (Solo visible al hacer clic en "Ver Histórico") */}
      {mostrarHistorico && (
        <section className="p-6 sm:p-8 rounded-3xl bg-midnight-950 border-2 border-pastel-lavender/40 shadow-2xl space-y-7 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base">🏛️</span>
                <span className="text-xs font-mono uppercase tracking-widest text-pastel-lavender font-semibold">
                  Bóveda Histórica Consolidada
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Auditoría Retrospectiva y Tendencias Pasadas
              </h3>
              <p className="text-xs text-slate-400">
                Consulta de trayectoria acumulada. Recuerda: el pasado no justifica la inercia del día actual.
              </p>
            </div>

            <button
              onClick={() => setMostrarHistorico(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white bg-midnight-900 hover:bg-slate-800 border border-white/10 self-start sm:self-auto transition-all"
            >
              <span>✕ Cerrar Histórico</span>
            </button>
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

          {/* Gráfico de Tendencia Temporal Histórica */}
          <div className="card-midnight rounded-2xl p-5 sm:p-6 shadow-xl border border-white/7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                  <svg className="w-4 h-4 text-pastel-mint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                  Tendencia Temporal Histórica
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
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400">Incomodidad:</span>
                      <span className="text-pastel-coral font-semibold">{hoveredDay.distribucionIncomodidad?.Alta || 0}h A</span>
                      <span className="text-pastel-amber font-semibold">{hoveredDay.distribucionIncomodidad?.Media || 0}h M</span>
                      <span className="text-pastel-ice font-semibold">{hoveredDay.distribucionIncomodidad?.Baja || 0}h B</span>
                    </div>
                  )}
                  {hoveredDay.cierreRealizado ? (
                    <span className="text-pastel-mint text-[11px]">✓ Cierre sellado</span>
                  ) : (
                    <span className="text-slate-500 text-[11px]">Sin cierre</span>
                  )}
                </div>
              ) : (
                <span className="text-slate-500 text-[11px]">Pasa el cursor sobre una barra para inspeccionar el día histórico</span>
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
                    const hasHours = day.horasNetas > 0;

                    return (
                      <div
                        key={day.fecha || idx}
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group relative z-10"
                      >
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                            hasHours
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

                    return (
                      <div key={day.fecha} className="flex-1 text-center truncate">
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

          {/* Matriz 2D Histórica y Tipos de Enfoque */}
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
        </section>
      )}
    </div>
  );
};

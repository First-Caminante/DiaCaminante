import React, { useState, useEffect } from 'react';
import type { EstadisticasResponse, TendenciaDia } from '../types/database';

interface VisualStatsProps {
  onGoToDailyLog?: () => void;
}

export const VisualStats: React.FC<VisualStatsProps> = ({ onGoToDailyLog }) => {
  const [stats, setStats] = useState<EstadisticasResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rangoDias, setRangoDias] = useState<7 | 14 | 30>(14);
  const [hoveredDay, setHoveredDay] = useState<TendenciaDia | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/estadisticas');
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
  }, []);

  if (loading && !stats) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-10 flex flex-col items-center justify-center min-h-[45vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-pastel-lavender/20 border-t-pastel-lavender animate-spin"></div>
        <p className="text-xs font-mono text-slate-400">Calculando métricas y tendencias de Deep Work...</p>
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

  // Filter trend days according to selected range
  const filteredTrend = stats.tendenciaDias.slice(-rangoDias);
  const maxHoursInTrend = Math.max(...filteredTrend.map((d) => d.horasNetas), 4.5);
  const totalHorasEnRango = filteredTrend.reduce((acc, d) => acc + d.horasNetas, 0);

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
      {/* Top Header & Actions */}
      <div className="card-midnight rounded-2xl p-5 sm:p-7 shadow-xl border border-white/7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pastel-mint animate-pulse"></span>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                Dashboard de Alto Rendimiento
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Estadísticas y Proceso Visual
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Evaluación cuantitativa de concentración profunda, consistencia y hábitos psicofísicos
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono bg-midnight-800 hover:bg-midnight-700 text-slate-300 hover:text-white border border-white/5 transition-all"
              title="Recalcular métricas"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>{loading ? 'Sincronizando...' : 'Actualizar'}</span>
            </button>

            {onGoToDailyLog && (
              <button
                onClick={onGoToDailyLog}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-midnight-950 bg-pastel-lavender hover:bg-pastel-lavenderDark shadow-glow-lavender transition-all"
              >
                <span>+ Registrar Bloque</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Horas Totales */}
        <div className="card-midnight rounded-2xl p-4 sm:p-5 border border-white/5 space-y-1">
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
            En {stats.diasActivosCount} {stats.diasActivosCount === 1 ? 'día activo' : 'días activos'}
          </p>
        </div>

        {/* KPI 2: Promedio Diario */}
        <div className="card-midnight rounded-2xl p-4 sm:p-5 border border-white/5 space-y-1">
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
            {stats.totalSesiones} {stats.totalSesiones === 1 ? 'bloque registrado' : 'bloques registrados'}
          </p>
        </div>

        {/* KPI 3: Racha de Foco */}
        <div className="card-midnight rounded-2xl p-4 sm:p-5 border border-white/5 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Racha Actual</span>
            <span className="text-pastel-amber">🔥</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-pastel-amber tabular-nums">
              {stats.rachaActual}
            </span>
            <span className="text-xs font-mono text-pastel-amber/70 font-semibold">días</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Racha máxima: {stats.rachaMaxima} días
          </p>
        </div>

        {/* KPI 4: Ritual de Cierre Completado */}
        <div className="card-midnight rounded-2xl p-4 sm:p-5 border border-white/5 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Ritual de Cierre
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-pastel-lavender tabular-nums">
              {stats.tasaCierre.toFixed(0)}%
            </span>
            <span className="text-xs font-mono text-pastel-lavender/70 font-semibold">tasa</span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Mente liberada al anochecer
          </p>
        </div>
      </div>

      {/* Main Interactive Visual Chart: Daily Trend */}
      <div className="card-midnight rounded-2xl p-5 sm:p-7 shadow-xl border border-white/7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <svg className="w-4 h-4 text-pastel-mint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              Tendencia Temporal de Horas Netas
            </h3>
            <p className="text-xs text-slate-400">
              Total acumulado en el período: <span className="text-pastel-mint font-mono font-semibold">{totalHorasEnRango.toFixed(1)}h</span>
            </p>
          </div>

          {/* Range Pills: 7, 14, 30 days */}
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
        <div className="h-7 flex items-center justify-between text-xs font-mono px-2">
          {hoveredDay ? (
            <div className="flex items-center gap-3 animate-fade-in">
              <span className="text-white font-semibold">📅 {hoveredDay.fecha}</span>
              <span className="text-pastel-mint font-bold">{hoveredDay.horasNetas.toFixed(2)}h netas</span>
              <span className="text-slate-400">({hoveredDay.sesionesCount} bloques)</span>
              {hoveredDay.cierreRealizado ? (
                <span className="text-pastel-mint text-[11px]">✓ Cierre sellado</span>
              ) : (
                <span className="text-slate-500 text-[11px]">Sin cierre</span>
              )}
            </div>
          ) : (
            <span className="text-slate-500 text-[11px]">Pasa el cursor sobre una barra para inspeccionar el día</span>
          )}

          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-pastel-mint"></span>
            <span>Con Cierre</span>
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-pastel-lavender ml-1"></span>
            <span>Sin Cierre</span>
          </div>
        </div>

        {/* SVG Continuous Bar Chart */}
        <div className="relative pt-4 pb-2 overflow-x-auto">
          <div className="min-w-[480px]">
            {/* 4h Deep Work Benchmark Line */}
            <div className="relative h-48 w-full border-b border-white/10 flex items-end justify-between gap-1.5 px-2">
              {/* Benchmark Reference Line (Cal Newport 4h Gold Standard) */}
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
                    {/* The bar */}
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

                    {/* Value on top if active */}
                    {hasHours && (
                      <span className="absolute -top-5 text-[9px] font-mono font-semibold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {day.horasNetas.toFixed(1)}h
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* X Axis Dates */}
            <div className="flex items-center justify-between gap-1.5 px-2 pt-2 text-[10px] font-mono text-slate-500">
              {filteredTrend.map((day, idx) => {
                // Show dates periodically to avoid crowding
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

      {/* Two Columns: Distribution of Focus Types & Cognitive Exigence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left: Focus Types Breakdown */}
        <div className="card-midnight rounded-2xl p-5 sm:p-6 shadow-xl border border-white/7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="p-1 rounded-md bg-pastel-ice/10 text-pastel-ice">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </span>
              Distribución por Tipo de Enfoque
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {stats.distribucionTipos.length} categorías
            </span>
          </div>

          {stats.distribucionTipos.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              Aún no hay bloques categorizados registrados.
            </p>
          ) : (
            <div className="space-y-3.5">
              {stats.distribucionTipos.map((item, idx) => {
                const colors = [
                  'bg-pastel-lavender',
                  'bg-pastel-mint',
                  'bg-pastel-ice',
                  'bg-pastel-amber',
                  'bg-pastel-coral',
                ];
                const barColor = colors[idx % colors.length];

                return (
                  <div key={item.tipo} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{item.tipo}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 text-[11px]">({item.count} sesiones)</span>
                        <span className="font-bold text-white">{item.horas.toFixed(1)}h</span>
                        <span className="text-slate-500 text-[11px] w-9 text-right">{item.porcentaje}%</span>
                      </div>
                    </div>

                    <div className="h-2 w-full rounded-full bg-midnight-950 overflow-hidden border border-white/5">
                      <div
                        style={{ width: `${Math.min(100, item.porcentaje)}%` }}
                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Cognitive Exigence & Intensity Matrix */}
        <div className="card-midnight rounded-2xl p-5 sm:p-6 shadow-xl border border-white/7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="p-1 rounded-md bg-pastel-coral/10 text-pastel-coral">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </span>
              Matriz de Esfuerzo Cognitivo
            </h3>
            <span
              className="text-xs text-slate-500 cursor-help"
              title="Cal Newport: La frontera cognitiva (incomodidad alta) expande las capacidades del cerebro."
            >
              ⓘ Exigencia
            </span>
          </div>

          <div className="space-y-4">
            {/* Incomodidad Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span>Incomodidad (Frontera Cognitiva)</span>
                <span className="text-[11px] text-pastel-coral">
                  Alta: {stats.distribucionIncomodidad.Alta.toFixed(1)}h
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-midnight-950 border border-pastel-coral/30">
                  <span className="text-[10px] font-mono text-pastel-coral uppercase block">Alta</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {stats.distribucionIncomodidad.Alta.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">h netas</span>
                </div>
                <div className="p-2.5 rounded-xl bg-midnight-950 border border-pastel-amber/30">
                  <span className="text-[10px] font-mono text-pastel-amber uppercase block">Media</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {stats.distribucionIncomodidad.Media.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">h netas</span>
                </div>
                <div className="p-2.5 rounded-xl bg-midnight-950 border border-pastel-ice/30">
                  <span className="text-[10px] font-mono text-pastel-ice uppercase block">Baja</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {stats.distribucionIncomodidad.Baja.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">h netas</span>
                </div>
              </div>
            </div>

            {/* Intensidad Breakdown */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span>Intensidad de Foco</span>
                <span className="text-[11px] text-pastel-mint">
                  Alta: {stats.distribucionIntensidad.Alta.toFixed(1)}h
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-midnight-950 border border-white/5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Alta</span>
                  <span className="text-base font-bold font-mono text-pastel-mint">
                    {stats.distribucionIntensidad.Alta.toFixed(1)}h
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-midnight-950 border border-white/5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Media</span>
                  <span className="text-base font-bold font-mono text-pastel-amber">
                    {stats.distribucionIntensidad.Media.toFixed(1)}h
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-midnight-950 border border-white/5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Baja</span>
                  <span className="text-base font-bold font-mono text-slate-300">
                    {stats.distribucionIntensidad.Baja.toFixed(1)}h
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Habits & Health Correlation Card */}
      <div className="card-midnight rounded-2xl p-5 sm:p-6 shadow-xl border border-white/7 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span className="p-1 rounded-md bg-pastel-mint/10 text-pastel-mint">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            Indicadores Psicofísicos y Hábitos
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Soporte de energía para el Deep Work
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Calidad de Alimentación */}
          <div className="p-4 rounded-xl bg-midnight-950/70 border border-white/5 space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
              Alimentación Promedio
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-pastel-mint">
                {stats.salud.promedioAlimento.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400">/ 5.0</span>
            </div>
            <div className="flex gap-1 pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-sm ${
                    star <= Math.round(stats.salud.promedioAlimento)
                      ? 'text-pastel-mint'
                      : 'text-slate-700'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          {/* Ejercicio Físico */}
          <div className="p-4 rounded-xl bg-midnight-950/70 border border-white/5 space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
              Entrenamiento Acumulado
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-pastel-ice">
                {stats.salud.totalEjercicioHoras.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400">horas</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {stats.salud.diasConEjercicio} días con sesión física
            </p>
          </div>

          {/* Estado de Frío Mental */}
          <div className="p-4 rounded-xl bg-midnight-950/70 border border-white/5 space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
              Estados Mentales Registrados
            </span>
            <div className="space-y-1 text-xs font-mono pt-1">
              <div className="flex justify-between text-slate-300">
                <span>Inspirado:</span>
                <span className="text-pastel-lavender font-bold">
                  {stats.salud.distribucionFrioMental['Inspirado'] || 0}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Frío total:</span>
                <span className="text-pastel-ice font-bold">
                  {stats.salud.distribucionFrioMental['Frio total'] || 0}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Ávido:</span>
                <span className="text-pastel-amber font-bold">
                  {stats.salud.distribucionFrioMental['Avido'] || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

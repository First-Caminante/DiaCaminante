import React, { useState } from 'react';
import type { TareaPlanificada } from '../types/database';

interface ScoreboardProps {
  fecha: string;
  totalHorasNetas: number;
  cierreRealizado: boolean;
  onOpenShutdown: () => void;
  onRefresh?: () => void;
  tareas?: TareaPlanificada[];
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  fecha,
  totalHorasNetas,
  cierreRealizado,
  onOpenShutdown,
  onRefresh,
  tareas = [],
}) => {
  const [exporting, setExporting] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const totalTareas = tareas.length;
  const tareasCumplidas = tareas.filter((t) => t.estado === 'hecho').length;
  const tareasPendientes = tareas.filter((t) => t.estado === 'pendiente' || t.estado === 'incompleto').length;
  const pctTareasCumplidas = totalTareas > 0 ? Math.round((tareasCumplidas / totalTareas) * 100) : 0;

  const formattedDate = (() => {
    try {
      if (!fecha) return 'Hoy';
      const [y, m, d] = fecha.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const formatted = new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(date);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return fecha;
    }
  })();

  const handleExportJson = async () => {
    try {
      setExporting(true);
      const res = await fetch('/api/exportar');
      if (!res.ok) throw new Error('Error al exportar');
      const data = await res.json();
      const jsonString = JSON.stringify(data, null, 2);

      await navigator.clipboard.writeText(jsonString);
      setCopiedToast(true);

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diacaminante-registro-${fecha || 'export'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => setCopiedToast(false), 3500);
    } catch (err) {
      console.error('Error al exportar:', err);
      alert('Hubo un error al exportar los datos. Revisa la consola.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="w-full min-w-0">
      <div className="card-midnight p-5 sm:p-7 border border-white/10 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 min-w-0">
          
          {/* Left: Date & Title */}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag-formal px-3 py-0.5 rounded-full text-[10px] bg-[#141414] text-[#eed59b] border border-[#eed59b]/30 font-medium">
                Jornada Activa
              </span>
              <span className="text-xs text-[#eed59b] font-medium tracking-wide uppercase">
                Control de Sesiones Diarias
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-wide text-white truncate">
              {formattedDate}
            </h2>
            <p className="text-xs sm:text-sm text-[#94a3b8]">
              Registro riguroso de bloques de foco, intensidad y protocolo de cierre diario.
            </p>
          </div>

          {/* Center / Stat: Total Net Hours */}
          <div className="flex items-center gap-4 sm:gap-6 bg-[#080808] rounded-2xl px-4 sm:px-5 py-3.5 border border-white/10 shadow-inner flex-wrap sm:flex-nowrap min-w-0">
            <div>
              <div className="text-[11px] font-sans font-medium text-[#94a3b8] uppercase tracking-wider">
                Horas Netas de Hoy
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl sm:text-4xl font-serif font-bold text-[#eed59b] tabular-nums">
                  {totalHorasNetas.toFixed(2)}
                </span>
                <span className="text-xs text-[#eed59b] font-medium">
                  horas
                </span>
              </div>
            </div>

            <div className="h-10 w-px bg-white/10 hidden sm:block"></div>

            {/* Status indicator: Shutdown Ritual */}
            <div>
              <div className="text-[11px] font-sans font-medium text-[#94a3b8] uppercase tracking-wider mb-1">
                Estado de Cierre
              </div>
              {cierreRealizado ? (
                <div className="tag-formal inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium">
                  <span>✓</span>
                  <span>Jornada Concluida</span>
                </div>
              ) : (
                <div className="tag-formal inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>En Curso</span>
                </div>
              )}
            </div>

            {/* Task summary indicator */}
            {totalTareas > 0 && (
              <>
                <div className="h-10 w-px bg-white/10 hidden sm:block"></div>
                <div className="hidden sm:block">
                  <div className="text-[11px] font-sans font-medium text-[#94a3b8] uppercase tracking-wider mb-1">
                    Plan de Tareas
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-serif font-bold text-white tabular-nums">
                      {tareasCumplidas}/{totalTareas}
                    </span>
                    <span className={`tag-formal text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                      pctTareasCumplidas === 100
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-[#141414] text-[#eed59b] border border-[#eed59b]/30'
                    }`}>
                      {pctTareasCumplidas}% hecho
                    </span>
                  </div>
                  <span className="text-[10px] text-[#94a3b8]">
                    {tareasPendientes > 0 ? `${tareasPendientes} por cumplir` : '✓ Todas cumplidas'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
            {/* Refresh Button */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="btn-formal-outline p-2.5 rounded-full text-[#94a3b8] hover:text-white"
                title="Actualizar datos"
                aria-label="Actualizar datos"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {/* Export JSON Button */}
            <button
              onClick={handleExportJson}
              disabled={exporting}
              className="btn-formal-outline relative inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium"
              title="Descargar copia de seguridad en formato JSON"
            >
              <svg className="w-4 h-4 text-[#eed59b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{exporting ? 'Exportando...' : 'Exportar Datos'}</span>
              
              {copiedToast && (
                <span className="tag-formal absolute -bottom-9 right-0 bg-[#eed59b] text-[#070e1e] text-[10px] py-1 px-3 rounded-full whitespace-nowrap animate-bounce font-bold shadow-md">
                  ¡Copia descargada!
                </span>
              )}
            </button>

            {/* Shutdown Ritual Modal trigger button */}
            <button
              onClick={onOpenShutdown}
              className="btn-formal inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>{cierreRealizado ? 'Revisar Cierre' : 'Cierre de Jornada'}</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

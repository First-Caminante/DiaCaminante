import React, { useState } from 'react';

interface ScoreboardProps {
  fecha: string;
  totalHorasNetas: number;
  cierreRealizado: boolean;
  onOpenShutdown: () => void;
  onRefresh?: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  fecha,
  totalHorasNetas,
  cierreRealizado,
  onOpenShutdown,
  onRefresh,
}) => {
  const [exporting, setExporting] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // Format date in Spanish: "Jueves, 22 de Octubre"
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

      // Copy to clipboard
      await navigator.clipboard.writeText(jsonString);
      setCopiedToast(true);

      // Also trigger file download for convenience
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deep-work-resumen-${fecha || 'export'}.json`;
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
    <header className="w-full max-w-5xl mx-auto pt-6 pb-4 px-3 sm:px-6">
      <div className="card-acrylic p-5 sm:p-7 border-2 border-white/20 shadow-brutal space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          
          {/* Left: Date & Subtitle */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="tag-retro px-2 py-0.5 rounded text-[10px] bg-retro-peach text-midnight-950">
                ■ PROTOCOLO ACTIVO
              </span>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
                DEEP WORK &amp; RIGOR
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-white uppercase">
              {formattedDate}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              Auditoría de concentración profunda y ritual de cierre diario
            </p>
          </div>

          {/* Center / Stat: Total Net Hours */}
          <div className="flex items-center gap-6 sm:gap-8 bg-midnight-950/90 rounded-2xl px-5 py-3 border-2 border-white/10 shadow-brutal-sm">
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Horas Netas Hoy
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl sm:text-4xl font-display font-extrabold text-retro-mint tabular-nums">
                  {totalHorasNetas.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-retro-mint font-bold uppercase">
                  h
                </span>
              </div>
            </div>

            <div className="h-10 w-0.5 bg-white/10"></div>

            {/* Status indicator: Shutdown Ritual */}
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                Ritual de Cierre
              </div>
              {cierreRealizado ? (
                <div className="tag-retro inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-retro-mint text-midnight-950 shadow-brutal-mint">
                  <span>✓</span>
                  <span>Mente Liberada</span>
                </div>
              ) : (
                <div className="tag-retro inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-midnight-900 text-retro-amber border-retro-amber/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-retro-amber animate-pulse"></span>
                  <span>Pendiente</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Refresh Button */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="btn-neo p-2.5 rounded-xl text-slate-200 bg-midnight-950 border-white/20 hover:text-white"
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
              className="btn-neo relative inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-200 bg-midnight-950 border-white/20 uppercase"
              title="Exportar dataset completo en JSON"
            >
              <svg className="w-4 h-4 text-retro-ice" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{exporting ? 'Exportando...' : 'Exportar JSON'}</span>
              
              {copiedToast && (
                <span className="tag-retro absolute -bottom-9 right-0 bg-retro-mint text-midnight-950 text-[10px] py-1 px-2.5 rounded-md whitespace-nowrap animate-bounce shadow-brutal-sm">
                  ¡Copiado &amp; Descargado!
                </span>
              )}
            </button>

            {/* Shutdown Ritual Modal trigger button */}
            <button
              onClick={onOpenShutdown}
              className="btn-neo inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-midnight-950 bg-retro-lavender uppercase"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>{cierreRealizado ? 'Ver Ritual Cierre' : 'Ritual Cierre'}</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

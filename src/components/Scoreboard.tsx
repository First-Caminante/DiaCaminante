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
      // Capitalize first letter
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
    <header className="w-full max-w-5xl mx-auto pt-6 pb-4 px-4 sm:px-6">
      <div className="card-midnight rounded-2xl p-5 sm:p-7 relative overflow-hidden transition-all duration-300 hover:border-white/10 shadow-xl">
        {/* Subtle decorative glow top-right */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-pastel-lavender/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          
          {/* Left: Date & Subtitle */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-block w-2 h-2 rounded-full bg-pastel-lavender animate-pulse"></span>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                Deep Work Protocol
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              {formattedDate}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-normal">
              Auditoría de concentración profunda y ritual de cierre diario
            </p>
          </div>

          {/* Center / Stat: Total Net Hours */}
          <div className="flex items-center gap-6 sm:gap-8 bg-midnight-950/60 rounded-xl px-5 py-3 border border-white/5">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Horas Netas Hoy
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl sm:text-4xl font-bold font-mono text-pastel-mint tabular-nums tracking-tight">
                  {totalHorasNetas.toFixed(2)}
                </span>
                <span className="text-sm font-mono text-pastel-mint/70 font-semibold">
                  h
                </span>
              </div>
            </div>

            <div className="h-10 w-px bg-white/10"></div>

            {/* Status indicator: Shutdown Ritual */}
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Ritual de Cierre
              </div>
              {cierreRealizado ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-mint/15 text-pastel-mint border border-pastel-mint/30 shadow-glow-mint">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Mente Liberada</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-pastel-amber/90 border border-pastel-amber/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-pastel-amber animate-pulse"></span>
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
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-midnight-800 hover:bg-midnight-700 border border-white/5 transition-colors active:scale-95"
                title="Actualizar datos"
                aria-label="Actualizar datos"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {/* Export JSON Button */}
            <button
              onClick={handleExportJson}
              disabled={exporting}
              className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-midnight-800 hover:bg-midnight-700 border border-white/5 hover:border-white/10 transition-all duration-200 active:scale-95 focus:outline-none"
              title="Exportar dataset completo en JSON"
            >
              <svg className="w-3.5 h-3.5 text-pastel-ice" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{exporting ? 'Exportando...' : 'Exportar JSON'}</span>
              
              {copiedToast && (
                <span className="absolute -bottom-8 right-0 bg-pastel-mint text-midnight-950 font-bold text-[10px] py-1 px-2.5 rounded-md shadow-lg whitespace-nowrap animate-bounce">
                  ¡Copiado & Descargado!
                </span>
              )}
            </button>

            {/* Shutdown Ritual Modal trigger button */}
            <button
              onClick={onOpenShutdown}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-midnight-950 bg-pastel-lavender hover:bg-pastel-lavenderDark transition-all duration-200 active:scale-95 shadow-glow-lavender"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>{cierreRealizado ? 'Ver Ritual Cierre' : 'Ritual de Cierre'}</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

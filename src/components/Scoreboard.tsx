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
    <header className="w-full">
      <div className="card-tactical p-5 sm:p-7 border-2 border-[#74a47b]/40 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          
          {/* Left: Date & Subtitle */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                ▲ PROTOCOLO ACTIVO
              </span>
              <span className="text-xs font-mono uppercase tracking-widest text-[#92aa95] font-bold">
                DEEP WORK &amp; RIGOR
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-[#f8fafc] uppercase">
              {formattedDate}
            </h1>
            <p className="text-xs sm:text-sm text-[#92aa95] font-mono">
              Auditoría de concentración profunda y ritual de cierre diario
            </p>
          </div>

          {/* Center / Stat: Total Net Hours */}
          <div className="flex items-center gap-6 sm:gap-8 bg-[#000000] rounded-2xl px-5 py-3 border-2 border-[#74a47b]/30 shadow-inner">
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#92aa95]">
                Horas Netas Hoy
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl sm:text-4xl font-display font-extrabold text-[#d9f2c4] tabular-nums">
                  {totalHorasNetas.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-[#d9f2c4] font-bold uppercase">
                  h
                </span>
              </div>
            </div>

            <div className="h-10 w-0.5 bg-[#74a47b]/20"></div>

            {/* Status indicator: Shutdown Ritual */}
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#92aa95] mb-1">
                Ritual de Cierre
              </div>
              {cierreRealizado ? (
                <div className="tag-tactical inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
                  <span>✓</span>
                  <span>Mente Liberada</span>
                </div>
              ) : (
                <div className="tag-tactical inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-[#121c13] text-[#fde68a] border-[#fde68a]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#fde68a] animate-pulse"></span>
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
                className="btn-tactical-ghost p-2.5 rounded-xl text-[#f8fafc] hover:text-[#d9f2c4]"
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
              className="btn-tactical-ghost relative inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase"
              title="Exportar dataset completo en JSON"
            >
              <svg className="w-4 h-4 text-[#74a47b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{exporting ? 'Exportando...' : 'Exportar JSON'}</span>
              
              {copiedToast && (
                <span className="tag-tactical absolute -bottom-9 right-0 bg-[#d9f2c4] text-[#000000] text-[10px] py-1 px-2.5 rounded-md whitespace-nowrap animate-bounce border-[#74a47b]">
                  ¡Copiado &amp; Descargado!
                </span>
              )}
            </button>

            {/* Shutdown Ritual Modal trigger button */}
            <button
              onClick={onOpenShutdown}
              className="btn-tactical inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase"
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

import React, { useEffect } from 'react';
import type { ReflexionDiaria } from '../data/reflections';

interface DailyReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  reflection: ReflexionDiaria;
  onMarkAsReadForToday: () => void;
}

export const DailyReflectionModal: React.FC<DailyReflectionModalProps> = ({
  isOpen,
  onClose,
  reflection,
  onMarkAsReadForToday,
}) => {
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onMarkAsReadForToday();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onMarkAsReadForToday]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    onMarkAsReadForToday();
    onClose();
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Estoicismo':
        return 'text-pastel-lavender bg-pastel-lavender/10 border-pastel-lavender/30';
      case 'Dureza Mental':
        return 'text-pastel-coral bg-pastel-coral/10 border-pastel-coral/30';
      case 'Sabiduría Espiritual':
        return 'text-pastel-mint bg-pastel-mint/10 border-pastel-mint/30';
      case 'Riqueza y Estrategia':
        return 'text-pastel-amber bg-pastel-amber/10 border-pastel-amber/30';
      default:
        return 'text-pastel-ice bg-pastel-ice/10 border-pastel-ice/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-midnight-950/85 backdrop-blur-md animate-fade-in">
      <div
        className="card-midnight-solid w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto border border-white/10 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-reflection-title"
      >
        {/* Subtle decorative glow in corner */}
        <div className="absolute -top-20 -right-20 w-52 h-52 bg-pastel-lavender/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 transition-colors"
          aria-label="Cerrar modal"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="space-y-6 relative z-10">
          {/* Header pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest bg-midnight-800 text-slate-300 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-pastel-mint animate-pulse"></span>
              Reflexión del Día • Día {reflection.dia} de 365
            </span>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${getCategoryColor(reflection.categoria)}`}>
              {reflection.categoria}
            </span>
          </div>

          {/* Theme & Quote */}
          <div className="space-y-3">
            <h2 id="daily-reflection-title" className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {reflection.tema}
            </h2>

            <blockquote className="p-4 sm:p-5 rounded-2xl bg-midnight-950/80 border-l-4 border-pastel-lavender border border-white/5 space-y-2">
              <p className="text-base sm:text-lg font-serif italic text-slate-100 leading-relaxed">
                &ldquo;{reflection.frase}&rdquo;
              </p>
              <footer className="text-xs font-mono text-pastel-lavender flex items-center gap-2">
                <span className="font-semibold">— {reflection.autor}</span>
                <span className="text-slate-500">•</span>
                <cite className="not-italic text-slate-400">{reflection.origen}</cite>
              </footer>
            </blockquote>
          </div>

          {/* Practical Deep Work Reflection */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-pastel-mint font-semibold">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 14 14" />
              </svg>
              <span>Aplicación Práctica para Hoy</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              {reflection.reflexion}
            </p>
          </div>

          {/* Action button to dismiss and start focusing */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-slate-500">
              Presiona <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/5">Esc</kbd> o el botón para entrar en la arena
            </span>

            <button
              onClick={handleDismiss}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-midnight-950 bg-pastel-lavender hover:bg-pastel-lavenderDark shadow-glow-lavender transition-all duration-200 active:scale-95"
            >
              <span>Comenzar Jornada con Foco</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

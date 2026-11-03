import React, { useState, useEffect } from 'react';
import { type ReflexionDiaria, getReflexionAleatoria } from '../data/reflections';

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
  const [currentReflection, setCurrentReflection] = useState<ReflexionDiaria>(reflection);

  // Sync with prop when opened or changed
  useEffect(() => {
    setCurrentReflection(reflection);
  }, [reflection, isOpen]);

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

  const handleRandomize = () => {
    setCurrentReflection(getReflexionAleatoria());
  };

  const getCategoryTagClass = (cat: string) => {
    switch (cat) {
      case 'Estoicismo':
        return 'bg-retro-lavender text-midnight-950';
      case 'Dureza Mental':
        return 'bg-retro-coral text-midnight-950';
      case 'Sabiduría Espiritual':
        return 'bg-retro-mint text-midnight-950';
      case 'Riqueza y Estrategia':
        return 'bg-retro-amber text-midnight-950';
      default:
        return 'bg-retro-ice text-midnight-950';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-midnight-950/90 backdrop-blur-md animate-fade-in">
      <div
        className="card-acrylic w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-brutal relative my-auto border-2 border-retro-lavender overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-reflection-title"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="btn-neo absolute top-5 right-5 p-2 rounded-xl text-midnight-950 bg-retro-coral hover:brightness-110 uppercase font-mono text-xs font-bold"
          aria-label="Cerrar modal"
        >
          ✕
        </button>

        <div className="space-y-6 relative z-10">
          {/* Header pill & Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap pr-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag-retro inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-midnight-950 text-slate-200 border-white/20">
                <span className="w-2 h-2 rounded-full bg-retro-mint animate-pulse"></span>
                <span>DÍA {currentReflection.dia} / 365</span>
              </span>
              <span className={`tag-retro text-[10px] px-2.5 py-1 rounded-lg ${getCategoryTagClass(currentReflection.categoria)}`}>
                {currentReflection.categoria}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRandomize}
              className="btn-neo inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-midnight-950 bg-retro-ice uppercase"
              title="Cargar otra reflexión aleatoria"
            >
              <span>🎲</span>
              <span>Cambiar Frase</span>
            </button>
          </div>

          {/* Theme & Quote */}
          <div className="space-y-3">
            <h2 id="daily-reflection-title" className="text-xl sm:text-2xl font-display font-extrabold tracking-tight text-white uppercase">
              {currentReflection.tema}
            </h2>

            <blockquote className="p-4 sm:p-6 rounded-2xl bg-midnight-950 border-l-4 border-retro-lavender border-2 border-white/10 shadow-brutal-sm space-y-2">
              <p className="text-base sm:text-lg font-serif italic text-slate-100 leading-relaxed">
                &ldquo;{currentReflection.frase}&rdquo;
              </p>
              <footer className="text-xs font-mono text-retro-lavender flex items-center gap-2 font-bold uppercase">
                <span>— {currentReflection.autor}</span>
                <span className="text-slate-500">•</span>
                <cite className="not-italic text-slate-400 font-normal">{currentReflection.origen}</cite>
              </footer>
            </blockquote>
          </div>

          {/* Practical Deep Work Reflection */}
          <div className="p-4.5 rounded-2xl bg-midnight-900 border-2 border-white/10 shadow-brutal-sm space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-retro-mint font-bold">
              <span>⚡</span>
              <span>Aplicación Práctica para Hoy</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-mono font-normal">
              {currentReflection.reflexion}
            </p>
          </div>

          {/* Action button to dismiss and start focusing */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              Presiona <kbd className="tag-retro px-1.5 py-0.5 rounded bg-midnight-950 text-slate-200 text-[10px]">Esc</kbd> para entrar a la arena
            </span>

            <button
              onClick={handleDismiss}
              className="btn-neo w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-mono font-bold text-midnight-950 bg-retro-lavender uppercase"
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

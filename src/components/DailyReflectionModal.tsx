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
        return 'bg-[#1a281b] text-[#d9f2c4] border border-[#74a47b]/40';
      case 'Dureza Mental':
        return 'bg-[#215e28] text-[#f8fafc] border border-[#74a47b]/60';
      case 'Sabiduría Espiritual':
        return 'bg-[#121c13] text-[#d9f2c4] border border-[#74a47b]/40';
      case 'Riqueza y Estrategia':
        return 'bg-[#1a281b] text-[#92aa95] border border-[#74a47b]/30';
      default:
        return 'bg-[#121c13] text-[#f8fafc] border border-[#74a47b]/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="card-tactical w-full max-w-2xl rounded-2xl p-6 sm:p-8 relative my-auto border-2 border-[#74a47b]/40 shadow-tactical-glow bg-[#121c13] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-reflection-title"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d9f2c4] to-transparent opacity-80" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="btn-tactical-ghost absolute top-5 right-5 p-2 rounded-lg text-[#92aa95] hover:text-[#d9f2c4] uppercase font-mono text-xs font-bold border border-[#74a47b]/20 hover:border-[#74a47b]/60"
          aria-label="Cerrar modal"
        >
          ✕
        </button>

        <div className="space-y-6 relative z-10">
          {/* Header pill & Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap pr-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag-tactical inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-[#000000] text-[#f8fafc] border border-[#74a47b]/40 font-mono font-bold tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[#d9f2c4] animate-pulse"></span>
                <span>DÍA {currentReflection.dia} / 365</span>
              </span>
              <span className={`tag-tactical text-[10px] px-2.5 py-1 rounded-lg font-mono font-bold uppercase tracking-wider ${getCategoryTagClass(currentReflection.categoria)}`}>
                {currentReflection.categoria}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRandomize}
              className="btn-tactical-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-[#d9f2c4] bg-[#1a281b] border border-[#74a47b]/40 hover:border-[#74a47b] uppercase"
              title="Cargar otra reflexión aleatoria"
            >
              <span>🎲</span>
              <span>Cambiar Frase</span>
            </button>
          </div>

          {/* Theme & Quote */}
          <div className="space-y-3">
            <h2 id="daily-reflection-title" className="text-xl sm:text-2xl font-mono font-black tracking-wider text-[#f8fafc] uppercase">
              {currentReflection.tema}
            </h2>

            <blockquote className="p-4 sm:p-6 rounded-xl bg-[#000000] border-l-4 border-[#d9f2c4] border border-[#74a47b]/30 shadow-tactical space-y-3">
              <p className="text-base sm:text-lg font-serif italic text-[#f8fafc] leading-relaxed">
                &ldquo;{currentReflection.frase}&rdquo;
              </p>
              <footer className="text-xs font-mono text-[#d9f2c4] flex items-center gap-2 font-bold uppercase tracking-wider">
                <span>— {currentReflection.autor}</span>
                <span className="text-[#74a47b]/60">•</span>
                <cite className="not-italic text-[#92aa95] font-normal">{currentReflection.origen}</cite>
              </footer>
            </blockquote>
          </div>

          {/* Practical Deep Work Reflection */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#1a281b] border border-[#74a47b]/30 shadow-tactical space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#d9f2c4] font-bold">
              <span>⚡</span>
              <span>Aplicación Práctica para Hoy</span>
            </div>
            <p className="text-xs sm:text-sm text-[#f8fafc] leading-relaxed font-mono">
              {currentReflection.reflexion}
            </p>
          </div>

          {/* Action button to dismiss and start focusing */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#74a47b]/20">
            <span className="text-[11px] font-mono text-[#92aa95]">
              Presiona <kbd className="tag-tactical px-1.5 py-0.5 rounded bg-[#000000] text-[#d9f2c4] border border-[#74a47b]/40 text-[10px]">Esc</kbd> para entrar a la arena
            </span>

            <button
              onClick={handleDismiss}
              className="btn-tactical w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-mono font-bold text-[#d9f2c4] bg-[#215e28] border border-[#74a47b]/60 hover:bg-[#286f31] uppercase tracking-wider shadow-tactical"
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

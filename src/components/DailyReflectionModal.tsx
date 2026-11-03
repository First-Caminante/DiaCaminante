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
        return 'bg-[#1e3a8a]/40 text-[#93c5fd] border-[#60a5fa]/30';
      case 'Dureza Mental':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Sabiduría Espiritual':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'Riqueza y Estrategia':
        return 'bg-[#eed59b]/20 text-[#eed59b] border-[#eed59b]/40';
      default:
        return 'bg-[#0d1733] text-[#94a3b8] border-[#5b9bd5]/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="card-midnight w-full max-w-2xl rounded-3xl p-6 sm:p-8 relative my-auto border border-[#5b9bd5]/30 shadow-2xl bg-[#081229] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-reflection-title"
      >
        {/* Ambient Top Glow Dorado */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#eed59b] to-transparent opacity-80" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="btn-formal-outline absolute top-5 right-5 p-2 rounded-full text-[#94a3b8] hover:text-white"
          aria-label="Cerrar modal"
        >
          ✕
        </button>

        <div className="space-y-6 relative z-10">
          {/* Header pill & Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap pr-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="tag-formal inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-[#0d1733] text-white border border-[#5b9bd5]/25">
                <span className="w-2 h-2 rounded-full bg-[#eed59b] animate-pulse"></span>
                <span>Día {currentReflection.dia} de 365</span>
              </span>
              <span className={`tag-formal text-[10px] px-3 py-1 rounded-full border ${getCategoryTagClass(currentReflection.categoria)}`}>
                {currentReflection.categoria}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRandomize}
              className="btn-formal-outline inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs"
              title="Cargar otra reflexión aleatoria"
            >
              <span>🎲</span>
              <span>Cambiar Frase</span>
            </button>
          </div>

          {/* Theme & Quote */}
          <div className="space-y-3">
            <h2 id="daily-reflection-title" className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide">
              {currentReflection.tema}
            </h2>

            <blockquote className="p-5 sm:p-7 rounded-2xl bg-[#070e1e]/90 border-l-4 border-[#eed59b] border border-[#5b9bd5]/20 shadow-inner space-y-3">
              <p className="text-base sm:text-lg font-serif italic text-white leading-relaxed">
                &ldquo;{currentReflection.frase}&rdquo;
              </p>
              <footer className="text-xs font-sans text-[#eed59b] flex items-center gap-2 font-medium">
                <span>— {currentReflection.autor}</span>
                <span className="text-[#5b9bd5]/40">•</span>
                <cite className="not-italic text-[#94a3b8] font-normal">{currentReflection.origen}</cite>
              </footer>
            </blockquote>
          </div>

          {/* Practical Reflection */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#0d1733]/80 border border-[#5b9bd5]/20 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-[#60a5fa] font-semibold">
              <span>✦</span>
              <span>Aplicación Práctica para la Jornada</span>
            </div>
            <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed font-sans">
              {currentReflection.reflexion}
            </p>
          </div>

          {/* Action button to dismiss and start focusing */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#5b9bd5]/15">
            <span className="text-xs text-[#94a3b8]">
              Presiona <kbd className="px-2 py-0.5 rounded bg-[#0d1733] text-white border border-[#5b9bd5]/30 text-[10px]">Esc</kbd> para ingresar al panel
            </span>

            <button
              onClick={handleDismiss}
              className="btn-formal w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold shadow-midnight"
            >
              <span>Comenzar Jornada</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import type { TareaPlanificada, Intensidad, FrioMental } from '../types/database';

interface ShutdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  fecha: string;
  tareasHoy: TareaPlanificada[];
  onTaskUpdated: (tarea: TareaPlanificada) => void;
  onCierreCompletado: (data: any) => void;
}

const DEFAULT_MARKDOWN = `- [ ] [09:00 - 11:00] [PROFUNDO] Tarea clave de la mañana (2h netas)
- [ ] [11:15 - 12:45] [PROFUNDO] Segunda sesión profunda (1.5h netas)
- [ ] [15:00 - 15:30] [SUPERFICIAL] Organización y respuestas`;

export const ShutdownModal: React.FC<ShutdownModalProps> = ({
  isOpen,
  onClose,
  fecha,
  tareasHoy,
  onTaskUpdated,
  onCierreCompletado,
}) => {
  // Step states
  const [alimento, setAlimento] = useState<number>(4);
  const [ejercicioHoras, setEjercicioHoras] = useState<number>(0.75);
  const [ejercicioIntensidad, setEjercicioIntensidad] = useState<Intensidad>('Media');
  const [frioMental, setFrioMental] = useState<FrioMental>('Inspirado');
  const [markdownPlan, setMarkdownPlan] = useState<string>(DEFAULT_MARKDOWN);

  // Per-task deviation reasons local tracking
  const [desviosMap, setDesviosMap] = useState<Record<string, string>>({});
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  // Ritual submit state
  const [submittingCierre, setSubmittingCierre] = useState<boolean>(false);
  const [cierreExitoso, setCierreExitoso] = useState<boolean>(false);

  // Initialize desviosMap from props
  useEffect(() => {
    const initialDesvios: Record<string, string> = {};
    tareasHoy.forEach((t) => {
      if (t.motivo_desvio) initialDesvios[t.id] = t.motivo_desvio;
    });
    setDesviosMap(initialDesvios);
  }, [tareasHoy]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Task audit button click
  const handleSetTaskStatus = async (
    tarea: TareaPlanificada,
    nuevoEstado: 'hecho' | 'incompleto' | 'no_hecho'
  ) => {
    try {
      setSavingTaskId(tarea.id);
      const motivo = desviosMap[tarea.id] || tarea.motivo_desvio || '';
      const res = await fetch(`/api/tareas/${tarea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: nuevoEstado,
          motivo_desvio: nuevoEstado === 'hecho' ? null : motivo,
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar tarea');
      const data = await res.json();
      onTaskUpdated(data.tarea);
    } catch (err) {
      console.error(err);
      alert('No se pudo actualizar el estado de la tarea');
    } finally {
      setSavingTaskId(null);
    }
  };

  // Save deviation explanation on blur or submit
  const handleSaveDesvio = async (tareaId: string, currentEstado: string) => {
    try {
      setSavingTaskId(tareaId);
      const motivo = desviosMap[tareaId] || '';
      const res = await fetch(`/api/tareas/${tareaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: currentEstado,
          motivo_desvio: motivo.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar desvío');
      const data = await res.json();
      onTaskUpdated(data.tarea);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTaskId(null);
    }
  };

  // Real-time live count of parsed lines in Markdown
  const parsedTasksCount = (() => {
    const regex = /^\s*-\s*\[\s*\]\s*\[(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\]\s*\[(PROFUNDO|SUPERFICIAL)\]\s*(.+?)(?:\s*\((\d+(?:\.\d+)?)\s*h\s*netas\))?\s*$/i;
    const lines = markdownPlan.split('\n');
    return lines.filter((l) => regex.test(l.trim())).length;
  })();

  // Complete Shutdown Ritual
  const handleCompletarRitual = async () => {
    try {
      setSubmittingCierre(true);
      const res = await fetch('/api/cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          alimento,
          ejercicio_horas: ejercicioHoras,
          ejercicio_intensidad: ejercicioIntensidad,
          frio_mental: frioMental,
          planificacion_markdown: markdownPlan,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al completar ritual');
      }

      const data = await res.json();
      setCierreExitoso(true);
      onCierreCompletado(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al procesar el ritual de cierre');
    } finally {
      setSubmittingCierre(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-midnight-950/85 backdrop-blur-md animate-fade-in">
      <div
        className="card-midnight-solid w-full max-w-3xl rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto border border-white/10 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shutdown-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 transition-colors"
          aria-label="Cerrar modal"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {cierreExitoso ? (
          /* Celebratory Finished State */
          <div className="text-center py-10 px-4 space-y-6 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-full bg-pastel-mint/15 border border-pastel-mint/30 flex items-center justify-center text-pastel-mint shadow-glow-mint">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-pastel-mint">
                Shutdown Complete
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Ritual de cierre completado. Mente liberada hasta mañana.
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto italic font-serif">
                &ldquo;El ritual de cierre le asegura al cerebro que ningún hilo quedó suelto, permitiendo una desconexión total para regenerar la energía cognitiva.&rdquo;
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={() => {
                  setCierreExitoso(false);
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-midnight-950 bg-pastel-mint hover:bg-pastel-mint/90 shadow-glow-mint transition-all"
              >
                Volver al Tablero
              </button>
            </div>
          </div>
        ) : (
          /* Normal Multi-Step Shutdown Form */
          <div className="space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-pastel-lavender"></span>
                <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                  Cal Newport Daily Protocol
                </span>
              </div>
              <h2 id="shutdown-title" className="text-2xl font-bold text-white tracking-tight">
                Ritual de Cierre Diario (Shutdown Ritual)
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Audita las tareas de hoy, registra tu estado psicofísico y programa el bloque de mañana para desconectar tu mente en paz.
              </p>
            </div>

            {/* SECCIÓN 1: Auditoría de Tareas de Hoy */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2 font-mono">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-pastel-lavender text-xs">
                    1
                  </span>
                  Auditoría de Tareas de Hoy
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {tareasHoy.length} {tareasHoy.length === 1 ? 'tarea programada' : 'tareas programadas'}
                </span>
              </div>

              {tareasHoy.length === 0 ? (
                <div className="p-4 rounded-xl bg-midnight-950/60 border border-white/5 text-center text-xs text-slate-400">
                  No había tareas planificadas para hoy. Puedes planificar las de mañana en la sección 3.
                </div>
              ) : (
                <div className="space-y-3">
                  {tareasHoy.map((tarea) => {
                    const isDeviated =
                      tarea.estado === 'incompleto' || tarea.estado === 'no_hecho';

                    return (
                      <div
                        key={tarea.id}
                        className="p-3.5 rounded-xl bg-midnight-950/70 border border-white/5 space-y-2.5 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                                {tarea.hora_inicio?.slice(0, 5)} - {tarea.hora_fin?.slice(0, 5)}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                                  tarea.tipo_trabajo === 'PROFUNDO'
                                    ? 'bg-pastel-lavender/15 text-pastel-lavender border border-pastel-lavender/30'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {tarea.tipo_trabajo}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                ({tarea.horas_netas_estimadas}h est.)
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-200">
                              {tarea.descripcion}
                            </p>
                          </div>

                          {/* 3 Pill buttons: Hecho, Incompleto, No hecho */}
                          <div className="flex items-center gap-1.5 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'hecho')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                tarea.estado === 'hecho'
                                  ? 'bg-pastel-mint text-midnight-950 font-bold shadow-glow-mint'
                                  : 'bg-slate-800/80 text-slate-300 hover:text-white border border-white/5 hover:border-pastel-mint/30'
                              }`}
                            >
                              ✓ Hecho
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'incompleto')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                tarea.estado === 'incompleto'
                                  ? 'bg-pastel-amber text-midnight-950 font-bold'
                                  : 'bg-slate-800/80 text-slate-300 hover:text-white border border-white/5 hover:border-pastel-amber/30'
                              }`}
                            >
                              Incompleto
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'no_hecho')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                tarea.estado === 'no_hecho'
                                  ? 'bg-pastel-coral text-midnight-950 font-bold'
                                  : 'bg-slate-800/80 text-slate-300 hover:text-white border border-white/5 hover:border-pastel-coral/30'
                              }`}
                            >
                              No hecho
                            </button>
                          </div>
                        </div>

                        {/* Micro-input if deviated */}
                        {isDeviated && (
                          <div className="pt-2 border-t border-white/5 flex items-center gap-2 animate-fade-in">
                            <span className="text-xs text-pastel-coral font-mono whitespace-nowrap">
                              ¿Qué causó el desvío?
                            </span>
                            <input
                              type="text"
                              placeholder="Ej: Interrupción urgente, cansancio cognitivo acumulado..."
                              value={desviosMap[tarea.id] || ''}
                              onChange={(e) =>
                                setDesviosMap((prev) => ({
                                  ...prev,
                                  [tarea.id]: e.target.value,
                                }))
                              }
                              onBlur={() => handleSaveDesvio(tarea.id, tarea.estado)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDesvio(tarea.id, tarea.estado);
                              }}
                              className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-midnight-900 border border-white/10 text-white placeholder-slate-500 focus:border-pastel-coral/50 focus:outline-none"
                            />
                            {savingTaskId === tarea.id && (
                              <span className="text-[10px] font-mono text-slate-400">
                                Guardando...
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: Contexto de Salud y Mente */}
            <div className="space-y-4 pt-2 border-t border-white/5">
              <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2 font-mono">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-pastel-lavender text-xs">
                  2
                </span>
                Contexto de Salud y Mente
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Alimento: 1 a 5 */}
                <div className="p-3.5 rounded-xl bg-midnight-950/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono text-slate-300 uppercase tracking-wider">
                      Alimento (1-5)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {alimento === 5 ? 'Óptimo' : alimento === 1 ? 'Pobre' : 'Normal'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAlimento(val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                          alimento === val
                            ? 'bg-pastel-mint text-midnight-950 shadow-glow-mint'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ejercicio: Horas & Intensidad */}
                <div className="p-3.5 rounded-xl bg-midnight-950/60 border border-white/5 space-y-2">
                  <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block">
                    Ejercicio Físico
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="6"
                      value={ejercicioHoras}
                      onChange={(e) => setEjercicioHoras(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1.5 rounded-lg text-xs font-mono font-semibold bg-midnight-900 border border-white/10 text-white focus:outline-none"
                    />
                    <div className="flex flex-1 rounded-lg bg-midnight-900 p-0.5 border border-white/5">
                      {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setEjercicioIntensidad(level)}
                          className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
                            ejercicioIntensidad === level
                              ? 'bg-slate-700 text-pastel-ice font-semibold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Frío Mental */}
                <div className="p-3.5 rounded-xl bg-midnight-950/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono text-slate-300 uppercase tracking-wider">
                      Frío Mental
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Estado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['Frio total', 'Inspirado', 'Avido'] as FrioMental[]).map((estado) => {
                      const isActive = frioMental === estado;
                      const label =
                        estado === 'Frio total'
                          ? 'Frío total'
                          : estado === 'Avido'
                          ? 'Ávido'
                          : estado;

                      return (
                        <button
                          key={estado}
                          type="button"
                          onClick={() => setFrioMental(estado)}
                          className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all truncate ${
                            isActive
                              ? 'bg-pastel-lavender text-midnight-950 font-bold shadow-glow-lavender'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title={label}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: Planificación de Mañana */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2 font-mono">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-pastel-lavender text-xs">
                    3
                  </span>
                  Planificación de Mañana (Editor Estricto)
                </h3>
                <span className="text-xs font-mono text-pastel-lavender">
                  {parsedTasksCount} tareas identificadas
                </span>
              </div>

              <p className="text-xs text-slate-400 font-mono">
                Formato requerido: <span className="text-slate-300">- [ ] [HH:MM - HH:MM] [PROFUNDO/SUPERFICIAL] Descripción (Xh netas)</span>
              </p>

              <textarea
                rows={5}
                value={markdownPlan}
                onChange={(e) => setMarkdownPlan(e.target.value)}
                className="w-full p-3.5 rounded-xl font-mono text-xs text-pastel-ice bg-midnight-950 border border-white/10 focus:border-pastel-lavender/50 focus:outline-none leading-relaxed"
                placeholder="- [ ] [09:00 - 11:00] [PROFUNDO] Tarea clave de la mañana (2h netas)"
              />
            </div>

            {/* Ritual Completion Button */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={submittingCierre}
                onClick={handleCompletarRitual}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-midnight-950 bg-pastel-mint hover:bg-pastel-mint/90 shadow-glow-mint transition-all duration-200 active:scale-95 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{submittingCierre ? 'Guardando Ritual...' : 'Completar Ritual y Guardar'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

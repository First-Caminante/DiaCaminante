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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="card-tactical w-full max-w-3xl rounded-2xl p-6 sm:p-8 relative my-auto border-2 border-[#74a47b]/40 shadow-tactical-glow bg-[#121c13] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shutdown-title"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d9f2c4] to-transparent opacity-80" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="btn-tactical-ghost absolute top-5 right-5 p-2 rounded-lg text-[#92aa95] hover:text-[#d9f2c4] uppercase font-mono text-xs font-bold border border-[#74a47b]/20 hover:border-[#74a47b]/60"
          aria-label="Cerrar modal"
        >
          ✕
        </button>

        {cierreExitoso ? (
          /* Celebratory Finished State */
          <div className="text-center py-10 px-4 space-y-6 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-[#215e28] border-2 border-[#74a47b] flex items-center justify-center text-[#d9f2c4] shadow-tactical-glow text-2xl font-bold">
              ✓
            </div>

            <div className="space-y-2">
              <span className="tag-tactical px-3 py-1 rounded-lg text-xs bg-[#1a281b] text-[#d9f2c4] border border-[#74a47b]/40 font-mono font-bold tracking-wider">
                SHUTDOWN COMPLETE
              </span>
              <h2 className="text-2xl sm:text-3xl font-mono font-black text-[#f8fafc] uppercase tracking-wider">
                Ritual de cierre completado. Mente liberada hasta mañana.
              </h2>
              <p className="text-sm text-[#92aa95] max-w-md mx-auto italic font-serif leading-relaxed">
                &ldquo;El ritual de cierre le asegura al cerebro que ningún hilo quedó suelto, permitiendo una desconexión total para regenerar la energía cognitiva.&rdquo;
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={() => {
                  setCierreExitoso(false);
                  onClose();
                }}
                className="btn-tactical px-6 py-2.5 rounded-lg text-xs font-mono font-bold text-[#d9f2c4] bg-[#215e28] border border-[#74a47b]/60 hover:bg-[#286f31] uppercase tracking-wider shadow-tactical"
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
                <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#1a281b] text-[#d9f2c4] border border-[#74a47b]/40 font-mono font-bold tracking-wider">
                  RITUAL
                </span>
                <span className="text-xs font-mono uppercase tracking-widest text-[#92aa95] font-bold">
                  CAL NEWPORT PROTOCOL
                </span>
              </div>
              <h2 id="shutdown-title" className="text-2xl font-mono font-black text-[#f8fafc] tracking-wider uppercase">
                Ritual de Cierre Diario (Shutdown Ritual)
              </h2>
              <p className="text-xs sm:text-sm text-[#92aa95] mt-1 font-mono">
                Audita las tareas de hoy, registra tu estado psicofísico y programa el bloque de mañana para desconectar tu mente en paz.
              </p>
            </div>

            {/* SECCIÓN 1: Auditoría de Tareas de Hoy */}
            <div className="space-y-3 pt-2 border-t border-[#74a47b]/20">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#f8fafc] tracking-wide flex items-center gap-2 font-mono">
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#215e28] text-[#d9f2c4] border border-[#74a47b]/40 text-xs font-bold">
                    1
                  </span>
                  Auditoría de Tareas de Hoy
                </h3>
                <span className="text-xs font-mono text-[#92aa95]">
                  {tareasHoy.length} {tareasHoy.length === 1 ? 'tarea programada' : 'tareas programadas'}
                </span>
              </div>

              {tareasHoy.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#000000] border border-[#74a47b]/20 text-center text-xs text-[#92aa95] font-mono">
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
                        className="p-3.5 rounded-xl bg-[#000000] border border-[#74a47b]/30 space-y-2.5 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-[#92aa95] bg-[#1a281b] border border-[#74a47b]/30 px-2 py-0.5 rounded">
                                {tarea.hora_inicio?.slice(0, 5)} - {tarea.hora_fin?.slice(0, 5)}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                                  tarea.tipo_trabajo === 'PROFUNDO'
                                    ? 'bg-[#215e28] text-[#d9f2c4] border border-[#74a47b]/50'
                                    : 'bg-[#1a281b] text-[#92aa95] border border-[#74a47b]/20'
                                }`}
                              >
                                {tarea.tipo_trabajo}
                              </span>
                              <span className="text-xs text-[#92aa95] font-mono">
                                ({tarea.horas_netas_estimadas}h est.)
                              </span>
                            </div>
                            <p className="text-sm font-mono text-[#f8fafc]">
                              {tarea.descripcion}
                            </p>
                          </div>

                          {/* 3 Pill buttons: Hecho, Incompleto, No hecho */}
                          <div className="flex items-center gap-1.5 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'hecho')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all uppercase tracking-wider ${
                                tarea.estado === 'hecho'
                                  ? 'bg-[#215e28] text-[#d9f2c4] border border-[#74a47b] shadow-tactical-glow'
                                  : 'bg-[#1a281b] text-[#92aa95] hover:text-[#f8fafc] border border-[#74a47b]/30'
                              }`}
                            >
                              ✓ Hecho
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'incompleto')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all uppercase tracking-wider ${
                                tarea.estado === 'incompleto'
                                  ? 'bg-[#d9f2c4] text-[#121c13] font-black'
                                  : 'bg-[#1a281b] text-[#92aa95] hover:text-[#f8fafc] border border-[#74a47b]/30'
                              }`}
                            >
                              Incompleto
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'no_hecho')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all uppercase tracking-wider ${
                                tarea.estado === 'no_hecho'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                                  : 'bg-[#1a281b] text-[#92aa95] hover:text-[#f8fafc] border border-[#74a47b]/30'
                              }`}
                            >
                              No hecho
                            </button>
                          </div>
                        </div>

                        {/* Micro-input if deviated */}
                        {isDeviated && (
                          <div className="pt-2 border-t border-[#74a47b]/20 flex items-center gap-2 animate-fade-in">
                            <span className="text-xs text-rose-400 font-mono whitespace-nowrap">
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
                              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#1a281b] border border-[#74a47b]/40 text-[#f8fafc] placeholder-[#92aa95]/60 focus:border-[#d9f2c4] focus:outline-none"
                            />
                            {savingTaskId === tarea.id && (
                              <span className="text-[10px] font-mono text-[#92aa95]">
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
            <div className="space-y-4 pt-2 border-t border-[#74a47b]/20">
              <h3 className="text-sm font-semibold text-[#f8fafc] tracking-wide flex items-center gap-2 font-mono">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#215e28] text-[#d9f2c4] border border-[#74a47b]/40 text-xs font-bold">
                  2
                </span>
                Contexto de Salud y Mente
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Alimento: 1 a 5 */}
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#74a47b]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono text-[#92aa95] uppercase tracking-wider font-bold">
                      Alimento (1-5)
                    </label>
                    <span className="text-[10px] text-[#d9f2c4] font-mono">
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
                            ? 'bg-[#215e28] text-[#d9f2c4] border border-[#74a47b] shadow-tactical-glow'
                            : 'bg-[#1a281b] text-[#92aa95] hover:text-[#f8fafc] border border-[#74a47b]/20'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ejercicio: Horas & Intensidad */}
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#74a47b]/30 space-y-2">
                  <label className="text-xs font-mono text-[#92aa95] uppercase tracking-wider block font-bold">
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
                      className="w-20 px-2 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[#1a281b] border border-[#74a47b]/40 text-[#f8fafc] focus:outline-none focus:border-[#d9f2c4]"
                    />
                    <div className="flex flex-1 rounded-lg bg-[#1a281b] p-0.5 border border-[#74a47b]/20">
                      {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setEjercicioIntensidad(level)}
                          className={`flex-1 py-1 text-[11px] font-mono font-bold rounded transition-all ${
                            ejercicioIntensidad === level
                              ? 'bg-[#215e28] text-[#d9f2c4] border border-[#74a47b]/40 shadow-tactical-glow'
                              : 'text-[#92aa95] hover:text-[#f8fafc]'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Frío Mental */}
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#74a47b]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono text-[#92aa95] uppercase tracking-wider font-bold">
                      Frío Mental
                    </label>
                    <span className="text-[10px] text-[#d9f2c4] font-mono">Estado</span>
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
                          className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-mono font-bold transition-all truncate ${
                            isActive
                              ? 'bg-[#215e28] text-[#d9f2c4] border border-[#74a47b] shadow-tactical-glow'
                              : 'bg-[#1a281b] text-[#92aa95] hover:text-[#f8fafc] border border-[#74a47b]/20'
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
            <div className="space-y-3 pt-2 border-t border-[#74a47b]/20">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#f8fafc] tracking-wide flex items-center gap-2 font-mono">
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#215e28] text-[#d9f2c4] border border-[#74a47b]/40 text-xs font-bold">
                    3
                  </span>
                  Planificación de Mañana (Editor Estricto)
                </h3>
                <span className="text-xs font-mono text-[#d9f2c4] font-bold">
                  {parsedTasksCount} tareas identificadas
                </span>
              </div>

              <p className="text-xs text-[#92aa95] font-mono">
                Formato requerido: <span className="text-[#d9f2c4]">- [ ] [HH:MM - HH:MM] [PROFUNDO/SUPERFICIAL] Descripción (Xh netas)</span>
              </p>

              <textarea
                rows={5}
                value={markdownPlan}
                onChange={(e) => setMarkdownPlan(e.target.value)}
                className="w-full p-3.5 rounded-xl font-mono text-xs text-[#f8fafc] bg-[#000000] border border-[#74a47b]/40 focus:border-[#d9f2c4] focus:outline-none leading-relaxed"
                placeholder="- [ ] [09:00 - 11:00] [PROFUNDO] Tarea clave de la mañana (2h netas)"
              />
            </div>

            {/* Ritual Completion Button */}
            <div className="pt-4 border-t-2 border-[#74a47b]/30 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="btn-tactical-ghost px-4 py-2 rounded-lg text-xs font-mono font-bold text-[#92aa95] hover:text-[#f8fafc] bg-[#000000] border border-[#74a47b]/30 uppercase"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={submittingCierre}
                onClick={handleCompletarRitual}
                className="btn-tactical inline-flex items-center gap-2 px-6 py-3 rounded-lg text-xs font-mono font-bold text-[#d9f2c4] bg-[#215e28] border border-[#74a47b]/60 hover:bg-[#286f31] uppercase tracking-wider shadow-tactical disabled:opacity-50"
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

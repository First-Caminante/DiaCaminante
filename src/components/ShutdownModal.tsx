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
        throw new Error(err.error || 'Error al completar cierre');
      }

      const data = await res.json();
      setCierreExitoso(true);
      onCierreCompletado(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al procesar el cierre');
    } finally {
      setSubmittingCierre(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="card-midnight w-full max-w-3xl rounded-3xl p-6 sm:p-8 relative my-auto border border-[#5b9bd5]/30 shadow-2xl bg-[#081229] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shutdown-title"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#eed59b] to-transparent opacity-80" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="btn-formal-outline absolute top-5 right-5 p-2 rounded-full text-[#94a3b8] hover:text-white"
          aria-label="Cerrar modal"
        >
          ✕
        </button>

        {cierreExitoso ? (
          /* Celebratory Finished State */
          <div className="text-center py-10 px-4 space-y-6 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-midnight text-2xl font-bold">
              ✓
            </div>

            <div className="space-y-2">
              <span className="tag-formal px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Protocolo Completado
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide">
                Jornada Concluida con Serenidad
              </h2>
              <p className="text-sm text-[#94a3b8] max-w-md mx-auto italic font-serif leading-relaxed">
                &ldquo;El protocolo de cierre le asegura al cerebro que ningún pendiente quedó en el limbo, permitiendo un descanso genuino para regenerar la energía cognitiva.&rdquo;
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={() => {
                  setCierreExitoso(false);
                  onClose();
                }}
                className="btn-formal px-6 py-2.5 rounded-full text-xs font-semibold"
              >
                Volver al Panel Principal
              </button>
            </div>
          </div>
        ) : (
          /* Normal Multi-Step Shutdown Form */
          <div className="space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
                  Protocolo
                </span>
                <span className="text-xs text-[#eed59b] font-medium tracking-wider uppercase">
                  Cierre de Jornada (Cal Newport)
                </span>
              </div>
              <h2 id="shutdown-title" className="text-2xl font-serif font-bold text-white tracking-wide">
                Protocolo de Cierre Diario
              </h2>
              <p className="text-xs sm:text-sm text-[#94a3b8] mt-1 font-sans">
                Audita las tareas de hoy, registra tu estado físico y programa la jornada de mañana para descansar en paz.
              </p>
            </div>

            {/* SECCIÓN 1: Auditoría de Tareas de Hoy */}
            <div className="space-y-3 pt-2 border-t border-[#5b9bd5]/15">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-serif font-bold text-white tracking-wide flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1e3a8a] text-[#93c5fd] text-xs font-bold">
                    1
                  </span>
                  Auditoría de Tareas de Hoy
                </h3>
                <span className="text-xs text-[#94a3b8]">
                  {tareasHoy.length} {tareasHoy.length === 1 ? 'tarea registrada' : 'tareas registradas'}
                </span>
              </div>

              {tareasHoy.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#070e1e]/80 border border-[#5b9bd5]/15 text-center text-xs text-[#94a3b8]">
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
                        className="p-4 rounded-2xl bg-[#070e1e]/80 border border-[#5b9bd5]/20 space-y-2.5 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-[#94a3b8] bg-[#0d1733] border border-[#5b9bd5]/25 px-2 py-0.5 rounded-full font-mono">
                                {tarea.hora_inicio?.slice(0, 5)} - {tarea.hora_fin?.slice(0, 5)}
                              </span>
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
                                  tarea.tipo_trabajo === 'PROFUNDO'
                                    ? 'bg-[#1e3a8a]/50 text-[#93c5fd] border border-[#60a5fa]/30'
                                    : 'bg-[#0d1733] text-[#94a3b8]'
                                }`}
                              >
                                {tarea.tipo_trabajo}
                              </span>
                              <span className="text-xs text-[#94a3b8]">
                                ({tarea.horas_netas_estimadas}h est.)
                              </span>
                            </div>
                            <p className="text-sm font-serif text-white">
                              {tarea.descripcion}
                            </p>
                          </div>

                          {/* 3 Pill buttons */}
                          <div className="flex items-center gap-1.5 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'hecho')}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                tarea.estado === 'hecho'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                                  : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                              }`}
                            >
                              ✓ Hecho
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'incompleto')}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                tarea.estado === 'incompleto'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                                  : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                              }`}
                            >
                              Incompleto
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(tarea, 'no_hecho')}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                tarea.estado === 'no_hecho'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
                                  : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                              }`}
                            >
                              No hecho
                            </button>
                          </div>
                        </div>

                        {/* Micro-input if deviated */}
                        {isDeviated && (
                          <div className="pt-2 border-t border-[#5b9bd5]/15 flex items-center gap-2 animate-fade-in">
                            <span className="text-xs text-amber-300 whitespace-nowrap">
                              Motivo del desvío:
                            </span>
                            <input
                              type="text"
                              placeholder="Ej: Interrupción imprevista, cambio de prioridad..."
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
                              className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-[#0d1733] border border-[#5b9bd5]/30 text-white placeholder-[#94a3b8]/50 focus:border-[#eed59b] focus:outline-none"
                            />
                            {savingTaskId === tarea.id && (
                              <span className="text-[10px] text-[#94a3b8]">
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
            <div className="space-y-4 pt-2 border-t border-[#5b9bd5]/15">
              <h3 className="text-sm font-serif font-bold text-white tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1e3a8a] text-[#93c5fd] text-xs font-bold">
                  2
                </span>
                Contexto de Salud y Estado
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Alimento: 1 a 5 */}
                <div className="p-4 rounded-2xl bg-[#070e1e]/80 border border-[#5b9bd5]/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#94a3b8]">
                      Alimentación (1-5)
                    </label>
                    <span className="text-[11px] text-[#eed59b] font-medium">
                      {alimento === 5 ? 'Óptimo' : alimento === 1 ? 'Pobre' : 'Normal'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAlimento(val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          alimento === val
                            ? 'bg-[#2563eb] text-white font-bold shadow-sm'
                            : 'bg-[#0d1733] text-[#94a3b8] hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ejercicio: Horas & Intensidad */}
                <div className="p-4 rounded-2xl bg-[#070e1e]/80 border border-[#5b9bd5]/20 space-y-2">
                  <label className="text-xs font-medium text-[#94a3b8] block">
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
                      className="w-20 px-3 py-1.5 rounded-xl text-xs font-mono font-medium bg-[#0d1733] border border-[#5b9bd5]/30 text-white focus:outline-none focus:border-[#eed59b]"
                    />
                    <div className="flex flex-1 rounded-xl bg-[#0d1733] p-0.5 border border-[#5b9bd5]/20">
                      {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setEjercicioIntensidad(level)}
                          className={`flex-1 py-1 text-[11px] font-medium rounded-lg transition-all ${
                            ejercicioIntensidad === level
                              ? 'bg-[#1e3a8a] text-[#93c5fd] font-bold'
                              : 'text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Frío Mental */}
                <div className="p-4 rounded-2xl bg-[#070e1e]/80 border border-[#5b9bd5]/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#94a3b8]">
                      Estado Mental
                    </label>
                    <span className="text-[11px] text-[#eed59b] font-medium">Serenidad</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['Frio total', 'Inspirado', 'Avido'] as FrioMental[]).map((estado) => {
                      const isActive = frioMental === estado;
                      const label =
                        estado === 'Frio total'
                          ? 'Sereno'
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
                              ? 'bg-[#eed59b] text-[#070e1e] font-bold shadow-sm'
                              : 'bg-[#0d1733] text-[#94a3b8] hover:text-white'
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
            <div className="space-y-3 pt-2 border-t border-[#5b9bd5]/15">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-serif font-bold text-white tracking-wide flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1e3a8a] text-[#93c5fd] text-xs font-bold">
                    3
                  </span>
                  Planificación para Mañana
                </h3>
                <span className="text-xs text-[#eed59b] font-medium">
                  {parsedTasksCount} tareas identificadas
                </span>
              </div>

              <p className="text-xs text-[#94a3b8]">
                Formato sugerido: <span className="text-white font-mono">- [ ] [HH:MM - HH:MM] [PROFUNDO/SUPERFICIAL] Descripción (Xh netas)</span>
              </p>

              <textarea
                rows={5}
                value={markdownPlan}
                onChange={(e) => setMarkdownPlan(e.target.value)}
                className="w-full p-4 rounded-2xl font-mono text-xs text-white bg-[#070e1e] border border-[#5b9bd5]/30 focus:border-[#eed59b] focus:outline-none leading-relaxed"
                placeholder="- [ ] [09:00 - 11:00] [PROFUNDO] Tarea clave de la mañana (2h netas)"
              />
            </div>

            {/* Ritual Completion Button */}
            <div className="pt-4 border-t border-[#5b9bd5]/20 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="btn-formal-outline px-5 py-2.5 rounded-full text-xs font-medium"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={submittingCierre}
                onClick={handleCompletarRitual}
                className="btn-formal inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{submittingCierre ? 'Guardando...' : 'Completar y Cerrar Jornada'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

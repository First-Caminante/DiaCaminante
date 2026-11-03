import React, { useState } from 'react';
import type { SesionFlujo, Intensidad, Incomodidad } from '../types/database';

interface QuickLogProps {
  fecha: string;
  sesiones: SesionFlujo[];
  onSesionRegistrada: (nuevaSesion: SesionFlujo) => void;
  onSesionActualizada?: (sesionActualizada: SesionFlujo) => void;
  onSesionEliminada?: (sesionId: string) => void;
}

const PRESET_TIPOS = ['Desarrollo', 'Estudio', 'Arquitectura', 'Escritura'];

export const QuickLog: React.FC<QuickLogProps> = ({
  fecha,
  sesiones,
  onSesionRegistrada,
  onSesionActualizada,
  onSesionEliminada,
}) => {
  // New session state
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('Desarrollo');
  const [isCustomTipo, setIsCustomTipo] = useState<boolean>(false);
  const [customTipo, setCustomTipo] = useState<string>('');

  const [horasNetas, setHorasNetas] = useState<number>(1.5);
  const [intensidad, setIntensidad] = useState<Intensidad>('Alta');
  const [incomodidad, setIncomodidad] = useState<Incomodidad>('Alta');
  const [calidad, setCalidad] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Edit session state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState<string>('');
  const [editHorasNetas, setEditHorasNetas] = useState<number>(1.5);
  const [editIntensidad, setEditIntensidad] = useState<Intensidad>('Media');
  const [editIncomodidad, setEditIncomodidad] = useState<Incomodidad>('Media');
  const [editCalidad, setEditCalidad] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Delete session state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeTipo = isCustomTipo ? customTipo : tipoSeleccionado;

  const handleAddHoras = (increment: number) => {
    setHorasNetas((prev) => {
      const next = Math.max(0.25, Math.round((prev + increment) * 100) / 100);
      return next;
    });
  };

  const handleAddEditHoras = (increment: number) => {
    setEditHorasNetas((prev) => {
      const next = Math.max(0.25, Math.round((prev + increment) * 100) / 100);
      return next;
    });
  };

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!activeTipo.trim()) {
      alert('Por favor especifica el tipo de trabajo.');
      return;
    }
    if (horasNetas <= 0) {
      alert('Las horas netas deben ser mayores a 0.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: activeTipo.trim(),
          horas_netas: horasNetas,
          intensidad,
          incomodidad,
          calidad: calidad.trim(),
          fecha,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar la sesión');
      }

      const data = await res.json();
      onSesionRegistrada(data.sesion);

      setCalidad('');
      setFeedbackMsg(`+${horasNetas}h registradas en ${activeTipo.trim()}`);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al registrar bloque');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  const startEdit = (sesion: SesionFlujo) => {
    setEditingSessionId(sesion.id);
    setEditTipo(sesion.tipo);
    setEditHorasNetas(parseFloat(String(sesion.horas_netas)) || 1.0);
    setEditIntensidad(sesion.intensidad);
    setEditIncomodidad(sesion.incomodidad);
    setEditCalidad(sesion.calidad || '');
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingSessionId(null);
  };

  const handleSaveEdit = async (sesionId: string) => {
    if (!editTipo.trim()) {
      alert('El tipo no puede estar vacío');
      return;
    }
    if (editHorasNetas <= 0) {
      alert('Las horas netas deben ser mayores a 0');
      return;
    }

    try {
      setSavingEdit(true);
      const res = await fetch(`/api/sesiones/${sesionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: editTipo.trim(),
          horas_netas: editHorasNetas,
          intensidad: editIntensidad,
          incomodidad: editIncomodidad,
          calidad: editCalidad.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar sesión');
      }

      const data = await res.json();
      if (onSesionActualizada) {
        onSesionActualizada(data.sesion);
      }
      setEditingSessionId(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al actualizar bloque');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSession = async (sesionId: string) => {
    try {
      setDeletingId(sesionId);
      const res = await fetch(`/api/sesiones/${sesionId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar sesión');
      }

      if (onSesionEliminada) {
        onSesionEliminada(sesionId);
      }
      setConfirmDeleteId(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al eliminar bloque');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Columna Izquierda (col-span-5): Consola de Registro Rápido */}
      <div className="lg:col-span-5 card-tactical p-5 sm:p-6 border-2 border-[#74a47b]/40 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#74a47b]/20">
          <div className="flex items-center gap-2">
            <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#215e28] text-[#d9f2c4] border-[#74a47b]">
              REGISTRO
            </span>
            <h2 className="text-base sm:text-lg font-display font-extrabold text-[#f8fafc] uppercase tracking-tight">
              Ingreso Rápido de Flujo
            </h2>
          </div>

          {feedbackMsg && (
            <span className="tag-tactical text-xs bg-[#d9f2c4] text-[#000000] px-2.5 py-0.5 rounded border-[#74a47b] animate-fade-in font-bold">
              ✓ {feedbackMsg}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
          {/* Tipo de Trabajo Selector */}
          <div>
            <label className="block text-[11px] font-bold text-[#92aa95] uppercase tracking-wider mb-2 font-mono">
              Tipo de Enfoque
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_TIPOS.map((tipo) => {
                const isActive = !isCustomTipo && tipoSeleccionado === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      setIsCustomTipo(false);
                      setTipoSeleccionado(tipo);
                    }}
                    className={`btn-tactical-ghost px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                      isActive
                        ? 'bg-[#d9f2c4] text-[#000000] border-[#d9f2c4] font-bold shadow-[0_0_12px_rgba(217,242,196,0.3)]'
                        : 'text-[#92aa95]'
                    }`}
                  >
                    {tipo}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomTipo(true)}
                className={`btn-tactical-ghost px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                  isCustomTipo
                    ? 'bg-[#d9f2c4] text-[#000000] border-[#d9f2c4] font-bold'
                    : 'text-[#92aa95]'
                }`}
              >
                + Otro
              </button>

              {isCustomTipo && (
                <input
                  type="text"
                  placeholder="Nombre..."
                  value={customTipo}
                  onChange={(e) => setCustomTipo(e.target.value)}
                  autoFocus
                  className="px-3 py-1.5 rounded-xl text-xs font-mono bg-[#000000] border-2 border-[#74a47b] text-[#f8fafc] placeholder-[#92aa95]/50 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Horas Netas con tacómetro digital e incremento rápido */}
          <div>
            <label className="block text-[11px] font-bold text-[#92aa95] uppercase tracking-wider mb-2 font-mono">
              Horas Netas de Concentración
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="12"
                  value={horasNetas}
                  onChange={(e) => setHorasNetas(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-base font-mono text-[#d9f2c4] font-bold bg-[#000000] border-2 border-[#74a47b]/50 focus:border-[#d9f2c4] focus:outline-none tabular-nums"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#92aa95] pointer-events-none font-bold">
                  horas
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddHoras(0.5)}
                  className="btn-tactical-ghost px-2.5 py-2.5 rounded-xl text-xs font-mono font-bold"
                  title="Sumar 30 minutos"
                >
                  +0.5h
                </button>
                <button
                  type="button"
                  onClick={() => handleAddHoras(1.0)}
                  className="btn-tactical-ghost px-2.5 py-2.5 rounded-xl text-xs font-mono font-bold"
                  title="Sumar 1 hora"
                >
                  +1.0h
                </button>
              </div>
            </div>
          </div>

          {/* Intensidad & Incomodidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#92aa95] uppercase tracking-wider mb-1.5 font-mono">
                Intensidad
              </label>
              <div className="flex rounded-xl bg-[#000000] p-1 border border-[#74a47b]/30">
                {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => {
                  const isActive = intensidad === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIntensidad(level)}
                      className={`flex-1 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                        isActive
                          ? 'bg-[#215e28] text-[#d9f2c4] border border-[#74a47b]'
                          : 'text-[#92aa95] hover:text-[#f8fafc]'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#92aa95] uppercase tracking-wider mb-1.5 font-mono">
                Incomodidad
              </label>
              <div className="flex rounded-xl bg-[#000000] p-1 border border-[#74a47b]/30">
                {(['Baja', 'Media', 'Alta'] as Incomodidad[]).map((level) => {
                  const isActive = incomodidad === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIncomodidad(level)}
                      className={`flex-1 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                        isActive
                          ? level === 'Alta'
                            ? 'bg-[#1a281b] text-[#e28080] border border-[#e28080]/60'
                            : 'bg-[#1a281b] text-[#fde68a] border border-[#fde68a]/60'
                          : 'text-[#92aa95] hover:text-[#f8fafc]'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Calidad / Entregable */}
          <div>
            <label className="block text-[11px] font-bold text-[#92aa95] uppercase tracking-wider mb-1.5 font-mono">
              Calidad / Entregable Conseguido
            </label>
            <input
              type="text"
              placeholder="Ej: Refactorización del motor de búsqueda..."
              value={calidad}
              onChange={(e) => setCalidad(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-[#000000] border-2 border-[#74a47b]/40 text-[#f8fafc] placeholder-[#92aa95]/40 focus:border-[#d9f2c4] focus:outline-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#92aa95]">
              Atajo: <kbd className="tag-tactical px-1.5 py-0.5 rounded bg-[#000000] text-[#f8fafc] text-[9px] border-[#74a47b]/40">Ctrl+Enter</kbd>
            </span>

            <button
              type="submit"
              disabled={submitting}
              className="btn-tactical px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase disabled:opacity-50"
            >
              <span>{submitting ? 'Registrando...' : 'Registrar Bloque'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Columna Derecha (col-span-7): Bitácora / Línea de Tiempo de Hoy */}
      <div className="lg:col-span-7 card-tactical p-5 sm:p-6 border-2 border-[#74a47b]/40 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#74a47b]/20">
          <div className="flex items-center gap-2">
            <span className="tag-tactical px-2 py-0.5 rounded text-[10px] bg-[#1a281b] text-[#d9f2c4] border-[#74a47b]">
              BITÁCORA
            </span>
            <h3 className="text-base sm:text-lg font-display font-extrabold text-[#f8fafc] uppercase tracking-tight">
              Línea de Tiempo de Hoy
            </h3>
          </div>
          <span className="text-xs font-mono text-[#92aa95] font-bold uppercase">
            {sesiones.length} {sesiones.length === 1 ? 'bloque' : 'bloques'}
          </span>
        </div>

        {sesiones.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-[#74a47b]/30 bg-[#000000]">
            <p className="text-sm font-display font-bold text-[#f8fafc] uppercase">Aún no hay bloques registrados hoy</p>
            <p className="text-xs font-mono text-[#92aa95] mt-1">
              Ejecuta tu primera sesión de trabajo profundo y regístrala para iluminar tu cronograma.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sesiones.map((sesion, idx) => {
              const isEditing = editingSessionId === sesion.id;
              const isConfirmingDelete = confirmDeleteId === sesion.id;

              if (isEditing) {
                return (
                  <div
                    key={sesion.id || idx}
                    className="p-4 rounded-xl bg-[#000000] border-2 border-[#d9f2c4] shadow-[0_0_15px_rgba(217,242,196,0.2)] space-y-3 animate-fade-in font-mono"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#74a47b]/20 text-xs">
                      <span className="font-bold text-[#d9f2c4] uppercase">Editar Bloque</span>
                      <span className="text-[#92aa95]">{formatTime(sesion.registrado_a)}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] text-[#92aa95] mb-1 font-bold uppercase">Tipo</label>
                        <input
                          type="text"
                          value={editTipo}
                          onChange={(e) => setEditTipo(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#121c13] border border-[#74a47b] text-[#f8fafc]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#92aa95] mb-1 font-bold uppercase">Horas</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.25"
                            value={editHorasNetas}
                            onChange={(e) => setEditHorasNetas(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#121c13] border border-[#74a47b] text-[#d9f2c4] font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddEditHoras(0.5)}
                            className="btn-tactical-ghost px-2 py-1 rounded text-xs font-bold"
                          >
                            +0.5
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#92aa95] mb-1 font-bold uppercase">Calidad</label>
                      <input
                        type="text"
                        value={editCalidad}
                        onChange={(e) => setEditCalidad(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#121c13] border border-[#74a47b] text-[#f8fafc]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="btn-tactical-ghost px-3 py-1 rounded text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(sesion.id)}
                        className="btn-tactical px-3.5 py-1 rounded text-xs font-bold"
                      >
                        {savingEdit ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={sesion.id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#000000] border-2 border-[#74a47b]/30 hover:border-[#74a47b]/60 transition-all group"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="tag-tactical text-[10px] text-[#d9f2c4] bg-[#121c13] px-2 py-1 rounded border-[#74a47b]/40">
                      {formatTime(sesion.registrado_a)}
                    </span>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-display font-bold text-[#f8fafc] uppercase">
                          {sesion.tipo}
                        </span>

                        <span className="tag-tactical text-[9px] px-2 py-0.5 rounded bg-[#121c13] text-[#92aa95] border-[#74a47b]/30">
                          Int: {sesion.intensidad}
                        </span>

                        <span className="tag-tactical text-[9px] px-2 py-0.5 rounded bg-[#121c13] text-[#e28080] border-[#74a47b]/30">
                          Incom: {sesion.incomodidad}
                        </span>
                      </div>

                      {sesion.calidad && (
                        <p className="text-xs text-[#92aa95] mt-1 font-mono italic line-clamp-1">
                          ↳ &ldquo;{sesion.calidad}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="flex items-baseline gap-1 font-mono">
                      <span className="text-lg font-display font-extrabold text-[#d9f2c4] tabular-nums">
                        {Number(sesion.horas_netas).toFixed(2)}
                      </span>
                      <span className="text-xs text-[#92aa95] font-bold uppercase">h</span>
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-[#74a47b]/20">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 animate-fade-in font-mono">
                          <span className="text-[10px] text-[#e28080] font-bold">¿Borrar?</span>
                          <button
                            type="button"
                            disabled={deletingId === sesion.id}
                            onClick={() => handleDeleteSession(sesion.id)}
                            className="btn-tactical px-2 py-0.5 rounded text-[10px] bg-[#e28080] text-black font-bold"
                          >
                            {deletingId === sesion.id ? '...' : 'Sí'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="btn-tactical-ghost px-2 py-0.5 rounded text-[10px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(sesion)}
                            className="btn-tactical-ghost p-1.5 rounded-lg text-[#92aa95] hover:text-[#d9f2c4]"
                            title="Editar bloque"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sesion.id)}
                            className="btn-tactical-ghost p-1.5 rounded-lg text-[#92aa95] hover:text-[#e28080]"
                            title="Eliminar bloque"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

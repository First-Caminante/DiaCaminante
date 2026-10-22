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

      // Reset form fields
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

  // Start editing a session
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

  // Save edited session
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

  // Delete session
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

  // Helper for formatting registration time
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
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-4 space-y-6">
      {/* Quick Log Form Card */}
      <div className="card-midnight rounded-2xl p-5 sm:p-7 shadow-xl border border-white/7 transition-all">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-pastel-ice/10 text-pastel-ice">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Registro Rápido de Flujo
            </h2>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-white/5 hidden sm:inline-block">
              &lt; 15 segundos
            </span>
          </div>

          {feedbackMsg && (
            <span className="text-xs font-medium text-pastel-mint bg-pastel-mint/10 border border-pastel-mint/30 px-3 py-1 rounded-full animate-fade-in">
              ✓ {feedbackMsg}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-5">
          {/* Tipo de Trabajo Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2 font-mono">
              Tipo de Enfoque
            </label>
            <div className="flex flex-wrap items-center gap-2">
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
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95 ${
                      isActive
                        ? 'bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/40 shadow-glow-lavender font-semibold'
                        : 'bg-midnight-800 text-slate-300 border border-white/5 hover:border-white/10 hover:text-white'
                    }`}
                  >
                    {tipo}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomTipo(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95 ${
                  isCustomTipo
                    ? 'bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/40 shadow-glow-lavender font-semibold'
                    : 'bg-midnight-800 text-slate-400 border border-white/5 hover:border-white/10 hover:text-white'
                }`}
              >
                + Personalizado
              </button>

              {isCustomTipo && (
                <input
                  type="text"
                  placeholder="Nombre del bloque..."
                  value={customTipo}
                  onChange={(e) => setCustomTipo(e.target.value)}
                  autoFocus
                  className="px-3 py-1.5 rounded-xl text-xs bg-midnight-950 border border-pastel-lavender/40 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pastel-lavender"
                />
              )}
            </div>
          </div>

          {/* Horas Netas con botones de incremento rápido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2 font-mono">
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
                    className="w-full px-3.5 py-2 rounded-xl text-sm font-mono text-pastel-mint font-semibold bg-midnight-950 border border-white/10 focus:border-pastel-mint/50 focus:outline-none tabular-nums"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">
                    horas
                  </span>
                </div>

                {/* Incremental quick pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddHoras(0.5)}
                    className="px-2.5 py-2 rounded-xl text-xs font-mono text-slate-300 bg-midnight-800 hover:bg-midnight-700 border border-white/5 hover:border-white/10 active:scale-95"
                    title="Sumar 30 minutos"
                  >
                    +0.5h
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddHoras(1.0)}
                    className="px-2.5 py-2 rounded-xl text-xs font-mono text-slate-300 bg-midnight-800 hover:bg-midnight-700 border border-white/5 hover:border-white/10 active:scale-95"
                    title="Sumar 1 hora"
                  >
                    +1.0h
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddHoras(1.5)}
                    className="px-2.5 py-2 rounded-xl text-xs font-mono text-slate-300 bg-midnight-800 hover:bg-midnight-700 border border-white/5 hover:border-white/10 active:scale-95"
                    title="Sumar 1.5 horas"
                  >
                    +1.5h
                  </button>
                </div>
              </div>
            </div>

            {/* Intensidad & Incomodidad */}
            <div className="grid grid-cols-2 gap-3">
              {/* Intensidad */}
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2 font-mono">
                  Intensidad
                </label>
                <div className="flex rounded-xl bg-midnight-950 p-1 border border-white/5">
                  {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => {
                    const isActive = intensidad === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setIntensidad(level)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          isActive
                            ? 'bg-midnight-800 text-pastel-ice border border-pastel-ice/30 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Incomodidad */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider font-mono">
                    Incomodidad
                  </label>
                  <span
                    className="text-[10px] text-slate-500 hover:text-slate-300 cursor-help"
                    title="Nivel de exigencia cognitiva. Newport: El foco real empuja los límites y genera incomodidad productiva."
                  >
                    ⓘ
                  </span>
                </div>
                <div className="flex rounded-xl bg-midnight-950 p-1 border border-white/5">
                  {(['Baja', 'Media', 'Alta'] as Incomodidad[]).map((level) => {
                    const isActive = incomodidad === level;
                    const activeColor =
                      level === 'Alta'
                        ? 'text-pastel-coral border-pastel-coral/30'
                        : level === 'Media'
                        ? 'text-pastel-amber border-pastel-amber/30'
                        : 'text-pastel-ice border-pastel-ice/30';

                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setIncomodidad(level)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          isActive
                            ? `bg-midnight-800 ${activeColor} border shadow-sm`
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Calidad / Avance (Texto conciso) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2 font-mono">
              Calidad / Entregable Conseguido
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ej: Implementación del parser regex y validación de endpoints..."
                value={calidad}
                onChange={(e) => setCalidad(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-midnight-950 border border-white/10 text-white placeholder-slate-500 focus:border-pastel-lavender/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Button & Shortcut hint */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline-block">
              Atajo: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/5">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/5">Enter</kbd>
            </span>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-midnight-950 bg-pastel-lavender hover:bg-pastel-lavenderDark transition-all duration-200 active:scale-95 shadow-glow-lavender disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>{submitting ? 'Registrando...' : 'Registrar Bloque de Foco'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Timeline of Today's Sessions */}
      <div className="card-midnight rounded-2xl p-5 sm:p-7 shadow-xl border border-white/7">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-pastel-mint/10 text-pastel-mint">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </span>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Línea de Tiempo de Hoy
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {sesiones.length} {sesiones.length === 1 ? 'bloque registrado' : 'bloques registrados'}
          </span>
        </div>

        {sesiones.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-white/5 bg-midnight-950/40">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <p className="text-sm text-slate-300 font-medium">Aún no has registrado bloques hoy</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Realiza tu primera sesión de trabajo profundo y regístrala en 15 segundos para alimentar tu marcador.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sesiones.map((sesion, idx) => {
              const isEditing = editingSessionId === sesion.id;
              const isConfirmingDelete = confirmDeleteId === sesion.id;

              if (isEditing) {
                return (
                  /* INLINE EDIT MODE CARD */
                  <div
                    key={sesion.id || idx}
                    className="p-4 sm:p-5 rounded-xl bg-midnight-900 border border-pastel-lavender/40 shadow-glow-lavender space-y-4 animate-fade-in"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="text-xs font-mono uppercase text-pastel-lavender font-semibold tracking-wider">
                        Editar Bloque de Foco
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {formatTime(sesion.registrado_a)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Edit Tipo */}
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Tipo de Enfoque
                        </label>
                        <input
                          type="text"
                          value={editTipo}
                          onChange={(e) => setEditTipo(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-midnight-950 border border-white/10 text-white focus:border-pastel-lavender/50 focus:outline-none"
                        />
                      </div>

                      {/* Edit Horas */}
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Horas Netas
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.25"
                            min="0.25"
                            max="12"
                            value={editHorasNetas}
                            onChange={(e) => setEditHorasNetas(parseFloat(e.target.value) || 0)}
                            className="w-24 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-pastel-mint bg-midnight-950 border border-white/10 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddEditHoras(0.5)}
                            className="px-2 py-1.5 rounded-lg text-[10px] font-mono bg-midnight-800 text-slate-300 hover:text-white border border-white/5"
                          >
                            +0.5h
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddEditHoras(1.0)}
                            className="px-2 py-1.5 rounded-lg text-[10px] font-mono bg-midnight-800 text-slate-300 hover:text-white border border-white/5"
                          >
                            +1.0h
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Edit Intensidad */}
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Intensidad
                        </label>
                        <div className="flex rounded-lg bg-midnight-950 p-1 border border-white/5">
                          {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setEditIntensidad(level)}
                              className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
                                editIntensidad === level
                                  ? 'bg-midnight-800 text-pastel-ice border border-pastel-ice/30'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Edit Incomodidad */}
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Incomodidad (Exigencia Cognitiva)
                        </label>
                        <div className="flex rounded-lg bg-midnight-950 p-1 border border-white/5">
                          {(['Baja', 'Media', 'Alta'] as Incomodidad[]).map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setEditIncomodidad(level)}
                              className={`flex-1 py-1 text-[11px] font-medium rounded transition-all ${
                                editIncomodidad === level
                                  ? level === 'Alta'
                                    ? 'bg-midnight-800 text-pastel-coral border border-pastel-coral/30'
                                    : level === 'Media'
                                    ? 'bg-midnight-800 text-pastel-amber border border-pastel-amber/30'
                                    : 'bg-midnight-800 text-pastel-ice border border-pastel-ice/30'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Edit Calidad */}
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Entregable / Avance Conseguido
                      </label>
                      <input
                        type="text"
                        value={editCalidad}
                        onChange={(e) => setEditCalidad(e.target.value)}
                        placeholder="Descripción concisa del entregable..."
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-midnight-950 border border-white/10 text-white placeholder-slate-500 focus:border-pastel-lavender/50 focus:outline-none"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(sesion.id)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-midnight-950 bg-pastel-lavender hover:bg-pastel-lavenderDark shadow-glow-lavender transition-all disabled:opacity-50"
                      >
                        {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                /* NORMAL DISPLAY CARD */
                <div
                  key={sesion.id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-midnight-950/60 border border-white/5 hover:border-white/10 transition-colors group"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Time stamp */}
                    <span className="text-xs font-mono text-slate-400 bg-midnight-800 px-2 py-1 rounded-md border border-white/5">
                      {formatTime(sesion.registrado_a)}
                    </span>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {sesion.tipo}
                        </span>

                        {/* Intensity badge */}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-white/5">
                          Intensidad: {sesion.intensidad}
                        </span>

                        {/* Incomodidad badge */}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            sesion.incomodidad === 'Alta'
                              ? 'bg-pastel-coral/10 text-pastel-coral border-pastel-coral/30'
                              : sesion.incomodidad === 'Media'
                              ? 'bg-pastel-amber/10 text-pastel-amber border-pastel-amber/30'
                              : 'bg-pastel-ice/10 text-pastel-ice border-pastel-ice/30'
                          }`}
                        >
                          Exigencia: {sesion.incomodidad}
                        </span>
                      </div>

                      {sesion.calidad && (
                        <p className="text-xs text-slate-400 mt-1 font-normal line-clamp-1">
                          ↳ {sesion.calidad}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side: Net Hours Display & Action buttons */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {/* Net Hours Display */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold font-mono text-pastel-mint tabular-nums">
                        {Number(sesion.horas_netas).toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400 font-medium">h netas</span>
                    </div>

                    {/* Action buttons (Edit & Delete) */}
                    <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <span className="text-[11px] text-pastel-coral font-mono">¿Eliminar?</span>
                          <button
                            type="button"
                            disabled={deletingId === sesion.id}
                            onClick={() => handleDeleteSession(sesion.id)}
                            className="px-2 py-1 rounded bg-pastel-coral text-midnight-950 font-bold text-[10px] hover:bg-pastel-coral/90 transition-colors"
                          >
                            {deletingId === sesion.id ? '...' : 'Sí'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] hover:text-white transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(sesion)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-pastel-lavender hover:bg-midnight-800 transition-colors"
                            title="Editar bloque de foco"
                            aria-label="Editar bloque"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sesion.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-pastel-coral hover:bg-midnight-800 transition-colors"
                            title="Eliminar bloque de foco"
                            aria-label="Eliminar bloque"
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

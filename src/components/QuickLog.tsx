import React, { useState } from 'react';
import type { SesionFlujo, Intensidad, Incomodidad } from '../types/database';

interface QuickLogProps {
  fecha: string;
  sesiones: SesionFlujo[];
  onSesionRegistrada: (nuevaSesion: SesionFlujo) => void;
  onSesionActualizada?: (sesionActualizada: SesionFlujo) => void;
  onSesionEliminada?: (sesionId: string) => void;
}

const PRESET_TIPOS = ['Desarrollo', 'Estudio', 'Arquitectura', 'Escritura', 'Lectura'];

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
  const [incomodidad, setIncomodidad] = useState<Incomodidad>('Media');
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
      alert(err.message || 'Error al registrar sesión');
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
      alert(err.message || 'Error al actualizar sesión');
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
      alert(err.message || 'Error al eliminar sesión');
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
      {/* Columna Izquierda (col-span-5): Registro Rápido */}
      <div className="lg:col-span-5 card-midnight p-5 sm:p-6 border border-[#5b9bd5]/25 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#5b9bd5]/15">
          <div className="flex items-center gap-2">
            <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
              Nueva Sesión
            </span>
            <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
              Registrar Sesión de Foco
            </h3>
          </div>

          {feedbackMsg && (
            <span className="tag-formal text-xs bg-[#eed59b] text-[#070e1e] px-3 py-0.5 rounded-full font-semibold animate-fade-in shadow-sm">
              ✓ {feedbackMsg}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
          {/* Tipo de Trabajo Selector */}
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-2">
              Tipo de Actividad
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
                    className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                      isActive
                        ? 'bg-[#2563eb] text-white font-medium shadow-midnight'
                        : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                    }`}
                  >
                    {tipo}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomTipo(true)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                  isCustomTipo
                    ? 'bg-[#2563eb] text-white font-medium'
                    : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                }`}
              >
                + Personalizado
              </button>

              {isCustomTipo && (
                <input
                  type="text"
                  placeholder="Especificar nombre..."
                  value={customTipo}
                  onChange={(e) => setCustomTipo(e.target.value)}
                  autoFocus
                  className="px-3.5 py-1.5 rounded-full text-xs bg-[#070e1e] border border-[#5b9bd5]/40 text-white placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#eed59b]"
                />
              )}
            </div>
          </div>

          {/* Horas Netas con incremento rápido */}
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-2">
              Duración Neta de Concentración
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
                  className="w-full px-4 py-2.5 rounded-xl text-base font-serif font-bold text-[#eed59b] bg-[#081229] border border-[#5b9bd5]/30 focus:border-[#eed59b] focus:outline-none tabular-nums"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8] pointer-events-none">
                  horas
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddHoras(0.5)}
                  className="btn-formal-outline px-3 py-2.5 rounded-xl text-xs font-mono font-medium"
                  title="Sumar 30 minutos"
                >
                  +0.5h
                </button>
                <button
                  type="button"
                  onClick={() => handleAddHoras(1.0)}
                  className="btn-formal-outline px-3 py-2.5 rounded-xl text-xs font-mono font-medium"
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
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                Intensidad
              </label>
              <div className="flex rounded-xl bg-[#081229] p-1 border border-[#5b9bd5]/20">
                {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => {
                  const isActive = intensidad === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIntensidad(level)}
                      className={`flex-1 py-1 text-xs rounded-lg transition-all ${
                        isActive
                          ? 'bg-[#2563eb] text-white font-medium shadow-sm'
                          : 'text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                Incomodidad
              </label>
              <div className="flex rounded-xl bg-[#081229] p-1 border border-[#5b9bd5]/20">
                {(['Baja', 'Media', 'Alta'] as Incomodidad[]).map((level) => {
                  const isActive = incomodidad === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIncomodidad(level)}
                      className={`flex-1 py-1 text-xs rounded-lg transition-all ${
                        isActive
                          ? level === 'Alta'
                            ? 'bg-[#1e3a8a] text-[#eed59b] font-medium border border-[#eed59b]/40'
                            : 'bg-[#1e3a8a] text-[#60a5fa] font-medium'
                          : 'text-[#94a3b8] hover:text-white'
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
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
              Entregable / Resultado Obtenido
            </label>
            <input
              type="text"
              placeholder="Ej: Análisis del capítulo 4, refactorización del módulo..."
              value={calidad}
              onChange={(e) => setCalidad(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-[#081229] border border-[#5b9bd5]/30 text-white placeholder-[#94a3b8]/40 focus:border-[#eed59b] focus:outline-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#94a3b8]">
              Atajo: <kbd className="px-2 py-0.5 rounded bg-[#0d1733] text-white text-[10px] border border-[#5b9bd5]/20">Ctrl+Enter</kbd>
            </span>

            <button
              type="submit"
              disabled={submitting}
              className="btn-formal px-6 py-2.5 rounded-full text-xs font-semibold disabled:opacity-50"
            >
              <span>{submitting ? 'Guardando...' : 'Registrar Sesión'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Columna Derecha (col-span-7): Bitácora de Sesiones de Hoy */}
      <div className="lg:col-span-7 card-midnight p-5 sm:p-6 border border-[#5b9bd5]/25 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#5b9bd5]/15">
          <div className="flex items-center gap-2">
            <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
              Bitácora
            </span>
            <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
              Sesiones Registradas Hoy
            </h3>
          </div>
          <span className="text-xs text-[#94a3b8] font-medium">
            {sesiones.length} {sesiones.length === 1 ? 'sesión' : 'sesiones'}
          </span>
        </div>

        {sesiones.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[#5b9bd5]/20 bg-[#081229]/60">
            <p className="text-sm font-serif font-bold text-white">Aún no hay sesiones registradas hoy</p>
            <p className="text-xs text-[#94a3b8] mt-1">
              Inicia tu primera sesión de trabajo profundo y anótala aquí para ver reflejado tu avance.
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
                    className="p-4 rounded-2xl bg-[#081229] border border-[#eed59b]/50 shadow-midnight space-y-3 animate-fade-in text-xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#5b9bd5]/15">
                      <span className="font-serif font-bold text-[#eed59b]">Editar Sesión</span>
                      <span className="text-[#94a3b8]">{formatTime(sesion.registrado_a)}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1 font-medium">Tipo de Tarea</label>
                        <input
                          type="text"
                          value={editTipo}
                          onChange={(e) => setEditTipo(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-[#0d1733] border border-[#5b9bd5]/30 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1 font-medium">Horas Netas</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.25"
                            value={editHorasNetas}
                            onChange={(e) => setEditHorasNetas(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded-xl bg-[#0d1733] border border-[#5b9bd5]/30 text-[#eed59b] font-serif font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddEditHoras(0.5)}
                            className="btn-formal-outline px-2.5 py-1 rounded-xl text-xs"
                          >
                            +0.5
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#94a3b8] mb-1 font-medium">Entregable</label>
                      <input
                        type="text"
                        value={editCalidad}
                        onChange={(e) => setEditCalidad(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#0d1733] border border-[#5b9bd5]/30 text-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="btn-formal-outline px-4 py-1.5 rounded-full text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(sesion.id)}
                        className="btn-formal px-4 py-1.5 rounded-full text-xs font-semibold"
                      >
                        {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={sesion.id || idx}
                  className="p-4 rounded-2xl bg-[#081229]/80 border border-[#5b9bd5]/20 hover:border-[#5b9bd5]/40 transition-all space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#5b9bd5]/15">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-white text-base">
                        {sesion.tipo}
                      </span>
                      <span className="tag-formal text-[10px] px-2.5 py-0.5 rounded-full bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30">
                        {sesion.horas_netas} horas netas
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#94a3b8]">
                        {formatTime(sesion.registrado_a)}
                      </span>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => startEdit(sesion)}
                        className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#0d1733] transition-colors"
                        title="Editar sesión"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(sesion.id)}
                        className="p-1.5 rounded-lg text-[#94a3b8] hover:text-rose-400 hover:bg-[#0d1733] transition-colors"
                        title="Eliminar sesión"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Badges of Intensity & Inconvenience */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="tag-formal px-2.5 py-0.5 rounded-full bg-[#0d1733] text-[#60a5fa] border border-[#5b9bd5]/25">
                        Intensidad: <b>{sesion.intensidad}</b>
                      </span>
                      <span className="tag-formal px-2.5 py-0.5 rounded-full bg-[#0d1733] text-[#eed59b] border border-[#e5c179]/30">
                        Incomodidad: <b>{sesion.incomodidad}</b>
                      </span>
                    </div>
                  </div>

                  {/* Quality Note */}
                  {sesion.calidad && (
                    <blockquote className="p-3 rounded-xl bg-[#0d1733]/80 border-l-2 border-[#eed59b] text-xs text-[#94a3b8] italic font-serif">
                      &ldquo;{sesion.calidad}&rdquo;
                    </blockquote>
                  )}

                  {/* Inline Delete Confirmation */}
                  {isConfirmingDelete && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-3 text-xs animate-fade-in">
                      <span className="text-rose-200">¿Deseas eliminar este registro?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1 rounded-full text-xs text-[#94a3b8] hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === sesion.id}
                          onClick={() => handleDeleteSession(sesion.id)}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
                        >
                          {deletingId === sesion.id ? 'Eliminando...' : 'Confirmar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

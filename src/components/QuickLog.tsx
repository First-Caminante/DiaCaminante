import React, { useState } from 'react';
import type { SesionFlujo, Intensidad, Incomodidad } from '../types/database';

interface QuickLogProps {
  fecha: string;
  sesiones: SesionFlujo[];
  onSesionRegistrada: (nuevaSesion: SesionFlujo) => void;
  onSesionActualizada?: (sesionActualizada: SesionFlujo) => void;
  onSesionEliminada?: (sesionId: string) => void;
}

interface PresetItem {
  label: string;
  icon: string;
}

const PRESET_TIPOS: PresetItem[] = [
  { label: 'Desarrollo', icon: '💻' },
  { label: 'Estudio', icon: '📚' },
  { label: 'Entrenamiento', icon: '🏃' },
  { label: 'Sueño / Descanso', icon: '🌙' },
  { label: 'Trabajo Profundo', icon: '🧠' },
  { label: 'Arquitectura', icon: '🏛️' },
  { label: 'Escritura', icon: '✍️' },
  { label: 'Lectura', icon: '📖' },
  { label: 'Planificación', icon: '🎯' },
];

// Helper: Formatea Date a HH:MM
const dateToTimeString = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

// Helper: Suma minutos a una cadena HH:MM retornando HH:MM
const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  if (!timeStr || !timeStr.includes(':')) return '12:00';
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = ((h * 60 + m + minutesToAdd) % (24 * 60) + 24 * 60) % (24 * 60);
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

// Helper: Diferencia en horas decimales entre start (HH:MM) y end (HH:MM)
const diffInHours = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 1.0;
  const [h1, m1] = startStr.split(':').map(Number);
  const [h2, m2] = endStr.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  if (mins === 0) mins = 60;
  return Math.round((mins / 60) * 100) / 100;
};

export const QuickLog: React.FC<QuickLogProps> = ({
  fecha,
  sesiones,
  onSesionRegistrada,
  onSesionActualizada,
  onSesionEliminada,
}) => {
  // Inicialización de horarios: hora fin es la hora actual, inicio es 1.5h antes
  const now = new Date();
  const initialFin = dateToTimeString(now);
  const initialInicio = addMinutesToTime(initialFin, -90);

  // New session state
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('Desarrollo');
  const [isCustomTipo, setIsCustomTipo] = useState<boolean>(false);
  const [customTipo, setCustomTipo] = useState<string>('');

  const [horaInicio, setHoraInicio] = useState<string>(initialInicio);
  const [horaFin, setHoraFin] = useState<string>(initialFin);
  const [horasNetas, setHorasNetas] = useState<number>(1.5);

  const [intensidad, setIntensidad] = useState<Intensidad>('Alta');
  const [incomodidad, setIncomodidad] = useState<Incomodidad>('Media');
  const [calidad, setCalidad] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Edit session state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState<string>('');
  const [editHoraInicio, setEditHoraInicio] = useState<string>('09:00');
  const [editHoraFin, setEditHoraFin] = useState<string>('11:00');
  const [editHorasNetas, setEditHorasNetas] = useState<number>(1.5);
  const [editIntensidad, setEditIntensidad] = useState<Intensidad>('Media');
  const [editIncomodidad, setEditIncomodidad] = useState<Incomodidad>('Media');
  const [editCalidad, setEditCalidad] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Delete session state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeTipo = isCustomTipo ? customTipo : tipoSeleccionado;

  // Sincronización inteligente de Horas y Horarios en Nueva Sesión
  const handleHoraInicioChange = (val: string) => {
    setHoraInicio(val);
    if (val && horaFin) {
      const calc = diffInHours(val, horaFin);
      setHorasNetas(calc);
    }
  };

  const handleHoraFinChange = (val: string) => {
    setHoraFin(val);
    if (horaInicio && val) {
      const calc = diffInHours(horaInicio, val);
      setHorasNetas(calc);
    }
  };

  const handleHorasNetasChange = (val: number) => {
    const safeVal = Math.max(0.1, Math.round(val * 100) / 100);
    setHorasNetas(safeVal);
    if (horaInicio) {
      const newFin = addMinutesToTime(horaInicio, Math.round(safeVal * 60));
      setHoraFin(newFin);
    }
  };

  const handleAddHoras = (increment: number) => {
    const next = Math.max(0.25, Math.round((horasNetas + increment) * 100) / 100);
    handleHorasNetasChange(next);
  };

  // Sincronización inteligente en Edición
  const handleEditHoraInicioChange = (val: string) => {
    setEditHoraInicio(val);
    if (val && editHoraFin) {
      const calc = diffInHours(val, editHoraFin);
      setEditHorasNetas(calc);
    }
  };

  const handleEditHoraFinChange = (val: string) => {
    setEditHoraFin(val);
    if (editHoraInicio && val) {
      const calc = diffInHours(editHoraInicio, val);
      setEditHorasNetas(calc);
    }
  };

  const handleEditHorasNetasChange = (val: number) => {
    const safeVal = Math.max(0.1, Math.round(val * 100) / 100);
    setEditHorasNetas(safeVal);
    if (editHoraInicio) {
      const newFin = addMinutesToTime(editHoraInicio, Math.round(safeVal * 60));
      setEditHoraFin(newFin);
    }
  };

  const handleAddEditHoras = (increment: number) => {
    const next = Math.max(0.25, Math.round((editHorasNetas + increment) * 100) / 100);
    handleEditHorasNetasChange(next);
  };

  // Registrar nueva sesión
  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!activeTipo.trim()) {
      alert('Por favor especifica el tipo de actividad.');
      return;
    }
    if (horasNetas <= 0) {
      alert('Las horas netas deben ser mayores a 0.');
      return;
    }

    try {
      setSubmitting(true);
      // Generar timestamp de finalización con la fecha y hora seleccionadas
      let registradoA: string;
      try {
        const localEnd = new Date(`${fecha}T${horaFin}:00`);
        registradoA = !isNaN(localEnd.getTime()) ? localEnd.toISOString() : new Date().toISOString();
      } catch {
        registradoA = new Date().toISOString();
      }

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
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          registrado_a: registradoA,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar la sesión');
      }

      const data = await res.json();
      onSesionRegistrada(data.sesion);

      setCalidad('');
      setFeedbackMsg(`+${horasNetas}h registradas (${horaInicio} - ${horaFin})`);
      setTimeout(() => setFeedbackMsg(null), 3500);

      // Avanzar horario sugerido para la siguiente actividad
      const newStart = horaFin;
      const newEnd = addMinutesToTime(newStart, Math.round(horasNetas * 60));
      setHoraInicio(newStart);
      setHoraFin(newEnd);
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

  // Abrir editor de sesión
  const startEdit = (sesion: SesionFlujo) => {
    setEditingSessionId(sesion.id);
    setEditTipo(sesion.tipo);
    const hNet = parseFloat(String(sesion.horas_netas)) || 1.0;
    setEditHorasNetas(hNet);
    setEditIntensidad(sesion.intensidad);
    setEditIncomodidad(sesion.incomodidad);
    setEditCalidad(sesion.calidad || '');
    setConfirmDeleteId(null);

    if (sesion.hora_inicio && sesion.hora_fin) {
      setEditHoraInicio(sesion.hora_inicio);
      setEditHoraFin(sesion.hora_fin);
    } else if (sesion.registrado_a) {
      try {
        const endDate = new Date(sesion.registrado_a);
        const finStr = dateToTimeString(endDate);
        const startDate = new Date(endDate.getTime() - Math.round(hNet * 60 * 60 * 1000));
        const inicioStr = dateToTimeString(startDate);
        setEditHoraInicio(inicioStr);
        setEditHoraFin(finStr);
      } catch {
        setEditHoraInicio('09:00');
        setEditHoraFin('11:00');
      }
    } else {
      setEditHoraInicio('09:00');
      setEditHoraFin('11:00');
    }
  };

  const cancelEdit = () => {
    setEditingSessionId(null);
  };

  // Guardar sesión editada (permite reubicar a cualquier hora)
  const handleSaveEdit = async (sesionId: string) => {
    if (!editTipo.trim()) {
      alert('El tipo de actividad no puede estar vacío');
      return;
    }
    if (editHorasNetas <= 0) {
      alert('Las horas netas deben ser mayores a 0');
      return;
    }

    try {
      setSavingEdit(true);

      // Calcular registrado_a para la fecha y la nueva hora fin
      let finalIso: string;
      try {
        const localEnd = new Date(`${fecha}T${editHoraFin}:00`);
        finalIso = !isNaN(localEnd.getTime()) ? localEnd.toISOString() : new Date().toISOString();
      } catch {
        finalIso = new Date().toISOString();
      }

      const res = await fetch(`/api/sesiones/${sesionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: editTipo.trim(),
          horas_netas: editHorasNetas,
          intensidad: editIntensidad,
          incomodidad: editIncomodidad,
          calidad: editCalidad.trim(),
          hora_inicio: editHoraInicio,
          hora_fin: editHoraFin,
          fecha,
          registrado_a: finalIso,
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

  // Eliminar sesión
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

  // Helper para mostrar rango horario de cada sesión en la lista
  const renderTimeBadge = (sesion: SesionFlujo) => {
    if (sesion.hora_inicio && sesion.hora_fin) {
      return `${sesion.hora_inicio} — ${sesion.hora_fin}`;
    }
    if (sesion.registrado_a) {
      try {
        const end = new Date(sesion.registrado_a);
        const durMin = Math.round((parseFloat(String(sesion.horas_netas)) || 0) * 60);
        const start = new Date(end.getTime() - durMin * 60 * 1000);
        const sStr = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const eStr = end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        return `${sStr} — ${eStr}`;
      } catch {
        return '--:--';
      }
    }
    return '--:--';
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Columna Izquierda (col-span-5): Registro Rápido */}
      <div className="lg:col-span-5 card-midnight p-5 sm:p-6 border border-[#5b9bd5]/25 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#5b9bd5]/15">
          <div className="flex items-center gap-2">
            <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
              Registro Diario
            </span>
            <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
              Registrar Actividad del Día
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
              {PRESET_TIPOS.map((item) => {
                const isActive = !isCustomTipo && tipoSeleccionado === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setIsCustomTipo(false);
                      setTipoSeleccionado(item.label);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#2563eb] text-white font-medium shadow-midnight'
                        : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomTipo(true)}
                className={`px-3 py-1.5 rounded-xl text-xs transition-all ${
                  isCustomTipo
                    ? 'bg-[#2563eb] text-white font-medium'
                    : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                }`}
              >
                + Otra Actividad
              </button>

              {isCustomTipo && (
                <input
                  type="text"
                  placeholder="Ej: Calistenia, Lectura de Paper, etc..."
                  value={customTipo}
                  onChange={(e) => setCustomTipo(e.target.value)}
                  autoFocus
                  className="w-full mt-1.5 px-3.5 py-2 rounded-xl text-xs bg-[#070e1e] border border-[#5b9bd5]/40 text-white placeholder-[#94a3b8]/50 focus:outline-none focus:border-[#eed59b]"
                />
              )}
            </div>
          </div>

          {/* Horario Exacto: Inicio y Fin */}
          <div className="p-3.5 rounded-2xl bg-[#081229] border border-[#5b9bd5]/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#eed59b] flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#eed59b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <polyline points="12 6 12 12 16 14" strokeWidth="2" />
                </svg>
                Horario de Realización
              </span>
              <span className="text-[11px] font-mono text-[#94a3b8]">
                {horaInicio} — {horaFin} ({horasNetas.toFixed(2)}h)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#94a3b8] mb-1">Hora Inicio</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => handleHoraInicioChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium text-white bg-[#0d1733] border border-[#5b9bd5]/30 focus:border-[#eed59b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#94a3b8] mb-1">Hora Fin</label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => handleHoraFinChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono font-medium text-white bg-[#0d1733] border border-[#5b9bd5]/30 focus:border-[#eed59b] focus:outline-none"
                />
              </div>
            </div>

            {/* Duración Neta y Botones de Ajuste Rápido */}
            <div className="pt-1 flex items-center justify-between gap-2 border-t border-[#5b9bd5]/10">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#94a3b8]">Duración:</span>
                <input
                  type="number"
                  step="0.25"
                  min="0.1"
                  max="24"
                  value={horasNetas}
                  onChange={(e) => handleHorasNetasChange(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2.5 py-1 rounded-lg text-xs font-serif font-bold text-[#eed59b] bg-[#070e1e] border border-[#5b9bd5]/30 text-center"
                />
                <span className="text-[11px] text-[#94a3b8]">horas</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAddHoras(0.5)}
                  className="btn-formal-outline px-2.5 py-1 rounded-lg text-[11px] font-mono"
                  title="Sumar 30 minutos"
                >
                  +30m
                </button>
                <button
                  type="button"
                  onClick={() => handleAddHoras(1.0)}
                  className="btn-formal-outline px-2.5 py-1 rounded-lg text-[11px] font-mono"
                  title="Sumar 1 hora"
                >
                  +1h
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
              placeholder="Ej: Análisis del capítulo 4, 5km de trote, refactorización..."
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
              <span>{submitting ? 'Guardando...' : 'Registrar Actividad'}</span>
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
              Actividades Registradas Hoy
            </h3>
          </div>
          <span className="text-xs text-[#94a3b8] font-medium">
            {sesiones.length} {sesiones.length === 1 ? 'actividad' : 'actividades'}
          </span>
        </div>

        {sesiones.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[#5b9bd5]/20 bg-[#081229]/60">
            <p className="text-sm font-serif font-bold text-white">Aún no hay actividades registradas hoy</p>
            <p className="text-xs text-[#94a3b8] mt-1">
              Registra cualquier bloque de trabajo, entrenamiento, estudio o descanso realizado.
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
                      <span className="font-serif font-bold text-[#eed59b]">Editar y Reubicar Horario</span>
                      <span className="text-[11px] text-[#94a3b8] font-mono">
                        {editHoraInicio} — {editHoraFin} ({editHorasNetas.toFixed(2)}h)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1 font-medium">Tipo de Actividad</label>
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
                            onChange={(e) => handleEditHorasNetasChange(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 rounded-xl bg-[#0d1733] border border-[#5b9bd5]/30 text-[#eed59b] font-serif font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddEditHoras(0.5)}
                            className="btn-formal-outline px-2.5 py-1 rounded-xl text-xs font-mono"
                          >
                            +0.5h
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Modificar Horario de qué hora a qué hora se hizo */}
                    <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-[#0d1733]/70 border border-[#5b9bd5]/20">
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1">Mover a Hora Inicio</label>
                        <input
                          type="time"
                          value={editHoraInicio}
                          onChange={(e) => handleEditHoraInicioChange(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-[#081229] border border-[#5b9bd5]/30 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1">Mover a Hora Fin</label>
                        <input
                          type="time"
                          value={editHoraFin}
                          onChange={(e) => handleEditHoraFinChange(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-[#081229] border border-[#5b9bd5]/30 text-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Intensidad & Incomodidad en Edición */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1">Intensidad</label>
                        <select
                          value={editIntensidad}
                          onChange={(e) => setEditIntensidad(e.target.value as Intensidad)}
                          className="w-full px-3 py-1.5 rounded-xl bg-[#0d1733] border border-[#5b9bd5]/30 text-white text-xs"
                        >
                          <option value="Baja">Baja</option>
                          <option value="Media">Media</option>
                          <option value="Alta">Alta</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#94a3b8] mb-1">Incomodidad</label>
                        <select
                          value={editIncomodidad}
                          onChange={(e) => setEditIncomodidad(e.target.value as Incomodidad)}
                          className="w-full px-3 py-1.5 rounded-xl bg-[#0d1733] border border-[#5b9bd5]/30 text-white text-xs"
                        >
                          <option value="Baja">Baja</option>
                          <option value="Media">Media</option>
                          <option value="Alta">Alta</option>
                        </select>
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
                        {savingEdit ? 'Guardando...' : 'Guardar y Reubicar'}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif font-bold text-white text-base">
                        {sesion.tipo}
                      </span>
                      <span className="tag-formal text-[11px] px-2.5 py-0.5 rounded-full bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-mono">
                        🕒 {renderTimeBadge(sesion)}
                      </span>
                      <span className="tag-formal text-[10px] px-2 py-0.5 rounded-full bg-[#eed59b]/10 text-[#eed59b] border border-[#eed59b]/30 font-semibold">
                        {parseFloat(String(sesion.horas_netas)).toFixed(2)}h
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => startEdit(sesion)}
                        className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#eed59b] hover:bg-[#0d1733] transition-colors flex items-center gap-1 text-[11px]"
                        title="Editar y reubicar horario"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Editar</span>
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

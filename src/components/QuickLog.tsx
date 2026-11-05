import React, { useState } from 'react';
import type {
  SesionFlujo,
  Intensidad,
  Incomodidad,
  RegistroSueno,
  RegistroComida,
  RegistroEjercicio,
  CalidadSueno,
  SensacionSueno,
  TipoComida,
  CalidadComida,
  TipoEjercicio,
  TareaPlanificada,
} from '../types/database';
import { getBoliviaShortTimeStr } from '../lib/boliviaTime';

interface QuickLogProps {
  fecha: string;
  sesiones: SesionFlujo[];
  suenos?: RegistroSueno[];
  comidas?: RegistroComida[];
  ejercicios?: RegistroEjercicio[];
  tareas?: TareaPlanificada[];
  onTaskUpdated?: (tarea: TareaPlanificada) => void;
  onSesionRegistrada: (nuevaSesion: SesionFlujo) => void;
  onSesionActualizada?: (sesionActualizada: SesionFlujo) => void;
  onSesionEliminada?: (sesionId: string) => void;
  onSuenoRegistrado?: (nuevoSueno: RegistroSueno) => void;
  onSuenoActualizado?: (suenoActualizado: RegistroSueno) => void;
  onSuenoEliminado?: (suenoId: string) => void;
  onComidaRegistrada?: (nuevaComida: RegistroComida) => void;
  onComidaActualizada?: (comidaActualizada: RegistroComida) => void;
  onComidaEliminada?: (comidaId: string) => void;
  onEjercicioRegistrado?: (nuevoEjercicio: RegistroEjercicio) => void;
  onEjercicioActualizado?: (ejercicioActualizado: RegistroEjercicio) => void;
  onEjercicioEliminado?: (ejercicioId: string) => void;
}

type TabRegistro = 'trabajo' | 'sueno' | 'comida' | 'ejercicio';
type FilterBitacora = 'todo' | 'trabajo' | 'sueno' | 'comida' | 'ejercicio';

const PRESETS_TRABAJO = [
  { label: 'Desarrollo', icon: '💻' },
  { label: 'Estudio', icon: '📚' },
  { label: 'Arquitectura', icon: '🏛️' },
  { label: 'Escritura', icon: '✍️' },
  { label: 'Lectura', icon: '📖' },
  { label: 'Planificación', icon: '🎯' },
];

const PRESETS_EJERCICIO: TipoEjercicio[] = [
  'Calistenia / Corporal',
  'Gimnasio / Pesas',
  'Running / Cardio',
  'Movilidad / Yoga',
  'Deporte / Marcial',
];

const dateToTimeString = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  if (!timeStr || !timeStr.includes(':')) return '12:00';
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = ((h * 60 + m + minutesToAdd) % (24 * 60) + 24 * 60) % (24 * 60);
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

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
  sesiones = [],
  suenos = [],
  comidas = [],
  ejercicios = [],
  tareas = [],
  onTaskUpdated,
  onSesionRegistrada,
  onSesionActualizada,
  onSesionEliminada,
  onSuenoRegistrado,
  onSuenoActualizado,
  onSuenoEliminado,
  onComidaRegistrada,
  onComidaActualizada,
  onComidaEliminada,
  onEjercicioRegistrado,
  onEjercicioActualizado,
  onEjercicioEliminado,
}) => {
  const boliviaTimeStr = getBoliviaShortTimeStr();
  const defaultFin = boliviaTimeStr || '12:00';
  const defaultInicio = addMinutesToTime(defaultFin, -90);

  // Tab activo de registro
  const [activeTab, setActiveTab] = useState<TabRegistro>('trabajo');
  const [filterBitacora, setFilterBitacora] = useState<FilterBitacora>('todo');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // ==========================================
  // ESTADO: TRABAJO PROFUNDO
  // ==========================================
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('Desarrollo');
  const [isCustomTipo, setIsCustomTipo] = useState<boolean>(false);
  const [customTipo, setCustomTipo] = useState<string>('');
  const [selectedTareaId, setSelectedTareaId] = useState<string | null>(null);
  const [horaInicioTrabajo, setHoraInicioTrabajo] = useState<string>(defaultInicio);
  const [horaFinTrabajo, setHoraFinTrabajo] = useState<string>(defaultFin);
  const [horasNetas, setHorasNetas] = useState<number>(1.5);
  const [intensidad, setIntensidad] = useState<Intensidad>('Alta');
  const [incomodidad, setIncomodidad] = useState<Incomodidad>('Media');
  const [calidad, setCalidad] = useState<string>('');

  // ==========================================
  // ESTADO: SUEÑO Y DESCANSO
  // ==========================================
  const [horaDormir, setHoraDormir] = useState<string>('23:00');
  const [horaDespertar, setHoraDespertar] = useState<string>('07:00');
  const [horasSueno, setHorasSueno] = useState<number>(8.0);
  const [calidadSueno, setCalidadSueno] = useState<CalidadSueno>('Reparador');
  const [sensacionSueno, setSensacionSueno] = useState<SensacionSueno>('Descansado');
  const [notasSueno, setNotasSueno] = useState<string>('');

  // ==========================================
  // ESTADO: ALIMENTACIÓN
  // ==========================================
  const [horaComida, setHoraComida] = useState<string>(defaultFin);
  const [tipoComida, setTipoComida] = useState<TipoComida>('Almuerzo');
  const [descripcionComida, setDescripcionComida] = useState<string>('');
  const [calidadComida, setCalidadComida] = useState<CalidadComida>('Limpio / Nutritivo');

  // ==========================================
  // ESTADO: EJERCICIO FÍSICO
  // ==========================================
  const [horaInicioEjercicio, setHoraInicioEjercicio] = useState<string>(addMinutesToTime(defaultFin, -60));
  const [horaFinEjercicio, setHoraFinEjercicio] = useState<string>(defaultFin);
  const [duracionEjercicio, setDuracionEjercicio] = useState<number>(1.0);
  const [tipoEjercicio, setTipoEjercicio] = useState<TipoEjercicio>('Calistenia / Corporal');
  const [descripcionEjercicio, setDescripcionEjercicio] = useState<string>('');
  const [intensidadEjercicio, setIntensidadEjercicio] = useState<Intensidad>('Alta');

  // ==========================================
  // ESTADO DE EDICIÓN
  // ==========================================
  const [editingItem, setEditingItem] = useState<{
    id: string;
    category: 'trabajo' | 'sueno' | 'comida' | 'ejercicio';
    data: any;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Helper Feedback
  const triggerFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // ------------------------------------------
  // HANDLERS: TRABAJO PROFUNDO
  // ------------------------------------------
  const activeTrabajoTipo = isCustomTipo ? customTipo : tipoSeleccionado;

  const handleHoraInicioTrabajo = (val: string) => {
    setHoraInicioTrabajo(val);
    if (val && horaFinTrabajo) setHorasNetas(diffInHours(val, horaFinTrabajo));
  };
  const handleHoraFinTrabajo = (val: string) => {
    setHoraFinTrabajo(val);
    if (horaInicioTrabajo && val) setHorasNetas(diffInHours(horaInicioTrabajo, val));
  };
  const handleHorasNetasChange = (val: number) => {
    const safe = Math.max(0.1, Math.round(val * 100) / 100);
    setHorasNetas(safe);
    if (horaInicioTrabajo) setHoraFinTrabajo(addMinutesToTime(horaInicioTrabajo, Math.round(safe * 60)));
  };

  const handleSelectTareaPlanificada = (t: TareaPlanificada) => {
    if (selectedTareaId === t.id) {
      // Deseleccionar
      setSelectedTareaId(null);
      setIsCustomTipo(false);
      setTipoSeleccionado('Desarrollo');
      return;
    }

    setSelectedTareaId(t.id);
    setIsCustomTipo(true);
    setCustomTipo(t.descripcion);
    setTipoSeleccionado(t.descripcion);

    if (t.hora_inicio && t.hora_fin && t.hora_inicio !== '00:00' && t.hora_inicio !== '00:01') {
      setHoraInicioTrabajo(t.hora_inicio);
      setHoraFinTrabajo(t.hora_fin);
      setHorasNetas(diffInHours(t.hora_inicio, t.hora_fin));
    } else if (t.horas_netas_estimadas) {
      setHorasNetas(t.horas_netas_estimadas);
      if (horaInicioTrabajo) {
        setHoraFinTrabajo(addMinutesToTime(horaInicioTrabajo, Math.round(t.horas_netas_estimadas * 60)));
      }
    }

    if (t.tipo_trabajo === 'PROFUNDO') {
      setIntensidad('Alta');
      setIncomodidad('Alta');
    } else {
      setIntensidad('Media');
      setIncomodidad('Media');
    }
  };

  const submitTrabajo = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!activeTrabajoTipo.trim()) return alert('Especifica el tipo de trabajo');
    try {
      setSubmitting(true);
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: activeTrabajoTipo.trim(),
          horas_netas: horasNetas,
          intensidad,
          incomodidad,
          calidad: calidad.trim(),
          fecha,
          hora_inicio: horaInicioTrabajo,
          hora_fin: horaFinTrabajo,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar sesión');
      const data = await res.json();
      onSesionRegistrada(data.sesion);

      // Si estaba vinculada a una tarea planificada, marcarla automáticamente como cumplida
      if (selectedTareaId) {
        try {
          const tarRes = await fetch(`/api/tareas/${selectedTareaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estado: 'hecho',
              hora_inicio: horaInicioTrabajo,
              hora_fin: horaFinTrabajo,
              hora_completada: horaFinTrabajo,
              horas_netas_estimadas: horasNetas,
            }),
          });
          if (tarRes.ok) {
            const tarData = await tarRes.json();
            if (tarData?.tarea && onTaskUpdated) {
              onTaskUpdated(tarData.tarea);
            }
          }
        } catch (tarErr) {
          console.warn('Error al actualizar tarea planificada vinculada:', tarErr);
        }
      }

      setCalidad('');
      const feedbackText = selectedTareaId
        ? `✓ +${horasNetas}h registradas y tarea planificada cumplida`
        : `+${horasNetas}h foco en ${activeTrabajoTipo}`;
      triggerFeedback(feedbackText);
      setSelectedTareaId(null);
      setHoraInicioTrabajo(horaFinTrabajo);
      setHoraFinTrabajo(addMinutesToTime(horaFinTrabajo, Math.round(horasNetas * 60)));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------
  // HANDLERS: SUEÑO Y DESCANSO
  // ------------------------------------------
  const handleHoraDormir = (val: string) => {
    setHoraDormir(val);
    if (val && horaDespertar) setHorasSueno(diffInHours(val, horaDespertar));
  };
  const handleHoraDespertar = (val: string) => {
    setHoraDespertar(val);
    if (horaDormir && val) setHorasSueno(diffInHours(horaDormir, val));
  };

  const submitSueno = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch('/api/sueno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hora_inicio: horaDormir,
          hora_fin: horaDespertar,
          horas: horasSueno,
          calidad_sueno: calidadSueno,
          sensacion: sensacionSueno,
          notas: notasSueno.trim(),
          fecha,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar sueño');
      if (onSuenoRegistrado) onSuenoRegistrado(data.sueno);
      setNotasSueno('');
      triggerFeedback(`🌙 ${horasSueno}h de sueño registradas`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------
  // HANDLERS: ALIMENTACIÓN
  // ------------------------------------------
  const submitComida = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!descripcionComida.trim()) return alert('Describe qué alimentos consumiste.');
    try {
      setSubmitting(true);
      const res = await fetch('/api/comida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hora: horaComida,
          tipo_comida: tipoComida,
          descripcion: descripcionComida.trim(),
          calidad: calidadComida,
          fecha,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar comida');
      if (onComidaRegistrada) onComidaRegistrada(data.comida);
      setDescripcionComida('');
      triggerFeedback(`🥗 Comida registrada (${tipoComida})`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------
  // HANDLERS: EJERCICIO FÍSICO
  // ------------------------------------------
  const handleHoraInicioEjercicio = (val: string) => {
    setHoraInicioEjercicio(val);
    if (val && horaFinEjercicio) setDuracionEjercicio(diffInHours(val, horaFinEjercicio));
  };
  const handleHoraFinEjercicio = (val: string) => {
    setHoraFinEjercicio(val);
    if (horaInicioEjercicio && val) setDuracionEjercicio(diffInHours(horaInicioEjercicio, val));
  };

  const submitEjercicio = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch('/api/ejercicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hora_inicio: horaInicioEjercicio,
          hora_fin: horaFinEjercicio,
          duracion_horas: duracionEjercicio,
          tipo_ejercicio: tipoEjercicio,
          descripcion: descripcionEjercicio.trim(),
          intensidad: intensidadEjercicio,
          fecha,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar ejercicio');
      if (onEjercicioRegistrado) onEjercicioRegistrado(data.ejercicio);
      setDescripcionEjercicio('');
      triggerFeedback(`🏃 ${duracionEjercicio}h de ${tipoEjercicio} registradas`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------
  // EDICIÓN / ELIMINACIÓN
  // ------------------------------------------
  const handleDelete = async (category: 'trabajo' | 'sueno' | 'comida' | 'ejercicio', id: string) => {
    try {
      setDeletingId(id);
      const endpoint = category === 'trabajo' ? `/api/sesiones/${id}` : `/api/${category}/${id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');

      if (category === 'trabajo' && onSesionEliminada) onSesionEliminada(id);
      if (category === 'sueno' && onSuenoEliminado) onSuenoEliminado(id);
      if (category === 'comida' && onComidaEliminada) onComidaEliminada(id);
      if (category === 'ejercicio' && onEjercicioEliminado) onEjercicioEliminado(id);
      triggerFeedback('Registro eliminado.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      setSavingEdit(true);
      const { category, id, data } = editingItem;
      const endpoint = category === 'trabajo' ? `/api/sesiones/${id}` : `/api/${category}/${id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, fecha }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al actualizar');

      if (category === 'trabajo' && onSesionActualizada) onSesionActualizada(resData.sesion);
      if (category === 'sueno' && onSuenoActualizado) onSuenoActualizado(resData.sueno);
      if (category === 'comida' && onComidaActualizada) onComidaActualizada(resData.comida);
      if (category === 'ejercicio' && onEjercicioActualizado) onEjercicioActualizado(resData.ejercicio);

      setEditingItem(null);
      triggerFeedback('Cambios guardados con éxito.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Bitácora Combinada Cronológica
  interface BitacoraEntry {
    id: string;
    category: 'trabajo' | 'sueno' | 'comida' | 'ejercicio';
    horaInicio: string;
    horaFin?: string;
    titulo: string;
    subtitulo: string;
    detalle?: string;
    badges: { text: string; color: string }[];
    original: any;
  }

  const bitacoraEntries: BitacoraEntry[] = [
    ...sesiones.map((s) => ({
      id: s.id,
      category: 'trabajo' as const,
      horaInicio: s.hora_inicio || '00:00',
      horaFin: s.hora_fin,
      titulo: s.tipo,
      subtitulo: `${parseFloat(String(s.horas_netas)).toFixed(2)}h de Foco`,
      detalle: s.calidad,
      badges: [
        { text: `Intensidad: ${s.intensidad}`, color: 'bg-[#1e3a8a] text-zinc-300 border-[#eed59b]/30' },
        {
          text: `Incomodidad: ${s.incomodidad}`,
          color: s.incomodidad === 'Alta' ? 'bg-[#78350f] text-[#fde68a] border-[#f59e0b]/50 shadow-sm' : 'bg-[#101010] text-[#eed59b] border-[#eed59b]/30',
        },
      ],
      original: s,
    })),
    ...suenos.map((s) => ({
      id: s.id,
      category: 'sueno' as const,
      horaInicio: s.hora_inicio,
      horaFin: s.hora_fin,
      titulo: `🌙 Sueño / Descanso`,
      subtitulo: `${parseFloat(String(s.horas)).toFixed(1)}h dormidas (${s.calidad_sueno})`,
      detalle: s.notas || undefined,
      badges: [
        { text: `Calidad: ${s.calidad_sueno}`, color: 'bg-[#4338ca] text-[#c7d2fe] border-[#818cf8]/40' },
        ...(s.sensacion ? [{ text: `Despertar: ${s.sensacion}`, color: 'bg-[#312e81] text-[#e0e7ff] border-[#6366f1]/30' }] : []),
      ],
      original: s,
    })),
    ...comidas.map((c) => ({
      id: c.id,
      category: 'comida' as const,
      horaInicio: c.hora,
      titulo: `🥗 ${c.tipo_comida}`,
      subtitulo: `Hora: ${c.hora}`,
      detalle: c.descripcion,
      badges: [
        {
          text: c.calidad,
          color: c.calidad.includes('Limpio')
            ? 'bg-[#064e3b] text-[#a7f3d0] border-[#10b981]/40'
            : c.calidad.includes('Moderado')
            ? 'bg-[#065f46] text-[#6ee7b7] border-[#059669]/30'
            : 'bg-[#7f1d1d] text-[#fecaca] border-[#ef4444]/40',
        },
      ],
      original: c,
    })),
    ...ejercicios.map((e) => ({
      id: e.id,
      category: 'ejercicio' as const,
      horaInicio: e.hora_inicio,
      horaFin: e.hora_fin,
      titulo: `🏃 ${e.tipo_ejercicio}`,
      subtitulo: `${parseFloat(String(e.duracion_horas)).toFixed(2)}h de Entrenamiento`,
      detalle: e.descripcion || undefined,
      badges: [
        { text: `Intensidad: ${e.intensidad}`, color: 'bg-[#7c2d12] text-[#fed7aa] border-[#f97316]/40' },
      ],
      original: e,
    })),
  ].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  const filteredEntries = bitacoraEntries.filter((item) => {
    if (filterBitacora === 'todo') return true;
    return item.category === filterBitacora;
  });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Columna Izquierda (col-span-5): Panel de Registro Especializado */}
      <div className="lg:col-span-5 min-w-0 card-midnight p-5 sm:p-6 border border-white/10 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#141414] text-zinc-300 border border-[#eed59b]/30 font-medium">
              Bitácora Diaria
            </span>
            <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
              Registrar Actividad
            </h3>
          </div>

          {feedbackMsg && (
            <span className="tag-formal text-xs bg-[#eed59b] text-[#070e1e] px-3 py-0.5 rounded-full font-semibold animate-fade-in shadow-sm">
              ✓ {feedbackMsg}
            </span>
          )}
        </div>

        {/* PESTAÑAS DE CATEGORÍA: Trabajo | Sueño | Alimentación | Ejercicio */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#080808] border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('trabajo')}
            className={`py-2 px-1 rounded-xl font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'trabajo'
                ? 'bg-[#2563eb] text-white shadow-midnight'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <span>🧠</span>
            <span className="text-[11px]">Trabajo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sueno')}
            className={`py-2 px-1 rounded-xl font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'sueno'
                ? 'bg-[#6366f1] text-white shadow-midnight'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <span>🌙</span>
            <span className="text-[11px]">Sueño</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('comida')}
            className={`py-2 px-1 rounded-xl font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'comida'
                ? 'bg-[#059669] text-white shadow-midnight'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <span>🥗</span>
            <span className="text-[11px]">Comida</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ejercicio')}
            className={`py-2 px-1 rounded-xl font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'ejercicio'
                ? 'bg-[#d97706] text-white shadow-midnight'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <span>🏃</span>
            <span className="text-[11px]">Ejercicio</span>
          </button>
        </div>

        {/* -------------------------------------------------------------
            FORMULARIO 1: TRABAJO PROFUNDO
            ------------------------------------------------------------- */}
        {activeTab === 'trabajo' && (
          <form onSubmit={submitTrabajo} className="space-y-4 animate-fade-in">
            {/* Vinculación Directa con Tareas Planificadas de Hoy */}
            {tareas && tareas.length > 0 && (
              <div className="p-3 rounded-2xl bg-[#080808] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-serif font-bold text-white flex items-center gap-1.5">
                    <span>🎯</span> Tomar Tarea Planificada de Hoy
                  </span>
                  {selectedTareaId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTareaId(null);
                        setIsCustomTipo(false);
                        setTipoSeleccionado('Desarrollo');
                      }}
                      className="text-[10px] text-[#eed59b] hover:underline"
                    >
                      ✕ Desvincular
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-0.5">
                  {tareas.map((t) => {
                    const isSelected = selectedTareaId === t.id;
                    const isDone = t.estado === 'hecho';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTareaPlanificada(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs text-left transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-[#eed59b] text-black font-semibold border-[#eed59b] shadow-md'
                            : isDone
                            ? 'bg-[#101010]/60 text-zinc-500 border-white/5 line-through opacity-70'
                            : 'bg-[#121212] text-zinc-200 hover:text-white border-white/10 hover:border-[#eed59b]/40'
                        }`}
                        title={isDone ? 'Tarea ya cumplida (puedes volver a seleccionarla)' : 'Seleccionar para prellenar y cumplir automáticamente'}
                      >
                        <span className="text-[10px]">{isDone ? '✓' : '○'}</span>
                        <span className="truncate max-w-[190px]">{t.descripcion}</span>
                        {t.hora_inicio && t.hora_inicio !== '00:00' && (
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-black/80 font-bold' : 'text-[#eed59b]'}`}>
                            {t.hora_inicio}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedTareaId && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#eed59b] bg-[#141414] px-2.5 py-1.5 rounded-xl border border-[#eed59b]/25">
                    <span>✓</span>
                    <span>Vinculada: al registrar este bloque, la tarea se marcará automáticamente como cumplida en el checklist y en el panel.</span>
                  </div>
                )}
              </div>
            )}

            {/* Presets de Tipo */}
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                Tipo de Foco / Estudio
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {PRESETS_TRABAJO.map((item) => {
                  const isActive = !isCustomTipo && tipoSeleccionado === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setIsCustomTipo(false);
                        setTipoSeleccionado(item.label);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 transition-all ${
                        isActive
                          ? 'bg-[#2563eb] text-white font-medium shadow-sm'
                          : 'bg-[#101010] text-[#94a3b8] hover:text-white border border-white/10'
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
                  className={`px-2.5 py-1 rounded-xl text-xs transition-all ${
                    isCustomTipo
                      ? 'bg-[#2563eb] text-white'
                      : 'bg-[#101010] text-[#94a3b8] hover:text-white border border-white/10'
                  }`}
                >
                  + Otro
                </button>
              </div>
              {isCustomTipo && (
                <input
                  type="text"
                  placeholder="Especificar nombre..."
                  value={customTipo}
                  onChange={(e) => setCustomTipo(e.target.value)}
                  className="w-full mt-2 px-3 py-1.5 rounded-xl text-xs bg-[#000000] border border-white/15 text-white"
                  autoFocus
                />
              )}
            </div>

            {/* Horario de Trabajo */}
            <div className="p-3 rounded-2xl bg-[#080808] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#eed59b] font-medium">🕒 Horario de Trabajo</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[#94a3b8]">{horasNetas.toFixed(2)}h netas</span>
                  <button
                    type="button"
                    onClick={() => handleHorasNetasChange(horasNetas + 0.5)}
                    className="btn-formal-outline px-2 py-0.5 rounded text-[10px]"
                    title="Sumar 30m"
                  >
                    +30m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHorasNetasChange(horasNetas + 1.0)}
                    className="btn-formal-outline px-2 py-0.5 rounded text-[10px]"
                    title="Sumar 1h"
                  >
                    +1h
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#94a3b8] mb-0.5">Inicio</label>
                  <input
                    type="time"
                    value={horaInicioTrabajo}
                    onChange={(e) => handleHoraInicioTrabajo(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#101010] border border-white/15 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#94a3b8] mb-0.5">Fin</label>
                  <input
                    type="time"
                    value={horaFinTrabajo}
                    onChange={(e) => handleHoraFinTrabajo(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#101010] border border-white/15 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Intensidad e Incomodidad */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1">Intensidad</label>
                <div className="flex rounded-xl bg-[#080808] p-1 border border-white/10 text-xs">
                  {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIntensidad(level)}
                      className={`flex-1 py-1 rounded-lg ${
                        intensidad === level ? 'bg-[#2563eb] text-white font-medium' : 'text-[#94a3b8]'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                  Incomodidad <span className="text-[#eed59b] text-[10px]">(Fricción)</span>
                </label>
                <div className="flex rounded-xl bg-[#080808] p-1 border border-white/10 text-xs">
                  {(['Baja', 'Media', 'Alta'] as Incomodidad[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIncomodidad(level)}
                      className={`flex-1 py-1 rounded-lg ${
                        incomodidad === level
                          ? level === 'Alta'
                            ? 'bg-[#78350f] text-[#fde68a] font-semibold border border-[#f59e0b]/50'
                            : 'bg-[#1e3a8a] text-white'
                          : 'text-[#94a3b8]'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Entregable */}
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                Entregable / Resultado Concreto
              </label>
              <input
                type="text"
                placeholder="Ej: Análisis capítulo 3, módulo de pagos implementado..."
                value={calidad}
                onChange={(e) => setCalidad(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[#080808] border border-white/15 text-white placeholder-[#94a3b8]/40"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-formal py-2.5 rounded-full text-xs font-semibold"
            >
              <span>{submitting ? 'Guardando...' : 'Registrar Sesión de Foco'}</span>
            </button>
          </form>
        )}

        {/* -------------------------------------------------------------
            FORMULARIO 2: SUEÑO Y DESCANSO
            ------------------------------------------------------------- */}
        {activeTab === 'sueno' && (
          <form onSubmit={submitSueno} className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-[#080808] border border-[#6366f1]/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c7d2fe] font-medium flex items-center gap-1.5">
                  <span>🌙</span> Ciclo de Sueño
                </span>
                <span className="font-mono text-[#a5b4fc]">{horasSueno.toFixed(1)} horas</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#94a3b8] mb-1">Hora de Acostarse</label>
                  <input
                    type="time"
                    value={horaDormir}
                    onChange={(e) => handleHoraDormir(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#101010] border border-[#6366f1]/30 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94a3b8] mb-1">Hora de Despertar</label>
                  <input
                    type="time"
                    value={horaDespertar}
                    onChange={(e) => handleHoraDespertar(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#101010] border border-[#6366f1]/30 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                  Calidad del Sueño
                </label>
                <select
                  value={calidadSueno}
                  onChange={(e) => setCalidadSueno(e.target.value as CalidadSueno)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#080808] border border-[#6366f1]/30 text-white"
                >
                  <option value="Profundo">Profundo</option>
                  <option value="Reparador">Reparador</option>
                  <option value="Ligero">Ligero</option>
                  <option value="Interrumpido">Interrumpido</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                  Sensación al Despertar
                </label>
                <select
                  value={sensacionSueno}
                  onChange={(e) => setSensacionSueno(e.target.value as SensacionSueno)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#080808] border border-[#6366f1]/30 text-white"
                >
                  <option value="Energizado">Energizado</option>
                  <option value="Descansado">Descansado</option>
                  <option value="Neutro">Neutro</option>
                  <option value="Cansado">Cansado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                Notas del Descanso <span className="text-[#94a3b8]/60">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Apagué pantallas 1h antes, desperté a las 4am..."
                value={notasSueno}
                onChange={(e) => setNotasSueno(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[#080808] border border-[#6366f1]/30 text-white placeholder-[#94a3b8]/40"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#4f46e5] to-[#6366f1] hover:brightness-110 shadow-midnight transition-all"
            >
              {submitting ? 'Guardando...' : 'Registrar Período de Sueño'}
            </button>
          </form>
        )}

        {/* -------------------------------------------------------------
            FORMULARIO 3: ALIMENTACIÓN / COMIDA
            ------------------------------------------------------------- */}
        {activeTab === 'comida' && (
          <form onSubmit={submitComida} className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                  Momento de Ingesta
                </label>
                <select
                  value={tipoComida}
                  onChange={(e) => setTipoComida(e.target.value as TipoComida)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#080808] border border-[#10b981]/30 text-white"
                >
                  <option value="Desayuno">Desayuno</option>
                  <option value="Almuerzo">Almuerzo</option>
                  <option value="Cena">Cena</option>
                  <option value="Merienda / Snack">Merienda / Snack</option>
                  <option value="Pre-entreno">Pre-entreno</option>
                  <option value="Post-entreno">Post-entreno</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                  Hora Exacta
                </label>
                <input
                  type="time"
                  value={horaComida}
                  onChange={(e) => setHoraComida(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#101010] border border-[#10b981]/30 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                ¿Qué comiste? <span className="text-[#a7f3d0] font-normal">(Detalle)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ej: 3 huevos revueltos, 80g de avena con manzana, café negro..."
                value={descripcionComida}
                onChange={(e) => setDescripcionComida(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[#080808] border border-[#10b981]/30 text-white placeholder-[#94a3b8]/40 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                Calidad Nutricional
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                {(['Limpio / Nutritivo', 'Moderado', 'Libre / Procesado'] as CalidadComida[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCalidadComida(item)}
                    className={`py-1.5 px-1 rounded-xl text-center transition-all ${
                      calidadComida === item
                        ? item.includes('Limpio')
                          ? 'bg-[#059669] text-white font-medium shadow-sm'
                          : item.includes('Moderado')
                          ? 'bg-[#047857] text-white font-medium'
                          : 'bg-[#b91c1c] text-white font-medium'
                        : 'bg-[#080808] text-[#94a3b8] border border-[#10b981]/20'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#059669] to-[#10b981] hover:brightness-110 shadow-midnight transition-all"
            >
              {submitting ? 'Guardando...' : 'Registrar Comida'}
            </button>
          </form>
        )}

        {/* -------------------------------------------------------------
            FORMULARIO 4: EJERCICIO FÍSICO
            ------------------------------------------------------------- */}
        {activeTab === 'ejercicio' && (
          <form onSubmit={submitEjercicio} className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                  Modalidad de Entrenamiento
                </label>
                <select
                  value={tipoEjercicio}
                  onChange={(e) => setTipoEjercicio(e.target.value as TipoEjercicio)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#080808] border border-[#f59e0b]/30 text-white"
                >
                  {PRESETS_EJERCICIO.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                  Intensidad Física
                </label>
                <div className="flex rounded-xl bg-[#080808] p-1 border border-[#f59e0b]/20 text-xs">
                  {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setIntensidadEjercicio(level)}
                      className={`flex-1 py-1 rounded-lg ${
                        intensidadEjercicio === level
                          ? 'bg-[#d97706] text-white font-semibold shadow-sm'
                          : 'text-[#94a3b8]'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Horario de Ejercicio */}
            <div className="p-3 rounded-2xl bg-[#080808] border border-[#f59e0b]/20 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#fbbf24] font-medium">🕒 Horario de Entrenamiento</span>
                <span className="font-mono text-[#94a3b8]">{duracionEjercicio.toFixed(2)}h</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#94a3b8] mb-0.5">Inicio</label>
                  <input
                    type="time"
                    value={horaInicioEjercicio}
                    onChange={(e) => handleHoraInicioEjercicio(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#101010] border border-[#f59e0b]/30 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#94a3b8] mb-0.5">Fin</label>
                  <input
                    type="time"
                    value={horaFinEjercicio}
                    onChange={(e) => handleHoraFinEjercicio(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#101010] border border-[#f59e0b]/30 text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                ¿Qué ejercicios hiciste? <span className="text-[#fed7aa] font-normal">(Series, reps, peso)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Dominadas 4x10, Fondos 4x15, Sentadillas búlgaras 3x12 por pierna..."
                value={descripcionEjercicio}
                onChange={(e) => setDescripcionEjercicio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[#080808] border border-[#f59e0b]/30 text-white placeholder-[#94a3b8]/40 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:brightness-110 shadow-midnight transition-all"
            >
              {submitting ? 'Guardando...' : 'Registrar Entrenamiento Físico'}
            </button>
          </form>
        )}
      </div>

      {/* Columna Derecha (col-span-7): Bitácora Cronológica Completa */}
      <div className="lg:col-span-7 min-w-0 card-midnight p-5 sm:p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#141414] text-zinc-300 border border-[#eed59b]/30 font-medium">
              Cronograma de Hoy
            </span>
            <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
              Bitácora Integral del Día
            </h3>
          </div>

          {/* Filtros de la bitácora */}
          <div className="flex items-center gap-1 text-[11px] bg-[#080808] p-1 rounded-xl border border-white/10 flex-wrap">
            {(['todo', 'trabajo', 'sueno', 'comida', 'ejercicio'] as FilterBitacora[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterBitacora(f)}
                className={`px-2 py-0.5 rounded-lg capitalize transition-all ${
                  filterBitacora === f
                    ? 'bg-[#2563eb] text-white font-medium'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                {f === 'todo' ? 'Todos' : f}
              </button>
            ))}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-white/10 bg-[#080808]/60">
            <p className="text-sm font-serif font-bold text-white">Sin actividades en este filtro</p>
            <p className="text-xs text-[#94a3b8] mt-1">
              Registra bloques de trabajo, horas de sueño, comidas o entrenamientos para ver tu día completo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((item) => {
              const isEditing = editingItem?.id === item.id;

              // Render Modo Edición
              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-[#080808] border border-[#eed59b]/50 shadow-midnight space-y-3 animate-fade-in text-xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="font-serif font-bold text-[#eed59b]">
                        Editar {item.category.toUpperCase()}
                      </span>
                      <span className="text-[#94a3b8] font-mono">{item.horaInicio}</span>
                    </div>

                    {/* Formulario Dinámico de Edición según Categoría */}
                    {item.category === 'trabajo' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#94a3b8]">Inicio</label>
                            <input
                              type="time"
                              value={editingItem.data.hora_inicio || '09:00'}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  data: { ...editingItem.data, hora_inicio: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1 rounded-lg bg-[#101010] border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#94a3b8]">Fin</label>
                            <input
                              type="time"
                              value={editingItem.data.hora_fin || '11:00'}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  data: { ...editingItem.data, hora_fin: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1 rounded-lg bg-[#101010] border border-white/15 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#94a3b8]">Entregable</label>
                          <input
                            type="text"
                            value={editingItem.data.calidad || ''}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                data: { ...editingItem.data, calidad: e.target.value },
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#101010] border border-white/15 text-white"
                          />
                        </div>
                      </div>
                    )}

                    {item.category === 'sueno' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#94a3b8]">Dormir</label>
                            <input
                              type="time"
                              value={editingItem.data.hora_inicio || '23:00'}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  data: { ...editingItem.data, hora_inicio: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1 rounded-lg bg-[#101010] border border-[#6366f1]/30 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#94a3b8]">Despertar</label>
                            <input
                              type="time"
                              value={editingItem.data.hora_fin || '07:00'}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  data: { ...editingItem.data, hora_fin: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1 rounded-lg bg-[#101010] border border-[#6366f1]/30 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#94a3b8]">Calidad</label>
                          <select
                            value={editingItem.data.calidad_sueno || 'Reparador'}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                data: { ...editingItem.data, calidad_sueno: e.target.value },
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-[#101010] border border-[#6366f1]/30 text-white text-xs"
                          >
                            <option value="Profundo">Profundo</option>
                            <option value="Reparador">Reparador</option>
                            <option value="Ligero">Ligero</option>
                            <option value="Interrumpido">Interrumpido</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {item.category === 'comida' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#94a3b8]">Hora</label>
                            <input
                              type="time"
                              value={editingItem.data.hora || '13:00'}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  data: { ...editingItem.data, hora: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1 rounded-lg bg-[#101010] border border-[#10b981]/30 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#94a3b8]">Tipo</label>
                            <select
                              value={editingItem.data.tipo_comida || 'Almuerzo'}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  data: { ...editingItem.data, tipo_comida: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1 rounded-lg bg-[#101010] border border-[#10b981]/30 text-white"
                            >
                              <option value="Desayuno">Desayuno</option>
                              <option value="Almuerzo">Almuerzo</option>
                              <option value="Cena">Cena</option>
                              <option value="Merienda / Snack">Merienda / Snack</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#94a3b8]">Descripción</label>
                          <input
                            type="text"
                            value={editingItem.data.descripcion || ''}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                data: { ...editingItem.data, descripcion: e.target.value },
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#101010] border border-[#10b981]/30 text-white"
                          />
                        </div>
                      </div>
                    )}

                    {item.category === 'ejercicio' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#94a3b8]">Inicio</label>
                            <input
                              type="time"
                              value={editingItem.data.hora_inicio || '17:00'}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  data: { ...editingItem.data, hora_inicio: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1 rounded-lg bg-[#101010] border border-[#f59e0b]/30 text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#94a3b8]">Fin</label>
                            <input
                              type="time"
                              value={editingItem.data.hora_fin || '18:00'}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  data: { ...editingItem.data, hora_fin: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1 rounded-lg bg-[#101010] border border-[#f59e0b]/30 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#94a3b8]">Ejercicios Realizados</label>
                          <input
                            type="text"
                            value={editingItem.data.descripcion || ''}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                data: { ...editingItem.data, descripcion: e.target.value },
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#101010] border border-[#f59e0b]/30 text-white"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="btn-formal-outline px-3 py-1 rounded-full text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={handleSaveEdit}
                        className="btn-formal px-4 py-1 rounded-full text-xs font-semibold"
                      >
                        {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                    </div>
                  </div>
                );
              }

              // Estilo de tarjeta según Categoría
              const cardBorder =
                item.category === 'trabajo'
                  ? 'border-white/15 hover:border-white/10/60'
                  : item.category === 'sueno'
                  ? 'border-[#818cf8]/40 hover:border-[#818cf8]/70 bg-[#080808]/90'
                  : item.category === 'comida'
                  ? 'border-[#10b981]/40 hover:border-[#10b981]/70 bg-[#080808]/90'
                  : 'border-[#f59e0b]/40 hover:border-[#f59e0b]/70 bg-[#080808]/90';

              const timeRangeStr = item.horaFin
                ? `${item.horaInicio} — ${item.horaFin}`
                : item.horaInicio;

              return (
                <div
                  key={`${item.category}-${item.id}`}
                  className={`p-4 rounded-2xl bg-[#080808]/80 border ${cardBorder} transition-all space-y-2.5`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif font-bold text-white text-base">
                        {item.titulo}
                      </span>
                      <span className="tag-formal text-[11px] px-2.5 py-0.5 rounded-full bg-[#101010] text-zinc-300 border border-white/15 font-mono">
                        🕒 {timeRangeStr}
                      </span>
                      <span className="text-xs text-[#eed59b] font-medium">
                        {item.subtitulo}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingItem({
                            id: item.id,
                            category: item.category,
                            data: { ...item.original },
                          })
                        }
                        className="p-1 rounded-lg text-[#94a3b8] hover:text-[#eed59b] hover:bg-[#101010] transition-colors"
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.category, item.id)}
                        disabled={deletingId === item.id}
                        className="p-1 rounded-lg text-[#94a3b8] hover:text-rose-400 hover:bg-[#101010] transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Badges distintivas */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    {item.badges.map((b, bIdx) => (
                      <span
                        key={bIdx}
                        className={`tag-formal px-2.5 py-0.5 rounded-full border ${b.color}`}
                      >
                        {b.text}
                      </span>
                    ))}
                  </div>

                  {/* Detalle / Comentarios */}
                  {item.detalle && (
                    <p className="text-xs text-[#94a3b8] italic bg-[#101010]/60 p-2.5 rounded-xl border-l-2 border-[#eed59b] font-serif">
                      &ldquo;{item.detalle}&rdquo;
                    </p>
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

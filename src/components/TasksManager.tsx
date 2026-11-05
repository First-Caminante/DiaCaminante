import React, { useState, useEffect } from 'react';
import type { TareaPlanificada, TipoTrabajo, EstadoTarea } from '../types/database';

interface TasksManagerProps {
  fechaHoy: string;
  tareasHoy: TareaPlanificada[];
  onTaskCreated: (nuevasTareas: TareaPlanificada[]) => void;
  onTaskUpdated: (tarea: TareaPlanificada) => void;
  onTaskDeleted: (id: string) => void;
  onRefresh?: () => void;
}

export const TasksManager: React.FC<TasksManagerProps> = ({
  fechaHoy,
  tareasHoy,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
  onRefresh,
}) => {
  // Pestaña de visualización de tareas: 'hoy' o 'manana'
  const [activeTabDate, setActiveTabDate] = useState<'hoy' | 'manana'>('hoy');
  // Filtro de estado: 'todas', 'por_cumplir' o 'cumplidas'
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'por_cumplir' | 'cumplidas'>('todas');

  // Cálculo de la fecha de mañana (YYYY-MM-DD)
  const fechaManana = (() => {
    try {
      const [y, m, d] = (fechaHoy || new Date().toISOString().slice(0, 10)).split('-').map(Number);
      const cur = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      cur.setUTCDate(cur.getUTCDate() + 1);
      return cur.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  })();

  // Tareas de mañana cargadas independientemente
  const [tareasManana, setTareasManana] = useState<TareaPlanificada[]>([]);
  const [loadingManana, setLoadingManana] = useState<boolean>(false);

  // Estados de formularios y modales
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [createMode, setCreateMode] = useState<'individual' | 'markdown'>('individual');
  const [submittingTask, setSubmittingTask] = useState<boolean>(false);

  // Campos para crear tarea individual
  const [newDesc, setNewDesc] = useState<string>('');
  const [newHoraInicio, setNewHoraInicio] = useState<string>('09:00');
  const [newHoraFin, setNewHoraFin] = useState<string>('10:30');
  const [newTipo, setNewTipo] = useState<TipoTrabajo>('PROFUNDO');
  const [newHorasEstimadas, setNewHorasEstimadas] = useState<number>(1.5);
  const [newTargetFecha, setNewTargetFecha] = useState<'hoy' | 'manana'>('hoy');
  const [newIsFlexible, setNewIsFlexible] = useState<boolean>(true);

  // Estado para modal de asignación retrospectiva de horario
  const [timeModalTask, setTimeModalTask] = useState<TareaPlanificada | null>(null);
  const [timeModalIni, setTimeModalIni] = useState<string>('09:00');
  const [timeModalFin, setTimeModalFin] = useState<string>('10:30');
  const [timeModalCompletada, setTimeModalCompletada] = useState<string>('');
  const [savingTimeModal, setSavingTimeModal] = useState<boolean>(false);

  // Campos para crear por bloque Markdown
  const [markdownBlock, setMarkdownBlock] = useState<string>(
    `- [ ] [09:00 - 11:00] [PROFUNDO] Tarea clave de la mañana (2h netas)\n- [ ] [11:15 - 12:45] [PROFUNDO] Segunda sesión profunda (1.5h netas)\n- [ ] [15:00 - 15:30] [SUPERFICIAL] Organización y respuestas`
  );

  // Estado para editar tarea
  const [editingTask, setEditingTask] = useState<TareaPlanificada | null>(null);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Estado de eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estado para capturar motivo de desvío rápido
  const [desvioPromptTaskId, setDesvioPromptTaskId] = useState<string | null>(null);
  const [desvioText, setDesvioText] = useState<string>('');

  // Notificación local de feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Cargar tareas de mañana
  const fetchTareasManana = async () => {
    if (!fechaManana) return;
    try {
      setLoadingManana(true);
      const res = await fetch(`/api/tareas?fecha=${fechaManana}`);
      if (!res.ok) throw new Error('Error al cargar tareas de mañana');
      const data = await res.json();
      setTareasManana(data.tareas || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingManana(false);
    }
  };

  useEffect(() => {
    if (activeTabDate === 'manana') {
      fetchTareasManana();
    }
  }, [activeTabDate, fechaManana]);

  // Selección de lista según pestaña activa
  const currentList = activeTabDate === 'hoy' ? tareasHoy : tareasManana;
  const targetDateForActions = activeTabDate === 'hoy' ? fechaHoy : fechaManana;

  // Estadísticas del listado activo
  const totalTasks = currentList.length;
  const hechasList = currentList.filter((t) => t.estado === 'hecho');
  const porCumplirList = currentList.filter(
    (t) => t.estado === 'pendiente' || t.estado === 'incompleto' || t.estado === 'no_hecho'
  );
  const hechas = hechasList.length;
  const pendientes = currentList.filter((t) => t.estado === 'pendiente').length;
  const incompletas = currentList.filter((t) => t.estado === 'incompleto' || t.estado === 'no_hecho').length;
  const pctCumplimiento = totalTasks > 0 ? Math.round((hechas / totalTasks) * 100) : 0;

  // Formato formal de fecha
  const formatFriendlyDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return dt.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  // Recalcular horas estimadas automáticamente al cambiar horarios
  const handleHorasChange = (ini: string, fin: string) => {
    setNewHoraInicio(ini);
    setNewHoraFin(fin);
    try {
      const [h1, m1] = ini.split(':').map(Number);
      const [h2, m2] = fin.split(':').map(Number);
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      const hours = Math.round((diff / 60) * 10) / 10;
      if (hours > 0) setNewHorasEstimadas(hours);
    } catch {
      // Ignorar
    }
  };

  // 1. Crear Tarea (Individual o Markdown)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingTask(true);
      const targetFechaReal = newTargetFecha === 'hoy' ? fechaHoy : fechaManana;

      const payload = createMode === 'individual'
        ? {
            fecha_objetivo: targetFechaReal,
            descripcion: newDesc.trim(),
            hora_inicio: newIsFlexible ? '00:00' : newHoraInicio,
            hora_fin: newIsFlexible ? '00:01' : newHoraFin,
            sin_hora: newIsFlexible,
            tipo_trabajo: newTipo,
            horas_netas_estimadas: newIsFlexible ? 1.0 : newHorasEstimadas,
          }
        : {
            fecha_objetivo: targetFechaReal,
            planificacion_markdown: markdownBlock,
          };

      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al crear tarea');
      }

      const resData = await res.json();
      const creadas: TareaPlanificada[] = resData.tareas || [];

      if (newTargetFecha === 'hoy') {
        onTaskCreated(creadas);
      } else {
        setTareasManana((prev) => [...prev, ...creadas]);
      }

      setIsCreateOpen(false);
      setNewDesc('');
      showNotification(`✓ ${creadas.length} tarea(s) programada(s) con éxito`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al guardar la tarea');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Apertura y guardado de modal para horario retrospectivo
  const openTimeModal = (task: TareaPlanificada) => {
    setTimeModalTask(task);
    const now = new Date();
    const currentH = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const [h, m] = currentH.split(':').map(Number);
    const startH = `${String(Math.max(0, h - 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    
    const isFlexible = !task.hora_inicio || !task.hora_fin || (task.hora_inicio === '00:00' && task.hora_fin === '00:01');
    setTimeModalIni(!isFlexible && task.hora_inicio && task.hora_inicio !== '00:00' ? task.hora_inicio : startH);
    setTimeModalFin(!isFlexible && task.hora_fin && task.hora_fin !== '00:01' ? task.hora_fin : currentH);
    setTimeModalCompletada(task.hora_completada || currentH);
  };

  const handleSaveTimeModal = async (markAsDone: boolean) => {
    if (!timeModalTask) return;
    try {
      setSavingTimeModal(true);
      const [h1, m1] = timeModalIni.split(':').map(Number);
      const [h2, m2] = timeModalFin.split(':').map(Number);
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      const hoursEst = Math.max(0.5, Math.round((diff / 60) * 10) / 10);

      const payload: Record<string, any> = {
        hora_inicio: timeModalIni,
        hora_fin: timeModalFin,
        horas_netas_estimadas: hoursEst,
        hora_completada: timeModalCompletada || timeModalFin,
      };
      if (markAsDone) {
        payload.estado = 'hecho';
      }

      const res = await fetch(`/api/tareas/${timeModalTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al registrar horario');
      const data = await res.json();
      const actualizada: TareaPlanificada = data.tarea;

      if (actualizada.fecha_objetivo === fechaHoy) {
        onTaskUpdated(actualizada);
      } else {
        setTareasManana((prev) => prev.map((t) => (t.id === timeModalTask.id ? actualizada : t)));
      }

      setTimeModalTask(null);
      showNotification(markAsDone ? '✓ Tarea cumplida con horario asignado' : '✓ Horario asignado a la tarea');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'No se pudo guardar el horario');
    } finally {
      setSavingTimeModal(false);
    }
  };

  // 2. Alternar Estado Rápido de Tarea (Checkbox)
  const handleToggleStatus = async (tarea: TareaPlanificada) => {
    // Si la tarea está pendiente y es de horario flexible sin hora completada, dar la opción de registrar la hora
    const isFlexible = !tarea.hora_inicio || !tarea.hora_fin || (tarea.hora_inicio === '00:00' && tarea.hora_fin === '00:01');
    if (tarea.estado === 'pendiente' && isFlexible && !tarea.hora_completada) {
      openTimeModal(tarea);
      return;
    }

    // Ciclo: pendiente -> hecho -> incompleto -> pendiente
    let nextStatus: EstadoTarea = 'hecho';
    if (tarea.estado === 'pendiente') nextStatus = 'hecho';
    else if (tarea.estado === 'hecho') nextStatus = 'incompleto';
    else nextStatus = 'pendiente';

    // Si pasa a incompleto, abrir prompt de desvío
    if (nextStatus === 'incompleto') {
      setDesvioPromptTaskId(tarea.id);
      setDesvioText(tarea.motivo_desvio || '');
      return;
    }

    await executeStatusUpdate(tarea.id, nextStatus, null);
  };

  const executeStatusUpdate = async (
    tareaId: string,
    estado: EstadoTarea,
    motivo: string | null
  ) => {
    try {
      const res = await fetch(`/api/tareas/${tareaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado,
          motivo_desvio: motivo,
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar estado de tarea');
      const data = await res.json();
      const actualizada: TareaPlanificada = data.tarea;

      if (actualizada.fecha_objetivo === fechaHoy) {
        onTaskUpdated(actualizada);
      } else {
        setTareasManana((prev) => prev.map((t) => (t.id === tareaId ? actualizada : t)));
      }
    } catch (err) {
      console.error(err);
      alert('No se pudo actualizar la tarea');
    }
  };

  // Confirmar motivo de desvío
  const handleConfirmDesvio = async (tareaId: string) => {
    await executeStatusUpdate(tareaId, 'incompleto', desvioText.trim() || 'Desvío de agenda');
    setDesvioPromptTaskId(null);
    setDesvioText('');
  };

  // 3. Guardar Edición Completa
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      setSavingEdit(true);
      const res = await fetch(`/api/tareas/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: editingTask.descripcion,
          hora_inicio: editingTask.hora_inicio,
          hora_fin: editingTask.hora_fin,
          tipo_trabajo: editingTask.tipo_trabajo,
          horas_netas_estimadas: editingTask.horas_netas_estimadas,
          estado: editingTask.estado,
          motivo_desvio: editingTask.motivo_desvio,
          fecha_objetivo: editingTask.fecha_objetivo,
        }),
      });

      if (!res.ok) throw new Error('Error al editar tarea');
      const data = await res.json();
      const actualizada: TareaPlanificada = data.tarea;

      if (actualizada.fecha_objetivo === fechaHoy) {
        onTaskUpdated(actualizada);
      } else {
        setTareasManana((prev) => prev.map((t) => (t.id === editingTask.id ? actualizada : t)));
      }

      setEditingTask(null);
      showNotification('✓ Tarea actualizada correctamente');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al actualizar tarea');
    } finally {
      setSavingEdit(false);
    }
  };

  // 4. Eliminar Tarea
  const handleDeleteTask = async (id: string, targetFecha: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea planificada?')) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/tareas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar tarea');

      if (targetFecha === fechaHoy) {
        onTaskDeleted(id);
      } else {
        setTareasManana((prev) => prev.filter((t) => t.id !== id));
      }

      showNotification('Tarea eliminada');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const renderTaskRow = (tarea: TareaPlanificada) => {
    const isHecho = tarea.estado === 'hecho';
    const isIncompleto = tarea.estado === 'incompleto';
    const isNoHecho = tarea.estado === 'no_hecho';
    const isProfundo = tarea.tipo_trabajo === 'PROFUNDO';

    return (
      <div
        key={tarea.id}
        className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isHecho
            ? 'bg-[#06241a]/50 border-[#10b981]/40'
            : isIncompleto || isNoHecho
            ? 'bg-[#261506]/50 border-[#f59e0b]/40'
            : 'bg-[#081229]/80 border-[#5b9bd5]/20 hover:border-[#60a5fa]/40'
        }`}
      >
        {/* Izquierda: Checkbox y Detalle de la Tarea */}
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          {/* Botón Checkbox Interactivo */}
          <button
            type="button"
            onClick={() => handleToggleStatus(tarea)}
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all border ${
              isHecho
                ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : isIncompleto
                ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : isNoHecho
                ? 'bg-rose-500 border-rose-400 text-white'
                : 'bg-[#0d1a3d] border-[#5b9bd5]/40 text-transparent hover:border-white'
            }`}
            title={
              isHecho
                ? 'Completada (Clic para cambiar)'
                : isIncompleto
                ? 'Incompleta (Clic para cambiar)'
                : 'Pendiente (Clic para marcar hecha)'
            }
          >
            {isHecho && <span className="font-bold text-xs">✓</span>}
            {isIncompleto && <span className="font-bold text-xs">~</span>}
            {isNoHecho && <span className="font-bold text-xs">✗</span>}
          </button>

          {/* Texto y Badges */}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Franja horaria */}
              {(!tarea.hora_inicio || !tarea.hora_fin || (tarea.hora_inicio === '00:00' && tarea.hora_fin === '00:01')) ? (
                <span className="font-mono text-[11px] font-semibold text-[#c084fc] bg-[#1a102f] px-2 py-0.5 rounded border border-[#a855f7]/30 flex items-center gap-1">
                  <span>⏱️</span>
                  <span>{tarea.hora_completada ? `Realizada: ${tarea.hora_completada}` : 'Horario Flexible'}</span>
                </span>
              ) : (
                <span className="font-mono text-[11px] font-semibold text-[#eed59b] bg-[#0d1733] px-2 py-0.5 rounded border border-[#5b9bd5]/25">
                  {tarea.hora_inicio} — {tarea.hora_fin}
                </span>
              )}

              {/* Tipo de trabajo */}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isProfundo
                    ? 'bg-[#1e3a8a]/70 text-[#93c5fd] border border-[#60a5fa]/40'
                    : 'bg-[#334155]/60 text-[#cbd5e1] border border-slate-600/40'
                }`}
              >
                {isProfundo ? '🧠 PROFUNDO' : '⚡ SUPERFICIAL'}
              </span>

              {/* Horas estimadas */}
              <span className="text-[10px] text-[#94a3b8] font-mono">
                {tarea.horas_netas_estimadas}h netas
              </span>

              {/* Badge de Estado */}
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                  isHecho
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isIncompleto
                    ? 'bg-amber-500/20 text-amber-300'
                    : isNoHecho
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-blue-500/10 text-blue-300'
                }`}
              >
                {tarea.estado === 'hecho' ? '✓ CUMPLIDA' : tarea.estado === 'pendiente' ? '⏳ POR CUMPLIR' : tarea.estado}
              </span>
            </div>

            {/* Descripción */}
            <p
              className={`text-sm font-medium transition-all ${
                isHecho
                  ? 'line-through text-[#94a3b8]'
                  : 'text-white'
              }`}
            >
              {tarea.descripcion}
            </p>

            {/* Motivo de Desvío si existe */}
            {tarea.motivo_desvio && (
              <div className="text-[11px] text-amber-300/90 italic bg-amber-950/30 px-2 py-1 rounded border border-amber-500/20">
                Motivo desvío: {tarea.motivo_desvio}
              </div>
            )}
          </div>
        </div>

        {/* Derecha: Botones de Acción (Editar, Motivo, Eliminar) */}
        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => openTimeModal(tarea)}
            className="px-2.5 py-1.5 rounded-lg bg-[#111f3d] border border-[#38bdf8]/30 text-[#93c5fd] hover:text-white hover:border-[#38bdf8] text-xs transition-all flex items-center gap-1"
            title="Registrar o editar el horario en que se realizó esta tarea"
          >
            <span>⏱️</span>
            <span className="hidden sm:inline">
              {(!tarea.hora_inicio || (tarea.hora_inicio === '00:00' && tarea.hora_fin === '00:01')) ? 'Registrar Hora' : 'Horario'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEditingTask(tarea)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0d1a3d] border border-[#5b9bd5]/25 text-[#cbd5e1] hover:text-white hover:border-[#60a5fa] text-xs transition-all flex items-center gap-1"
            title="Editar descripción, horarios o tipo"
          >
            <span>✏️</span>
            <span className="hidden sm:inline">Editar</span>
          </button>

          <button
            type="button"
            disabled={deletingId === tarea.id}
            onClick={() => handleDeleteTask(tarea.id, tarea.fecha_objetivo)}
            className="px-2 py-1.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 text-xs transition-all disabled:opacity-50"
            title="Eliminar tarea"
          >
            <span>🗑️</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="card-midnight p-5 sm:p-7 border border-[#5b9bd5]/25 space-y-5 relative">
      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className="absolute top-4 right-4 z-30 px-3.5 py-1.5 rounded-full bg-[#064e3b] text-emerald-200 border border-[#10b981]/40 text-xs font-medium shadow-lg animate-fade-in">
          {feedbackMsg}
        </div>
      )}

      {/* Cabecera Principal y Selector de Fecha */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#5b9bd5]/15">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 font-medium">
              Plan de Vuelo
            </span>
            <span className="text-xs text-[#eed59b] font-serif font-medium">
              Metodología Cal Newport
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide flex items-center gap-2">
            <span>📋</span>
            <span>Tareas Planificadas &amp; Checklist</span>
          </h2>
          <p className="text-xs text-[#94a3b8] max-w-xl">
            Gestiona los objetivos prioritarios de la jornada. Marca tu avance en tiempo real o añade tareas si no alcanzaste a hacer el cierre anoche.
          </p>
        </div>

        {/* Botones de Acción Superior */}
        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          {/* Selector de Pestañas: Hoy vs Mañana */}
          <div className="flex items-center p-1 rounded-xl bg-[#050b18] border border-[#5b9bd5]/20 text-xs">
            <button
              type="button"
              onClick={() => setActiveTabDate('hoy')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTabDate === 'hoy'
                  ? 'bg-[#1e3a8a] text-white shadow-md border border-[#60a5fa]/50'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>☀️</span>
              <span>Hoy</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-[#93c5fd]">
                {tareasHoy.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabDate('manana')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTabDate === 'manana'
                  ? 'bg-[#4c1d95] text-white shadow-md border border-[#a78bfa]/50'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>🌙</span>
              <span>Mañana</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-[#c084fc]">
                {tareasManana.length}
              </span>
            </button>
          </div>

          {/* Botón Crear Tarea */}
          <button
            type="button"
            onClick={() => {
              setNewTargetFecha(activeTabDate);
              setIsCreateOpen(true);
            }}
            className="btn-formal px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md"
          >
            <span>+</span>
            <span>Agregar Tarea</span>
          </button>
        </div>
      </div>

      {/* KPI HUD de Cumplimiento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-[#070e1e]/80 border border-[#5b9bd5]/20 space-y-0.5">
          <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-medium">Total Programadas</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-serif font-bold text-white tabular-nums">{totalTasks}</span>
            <span className="text-[10px] text-[#94a3b8]">bloques</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#06241a]/80 border border-[#10b981]/30 space-y-0.5">
          <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-medium">Completadas</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-serif font-bold text-white tabular-nums">{hechas}</span>
            <span className="text-[10px] text-emerald-400/80">({pctCumplimiento}%)</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0b1633]/80 border border-[#3b82f6]/30 space-y-0.5">
          <span className="text-[10px] text-[#93c5fd] uppercase tracking-wider font-medium">Pendientes</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-serif font-bold text-white tabular-nums">{pendientes}</span>
            <span className="text-[10px] text-[#94a3b8]">por ejecutar</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#261506]/80 border border-[#f59e0b]/30 space-y-0.5">
          <span className="text-[10px] text-amber-300 uppercase tracking-wider font-medium">Incompletas / Desvíos</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-serif font-bold text-white tabular-nums">{incompletas}</span>
            <span className="text-[10px] text-amber-400/80">auditadas</span>
          </div>
        </div>
      </div>

      {/* Pestañas de Filtrado de Tareas: Todas / Por Cumplir / Cumplidas */}
      {totalTasks > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-[#5b9bd5]/15 flex-wrap">
          <span className="text-[11px] font-sans text-[#94a3b8] uppercase tracking-wider font-semibold mr-1">
            Visualizar:
          </span>
          <button
            type="button"
            onClick={() => setFiltroEstado('todas')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
              filtroEstado === 'todas'
                ? 'bg-[#1e3a8a] text-white border border-[#60a5fa]/50 shadow-sm'
                : 'bg-[#0d1733] text-[#94a3b8] border border-[#5b9bd5]/20 hover:text-white'
            }`}
          >
            <span>📋 Todas</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-white">
              {totalTasks}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('por_cumplir')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
              filtroEstado === 'por_cumplir'
                ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/60 shadow-sm ring-1 ring-blue-400/40'
                : 'bg-[#0d1733] text-[#93c5fd] border border-blue-500/30 hover:bg-[#1e3a8a]/40'
            }`}
          >
            <span>⏳ Por Cumplir</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-blue-900/50 text-[#93c5fd]">
              {porCumplirList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('cumplidas')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
              filtroEstado === 'cumplidas'
                ? 'bg-[#064e3b] text-emerald-100 border border-emerald-400 shadow-sm ring-1 ring-emerald-400/40'
                : 'bg-[#06241a] text-emerald-300 border border-emerald-500/30 hover:bg-[#064e3b]/40'
            }`}
          >
            <span>✅ Ya Cumplidas</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300">
              {hechasList.length}
            </span>
          </button>
        </div>
      )}

      {/* Lista de Tareas */}
      <div className="space-y-2.5 pt-1">
        {loadingManana && activeTabDate === 'manana' ? (
          <div className="p-8 text-center text-xs text-[#94a3b8] animate-pulse">
            Cargando tareas planificadas para mañana...
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-[#070e1e]/60 border border-dashed border-[#5b9bd5]/25 text-center space-y-3">
            <span className="text-3xl">📋</span>
            <div className="space-y-1">
              <p className="text-sm font-serif font-bold text-white">
                {activeTabDate === 'hoy'
                  ? 'No hay tareas registradas para hoy'
                  : 'Aún no has planificado las tareas de mañana'}
              </p>
              <p className="text-xs text-[#94a3b8] max-w-md mx-auto">
                {activeTabDate === 'hoy'
                  ? 'Si se te pasó el ritual de cierre anoche, no te preocupes: puedes definir tu plan de vuelo para hoy ahora mismo.'
                  : 'Puedes adelantar tus tareas prioritarias de mañana sin esperar a hacer el cierre nocturno.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewTargetFecha(activeTabDate);
                setIsCreateOpen(true);
              }}
              className="btn-formal px-5 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shadow-md"
            >
              <span>+</span>
              <span>{activeTabDate === 'hoy' ? 'Programar Tareas de Hoy' : 'Planificar Tareas de Mañana'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* VISTA 1: FILTRO POR CUMPLIR */}
            {filtroEstado === 'por_cumplir' && (
              porCumplirList.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#94a3b8] bg-[#070e1e]/60 rounded-xl border border-dashed border-[#5b9bd5]/20 space-y-1">
                  <p className="font-serif font-bold text-[#eed59b] text-sm">🎉 ¡Excelente! No tienes tareas pendientes</p>
                  <p>Todos los objetivos programados han sido completados con éxito.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="px-1 text-xs font-serif font-bold text-[#93c5fd] uppercase tracking-wider flex items-center gap-1.5">
                    <span>⏳</span> Tareas Que Debes Cumplir ({porCumplirList.length})
                  </div>
                  {porCumplirList.map((tarea) => renderTaskRow(tarea))}
                </div>
              )
            )}

            {/* VISTA 2: FILTRO CUMPLIDAS */}
            {filtroEstado === 'cumplidas' && (
              hechasList.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#94a3b8] bg-[#070e1e]/60 rounded-xl border border-dashed border-[#5b9bd5]/20 space-y-1">
                  <p className="font-serif font-bold text-white text-sm">Aún no hay tareas cumplidas</p>
                  <p>Ejecuta tu primer bloque de foco y márcala como completada.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="px-1 text-xs font-serif font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>✅</span> Tareas Ya Cumplidas ({hechasList.length})
                  </div>
                  {hechasList.map((tarea) => renderTaskRow(tarea))}
                </div>
              )
            )}

            {/* VISTA 3: TODAS (AGRUPACIÓN CLARA) */}
            {filtroEstado === 'todas' && (
              <div className="space-y-4">
                {/* Bloque Por Cumplir */}
                {porCumplirList.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-serif font-bold text-[#eed59b] uppercase tracking-wider flex items-center gap-1.5">
                        <span>⏳</span> Tareas Que Debes Cumplir ({porCumplirList.length})
                      </span>
                      <span className="text-[11px] text-[#94a3b8]">Pendientes de ejecución</span>
                    </div>
                    <div className="space-y-2">
                      {porCumplirList.map((tarea) => renderTaskRow(tarea))}
                    </div>
                  </div>
                )}

                {/* Bloque Cumplidas */}
                {hechasList.length > 0 && (
                  <div className={`space-y-2 ${porCumplirList.length > 0 ? 'pt-3 border-t border-[#5b9bd5]/15' : ''}`}>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-serif font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>✅</span> Tareas Ya Cumplidas ({hechasList.length})
                      </span>
                      <span className="text-[11px] text-emerald-400 font-mono">
                        {pctCumplimiento}% completado
                      </span>
                    </div>
                    <div className="space-y-2">
                      {hechasList.map((tarea) => renderTaskRow(tarea))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL / PROMPT RÁPIDO PARA MOTIVO DE DESVÍO */}
      {desvioPromptTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card-midnight p-5 sm:p-6 rounded-2xl border border-amber-500/30 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <span>⚠️</span>
                <span>Auditoría de Desvío</span>
              </h3>
              <button
                type="button"
                onClick={() => setDesvioPromptTaskId(null)}
                className="text-[#94a3b8] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Has marcado esta tarea como incompleta. Explica brevemente qué interrumpió el plan para auditarlo honestamente:
            </p>
            <input
              type="text"
              value={desvioText}
              onChange={(e) => setDesvioText(e.target.value)}
              placeholder="Ej: Reunión imprevista, fallo técnico, fatiga..."
              className="w-full p-3 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white text-xs focus:outline-none focus:border-amber-400"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDesvioPromptTaskId(null)}
                className="btn-formal-outline px-4 py-2 rounded-full text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDesvio(desvioPromptTaskId)}
                className="btn-formal px-4 py-2 rounded-full text-xs font-semibold"
              >
                Guardar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR TAREA (INDIVIDUAL O MARKDOWN) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card-midnight p-5 sm:p-6 rounded-2xl border border-[#5b9bd5]/40 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#5b9bd5]/15">
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2">
                  <span>➕</span>
                  <span>Programar Nueva Tarea</span>
                </h3>
                <p className="text-xs text-[#94a3b8]">
                  Define el objetivo para{' '}
                  <strong className="text-[#eed59b]">
                    {newTargetFecha === 'hoy' ? `Hoy (${formatFriendlyDate(fechaHoy)})` : `Mañana (${formatFriendlyDate(fechaManana)})`}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-[#94a3b8] hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Selector de Fecha Objetivo */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-[#050b18] border border-[#5b9bd5]/20 text-xs">
              <span className="text-[11px] text-[#94a3b8] pl-2 font-medium">Asignar a:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setNewTargetFecha('hoy')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    newTargetFecha === 'hoy'
                      ? 'bg-[#1e3a8a] text-white border border-[#60a5fa]/50'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  ☀️ Para Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setNewTargetFecha('manana')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    newTargetFecha === 'manana'
                      ? 'bg-[#4c1d95] text-white border border-[#a78bfa]/50'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  🌙 Para Mañana
                </button>
              </div>
            </div>

            {/* Alternador de Modo: Individual vs Bloque Markdown */}
            <div className="flex border-b border-[#5b9bd5]/15 text-xs">
              <button
                type="button"
                onClick={() => setCreateMode('individual')}
                className={`flex-1 py-2 font-medium border-b-2 transition-all ${
                  createMode === 'individual'
                    ? 'border-[#eed59b] text-[#eed59b]'
                    : 'border-transparent text-[#94a3b8] hover:text-white'
                }`}
              >
                Formulario Rápido
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('markdown')}
                className={`flex-1 py-2 font-medium border-b-2 transition-all ${
                  createMode === 'markdown'
                    ? 'border-[#eed59b] text-[#eed59b]'
                    : 'border-transparent text-[#94a3b8] hover:text-white'
                }`}
              >
                Bloque Markdown (Cal Newport)
              </button>
            </div>

            {createMode === 'individual' ? (
              <form onSubmit={handleCreateTask} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Descripción del Objetivo *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Ej: Implementar arquitectura de microservicios"
                    className="w-full p-3 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white text-xs focus:outline-none focus:border-[#eed59b]"
                  />
                </div>

                {/* Selector de horario fijo vs flexible */}
                <div className="p-2.5 rounded-xl bg-[#0d162a]/80 border border-[#38bdf8]/30 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#93c5fd] font-medium">
                    <input
                      type="checkbox"
                      checked={newIsFlexible}
                      onChange={(e) => setNewIsFlexible(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-black/40 text-[#2563eb]"
                    />
                    <span>⏱️ Sin horario fijo (definir horas después o al cumplir)</span>
                  </label>
                  {newIsFlexible && (
                    <span className="text-[10px] text-[#eed59b] font-serif">Flexible</span>
                  )}
                </div>

                {!newIsFlexible && (
                  <div className="grid grid-cols-2 gap-3 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                        Hora Inicio
                      </label>
                      <input
                        type="time"
                        value={newHoraInicio}
                        onChange={(e) => handleHorasChange(e.target.value, newHoraFin)}
                        className="w-full p-2.5 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                        Hora Fin
                      </label>
                      <input
                        type="time"
                        value={newHoraFin}
                        onChange={(e) => handleHorasChange(newHoraInicio, e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                      Tipo de Trabajo
                    </label>
                    <select
                      value={newTipo}
                      onChange={(e) => setNewTipo(e.target.value as TipoTrabajo)}
                      className="w-full p-2.5 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white text-xs focus:outline-none focus:border-[#eed59b]"
                    >
                      <option value="PROFUNDO">🧠 PROFUNDO</option>
                      <option value="SUPERFICIAL">⚡ SUPERFICIAL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                      Horas Estimadas
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="12"
                      value={newHorasEstimadas}
                      onChange={(e) => setNewHorasEstimadas(parseFloat(e.target.value) || 1.0)}
                      className="w-full p-2.5 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#5b9bd5]/15">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="btn-formal-outline px-4 py-2 rounded-full text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTask || !newDesc.trim()}
                    className="btn-formal px-5 py-2 rounded-full text-xs font-semibold disabled:opacity-50"
                  >
                    {submittingTask ? 'Guardando...' : 'Guardar Tarea'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateTask} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Pega tu lista de tareas en Markdown
                  </label>
                  <textarea
                    rows={6}
                    value={markdownBlock}
                    onChange={(e) => setMarkdownBlock(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs leading-relaxed focus:outline-none focus:border-[#eed59b]"
                    placeholder="- [ ] [09:00 - 11:00] [PROFUNDO] Tarea clave (2h netas)"
                  />
                </div>
                <p className="text-[11px] text-[#94a3b8]">
                  Soporta tanto el formato estricto Cal Newport como listas simples con guión: <code className="text-[#eed59b] font-mono">- Tarea importante</code>.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#5b9bd5]/15">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="btn-formal-outline px-4 py-2 rounded-full text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTask || !markdownBlock.trim()}
                    className="btn-formal px-5 py-2 rounded-full text-xs font-semibold disabled:opacity-50"
                  >
                    {submittingTask ? 'Procesando...' : 'Crear Tareas en Bloque'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDITAR TAREA EXISTENTE */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card-midnight p-5 sm:p-6 rounded-2xl border border-[#5b9bd5]/40 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#5b9bd5]/15">
              <h3 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>✏️</span>
                <span>Editar Tarea Planificada</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="text-[#94a3b8] hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  required
                  value={editingTask.descripcion}
                  onChange={(e) => setEditingTask({ ...editingTask, descripcion: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white text-xs focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    value={editingTask.hora_inicio || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, hora_inicio: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    value={editingTask.hora_fin || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, hora_fin: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Tipo
                  </label>
                  <select
                    value={editingTask.tipo_trabajo}
                    onChange={(e) => setEditingTask({ ...editingTask, tipo_trabajo: e.target.value as TipoTrabajo })}
                    className="w-full p-2 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white text-xs focus:outline-none focus:border-[#eed59b]"
                  >
                    <option value="PROFUNDO">PROFUNDO</option>
                    <option value="SUPERFICIAL">SUPERFICIAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Horas Netas
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editingTask.horas_netas_estimadas}
                    onChange={(e) => setEditingTask({ ...editingTask, horas_netas_estimadas: parseFloat(e.target.value) || 1.0 })}
                    className="w-full p-2 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Estado
                  </label>
                  <select
                    value={editingTask.estado}
                    onChange={(e) => setEditingTask({ ...editingTask, estado: e.target.value as EstadoTarea })}
                    className="w-full p-2 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white text-xs focus:outline-none focus:border-[#eed59b]"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="hecho">Hecho</option>
                    <option value="incompleto">Incompleto</option>
                    <option value="no_hecho">No hecho</option>
                  </select>
                </div>
              </div>

              {(editingTask.estado === 'incompleto' || editingTask.estado === 'no_hecho') && (
                <div>
                  <label className="block text-[11px] font-medium text-amber-300 mb-1">
                    Motivo de Desvío / Razón de Interrupción
                  </label>
                  <input
                    type="text"
                    value={editingTask.motivo_desvio || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, motivo_desvio: e.target.value })}
                    placeholder="Explica qué causó el retraso o desvío"
                    className="w-full p-2.5 rounded-xl bg-[#050b18] border border-amber-500/40 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#5b9bd5]/15">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="btn-formal-outline px-4 py-2 rounded-full text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-formal px-5 py-2 rounded-full text-xs font-semibold disabled:opacity-50"
                >
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA ASIGNAR HORARIO A LA TAREA O CUMPLIR CON HORA */}
      {timeModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b1324] border border-[#38bdf8]/30 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏱️</span>
                <div>
                  <h3 className="font-serif font-bold text-white text-base">
                    Registrar Horario de Realización
                  </h3>
                  <p className="text-[11px] text-[#94a3b8]">
                    ¿A qué hora realizaste esta tarea?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTimeModalTask(null)}
                className="text-[#94a3b8] hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Resumen de la tarea */}
            <div className="p-3.5 rounded-2xl bg-[#03060c] border border-white/10">
              <span className="text-[10px] text-[#eed59b] font-bold uppercase tracking-wider block mb-1">
                Tarea Seleccionada
              </span>
              <p className="text-xs text-slate-100 font-medium">
                {timeModalTask.descripcion}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-[#94a3b8] font-medium block">
                  Hora Inicio
                </label>
                <input
                  type="time"
                  value={timeModalIni}
                  onChange={(e) => setTimeModalIni(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#94a3b8] font-medium block">
                  Hora Fin (o término)
                </label>
                <input
                  type="time"
                  value={timeModalFin}
                  onChange={(e) => {
                    setTimeModalFin(e.target.value);
                    if (!timeModalCompletada) setTimeModalCompletada(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-[#eed59b] font-medium block">
                Hora Exacta Completada (Opcional)
              </label>
              <input
                type="time"
                value={timeModalCompletada}
                onChange={(e) => setTimeModalCompletada(e.target.value)}
                placeholder="HH:MM"
                className="w-full px-3 py-2 rounded-xl bg-[#050b18] border border-[#5b9bd5]/30 text-white font-mono text-xs focus:outline-none focus:border-[#eed59b]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={savingTimeModal}
                onClick={() => handleSaveTimeModal(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
              >
                <span>✓ Guardar y Marcar Cumplida</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={savingTimeModal}
                  onClick={() => handleSaveTimeModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#1e293b] text-slate-200 hover:text-white border border-slate-600 text-xs transition-colors"
                  title="Solo guardar el horario sin cambiar el estado"
                >
                  Solo Horario
                </button>
                <button
                  type="button"
                  onClick={() => setTimeModalTask(null)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

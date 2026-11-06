import React, { useState, useEffect } from 'react';
import type {
  TareaPlanificada,
  Intensidad,
  Incomodidad,
  TipoTrabajo,
  CategoriaTarea,
  SesionFlujo,
  CalidadSueno,
  SensacionSueno,
  TipoComida,
  CalidadComida,
  TipoEjercicio,
} from '../types/database';
import { getBoliviaShortTimeStr } from '../lib/boliviaTime';

interface ModalCumplirTareaYRegistrarFocoProps {
  isOpen: boolean;
  onClose: () => void;
  tarea: TareaPlanificada | null;
  fechaHoy: string;
  onSesionRegistrada?: (sesion: SesionFlujo) => void;
  onSuenoRegistrado?: (sueno: any) => void;
  onComidaRegistrada?: (comida: any) => void;
  onEjercicioRegistrado?: (ejercicio: any) => void;
  onTaskUpdated?: (tarea: TareaPlanificada) => void;
}

const TIPOS_FOCO_SUGERIDOS = [
  { label: 'Desarrollo', icon: '💻' },
  { label: 'Estudio', icon: '📚' },
  { label: 'Arquitectura', icon: '🏛️' },
  { label: 'Escritura', icon: '✍️' },
  { label: 'Lectura', icon: '📖' },
  { label: 'Planificación', icon: '🎯' },
];

const PRESETS_EJERCICIO: { label: TipoEjercicio; icon: string }[] = [
  { label: 'Calistenia / Corporal', icon: '🤸' },
  { label: 'Gimnasio / Pesas', icon: '🏋️' },
  { label: 'Running / Cardio', icon: '🏃' },
  { label: 'Movilidad / Yoga', icon: '🧘' },
  { label: 'Deporte / Marcial', icon: '🥋' },
];

const PRESETS_COMIDA: { label: TipoComida; icon: string }[] = [
  { label: 'Desayuno', icon: '🌅' },
  { label: 'Almuerzo', icon: '☀️' },
  { label: 'Cena', icon: '🌙' },
  { label: 'Merienda / Snack', icon: '🍎' },
  { label: 'Pre-entreno', icon: '⚡' },
  { label: 'Post-entreno', icon: '💪' },
];

const addMinutes = (timeStr: string, mins: number): string => {
  if (!timeStr || !timeStr.includes(':')) return '10:00';
  const [h, m] = timeStr.split(':').map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
};

const diffHours = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 1.0;
  const [h1, m1] = startStr.split(':').map(Number);
  const [h2, m2] = endStr.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  if (mins === 0) mins = 60;
  return Math.round((mins / 60) * 100) / 100;
};

// Detección automática inteligente de categoría basada en el texto
function inferCategoryFromTask(task: TareaPlanificada): CategoriaTarea {
  if (task.categoria && ['trabajo', 'ejercicio', 'comida', 'sueno'].includes(task.categoria)) {
    return task.categoria;
  }
  const text = (task.descripcion || '').toLowerCase();
  if (/(desayun|almuerz|cena|comid|comer|meriend|snack|nutrici|ingesta)/i.test(text)) {
    return 'comida';
  }
  if (/(ejercic|gym|gimnas|entren|pesas|calisteni|corr|cardio|yoga|movilid|rutina)/i.test(text)) {
    return 'ejercicio';
  }
  if (/(dormir|siesta|descans|sueno|sueño|reposo)/i.test(text)) {
    return 'sueno';
  }
  return 'trabajo';
}

export const ModalCumplirTareaYRegistrarFoco: React.FC<ModalCumplirTareaYRegistrarFocoProps> = ({
  isOpen,
  onClose,
  tarea,
  fechaHoy,
  onSesionRegistrada,
  onSuenoRegistrado,
  onComidaRegistrada,
  onEjercicioRegistrado,
  onTaskUpdated,
}) => {
  if (!isOpen || !tarea) return null;

  const currentBoliviaTime = getBoliviaShortTimeStr();

  // Categoría activa de cumplimiento (Trabajo, Ejercicio, Comida, Sueño)
  const [categoria, setCategoria] = useState<CategoriaTarea>('trabajo');

  // Herencia de Tipo de Trabajo (PROFUNDO vs SUPERFICIAL)
  const [tipoTrabajo, setTipoTrabajo] = useState<TipoTrabajo>('PROFUNDO');

  // Horario base sugerido
  const hasSpecificTimes =
    tarea.hora_inicio &&
    tarea.hora_fin &&
    tarea.hora_inicio !== '00:00' &&
    tarea.hora_inicio !== '00:01';

  const initialFin = hasSpecificTimes ? tarea.hora_fin! : currentBoliviaTime;
  const initialInicio = hasSpecificTimes
    ? tarea.hora_inicio!
    : addMinutes(initialFin, -Math.round((tarea.horas_netas_estimadas || 1.0) * 60));

  // Estado: TRABAJO
  const [descripcionTrabajo, setDescripcionTrabajo] = useState<string>('');
  const [tipoFoco, setTipoFoco] = useState<string>('Desarrollo');
  const [isCustomTipoFoco, setIsCustomTipoFoco] = useState<boolean>(false);
  const [customTipoFoco, setCustomTipoFoco] = useState<string>('');
  const [horaInicioTrabajo, setHoraInicioTrabajo] = useState<string>(initialInicio);
  const [horaFinTrabajo, setHoraFinTrabajo] = useState<string>(initialFin);
  const [horasNetasTrabajo, setHorasNetasTrabajo] = useState<number>(diffHours(initialInicio, initialFin));
  const [intensidadTrabajo, setIntensidadTrabajo] = useState<Intensidad>('Alta');
  const [incomodidadTrabajo, setIncomodidadTrabajo] = useState<Incomodidad>('Alta');
  const [entregableTrabajo, setEntregableTrabajo] = useState<string>('');

  // Estado: EJERCICIO
  const [descripcionEjercicio, setDescripcionEjercicio] = useState<string>('');
  const [tipoEjercicio, setTipoEjercicio] = useState<TipoEjercicio>('Calistenia / Corporal');
  const [isCustomTipoEjercicio, setIsCustomTipoEjercicio] = useState<boolean>(false);
  const [customTipoEjercicio, setCustomTipoEjercicio] = useState<string>('');
  const [horaInicioEjercicio, setHoraInicioEjercicio] = useState<string>(initialInicio);
  const [horaFinEjercicio, setHoraFinEjercicio] = useState<string>(initialFin);
  const [duracionEjercicio, setDuracionEjercicio] = useState<number>(diffHours(initialInicio, initialFin));
  const [intensidadEjercicio, setIntensidadEjercicio] = useState<Intensidad>('Media');

  // Estado: COMIDA
  const [descripcionComida, setDescripcionComida] = useState<string>('');
  const [tipoComida, setTipoComida] = useState<TipoComida>('Almuerzo');
  const [calidadComida, setCalidadComida] = useState<CalidadComida>('Limpio / Nutritivo');
  const [horaComida, setHoraComida] = useState<string>(hasSpecificTimes ? tarea.hora_inicio! : currentBoliviaTime);

  // Estado: SUEÑO
  const [horaInicioSueno, setHoraInicioSueno] = useState<string>('23:00');
  const [horaFinSueno, setHoraFinSueno] = useState<string>('07:00');
  const [horasSueno, setHorasSueno] = useState<number>(8.0);
  const [calidadSueno, setCalidadSueno] = useState<CalidadSueno>('Reparador');
  const [sensacionSueno, setSensacionSueno] = useState<SensacionSueno>('Descansado');
  const [notasSueno, setNotasSueno] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);

  // Inicializar y heredar todos los datos de la tarea al abrir el modal
  useEffect(() => {
    if (tarea) {
      const cat = inferCategoryFromTask(tarea);
      setCategoria(cat);

      // Heredar Tipo de Trabajo (Profundo vs Superficial)
      const inheritedTipoTrabajo: TipoTrabajo = tarea.tipo_trabajo === 'SUPERFICIAL' ? 'SUPERFICIAL' : 'PROFUNDO';
      setTipoTrabajo(inheritedTipoTrabajo);

      // Horarios
      const isSpec =
        tarea.hora_inicio &&
        tarea.hora_fin &&
        tarea.hora_inicio !== '00:00' &&
        tarea.hora_inicio !== '00:01';
      const f = isSpec ? tarea.hora_fin! : getBoliviaShortTimeStr();
      const i = isSpec
        ? tarea.hora_inicio!
        : addMinutes(f, -Math.round((tarea.horas_netas_estimadas || 1.0) * 60));
      const hoursDiff = diffHours(i, f);

      // Trabajo
      setDescripcionTrabajo(tarea.descripcion || '');
      setHoraInicioTrabajo(i);
      setHoraFinTrabajo(f);
      setHorasNetasTrabajo(hoursDiff);
      setIntensidadTrabajo(inheritedTipoTrabajo === 'PROFUNDO' ? 'Alta' : 'Media');
      setIncomodidadTrabajo(inheritedTipoTrabajo === 'PROFUNDO' ? 'Alta' : 'Media');
      setEntregableTrabajo('');
      setTipoFoco('Desarrollo');
      setIsCustomTipoFoco(false);
      setCustomTipoFoco('');

      // Ejercicio
      setDescripcionEjercicio(tarea.descripcion || '');
      setHoraInicioEjercicio(i);
      setHoraFinEjercicio(f);
      setDuracionEjercicio(hoursDiff);
      setIntensidadEjercicio('Media');

      // Comida
      setDescripcionComida(tarea.descripcion || '');
      setHoraComida(isSpec ? tarea.hora_inicio! : getBoliviaShortTimeStr());
      // Sugerir tipo de comida según hora o texto
      const descL = (tarea.descripcion || '').toLowerCase();
      if (descL.includes('desayun')) setTipoComida('Desayuno');
      else if (descL.includes('cena')) setTipoComida('Cena');
      else if (descL.includes('snack') || descL.includes('meriend')) setTipoComida('Merienda / Snack');
      else setTipoComida('Almuerzo');

      // Sueño
      setNotasSueno(tarea.descripcion || '');
      setHoraInicioSueno(isSpec ? tarea.hora_inicio! : '23:00');
      setHoraFinSueno(isSpec ? tarea.hora_fin! : '07:00');
      setHorasSueno(isSpec ? hoursDiff : 8.0);
    }
  }, [tarea]);

  // Al alternar Tipo de Trabajo (Profundo vs Superficial), ajustar sugerencias
  const handleToggleTipoTrabajo = (newTipo: TipoTrabajo) => {
    setTipoTrabajo(newTipo);
    if (newTipo === 'PROFUNDO') {
      setIntensidadTrabajo('Alta');
      setIncomodidadTrabajo('Alta');
    } else {
      setIntensidadTrabajo('Media');
      setIncomodidadTrabajo('Media');
    }
  };

  // Manejo de horarios en Trabajo
  const handleInicioTrabajoChange = (val: string) => {
    setHoraInicioTrabajo(val);
    if (val && horaFinTrabajo) setHorasNetasTrabajo(diffHours(val, horaFinTrabajo));
  };
  const handleFinTrabajoChange = (val: string) => {
    setHoraFinTrabajo(val);
    if (horaInicioTrabajo && val) setHorasNetasTrabajo(diffHours(horaInicioTrabajo, val));
  };

  // Manejo de horarios en Ejercicio
  const handleInicioEjercicioChange = (val: string) => {
    setHoraInicioEjercicio(val);
    if (val && horaFinEjercicio) setDuracionEjercicio(diffHours(val, horaFinEjercicio));
  };
  const handleFinEjercicioChange = (val: string) => {
    setHoraFinEjercicio(val);
    if (horaInicioEjercicio && val) setDuracionEjercicio(diffHours(horaInicioEjercicio, val));
  };

  // Manejo de horarios en Sueño
  const handleInicioSuenoChange = (val: string) => {
    setHoraInicioSueno(val);
    if (val && horaFinSueno) setHorasSueno(diffHours(val, horaFinSueno));
  };
  const handleFinSuenoChange = (val: string) => {
    setHoraFinSueno(val);
    if (horaInicioSueno && val) setHorasSueno(diffHours(horaInicioSueno, val));
  };

  // SUBMIT PRINCIPAL: Cumplir tarea y registrar actividad en la categoría correspondiente
  const handleRegistrarYCumplir = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const targetFecha = tarea.fecha_objetivo || fechaHoy;

      // 1. REGISTRAR SEGÚN CATEGORÍA SELECCIONADA
      if (categoria === 'trabajo') {
        const finalTipo = isCustomTipoFoco ? customTipoFoco.trim() || 'Foco' : tipoFoco;
        const finalDesc = descripcionTrabajo.trim() || tarea.descripcion.trim();

        const sesionRes = await fetch('/api/sesiones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: finalTipo,
            descripcion: finalDesc,
            tipo_trabajo: tipoTrabajo,
            tarea_id: tarea.id,
            horas_netas: horasNetasTrabajo,
            intensidad: intensidadTrabajo,
            incomodidad: incomodidadTrabajo,
            calidad: entregableTrabajo.trim(), // Entregable / Resultado Concreto
            fecha: targetFecha,
            hora_inicio: horaInicioTrabajo,
            hora_fin: horaFinTrabajo,
          }),
        });

        if (!sesionRes.ok) {
          const err = await sesionRes.json();
          throw new Error(err.error || 'Error al registrar sesión de trabajo');
        }

        const data = await sesionRes.json();
        if (onSesionRegistrada && data.sesion) {
          onSesionRegistrada(data.sesion);
        }
      } else if (categoria === 'ejercicio') {
        const finalTipoEj = isCustomTipoEjercicio ? customTipoEjercicio.trim() || 'Entrenamiento' : tipoEjercicio;
        const finalDescEj = descripcionEjercicio.trim() || tarea.descripcion.trim();

        const ejRes = await fetch('/api/ejercicio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo_ejercicio: finalTipoEj,
            descripcion: finalDescEj,
            duracion_horas: duracionEjercicio,
            intensidad: intensidadEjercicio,
            hora_inicio: horaInicioEjercicio,
            hora_fin: horaFinEjercicio,
            fecha: targetFecha,
          }),
        });

        if (!ejRes.ok) {
          const err = await ejRes.json();
          throw new Error(err.error || 'Error al registrar ejercicio');
        }

        const data = await ejRes.json();
        if (onEjercicioRegistrado && data.ejercicio) {
          onEjercicioRegistrado(data.ejercicio);
        }
      } else if (categoria === 'comida') {
        const finalDescComida = descripcionComida.trim() || tarea.descripcion.trim();

        const comRes = await fetch('/api/comida', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo_comida: tipoComida,
            descripcion: finalDescComida,
            calidad: calidadComida,
            hora: horaComida,
            fecha: targetFecha,
          }),
        });

        if (!comRes.ok) {
          const err = await comRes.json();
          throw new Error(err.error || 'Error al registrar alimentación');
        }

        const data = await comRes.json();
        if (onComidaRegistrada && data.comida) {
          onComidaRegistrada(data.comida);
        }
      } else if (categoria === 'sueno') {
        const sueRes = await fetch('/api/sueno', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hora_inicio: horaInicioSueno,
            hora_fin: horaFinSueno,
            horas: horasSueno,
            calidad_sueno: calidadSueno,
            sensacion: sensacionSueno,
            notas: notasSueno.trim(),
            fecha: targetFecha,
          }),
        });

        if (!sueRes.ok) {
          const err = await sueRes.json();
          throw new Error(err.error || 'Error al registrar sueño');
        }

        const data = await sueRes.json();
        if (onSuenoRegistrado && data.sueno) {
          onSuenoRegistrado(data.sueno);
        }
      }

      // 2. ACTUALIZAR TAREA COMO CUMPLIDA (HECHO) Y PERSISTIR DATOS HEREDADOS
      const tareaUpdateBody: Record<string, any> = {
        estado: 'hecho',
        categoria,
        hora_completada: currentBoliviaTime,
      };

      if (categoria === 'trabajo') {
        tareaUpdateBody.tipo_trabajo = tipoTrabajo;
        tareaUpdateBody.hora_inicio = horaInicioTrabajo;
        tareaUpdateBody.hora_fin = horaFinTrabajo;
        tareaUpdateBody.horas_netas_estimadas = horasNetasTrabajo;
        tareaUpdateBody.descripcion = descripcionTrabajo.trim() || tarea.descripcion;
      } else if (categoria === 'ejercicio') {
        tareaUpdateBody.hora_inicio = horaInicioEjercicio;
        tareaUpdateBody.hora_fin = horaFinEjercicio;
        tareaUpdateBody.horas_netas_estimadas = duracionEjercicio;
        tareaUpdateBody.descripcion = descripcionEjercicio.trim() || tarea.descripcion;
      } else if (categoria === 'comida') {
        tareaUpdateBody.hora_inicio = horaComida;
        tareaUpdateBody.descripcion = descripcionComida.trim() || tarea.descripcion;
      } else if (categoria === 'sueno') {
        tareaUpdateBody.hora_inicio = horaInicioSueno;
        tareaUpdateBody.hora_fin = horaFinSueno;
        tareaUpdateBody.horas_netas_estimadas = horasSueno;
        tareaUpdateBody.descripcion = notasSueno.trim() || tarea.descripcion;
      }

      const updateTaskRes = await fetch(`/api/tareas/${tarea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tareaUpdateBody),
      });

      if (updateTaskRes.ok) {
        const taskData = await updateTaskRes.json();
        if (onTaskUpdated && taskData.tarea) {
          onTaskUpdated(taskData.tarea);
        }
      }

      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al procesar la tarea y registrar actividad');
    } finally {
      setSubmitting(false);
    }
  };

  // Solo marcar tarea como cumplida sin registrar en bitácora
  const handleSoloCumplir = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/tareas/${tarea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'hecho',
          hora_completada: currentBoliviaTime,
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar tarea');
      const data = await res.json();
      if (onTaskUpdated && data.tarea) {
        onTaskUpdated(data.tarea);
      }
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al marcar como cumplida');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-[#080808] border border-white/15 rounded-3xl shadow-2xl p-5 sm:p-7 space-y-4 my-auto">
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#141414] text-[#eed59b] border border-[#eed59b]/30 font-medium">
                Cumplir y Registrar
              </span>
              <span className="text-xs text-[#eed59b] font-medium uppercase tracking-wider">
                Tarea Planificada
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-serif font-bold text-white tracking-wide">
              Cumplir Tarea y Registrar en Bitácora
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg text-lg leading-none"
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* SELECTOR DE CATEGORÍA DE ACTIVIDAD */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-[#94a3b8]">
            Dimensión o Categoría de la Actividad:
          </label>
          <div className="grid grid-cols-4 gap-1.5 bg-[#030303] p-1 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => setCategoria('trabajo')}
              className={`py-2 px-1.5 rounded-xl text-[11px] font-medium transition-all flex flex-col items-center gap-1 ${
                categoria === 'trabajo'
                  ? 'bg-[#181818] text-white border border-[#eed59b]/50 shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>🧠</span>
              <span className="truncate">Trabajo</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoria('ejercicio')}
              className={`py-2 px-1.5 rounded-xl text-[11px] font-medium transition-all flex flex-col items-center gap-1 ${
                categoria === 'ejercicio'
                  ? 'bg-[#181818] text-[#f97316] border border-[#f97316]/50 shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>🏃</span>
              <span className="truncate">Ejercicio</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoria('comida')}
              className={`py-2 px-1.5 rounded-xl text-[11px] font-medium transition-all flex flex-col items-center gap-1 ${
                categoria === 'comida'
                  ? 'bg-[#181818] text-[#34d399] border border-[#34d399]/50 shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>🥗</span>
              <span className="truncate">Comida</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoria('sueno')}
              className={`py-2 px-1.5 rounded-xl text-[11px] font-medium transition-all flex flex-col items-center gap-1 ${
                categoria === 'sueno'
                  ? 'bg-[#181818] text-[#818cf8] border border-[#818cf8]/50 shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <span>🌙</span>
              <span className="truncate">Sueño</span>
            </button>
          </div>
        </div>

        {/* FORMULARIO DINÁMICO SEGÚN CATEGORÍA */}
        <form onSubmit={handleRegistrarYCumplir} className="space-y-4 text-xs">
          {/* =========================================================
              CASO 1: TRABAJO / ESTUDIO PROFUNDO O SUPERFICIAL
              ========================================================= */}
          {categoria === 'trabajo' && (
            <div className="space-y-3.5 animate-fade-in">
              {/* HERENCIA DE PROFUNDO VS SUPERFICIAL */}
              <div className="p-2.5 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#94a3b8]">Enfoque de Trabajo:</span>
                  <span className="font-mono text-[#eed59b] text-[10px]">Heredado de la tarea</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleTipoTrabajo('PROFUNDO')}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      tipoTrabajo === 'PROFUNDO'
                        ? 'bg-[#1e3a8a] text-blue-100 border border-[#60a5fa]/60 shadow-midnight'
                        : 'bg-[#121212] text-zinc-400 border border-white/5 hover:text-white'
                    }`}
                  >
                    <span>⚡</span>
                    <span>Trabajo Profundo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleTipoTrabajo('SUPERFICIAL')}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      tipoTrabajo === 'SUPERFICIAL'
                        ? 'bg-[#1e293b] text-slate-100 border border-slate-400/60 shadow-midnight'
                        : 'bg-[#121212] text-zinc-400 border border-white/5 hover:text-white'
                    }`}
                  >
                    <span>📋</span>
                    <span>Trabajo Superficial</span>
                  </button>
                </div>
              </div>

              {/* Nombre o Descripción */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#94a3b8]">
                  Nombre o Descripción de la Tarea / Actividad
                </label>
                <input
                  type="text"
                  value={descripcionTrabajo}
                  onChange={(e) => setDescripcionTrabajo(e.target.value)}
                  placeholder="Ej: Terminar sistema arco punto final mas metas en la pared"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#101010] border border-white/15 text-white font-medium focus:outline-none focus:border-[#eed59b]"
                  required
                />
              </div>

              {/* Tipo de Foco / Estudio */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#94a3b8]">
                  Tipo de Foco / Estudio
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_FOCO_SUGERIDOS.map((t) => {
                    const isActive = !isCustomTipoFoco && tipoFoco === t.label;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => {
                          setIsCustomTipoFoco(false);
                          setTipoFoco(t.label);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 transition-all ${
                          isActive
                            ? 'bg-[#2563eb] text-white font-medium shadow-sm'
                            : 'bg-[#101010] text-[#94a3b8] hover:text-white border border-white/10'
                        }`}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsCustomTipoFoco(true)}
                    className={`px-2.5 py-1 rounded-xl text-xs transition-all ${
                      isCustomTipoFoco
                        ? 'bg-[#2563eb] text-white font-medium'
                        : 'bg-[#101010] text-[#94a3b8] hover:text-white border border-white/10'
                    }`}
                  >
                    + Otro
                  </button>
                </div>
                {isCustomTipoFoco && (
                  <input
                    type="text"
                    placeholder="Especificar tipo..."
                    value={customTipoFoco}
                    onChange={(e) => setCustomTipoFoco(e.target.value)}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-xl text-xs bg-[#101010] border border-white/15 text-white"
                    autoFocus
                  />
                )}
              </div>

              {/* Horario de Ejecución */}
              <div className="p-3 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#eed59b] font-medium">🕒 Horario de Ejecución</span>
                  <span className="font-mono font-bold text-white">{horasNetasTrabajo.toFixed(2)}h netas</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#94a3b8] mb-1">Hora Inicio</label>
                    <input
                      type="time"
                      value={horaInicioTrabajo}
                      onChange={(e) => handleInicioTrabajoChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#94a3b8] mb-1">Hora Fin</label>
                    <input
                      type="time"
                      value={horaFinTrabajo}
                      onChange={(e) => handleFinTrabajoChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Intensidad e Incomodidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Intensidad (Foco)
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setIntensidadTrabajo(lvl)}
                        className={`py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                          intensidadTrabajo === lvl
                            ? 'bg-[#181818] text-[#eed59b] border border-[#eed59b]/50 shadow-sm'
                            : 'bg-[#101010] text-[#94a3b8] border border-white/5 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                    Incomodidad (Fricción)
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Baja', 'Media', 'Alta'] as Incomodidad[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setIncomodidadTrabajo(lvl)}
                        className={`py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                          incomodidadTrabajo === lvl
                            ? 'bg-[#181818] text-[#eed59b] border border-[#eed59b]/50 shadow-sm'
                            : 'bg-[#101010] text-[#94a3b8] border border-white/5 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Entregable / Resultado Concreto */}
              <div>
                <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                  Entregable / Resultado Concreto
                </label>
                <input
                  type="text"
                  placeholder="Ej: Módulo de pagos probado, 10 páginas redactadas, API testeada..."
                  value={entregableTrabajo}
                  onChange={(e) => setEntregableTrabajo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#101010] border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-[#eed59b]"
                />
              </div>
            </div>
          )}

          {/* =========================================================
              CASO 2: EJERCICIO FÍSICO
              ========================================================= */}
          {categoria === 'ejercicio' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#94a3b8]">
                  Descripción del Entrenamiento
                </label>
                <input
                  type="text"
                  value={descripcionEjercicio}
                  onChange={(e) => setDescripcionEjercicio(e.target.value)}
                  placeholder="Ej: 4 series dominadas, flexiones, sentadillas y movilidad..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#101010] border border-white/15 text-white font-medium focus:outline-none focus:border-[#f97316]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#94a3b8]">
                  Modalidad de Ejercicio
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS_EJERCICIO.map((pe) => {
                    const isActive = !isCustomTipoEjercicio && tipoEjercicio === pe.label;
                    return (
                      <button
                        key={pe.label}
                        type="button"
                        onClick={() => {
                          setIsCustomTipoEjercicio(false);
                          setTipoEjercicio(pe.label);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 transition-all ${
                          isActive
                            ? 'bg-[#ea580c] text-white font-medium shadow-sm'
                            : 'bg-[#101010] text-[#94a3b8] hover:text-white border border-white/10'
                        }`}
                      >
                        <span>{pe.icon}</span>
                        <span>{pe.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsCustomTipoEjercicio(true)}
                    className={`px-2.5 py-1 rounded-xl text-xs transition-all ${
                      isCustomTipoEjercicio
                        ? 'bg-[#ea580c] text-white font-medium'
                        : 'bg-[#101010] text-[#94a3b8] hover:text-white border border-white/10'
                    }`}
                  >
                    + Otro
                  </button>
                </div>
                {isCustomTipoEjercicio && (
                  <input
                    type="text"
                    placeholder="Especificar deporte..."
                    value={customTipoEjercicio}
                    onChange={(e) => setCustomTipoEjercicio(e.target.value)}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-xl text-xs bg-[#101010] border border-white/15 text-white"
                    autoFocus
                  />
                )}
              </div>

              <div className="p-3 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#f97316] font-medium">🕒 Horario de Entrenamiento</span>
                  <span className="font-mono font-bold text-white">{duracionEjercicio.toFixed(2)}h duración</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#94a3b8] mb-1">Inicio</label>
                    <input
                      type="time"
                      value={horaInicioEjercicio}
                      onChange={(e) => handleInicioEjercicioChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#94a3b8] mb-1">Fin</label>
                    <input
                      type="time"
                      value={horaFinEjercicio}
                      onChange={(e) => handleFinEjercicioChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
                  Intensidad Física
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIntensidadEjercicio(lvl)}
                      className={`py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                        intensidadEjercicio === lvl
                          ? 'bg-[#7c2d12] text-[#fed7aa] border border-[#f97316]/50 shadow-sm'
                          : 'bg-[#101010] text-[#94a3b8] border border-white/5 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              CASO 3: ALIMENTACIÓN Y COMIDA
              ========================================================= */}
          {categoria === 'comida' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#94a3b8]">
                  Qué comiste (Alimentos e Ingesta)
                </label>
                <input
                  type="text"
                  value={descripcionComida}
                  onChange={(e) => setDescripcionComida(e.target.value)}
                  placeholder="Ej: Bistec con sopa de arroz, ensalada fresca y un mango..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#101010] border border-white/15 text-white font-medium focus:outline-none focus:border-[#10b981]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#94a3b8]">
                  Momento del Día
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESETS_COMIDA.map((pc) => (
                    <button
                      key={pc.label}
                      type="button"
                      onClick={() => setTipoComida(pc.label)}
                      className={`px-2 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all ${
                        tipoComida === pc.label
                          ? 'bg-[#059669] text-white font-medium shadow-sm'
                          : 'bg-[#101010] text-[#94a3b8] hover:text-white border border-white/10'
                      }`}
                    >
                      <span>{pc.icon}</span>
                      <span className="truncate">{pc.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                    Hora Ingesta
                  </label>
                  <input
                    type="time"
                    value={horaComida}
                    onChange={(e) => setHoraComida(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                    Calidad Nutricional
                  </label>
                  <select
                    value={calidadComida}
                    onChange={(e) => setCalidadComida(e.target.value as CalidadComida)}
                    className="w-full px-2 py-1.5 rounded-xl text-xs bg-[#141414] border border-white/15 text-white"
                  >
                    <option value="Limpio / Nutritivo">🥗 Limpio / Nutritivo</option>
                    <option value="Moderado">🍲 Moderado</option>
                    <option value="Libre / Procesado">🍕 Libre / Procesado</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              CASO 4: SUEÑO Y DESCANSO
              ========================================================= */}
          {categoria === 'sueno' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="p-3 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#818cf8] font-medium">🌙 Horario de Sueño</span>
                  <span className="font-mono font-bold text-white">{horasSueno.toFixed(1)}h dormidas</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#94a3b8] mb-1">Hora Dormir</label>
                    <input
                      type="time"
                      value={horaInicioSueno}
                      onChange={(e) => handleInicioSuenoChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#94a3b8] mb-1">Hora Despertar</label>
                    <input
                      type="time"
                      value={horaFinSueno}
                      onChange={(e) => handleFinSuenoChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                    Calidad de Sueño
                  </label>
                  <select
                    value={calidadSueno}
                    onChange={(e) => setCalidadSueno(e.target.value as CalidadSueno)}
                    className="w-full px-2 py-1.5 rounded-xl text-xs bg-[#141414] border border-white/15 text-white"
                  >
                    <option value="Profundo">🌑 Profundo</option>
                    <option value="Reparador">✨ Reparador</option>
                    <option value="Ligero">🌓 Ligero</option>
                    <option value="Interrumpido">⚡ Interrumpido</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1">
                    Sensación al Despertar
                  </label>
                  <select
                    value={sensacionSueno}
                    onChange={(e) => setSensacionSueno(e.target.value as SensacionSueno)}
                    className="w-full px-2 py-1.5 rounded-xl text-xs bg-[#141414] border border-white/15 text-white"
                  >
                    <option value="Energizado">⚡ Energizado</option>
                    <option value="Descansado">🧘 Descansado</option>
                    <option value="Neutro">⚪ Neutro</option>
                    <option value="Cansado">🥱 Cansado</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#94a3b8]">
                  Notas / Observaciones de Descanso
                </label>
                <input
                  type="text"
                  value={notasSueno}
                  onChange={(e) => setNotasSueno(e.target.value)}
                  placeholder="Ej: Siesta reparadora de tarde o sueño nocturno continuo..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#101010] border border-white/15 text-white font-medium focus:outline-none focus:border-[#818cf8]"
                />
              </div>
            </div>
          )}

          {/* BOTONES DE ACCIÓN */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 rounded-full text-xs font-semibold text-black shadow-midnight transition-all flex items-center justify-center gap-2 ${
                categoria === 'ejercicio'
                  ? 'bg-gradient-to-r from-[#fb923c] to-[#f97316] hover:brightness-110'
                  : categoria === 'comida'
                  ? 'bg-gradient-to-r from-[#34d399] to-[#10b981] hover:brightness-110'
                  : categoria === 'sueno'
                  ? 'bg-gradient-to-r from-[#a5b4fc] to-[#818cf8] hover:brightness-110'
                  : 'bg-gradient-to-r from-[#eed59b] to-[#e5c179] hover:brightness-110'
              }`}
            >
              <span>✓</span>
              <span>
                {submitting
                  ? 'Guardando registro...'
                  : categoria === 'ejercicio'
                  ? 'Confirmar y Registrar Ejercicio en el Panel'
                  : categoria === 'comida'
                  ? 'Confirmar y Registrar Comida en el Panel'
                  : categoria === 'sueno'
                  ? 'Confirmar y Registrar Sueño en el Panel'
                  : 'Confirmar y Registrar Foco en el Panel'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSoloCumplir}
              disabled={submitting}
              className="w-full py-2.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white bg-[#0e0e0e] hover:bg-[#161616] border border-white/10 transition-all text-center"
            >
              Solo marcar tarea como cumplida (sin registrar en bitácora)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

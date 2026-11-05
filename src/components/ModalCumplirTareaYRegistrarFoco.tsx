import React, { useState, useEffect } from 'react';
import type { TareaPlanificada, Intensidad, Incomodidad, SesionFlujo } from '../types/database';
import { getBoliviaShortTimeStr } from '../lib/boliviaTime';

interface ModalCumplirTareaYRegistrarFocoProps {
  isOpen: boolean;
  onClose: () => void;
  tarea: TareaPlanificada | null;
  fechaHoy: string;
  onSesionRegistrada?: (sesion: SesionFlujo) => void;
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

export const ModalCumplirTareaYRegistrarFoco: React.FC<ModalCumplirTareaYRegistrarFocoProps> = ({
  isOpen,
  onClose,
  tarea,
  fechaHoy,
  onSesionRegistrada,
  onTaskUpdated,
}) => {
  if (!isOpen || !tarea) return null;

  const currentBoliviaTime = getBoliviaShortTimeStr();

  // Determinar horario sugerido inicial
  const hasSpecificTimes =
    tarea.hora_inicio &&
    tarea.hora_fin &&
    tarea.hora_inicio !== '00:00' &&
    tarea.hora_inicio !== '00:01';

  const initialFin = hasSpecificTimes ? tarea.hora_fin! : currentBoliviaTime;
  const initialInicio = hasSpecificTimes
    ? tarea.hora_inicio!
    : addMinutes(initialFin, -Math.round((tarea.horas_netas_estimadas || 1.0) * 60));

  const [descripcion, setDescripcion] = useState<string>(tarea.descripcion || '');
  const [tipoFoco, setTipoFoco] = useState<string>('Desarrollo');
  const [isCustomTipo, setIsCustomTipo] = useState<boolean>(false);
  const [customTipo, setCustomTipo] = useState<string>('');

  const [horaInicio, setHoraInicio] = useState<string>(initialInicio);
  const [horaFin, setHoraFin] = useState<string>(initialFin);
  const [horasNetas, setHorasNetas] = useState<number>(
    diffHours(initialInicio, initialFin)
  );
  const [intensidad, setIntensidad] = useState<Intensidad>(
    tarea.tipo_trabajo === 'PROFUNDO' ? 'Alta' : 'Media'
  );
  const [incomodidad, setIncomodidad] = useState<Incomodidad>(
    tarea.tipo_trabajo === 'PROFUNDO' ? 'Alta' : 'Media'
  );
  const [entregable, setEntregable] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (tarea) {
      setDescripcion(tarea.descripcion || '');
      const isSpec =
        tarea.hora_inicio &&
        tarea.hora_fin &&
        tarea.hora_inicio !== '00:00' &&
        tarea.hora_inicio !== '00:01';
      const f = isSpec ? tarea.hora_fin! : getBoliviaShortTimeStr();
      const i = isSpec
        ? tarea.hora_inicio!
        : addMinutes(f, -Math.round((tarea.horas_netas_estimadas || 1.0) * 60));
      setHoraInicio(i);
      setHoraFin(f);
      setHorasNetas(diffHours(i, f));
      setIntensidad(tarea.tipo_trabajo === 'PROFUNDO' ? 'Alta' : 'Media');
      setIncomodidad(tarea.tipo_trabajo === 'PROFUNDO' ? 'Alta' : 'Media');
      setEntregable('');
      setIsCustomTipo(false);
      setCustomTipo('');
    }
  }, [tarea]);

  const handleInicioChange = (val: string) => {
    setHoraInicio(val);
    if (val && horaFin) {
      setHorasNetas(diffHours(val, horaFin));
    }
  };

  const handleFinChange = (val: string) => {
    setHoraFin(val);
    if (horaInicio && val) {
      setHorasNetas(diffHours(horaInicio, val));
    }
  };

  // Registrar sesión de flujo y marcar tarea cumplida
  const handleRegistrarYCumplir = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      const tipoFinal = isCustomTipo ? customTipo.trim() || 'Foco' : tipoFoco;
      const descFinal = descripcion.trim() || tarea.descripcion.trim();

      // 1. Guardar sesión de foco en la base de datos con congruencia total
      const sesionRes = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoFinal,
          descripcion: descFinal,
          tarea_id: tarea.id,
          horas_netas: horasNetas,
          intensidad,
          incomodidad,
          calidad: entregable.trim(), // Entregable / Resultado Concreto
          fecha: tarea.fecha_objetivo || fechaHoy,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
        }),
      });

      if (!sesionRes.ok) {
        const errJson = await sesionRes.json();
        throw new Error(errJson.error || 'Error al registrar sesión de foco');
      }

      const sesionData = await sesionRes.json();
      if (onSesionRegistrada && sesionData.sesion) {
        onSesionRegistrada(sesionData.sesion);
      }

      // 2. Marcar la tarea como cumplida en la base de datos
      const tareaRes = await fetch(`/api/tareas/${tarea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'hecho',
          descripcion: descFinal,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          hora_completada: horaFin,
          horas_netas_estimadas: horasNetas,
        }),
      });

      if (tareaRes.ok) {
        const tareaData = await tareaRes.json();
        if (onTaskUpdated && tareaData.tarea) {
          onTaskUpdated(tareaData.tarea);
        }
      }

      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al procesar la tarea y actividad');
    } finally {
      setSubmitting(false);
    }
  };

  // Solo marcar tarea como cumplida sin registrar sesión
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
      <div className="relative w-full max-w-lg bg-[#080808] border border-white/15 rounded-3xl shadow-2xl p-5 sm:p-7 space-y-5 my-auto">
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="tag-formal px-2.5 py-0.5 rounded-full text-[10px] bg-[#141414] text-[#eed59b] border border-[#eed59b]/30 font-medium">
                Sincronización Directa
              </span>
              <span className="text-xs text-[#eed59b] font-medium uppercase tracking-wider">
                Cumplir Tarea
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

        {/* Formulario de Registro de Sesión */}
        <form onSubmit={handleRegistrarYCumplir} className="space-y-4 text-xs">
          {/* 1. Nombre / Descripción de la Tarea (Heredado y editable) */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#94a3b8]">
              Nombre o Descripción de la Tarea / Actividad
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Terminar sistema arco punto final mas metas en la pared"
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#101010] border border-white/15 text-white font-medium focus:outline-none focus:border-[#eed59b]"
              required
            />
          </div>

          {/* 2. Tipo de Foco / Estudio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#94a3b8]">
              Tipo de Foco / Estudio
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_FOCO_SUGERIDOS.map((t) => {
                const isActive = !isCustomTipo && tipoFoco === t.label;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => {
                      setIsCustomTipo(false);
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
                onClick={() => setIsCustomTipo(true)}
                className={`px-2.5 py-1 rounded-xl text-xs transition-all ${
                  isCustomTipo
                    ? 'bg-[#2563eb] text-white font-medium'
                    : 'bg-[#101010] text-[#94a3b8] hover:text-white border border-white/10'
                }`}
              >
                + Otro
              </button>
            </div>
            {isCustomTipo && (
              <input
                type="text"
                placeholder="Especificar tipo de foco..."
                value={customTipo}
                onChange={(e) => setCustomTipo(e.target.value)}
                className="w-full mt-1.5 px-3 py-1.5 rounded-xl text-xs bg-[#101010] border border-white/15 text-white focus:outline-none focus:border-[#eed59b]"
                autoFocus
              />
            )}
          </div>

          {/* 3. Horario de Ejecución */}
          <div className="p-3.5 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#eed59b] font-medium">🕒 Horario de Ejecución</span>
              <span className="font-mono font-bold text-white">{horasNetas.toFixed(2)}h netas</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1">Hora Inicio</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => handleInicioChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white focus:outline-none focus:border-[#eed59b]"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1">Hora Fin</label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => handleFinChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[#141414] border border-white/15 text-white focus:outline-none focus:border-[#eed59b]"
                  required
                />
              </div>
            </div>
          </div>

          {/* 4. Intensidad e Incomodidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#94a3b8] mb-1.5">
                Intensidad (Foco)
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['Baja', 'Media', 'Alta'] as Intensidad[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setIntensidad(lvl)}
                    className={`py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                      intensidad === lvl
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
              <label className="block text-[11px] font-medium text-[#94a3b8] mb-1.5">
                Incomodidad (Fricción)
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['Baja', 'Media', 'Alta'] as Incomodidad[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setIncomodidad(lvl)}
                    className={`py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                      incomodidad === lvl
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

          {/* 5. Entregable / Resultado Concreto (NOMBRE EXACTO Y CONGRUENTE) */}
          <div>
            <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
              Entregable / Resultado Concreto
            </label>
            <input
              type="text"
              placeholder="Ej: Módulo de pagos probado, 10 páginas redactadas, API testeada..."
              value={entregable}
              onChange={(e) => setEntregable(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#101010] border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-[#eed59b]"
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-full text-xs font-semibold text-black bg-gradient-to-r from-[#eed59b] to-[#e5c179] hover:brightness-110 shadow-midnight transition-all flex items-center justify-center gap-2"
            >
              <span>✓</span>
              <span>{submitting ? 'Registrando actividad...' : 'Confirmar y Registrar Foco en el Panel'}</span>
            </button>

            <button
              type="button"
              onClick={handleSoloCumplir}
              disabled={submitting}
              className="w-full py-2.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white bg-[#0e0e0e] hover:bg-[#161616] border border-white/10 transition-all text-center"
            >
              Solo marcar tarea como cumplida (sin registrar foco)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

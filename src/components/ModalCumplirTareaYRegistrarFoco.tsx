import React, { useState, useEffect } from 'react';
import type { TareaPlanificada, Intensidad, Incomodidad, SesionFlujo } from '../types/database';
import { getBoliviaNow, getBoliviaShortTimeStr } from '../lib/boliviaTime';

interface ModalCumplirTareaYRegistrarFocoProps {
  isOpen: boolean;
  onClose: () => void;
  tarea: TareaPlanificada | null;
  fechaHoy: string;
  onSesionRegistrada?: (sesion: SesionFlujo) => void;
  onTaskUpdated?: (tarea: TareaPlanificada) => void;
}

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
  const [calidad, setCalidad] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (tarea) {
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
      setCalidad('');
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

      // 1. Guardar sesión de foco en la base de datos
      const sesionRes = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tarea.descripcion.trim(),
          horas_netas: horasNetas,
          intensidad,
          incomodidad,
          calidad: calidad.trim(),
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
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* Tarjeta de Tarea Seleccionada */}
        <div className="p-3.5 rounded-2xl bg-[#0e0e0e] border border-[#eed59b]/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-[#eed59b] uppercase">
              {tarea.tipo_trabajo === 'PROFUNDO' ? '⚡ Trabajo Profundo' : '📋 Trabajo Superficial'}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              Hora Bolivia: {currentBoliviaTime}
            </span>
          </div>
          <p className="text-sm font-serif font-bold text-white">
            {tarea.descripcion}
          </p>
        </div>

        {/* Formulario de Registro de Sesión */}
        <form onSubmit={handleRegistrarYCumplir} className="space-y-4 text-xs">
          {/* Horario de Ejecución */}
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

          {/* Intensidad e Incomodidad */}
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

          {/* Calidad o Reflexión Breve */}
          <div>
            <label className="block text-[11px] font-medium text-[#94a3b8] mb-1">
              Reflexión de Calidad (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Gran concentración sin interrupciones, código modular..."
              value={calidad}
              onChange={(e) => setCalidad(e.target.value)}
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
              className="w-full py-2 rounded-full text-[11px] text-[#94a3b8] hover:text-white transition-colors"
            >
              Solo marcar como cumplida (sin registrar bloque de foco)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

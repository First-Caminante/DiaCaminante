import React, { useState, useEffect } from 'react';
import { Scoreboard } from './Scoreboard';
import { QuickLog } from './QuickLog';
import { ShutdownModal } from './ShutdownModal';
import { VisualStats } from './VisualStats';
import { TasksManager } from './TasksManager';
import { PhilosophyView } from './PhilosophyView';
import { DailyReflectionModal } from './DailyReflectionModal';
import { SnowEffect } from './SnowEffect';
import { getReflexionDeHoy, getDiaDelCiclo, type ReflexionDiaria } from '../data/reflections';
import type { DiaHoyResponse, SesionFlujo, TareaPlanificada } from '../types/database';

type NavigationTab = 'stats' | 'tasks' | 'today' | 'philosophy';

interface DeepWorkAppProps {
  initialData?: DiaHoyResponse | null;
}

export const DeepWorkApp: React.FC<DeepWorkAppProps> = ({ initialData }) => {
  const [data, setData] = useState<DiaHoyResponse | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [currentTab, setCurrentTab] = useState<NavigationTab>('stats');
  const [isShutdownOpen, setIsShutdownOpen] = useState<boolean>(false);
  const [isDailyReflectionOpen, setIsDailyReflectionOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Estado del Sidebar retráctil / desplegable (persistido en memoria / storage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Reloj local en tiempo real con formato formal
  const [clockTime, setClockTime] = useState<string>('');
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(
        now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setFormattedDate(
        now.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getLocalTodayDate = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayReflection: ReflexionDiaria = getReflexionDeHoy();
  const diaCiclo = getDiaDelCiclo();
  const todayStr = getLocalTodayDate();

  const fetchHoy = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dia/hoy?fecha=${todayStr}`);
      if (!res.ok) throw new Error('Error al cargar datos');
      const json: DiaHoyResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching dia/hoy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchHoy();
    }

    try {
      const lastShown = localStorage.getItem('diacaminante_last_reflection_shown');
      if (lastShown !== todayStr) {
        setIsDailyReflectionOpen(true);
      }
    } catch {
      // LocalStorage access
    }

    const handleOpenEvent = () => setIsShutdownOpen(true);
    window.addEventListener('open-shutdown-modal', handleOpenEvent);
    return () => window.removeEventListener('open-shutdown-modal', handleOpenEvent);
  }, []);

  const handleMarkDailyReflectionRead = () => {
    try {
      localStorage.setItem('diacaminante_last_reflection_shown', todayStr);
    } catch {
      // Fallback
    }
  };

  const handleSesionRegistrada = (nuevaSesion: SesionFlujo) => {
    setData((prev) => {
      if (!prev) return prev;
      const updatedSesiones = [...prev.sesiones, nuevaSesion];
      const updatedTotal = updatedSesiones.reduce(
        (acc, s) => acc + (parseFloat(String(s.horas_netas)) || 0),
        0
      );
      return {
        ...prev,
        sesiones: updatedSesiones,
        totalHorasNetas: Number(updatedTotal.toFixed(2)),
      };
    });
  };

  const handleSesionActualizada = (sesionActualizada: SesionFlujo) => {
    setData((prev) => {
      if (!prev) return prev;
      const updatedSesiones = prev.sesiones.map((s) =>
        s.id === sesionActualizada.id ? sesionActualizada : s
      );
      const updatedTotal = updatedSesiones.reduce(
        (acc, s) => acc + (parseFloat(String(s.horas_netas)) || 0),
        0
      );
      return {
        ...prev,
        sesiones: updatedSesiones,
        totalHorasNetas: Number(updatedTotal.toFixed(2)),
      };
    });
    setNotification('Sesión de trabajo actualizada correctamente');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSesionEliminada = (sesionId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const updatedSesiones = prev.sesiones.filter((s) => s.id !== sesionId);
      const updatedTotal = updatedSesiones.reduce(
        (acc, s) => acc + (parseFloat(String(s.horas_netas)) || 0),
        0
      );
      return {
        ...prev,
        sesiones: updatedSesiones,
        totalHorasNetas: Number(updatedTotal.toFixed(2)),
      };
    });
    setNotification('Sesión de trabajo eliminada');
    setTimeout(() => setNotification(null), 3000);
  };

  // Handlers de Sueño
  const handleSuenoRegistrado = (nuevoSueno: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, suenos: [...(prev.suenos || []), nuevoSueno] };
    });
  };
  const handleSuenoActualizado = (suenoActualizado: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        suenos: (prev.suenos || []).map((s) => (s.id === suenoActualizado.id ? suenoActualizado : s)),
      };
    });
  };
  const handleSuenoEliminado = (id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, suenos: (prev.suenos || []).filter((s) => s.id !== id) };
    });
  };

  // Handlers de Comida
  const handleComidaRegistrada = (nuevaComida: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, comidas: [...(prev.comidas || []), nuevaComida] };
    });
  };
  const handleComidaActualizada = (comidaActualizada: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        comidas: (prev.comidas || []).map((c) => (c.id === comidaActualizada.id ? comidaActualizada : c)),
      };
    });
  };
  const handleComidaEliminada = (id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, comidas: (prev.comidas || []).filter((c) => c.id !== id) };
    });
  };

  // Handlers de Ejercicio
  const handleEjercicioRegistrado = (nuevoEjercicio: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, ejercicios: [...(prev.ejercicios || []), nuevoEjercicio] };
    });
  };
  const handleEjercicioActualizado = (ejercicioActualizado: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ejercicios: (prev.ejercicios || []).map((e) => (e.id === ejercicioActualizado.id ? ejercicioActualizado : e)),
      };
    });
  };
  const handleEjercicioEliminado = (id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, ejercicios: (prev.ejercicios || []).filter((e) => e.id !== id) };
    });
  };

  const handleTaskCreated = (nuevasTareas: TareaPlanificada[]) => {
    setData((prev) => {
      if (!prev) return prev;
      const deHoy = nuevasTareas.filter((t) => t.fecha_objetivo === fechaHoy);
      return {
        ...prev,
        tareas: [...(prev.tareas || []), ...deHoy],
      };
    });
  };

  const handleTaskDeleted = (id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tareas: (prev.tareas || []).filter((t) => t.id !== id),
      };
    });
  };

  const handleTaskUpdated = (tareaActualizada: TareaPlanificada) => {
    setData((prev) => {
      if (!prev) return prev;
      const updatedTareas = prev.tareas.map((t) =>
        t.id === tareaActualizada.id ? tareaActualizada : t
      );
      return {
        ...prev,
        tareas: updatedTareas,
      };
    });
  };

  const handleCierreCompletado = (resData: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cierreRealizado: true,
        dia: resData.dia || { ...prev.dia, cierre_realizado: true },
      };
    });
    setNotification('Protocolo de cierre completado con serenidad.');
    setTimeout(() => setNotification(null), 5000);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-[#070e1e] text-[#f8fafc]">
        <div className="w-12 h-12 rounded-2xl bg-[#0d1733] border border-[#5b9bd5]/30 shadow-midnight flex items-center justify-center text-[#e5c179] font-serif text-2xl animate-pulse">
          ✦
        </div>
        <p className="text-sm font-serif italic tracking-wide text-[#94a3b8]">
          Cargando biblioteca y jornada...
        </p>
      </div>
    );
  }

  const fechaHoy = data?.dia?.fecha || todayStr;
  const totalHoras = data?.totalHorasNetas || 0;
  const cierreRealizado = Boolean(data?.cierreRealizado);

  return (
    <div className="relative min-h-screen w-full flex bg-[#070e1e] text-[#f8fafc] overflow-x-hidden">
      {/* Fondo de Nieve Suave */}
      <SnowEffect />

      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-5 right-6 z-50 animate-fade-in">
          <div className="px-5 py-3 rounded-full bg-[#0d1a3d]/90 text-[#f8fafc] border border-[#5b9bd5]/40 shadow-midnight-glow flex items-center gap-2.5 text-xs font-sans font-medium backdrop-blur-md">
            <span className="text-[#eed59b]">✓</span>
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* BACKDROP PARA MÓVILES */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* =========================================================================
          SIDEBAR DESPLEGABLE / RETRÁCTIL (INSPIRADO EN BIBLIOTECA ENCANTADA)
          ========================================================================= */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col justify-between bg-[#081229]/95 backdrop-blur-xl border-r border-[#5b9bd5]/20 shadow-2xl transition-all duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}
        aria-label="Barra lateral de navegación"
      >
        {/* Cabecera del Sidebar */}
        <div className="p-4 border-b border-[#5b9bd5]/15 flex items-center justify-between">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-3">
              {/* Icono de Libro Dorado */}
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1a336e] to-[#0d1a3d] border border-[#e5c179]/40 flex items-center justify-center text-[#e5c179] shadow-midnight">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-lg font-bold tracking-wide text-white leading-tight">
                  Día Caminante
                </span>
                <span className="text-[11px] font-sans text-[#e5c179] tracking-wider uppercase">
                  Sistema de Foco
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <div className="w-10 h-10 rounded-2xl bg-[#0d1a3d] border border-[#e5c179]/40 flex items-center justify-center text-[#e5c179]">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
          )}

          {/* Botón para Colapsar / Expandir (Solo Desktop) */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-xl text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#132247] transition-colors"
            title={isSidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {/* Botón Cerrar en Móvil */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-xl text-[#94a3b8] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tarjeta de Estado de la Jornada (Solo expandido) */}
        {!isSidebarCollapsed && (
          <div className="mx-4 my-3 p-3.5 rounded-2xl bg-gradient-to-br from-[#0d1a3d]/80 to-[#070e1e]/90 border border-[#5b9bd5]/20 shadow-midnight">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-sans font-bold tracking-widest text-[#eed59b] uppercase">
                Día {diaCiclo} de 365
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                cierreRealizado
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cierreRealizado ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'}`}></span>
                <span>{cierreRealizado ? 'Jornada Concluida' : 'En Curso'}</span>
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-bold tracking-tight text-white">
                {clockTime || '00:00:00'}
              </span>
              <span className="text-xs text-[#94a3b8] capitalize">
                {formattedDate}
              </span>
            </div>
          </div>
        )}

        {/* Navegación Principal */}
        <div className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto">
          {/* Tab 1: Panel General */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('stats');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
              currentTab === 'stats'
                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-midnight-glow'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#0d1a3d]'
            }`}
            title="Panel General y Estadísticas"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            {!isSidebarCollapsed && (
              <span className="truncate">Panel General</span>
            )}
          </button>

          {/* Tab 2: Plan de Tareas */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('tasks');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
              currentTab === 'tasks'
                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-midnight-glow'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#0d1a3d]'
            }`}
            title="Plan de Vuelo y Tareas Planificadas"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!isSidebarCollapsed && (
                <span className="truncate">Plan de Tareas</span>
              )}
            </div>
            {!isSidebarCollapsed && (data?.tareas?.length ?? 0) > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#eed59b]/20 text-[#eed59b] font-mono font-semibold">
                {data?.tareas?.filter((t) => t.estado === 'hecho').length}/{data?.tareas?.length}
              </span>
            )}
          </button>

          {/* Tab 3: Registro de Foco */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('today');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
              currentTab === 'today'
                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-midnight-glow'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#0d1a3d]'
            }`}
            title="Registro de Sesiones de Foco y Salud"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {!isSidebarCollapsed && (
                <span className="truncate">Registro Diario</span>
              )}
            </div>
            {!isSidebarCollapsed && totalHoras > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-mono font-semibold">
                {totalHoras.toFixed(1)}h
              </span>
            )}
          </button>

          {/* Tab 4: Biblioteca de Pensamiento */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('philosophy');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
              currentTab === 'philosophy'
                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-midnight-glow'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#0d1a3d]'
            }`}
            title="Biblioteca de Pensamiento (365 Días)"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            {!isSidebarCollapsed && (
              <span className="truncate">Biblioteca 365</span>
            )}
          </button>
        </div>

        {/* Acciones Rápidas en la Base del Sidebar */}
        <div className="p-3 border-t border-[#5b9bd5]/15 space-y-2">
          {/* Botón Perla Diaria */}
          <button
            type="button"
            onClick={() => {
              setIsDailyReflectionOpen(true);
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-[#eed59b] bg-[#0d1a3d] hover:bg-[#132247] border border-[#e5c179]/30 ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title="Leer reflexión del día"
          >
            <span className="text-sm">✦</span>
            {!isSidebarCollapsed && <span>Reflexión del Día</span>}
          </button>

          {/* Botón Cierre de Jornada */}
          <button
            type="button"
            onClick={() => {
              setIsShutdownOpen(true);
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-white bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] hover:brightness-110 border border-[#60a5fa]/40 shadow-midnight ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title="Realizar protocolo de cierre de jornada"
          >
            <span>🌙</span>
            {!isSidebarCollapsed && (
              <span>{cierreRealizado ? 'Cierre Efectuado' : 'Cierre de Jornada'}</span>
            )}
          </button>

          {!isSidebarCollapsed && (
            <p className="pt-2 text-center text-[10px] text-[#94a3b8]/70 italic font-serif">
              &ldquo;La quietud engendra claridad.&rdquo;
            </p>
          )}
        </div>
      </aside>

      {/* =========================================================================
          ÁREA PRINCIPAL DE CONTENIDO
          ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative z-10">
        {/* Cabecera Móvil y Barra Superior Sutil */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#070e1e]/80 backdrop-blur-md border-b border-[#5b9bd5]/15">
          <div className="flex items-center gap-3">
            {/* Botón Menú Móvil */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#0d1a3d] border border-[#5b9bd5]/30 text-[#f8fafc]"
              aria-label="Abrir menú de navegación"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div>
              <h1 className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide">
                {currentTab === 'stats' && 'Panel General y Ritmo Diario'}
                {currentTab === 'tasks' && 'Plan de Vuelo & Tareas'}
                {currentTab === 'today' && 'Registro de Sesiones de Foco'}
                {currentTab === 'philosophy' && 'Biblioteca de Pensamiento'}
              </h1>
              <p className="text-xs text-[#94a3b8] font-sans">
                {currentTab === 'stats' && 'Visualización circadiana, intensidad y auditoría retrospectiva.'}
                {currentTab === 'tasks' && 'Gestión y checklist de objetivos para hoy y mañana.'}
                {currentTab === 'today' && 'Control cronológico de horas netas e incomodidad cognitiva.'}
                {currentTab === 'philosophy' && 'Compendio de reflexiones para la excelencia y la disciplina.'}
              </p>
            </div>
          </div>

          {/* Acciones de Cabecera Superior */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsDailyReflectionOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-[#eed59b] bg-[#0d1a3d] border border-[#e5c179]/30 hover:bg-[#132247] transition-all shadow-sm"
            >
              <span>✦</span>
              <span>Reflexión del Día</span>
            </button>

            <button
              onClick={() => setIsShutdownOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#2563eb] to-[#3b82f6] border border-[#60a5fa]/40 hover:brightness-110 shadow-midnight transition-all"
            >
              <span>🌙</span>
              <span>{cierreRealizado ? 'Cierre Realizado' : 'Cerrar Jornada'}</span>
            </button>
          </div>
        </header>

        {/* CONTENEDOR DE PESTAÑAS */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'stats' && (
            <VisualStats
              fechaHoy={todayStr}
              sesionesHoy={data?.sesiones || []}
              suenosHoy={data?.suenos || []}
              comidasHoy={data?.comidas || []}
              ejerciciosHoy={data?.ejercicios || []}
              onGoToDailyLog={() => setCurrentTab('today')}
            />
          )}

          {currentTab === 'tasks' && (
            <div className="space-y-6 animate-fade-in">
              <TasksManager
                fechaHoy={todayStr}
                tareasHoy={data?.tareas || []}
                onTaskCreated={handleTaskCreated}
                onTaskUpdated={handleTaskUpdated}
                onTaskDeleted={handleTaskDeleted}
                onRefresh={fetchHoy}
              />
            </div>
          )}

          {currentTab === 'today' && (
            <div className="space-y-6 animate-fade-in">
              <Scoreboard
                fecha={fechaHoy}
                totalHorasNetas={totalHoras}
                cierreRealizado={cierreRealizado}
                onOpenShutdown={() => setIsShutdownOpen(true)}
                onRefresh={fetchHoy}
              />

              <TasksManager
                fechaHoy={todayStr}
                tareasHoy={data?.tareas || []}
                onTaskCreated={handleTaskCreated}
                onTaskUpdated={handleTaskUpdated}
                onTaskDeleted={handleTaskDeleted}
                onRefresh={fetchHoy}
              />

              <QuickLog
                fecha={fechaHoy}
                sesiones={data?.sesiones || []}
                suenos={data?.suenos || []}
                comidas={data?.comidas || []}
                ejercicios={data?.ejercicios || []}
                onSesionRegistrada={handleSesionRegistrada}
                onSesionActualizada={handleSesionActualizada}
                onSesionEliminada={handleSesionEliminada}
                onSuenoRegistrado={handleSuenoRegistrado}
                onSuenoActualizado={handleSuenoActualizado}
                onSuenoEliminado={handleSuenoEliminado}
                onComidaRegistrada={handleComidaRegistrada}
                onComidaActualizada={handleComidaActualizada}
                onComidaEliminada={handleComidaEliminada}
                onEjercicioRegistrado={handleEjercicioRegistrado}
                onEjercicioActualizado={handleEjercicioActualizado}
                onEjercicioEliminado={handleEjercicioEliminado}
              />
            </div>
          )}

          {currentTab === 'philosophy' && (
            <PhilosophyView />
          )}
        </main>

        {/* Footer Formal */}
        <footer className="w-full px-6 py-6 border-t border-[#5b9bd5]/10 text-center text-xs text-[#94a3b8]/70 font-sans">
          <p>Día Caminante • Sistema Formal de Trabajo Profundo &amp; Reflexión Cotidiana</p>
        </footer>
      </div>

      {/* Shutdown Ritual Modal */}
      <ShutdownModal
        isOpen={isShutdownOpen}
        onClose={() => setIsShutdownOpen(false)}
        fecha={fechaHoy}
        tareasHoy={data?.tareas || []}
        onTaskUpdated={handleTaskUpdated}
        onCierreCompletado={handleCierreCompletado}
      />

      {/* Daily Reflection Modal */}
      <DailyReflectionModal
        isOpen={isDailyReflectionOpen}
        onClose={() => setIsDailyReflectionOpen(false)}
        reflection={todayReflection}
        onMarkAsReadForToday={handleMarkDailyReflectionRead}
      />
    </div>
  );
};

export default DeepWorkApp;

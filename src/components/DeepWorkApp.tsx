import React, { useState, useEffect } from 'react';
import { Scoreboard } from './Scoreboard';
import { QuickLog } from './QuickLog';
import { ShutdownModal } from './ShutdownModal';
import { VisualStats } from './VisualStats';
import { TasksManager } from './TasksManager';
import { PhilosophyView } from './PhilosophyView';
import { IdealSelfView } from './IdealSelfView';
import { DailyReflectionModal } from './DailyReflectionModal';
import { SnowEffect } from './SnowEffect';
import { EnsoLogo } from './EnsoLogo';
import { getReflexionDeHoy, getDiaDelCiclo, type ReflexionDiaria } from '../data/reflections';
import { getBoliviaNow, getBoliviaTodayStr, fetchServerTime, setServerTimeSync } from '../lib/boliviaTime';
import type { DiaHoyResponse, SesionFlujo, TareaPlanificada } from '../types/database';

type NavigationTab = 'stats' | 'tasks' | 'today' | 'history' | 'philosophy' | 'ideal_self';

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

  // Reloj oficial de Bolivia (La Paz, UTC-4) en tiempo real
  const [clockTime, setClockTime] = useState<string>('');
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const bNow = getBoliviaNow();
      setClockTime(bNow.horaCompleta);
      setFormattedDate(bNow.textoFechaLarga);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Calibrar contra el tiempo oficial del servidor vía API
    fetchServerTime().then(() => {
      updateTime();
    });

    return () => clearInterval(interval);
  }, []);

  const todayReflection: ReflexionDiaria = getReflexionDeHoy();
  const diaCiclo = getDiaDelCiclo();
  const todayStr = getBoliviaTodayStr();

  const fetchHoy = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dia/hoy?fecha=${todayStr}`);
      if (!res.ok) throw new Error('Error al cargar datos');
      const json: DiaHoyResponse = await res.json();
      
      // Siempre asignar los datos recibidos de la base de datos primero
      setData(json);

      if (json.tiempoServidor?.timestampMs) {
        try {
          setServerTimeSync(json.tiempoServidor.timestampMs);
          const bNow = getBoliviaNow();
          setClockTime(bNow.horaCompleta);
          setFormattedDate(bNow.textoFechaLarga);
        } catch (tErr) {
          console.warn('Error sincronizando hora de servidor:', tErr);
        }
      }
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
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-[#020408] text-[#f8fafc]">
        <EnsoLogo className="w-16 h-16 animate-pulse text-[#eed59b]" />
        <p className="text-sm font-serif italic tracking-wide text-[#94a3b8]">
          Arco del Punto y Aparte • Cargando biblioteca y jornada...
        </p>
      </div>
    );
  }

  const fechaHoy = data?.dia?.fecha || todayStr;
  const totalHoras = data?.totalHorasNetas || 0;
  const cierreRealizado = Boolean(data?.cierreRealizado);

  return (
    <div className="relative min-h-screen w-full flex bg-[#020408] text-[#f8fafc] overflow-x-hidden">
      {/* Fondo de Nieve Suave */}
      <SnowEffect />

      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-5 right-6 z-50 animate-fade-in">
          <div className="px-5 py-3 rounded-full bg-[#081122]/95 text-[#f8fafc] border border-[#5b9bd5]/40 shadow-midnight-glow flex items-center gap-2.5 text-xs font-sans font-medium backdrop-blur-md">
            <span className="text-[#eed59b]">✓</span>
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* BACKDROP PARA MÓVILES */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* =========================================================================
          SIDEBAR DESPLEGABLE / RETRÁCTIL (INSPIRADO EN BIBLIOTECA ZEN OBSIDIANA)
          ========================================================================= */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col justify-between bg-[#000000]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl transition-all duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}
        aria-label="Barra lateral de navegación"
      >
        {/* Cabecera del Sidebar */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-3">
              {/* Logo Zen Ensō */}
              <div className="w-10 h-10 rounded-2xl bg-[#080808] border border-[#eed59b]/40 flex items-center justify-center text-white shadow-midnight p-1">
                <EnsoLogo className="w-7 h-7" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-base sm:text-lg font-bold tracking-wide text-white leading-tight">
                  Arco del Punto y Aparte
                </span>
                <span className="text-[10px] font-sans text-[#eed59b] tracking-wider uppercase">
                  Sistema Zen de Foco
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <div className="w-10 h-10 rounded-2xl bg-[#080808] border border-[#eed59b]/40 flex items-center justify-center p-1">
                <EnsoLogo className="w-7 h-7" />
              </div>
            </div>
          )}

          {/* Botón para Colapsar / Expandir (Solo Desktop) */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-xl text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/5 transition-colors"
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
          <div className="mx-4 my-3 p-3.5 rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-midnight">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-sans font-bold tracking-widest text-[#eed59b] uppercase">
                Día {diaCiclo} de 365
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                cierreRealizado
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cierreRealizado ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
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
                ? 'bg-[#141414] text-white border border-[#eed59b]/40 shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
            }`}
            title="Panel General y Ritmo Circadiano"
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
                ? 'bg-[#141414] text-white border border-[#eed59b]/40 shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
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

          {/* Tab 3: Registro Diario */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('today');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
              currentTab === 'today'
                ? 'bg-[#141414] text-white border border-[#eed59b]/40 shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
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

          {/* Tab 4: Archivo Histórico (Acceso directo desde menú) */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('history');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
              currentTab === 'history'
                ? 'bg-[#141414] text-white border border-[#eed59b]/40 shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
            }`}
            title="Archivo Histórico y Auditoría Retrospectiva"
          >
            <span className="text-base flex-shrink-0">🏛️</span>
            {!isSidebarCollapsed && (
              <span className="truncate">Archivo Histórico</span>
            )}
          </button>

          {/* Tab 5: Biblioteca de Pensamiento */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('philosophy');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
              currentTab === 'philosophy'
                ? 'bg-[#141414] text-white border border-[#eed59b]/40 shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
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

          {/* Tab 6: Mi Yo Ideal */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('ideal_self');
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
              currentTab === 'ideal_self'
                ? 'bg-[#141414] text-white border border-[#eed59b]/40 shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
            }`}
            title="Mi Yo Ideal — 6 Dimensiones y 3 Filtros de Validación"
          >
            <span className="text-base flex-shrink-0">⛩️</span>
            {!isSidebarCollapsed && (
              <span className="truncate">Mi Yo Ideal</span>
            )}
          </button>
        </div>

        {/* Acciones Rápidas en la Base del Sidebar */}
        <div className="p-3 border-t border-white/10 space-y-2">
          {/* Botón Perla Diaria */}
          <button
            type="button"
            onClick={() => {
              setIsDailyReflectionOpen(true);
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-[#eed59b] bg-[#0c0c0c] hover:bg-[#161616] border border-[#eed59b]/30 ${
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
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-white bg-[#141414] hover:bg-[#1f1f1f] border border-white/15 hover:border-[#eed59b]/40 shadow-midnight ${
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
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#000000]/90 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botón Menú Móvil */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#0c0c0c] border border-white/15 text-[#f8fafc] flex-shrink-0"
              aria-label="Abrir menú de navegación"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0">
              <h1 className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide truncate">
                {currentTab === 'stats' && 'Panel General y Ritmo Diario'}
                {currentTab === 'tasks' && 'Plan de Vuelo & Tareas'}
                {currentTab === 'today' && 'Registro de Sesiones de Foco'}
                {currentTab === 'history' && 'Archivo Histórico y Retrospectiva'}
                {currentTab === 'philosophy' && 'Biblioteca de Pensamiento'}
                {currentTab === 'ideal_self' && 'Mi Yo Ideal — Compás de Identidad Nuclear'}
              </h1>
              <p className="text-xs text-[#94a3b8] font-sans truncate">
                {currentTab === 'stats' && 'Visualización circadiana, intensidad y cronograma de 24 horas.'}
                {currentTab === 'tasks' && 'Gestión y checklist de objetivos para hoy y mañana.'}
                {currentTab === 'today' && 'Control cronológico de horas netas e incomodidad cognitiva.'}
                {currentTab === 'history' && 'Consulta de jornadas pasadas, auditoría detallada y relieve de montañas.'}
                {currentTab === 'philosophy' && 'Compendio de reflexiones para la excelencia y la disciplina.'}
                {currentTab === 'ideal_self' && 'Estructura formal de autogobierno bajo las 6 dimensiones y los 3 filtros de validación.'}
              </p>
            </div>
          </div>

          {/* Acciones de Cabecera Superior */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={() => setIsDailyReflectionOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-[#eed59b] bg-[#0c0c0c] border border-[#eed59b]/30 hover:bg-[#161616] transition-all shadow-sm"
            >
              <span>✦</span>
              <span>Reflexión del Día</span>
            </button>

            <button
              onClick={() => setIsShutdownOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#141414] hover:bg-[#1f1f1f] border border-white/20 hover:border-[#eed59b]/40 shadow-midnight transition-all"
            >
              <span>🌙</span>
              <span>{cierreRealizado ? 'Cierre Realizado' : 'Cerrar Jornada'}</span>
            </button>
          </div>
        </header>

        {/* CONTENEDOR DE PESTAÑAS */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
          {currentTab === 'stats' && (
            <VisualStats
              mode="dashboard"
              fechaHoy={todayStr}
              sesionesHoy={data?.sesiones || []}
              suenosHoy={data?.suenos || []}
              comidasHoy={data?.comidas || []}
              ejerciciosHoy={data?.ejercicios || []}
              tareasHoy={data?.tareas || []}
              onTaskUpdated={handleTaskUpdated}
              onTaskCreated={handleTaskCreated}
              onTaskDeleted={handleTaskDeleted}
              onSesionRegistrada={handleSesionRegistrada}
              onGoToDailyLog={() => setCurrentTab('today')}
              onGoToTasks={() => setCurrentTab('tasks')}
              onGoToHistory={() => setCurrentTab('history')}
            />
          )}

          {currentTab === 'history' && (
            <div className="space-y-6 animate-fade-in min-w-0">
              <VisualStats
                mode="history"
                fechaHoy={todayStr}
                sesionesHoy={data?.sesiones || []}
                suenosHoy={data?.suenos || []}
                comidasHoy={data?.comidas || []}
                ejerciciosHoy={data?.ejercicios || []}
                tareasHoy={data?.tareas || []}
                onTaskUpdated={handleTaskUpdated}
                onTaskCreated={handleTaskCreated}
                onTaskDeleted={handleTaskDeleted}
                onSesionRegistrada={handleSesionRegistrada}
                onGoToDailyLog={() => setCurrentTab('today')}
                onGoToTasks={() => setCurrentTab('tasks')}
              />
            </div>
          )}

          {currentTab === 'tasks' && (
            <div className="space-y-6 animate-fade-in min-w-0">
              <TasksManager
                fechaHoy={todayStr}
                tareasHoy={data?.tareas || []}
                onTaskCreated={handleTaskCreated}
                onTaskUpdated={handleTaskUpdated}
                onTaskDeleted={handleTaskDeleted}
                onSesionRegistrada={handleSesionRegistrada}
                onRefresh={fetchHoy}
              />
            </div>
          )}

          {currentTab === 'today' && (
            <div className="space-y-6 animate-fade-in min-w-0">
              <Scoreboard
                fecha={fechaHoy}
                totalHorasNetas={totalHoras}
                cierreRealizado={cierreRealizado}
                onOpenShutdown={() => setIsShutdownOpen(true)}
                onRefresh={fetchHoy}
                tareas={data?.tareas || []}
              />

              <TasksManager
                fechaHoy={todayStr}
                tareasHoy={data?.tareas || []}
                onTaskCreated={handleTaskCreated}
                onTaskUpdated={handleTaskUpdated}
                onTaskDeleted={handleTaskDeleted}
                onSesionRegistrada={handleSesionRegistrada}
                onRefresh={fetchHoy}
              />

              <QuickLog
                fecha={fechaHoy}
                tareas={data?.tareas || []}
                onTaskUpdated={handleTaskUpdated}
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
            <div className="min-w-0">
              <PhilosophyView />
            </div>
          )}

          {currentTab === 'ideal_self' && (
            <div className="min-w-0">
              <IdealSelfView />
            </div>
          )}
        </main>

        {/* Footer Formal */}
        <footer className="w-full px-6 py-6 border-t border-[#5b9bd5]/10 text-center text-xs text-[#94a3b8]/70 font-sans">
          <p>Arco del Punto y Aparte • Sistema Zen de Trabajo Profundo, Identidad Nuclear &amp; Reflexión Cotidiana</p>
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

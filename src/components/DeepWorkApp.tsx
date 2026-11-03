import React, { useState, useEffect } from 'react';
import { Scoreboard } from './Scoreboard';
import { QuickLog } from './QuickLog';
import { ShutdownModal } from './ShutdownModal';
import { VisualStats } from './VisualStats';
import { PhilosophyView } from './PhilosophyView';
import { DailyReflectionModal } from './DailyReflectionModal';
import { getReflexionDeHoy, getDiaDelCiclo, type ReflexionDiaria } from '../data/reflections';
import type { DiaHoyResponse, SesionFlujo, TareaPlanificada } from '../types/database';

type NavigationTab = 'stats' | 'today' | 'philosophy';

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

  // Reloj local en tiempo real para el menú
  const [clockTime, setClockTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
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
    setNotification('Bloque de foco actualizado');
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
    setNotification('Bloque de foco eliminado');
    setTimeout(() => setNotification(null), 3000);
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
    setNotification('Ritual de cierre completado. Mente sellada hasta mañana.');
    setTimeout(() => setNotification(null), 5000);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#121c13] border-2 border-[#74a47b] shadow-[0_0_20px_rgba(217,242,196,0.3)] animate-pulse flex items-center justify-center text-[#d9f2c4] font-mono text-xl">
          ▲
        </div>
        <span className="text-xs font-mono tracking-widest text-[#92aa95] uppercase">
          Inicializando Consola de Deep Work...
        </span>
      </div>
    );
  }

  const fechaHoy = data?.dia?.fecha || todayStr;
  const totalHoras = data?.totalHorasNetas || 0;
  const cierreRealizado = Boolean(data?.cierreRealizado);

  return (
    <div className="min-h-screen pb-16 flex flex-col bg-[#000000] text-[#f8fafc]">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="px-5 py-2.5 rounded-xl bg-[#121c13] text-[#d9f2c4] border-2 border-[#74a47b] shadow-[0_10px_25px_rgba(0,0,0,0.9),0_0_15px_rgba(217,242,196,0.3)] flex items-center gap-2.5 text-xs font-mono font-bold backdrop-blur-md">
            <span>✓</span>
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* TOP COMMAND BAR: CONSOLA DE MANDO OBSIDIAN EMERALD */}
      <header className="w-full max-w-7xl mx-auto pt-4 px-3 sm:px-6 sticky top-0 z-40">
        <nav
          className="bg-[#121c13]/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border-2 border-[#74a47b]/40 shadow-[0_10px_30px_rgba(0,0,0,0.9)] flex flex-col md:flex-row md:items-center justify-between gap-3.5"
          aria-label="Navegación principal táctica"
        >
          {/* Brand & Status HUD */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#215e28] border-2 border-[#74a47b] flex items-center justify-center font-bold text-[#d9f2c4] text-sm shadow-[0_0_12px_rgba(217,242,196,0.35)]">
                ▲
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-display font-extrabold tracking-tight text-[#f8fafc] uppercase">
                    DiaCaminante
                  </span>
                  <span className="tag-tactical bg-[#215e28] text-[#d9f2c4] text-[10px] px-2 py-0.5 rounded border-[#74a47b]">
                    DÍA {diaCiclo} / 365
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#92aa95]">
                  <span>RELOJ: <strong className="text-[#d9f2c4] font-mono">{clockTime || '00:00:00'}</strong></span>
                  <span>•</span>
                  <span>ESTADO: <strong className={cierreRealizado ? 'text-[#d9f2c4]' : 'text-[#fde68a]'}>{cierreRealizado ? 'SELLADO' : 'EN COMBATE'}</strong></span>
                </div>
              </div>
            </div>

            {/* Mobile Action for Daily Reflection */}
            <button
              onClick={() => setIsDailyReflectionOpen(true)}
              className="md:hidden tag-tactical bg-[#1a281b] text-[#d9f2c4] px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 border-[#74a47b]"
              title="Ver reflexión del día"
            >
              <span>✦</span>
              <span>Sabiduría</span>
            </button>
          </div>

          {/* Navigation Tabs - Switcher Táctico */}
          <div className="flex items-center gap-1.5 bg-[#000000] p-1.5 rounded-xl border border-[#74a47b]/40 overflow-x-auto">
            {/* Tab 1: Panel de Estadísticas */}
            <button
              type="button"
              onClick={() => setCurrentTab('stats')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap ${
                currentTab === 'stats'
                  ? 'bg-[#d9f2c4] text-[#000000] shadow-[0_0_15px_rgba(217,242,196,0.4)]'
                  : 'text-[#92aa95] hover:text-[#f8fafc] hover:bg-[#1a281b]'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              <span>[01] Tablero Hoy</span>
            </button>

            {/* Tab 2: Estación de Registro */}
            <button
              type="button"
              onClick={() => setCurrentTab('today')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap ${
                currentTab === 'today'
                  ? 'bg-[#d9f2c4] text-[#000000] shadow-[0_0_15px_rgba(217,242,196,0.4)]'
                  : 'text-[#92aa95] hover:text-[#f8fafc] hover:bg-[#1a281b]'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>[02] Registro &amp; Log</span>
              {totalHoras > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                  currentTab === 'today'
                    ? 'bg-[#000000] text-[#d9f2c4] border-[#000000]'
                    : 'bg-[#215e28] text-[#d9f2c4] border-[#74a47b]'
                }`}>
                  {totalHoras.toFixed(1)}h
                </span>
              )}
            </button>

            {/* Tab 3: Bóveda Filosófica */}
            <button
              type="button"
              onClick={() => setCurrentTab('philosophy')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap ${
                currentTab === 'philosophy'
                  ? 'bg-[#d9f2c4] text-[#000000] shadow-[0_0_15px_rgba(217,242,196,0.4)]'
                  : 'text-[#92aa95] hover:text-[#f8fafc] hover:bg-[#1a281b]'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>[03] Filosofía 365</span>
            </button>
          </div>

          {/* Desktop Right Actions: Sabiduría & Ritual de Cierre Rápido */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setIsDailyReflectionOpen(true)}
              className="btn-tactical-ghost px-3.5 py-2 rounded-xl text-xs font-mono flex items-center gap-1.5"
              title="Abrir reflexión del día"
            >
              <span className="text-[#d9f2c4]">✦</span>
              <span>Perla Diaria</span>
            </button>

            <button
              onClick={() => setIsShutdownOpen(true)}
              className="btn-tactical px-3.5 py-2 rounded-xl text-xs font-mono flex items-center gap-1.5"
              title="Abrir ritual de cierre"
            >
              <span>🌙</span>
              <span>{cierreRealizado ? 'Cierre Sellado' : 'Ritual Cierre'}</span>
            </button>
          </div>
        </nav>
      </header>

      {/* MAIN VIEW CONTENT (SWITCH ENTRE TABS) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 my-4">
        {currentTab === 'stats' && (
          <VisualStats
            fechaHoy={todayStr}
            sesionesHoy={data?.sesiones || []}
            onGoToDailyLog={() => setCurrentTab('today')}
          />
        )}

        {currentTab === 'today' && (
          <div className="space-y-5 animate-fade-in">
            {/* Scoreboard Táctico */}
            <Scoreboard
              fecha={fechaHoy}
              totalHorasNetas={totalHoras}
              cierreRealizado={cierreRealizado}
              onOpenShutdown={() => setIsShutdownOpen(true)}
              onRefresh={fetchHoy}
            />

            {/* Quick Log & Timeline */}
            <QuickLog
              fecha={fechaHoy}
              sesiones={data?.sesiones || []}
              onSesionRegistrada={handleSesionRegistrada}
              onSesionActualizada={handleSesionActualizada}
              onSesionEliminada={handleSesionEliminada}
            />
          </div>
        )}

        {currentTab === 'philosophy' && (
          <PhilosophyView />
        )}
      </main>

      {/* Shutdown Ritual Modal */}
      <ShutdownModal
        isOpen={isShutdownOpen}
        onClose={() => setIsShutdownOpen(false)}
        fecha={fechaHoy}
        tareasHoy={data?.tareas || []}
        onTaskUpdated={handleTaskUpdated}
        onCierreCompletado={handleCierreCompletado}
      />

      {/* Daily Reflection Awakening Modal (Primer visita del día) */}
      <DailyReflectionModal
        isOpen={isDailyReflectionOpen}
        onClose={() => setIsDailyReflectionOpen(false)}
        reflection={todayReflection}
        onMarkAsReadForToday={handleMarkDailyReflectionRead}
      />

      {/* Footer Táctico */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-6 text-center text-xs font-mono text-[#92aa95]/80">
        <p>DiaCaminante • Sistema Táctico de Auditoría de Deep Work &amp; Ritual de Cierre</p>
      </footer>
    </div>
  );
};

export default DeepWorkApp;

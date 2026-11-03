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
  const [currentTab, setCurrentTab] = useState<NavigationTab>('stats'); // Estadísticas visuales como principal
  const [isShutdownOpen, setIsShutdownOpen] = useState<boolean>(false);
  const [isDailyReflectionOpen, setIsDailyReflectionOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const getLocalTodayDate = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayReflection: ReflexionDiaria = getReflexionDeHoy();
  const diaCiclo = getDiaDelCiclo();
  const todayStr = getLocalTodayDate();

  // Fetch today's state
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

    // Auto-check for first visit of the day: show daily reflection modal
    try {
      const lastShown = localStorage.getItem('diacaminante_last_reflection_shown');
      if (lastShown !== todayStr) {
        setIsDailyReflectionOpen(true);
      }
    } catch {
      // LocalStorage access handling
    }

    // Listen for custom open event for shutdown modal
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

  // When a new session is logged
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

  // When a session is updated
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
    setNotification('Bloque de foco actualizado con éxito');
    setTimeout(() => setNotification(null), 3500);
  };

  // When a session is deleted
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
    setTimeout(() => setNotification(null), 3500);
  };

  // When a task is updated in the audit
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

  // When shutdown ritual completes
  const handleCierreCompletado = (resData: any) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cierreRealizado: true,
        dia: resData.dia || { ...prev.dia, cierre_realizado: true },
      };
    });
    setNotification('Ritual de cierre completado. Mente liberada hasta mañana.');
    setTimeout(() => setNotification(null), 6000);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-pastel-lavender/20 border-t-pastel-lavender animate-spin"></div>
        <span className="text-xs font-mono text-slate-400">
          Sincronizando estado de Deep Work...
        </span>
      </div>
    );
  }

  const fechaHoy = data?.dia?.fecha || todayStr;
  const totalHoras = data?.totalHorasNetas || 0;
  const cierreRealizado = Boolean(data?.cierreRealizado);

  return (
    <div className="min-h-screen pb-16 flex flex-col">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="px-5 py-2.5 rounded-2xl bg-midnight-900/90 text-pastel-mint border border-pastel-mint/30 shadow-glow-mint flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION MENU BAR */}
      <header className="w-full max-w-5xl mx-auto pt-6 px-4 sm:px-6">
        <nav
          className="card-midnight rounded-2xl p-2.5 sm:p-3 border border-white/7 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg"
          aria-label="Navegación principal"
        >
          {/* Logo & Brand */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pastel-mint animate-pulse"></span>
              <span className="text-sm font-bold tracking-tight text-white font-mono">
                DiaCaminante
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pastel-lavender/15 text-pastel-lavender border border-pastel-lavender/30">
                Día {diaCiclo} / 365
              </span>
            </div>

            {/* Mobile Reflection trigger */}
            <button
              onClick={() => setIsDailyReflectionOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-pastel-lavender bg-pastel-lavender/10 border border-pastel-lavender/20 text-xs flex items-center gap-1"
              title="Ver reflexión del día"
            >
              <span>✦</span>
              <span className="text-[11px] font-mono">Sabiduría</span>
            </button>
          </div>

          {/* Navigation Tabs Pills */}
          <div className="flex items-center gap-1.5 bg-midnight-950/80 p-1 rounded-xl border border-white/5 overflow-x-auto">
            {/* Tab 1: Estadísticas (Principal) */}
            <button
              type="button"
              onClick={() => setCurrentTab('stats')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap active:scale-95 ${
                currentTab === 'stats'
                  ? 'bg-pastel-lavender text-midnight-950 font-bold shadow-glow-lavender'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              <span>Estadísticas Visuales</span>
            </button>

            {/* Tab 2: Registro Diario */}
            <button
              type="button"
              onClick={() => setCurrentTab('today')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap active:scale-95 ${
                currentTab === 'today'
                  ? 'bg-pastel-lavender text-midnight-950 font-bold shadow-glow-lavender'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Registro Diario</span>
              {totalHoras > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'today' ? 'bg-midnight-950 text-pastel-mint' : 'bg-pastel-mint/20 text-pastel-mint'
                }`}>
                  {totalHoras.toFixed(1)}h
                </span>
              )}
            </button>

            {/* Tab 3: Filosofía y Disciplina */}
            <button
              type="button"
              onClick={() => setCurrentTab('philosophy')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap active:scale-95 ${
                currentTab === 'philosophy'
                  ? 'bg-pastel-lavender text-midnight-950 font-bold shadow-glow-lavender'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>Filosofía &amp; Disciplina</span>
              <span className="text-[10px] font-mono text-pastel-amber">365d</span>
            </button>
          </div>

          {/* Desktop Right Action: Daily Reflection Modal Trigger */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setIsDailyReflectionOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-pastel-lavender hover:text-white bg-pastel-lavender/10 hover:bg-pastel-lavender/20 border border-pastel-lavender/30 transition-all active:scale-95"
              title="Ver la reflexión del día"
            >
              <span>✦</span>
              <span>Reflexión del Día</span>
            </button>
          </div>
        </nav>
      </header>

      {/* MAIN VIEW CONTENT (Switch between tabs) */}
      <main className="flex-1">
        {currentTab === 'stats' && (
          <VisualStats
            fechaHoy={todayStr}
            sesionesHoy={data?.sesiones || []}
            onGoToDailyLog={() => setCurrentTab('today')}
          />
        )}

        {currentTab === 'today' && (
          <div className="space-y-4 animate-fade-in">
            {/* Scoreboard */}
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

      {/* Daily Reflection Awakening Modal (First visit of the day) */}
      <DailyReflectionModal
        isOpen={isDailyReflectionOpen}
        onClose={() => setIsDailyReflectionOpen(false)}
        reflection={todayReflection}
        onMarkAsReadForToday={handleMarkDailyReflectionRead}
      />

      {/* Elegant Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-10 text-center text-xs font-mono text-slate-600">
        <p>DiaCaminante • Sistema de Auditoría de Concentración Profunda &amp; Desconexión Cognitiva</p>
      </footer>
    </div>
  );
};

export default DeepWorkApp;

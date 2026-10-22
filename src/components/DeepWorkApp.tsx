import React, { useState, useEffect } from 'react';
import { Scoreboard } from './Scoreboard';
import { QuickLog } from './QuickLog';
import { ShutdownModal } from './ShutdownModal';
import type { DiaHoyResponse, SesionFlujo, TareaPlanificada } from '../types/database';

interface DeepWorkAppProps {
  initialData?: DiaHoyResponse | null;
}

export const DeepWorkApp: React.FC<DeepWorkAppProps> = ({ initialData }) => {
  const [data, setData] = useState<DiaHoyResponse | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [isShutdownOpen, setIsShutdownOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Fetch today's state
  const fetchHoy = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dia/hoy');
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

    // Listen for custom open event
    const handleOpenEvent = () => setIsShutdownOpen(true);
    window.addEventListener('open-shutdown-modal', handleOpenEvent);
    return () => window.removeEventListener('open-shutdown-modal', handleOpenEvent);
  }, []);

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

  const fechaHoy = data?.dia?.fecha || new Date().toISOString().split('T')[0];
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

      {/* 1. Scoreboard (Marcador Superior) */}
      <Scoreboard
        fecha={fechaHoy}
        totalHorasNetas={totalHoras}
        cierreRealizado={cierreRealizado}
        onOpenShutdown={() => setIsShutdownOpen(true)}
        onRefresh={fetchHoy}
      />

      {/* 2. Quick Log & Today's Timeline */}
      <main className="flex-1">
        <QuickLog
          fecha={fechaHoy}
          sesiones={data?.sesiones || []}
          onSesionRegistrada={handleSesionRegistrada}
        />
      </main>

      {/* 3. Shutdown Ritual Modal */}
      <ShutdownModal
        isOpen={isShutdownOpen}
        onClose={() => setIsShutdownOpen(false)}
        fecha={fechaHoy}
        tareasHoy={data?.tareas || []}
        onTaskUpdated={handleTaskUpdated}
        onCierreCompletado={handleCierreCompletado}
      />

      {/* Elegant Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-10 text-center text-xs font-mono text-slate-600">
        <p>DiaCaminante • Sistema de Auditoría de Concentración Profunda &amp; Desconexión Cognitiva</p>
      </footer>
    </div>
  );
};

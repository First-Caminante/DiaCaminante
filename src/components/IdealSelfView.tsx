import React, { useState, useEffect, useRef } from 'react';
import type { MiYoIdeal } from '../types/database';
import { EnsoLogo } from './EnsoLogo';

const SQL_MIGRATION_SCRIPT = `-- =========================================================================
-- MIGRACIÓN: ARCO DEL PUNTO Y APARTE
-- 1. Horario Flexible en Tareas
-- 2. Tabla para "Mi Yo Ideal"
-- =========================================================================

ALTER TABLE public.tareas_planificadas ALTER COLUMN hora_inicio DROP NOT NULL;
ALTER TABLE public.tareas_planificadas ALTER COLUMN hora_fin DROP NOT NULL;
ALTER TABLE public.tareas_planificadas DROP CONSTRAINT IF EXISTS check_rango_horario;
ALTER TABLE public.tareas_planificadas 
  ADD CONSTRAINT check_rango_horario 
  CHECK (
    hora_inicio IS NULL OR 
    hora_fin IS NULL OR 
    hora_inicio = '00:00' OR 
    hora_inicio <= hora_fin
  );
ALTER TABLE public.tareas_planificadas ADD COLUMN IF NOT EXISTS hora_completada text;

CREATE TABLE IF NOT EXISTS public.mi_yo_ideal (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_arquetipo text DEFAULT 'El Arquitecto Silencioso',
  lema_personal text DEFAULT 'Elijo la incomodidad del esfuerzo antes que el alivio de la postergación.',
  avatar_url text DEFAULT '',
  principios_rectores text[] DEFAULT ARRAY[
    'Elijo la incomodidad del esfuerzo antes que el alivio de la postergación.',
    'Hablo con honestidad directa y respeto absoluto.',
    'Construyo maestría en silencio; dejo que los entregables hablen.',
    'Trato mi cuerpo y mi descanso como instrumentos sagrados de mi propósito.'
  ],
  reaccion_rechazo_critica text DEFAULT 'Desvinculo mi ego del resultado. Analizo la crítica como datos objetivos de retroalimentación en 60 segundos y retomo el rumbo.',
  primeros_5min_error_grave text DEFAULT 'Detengo cualquier reactividad o justificación. Respiro profundo, asumo responsabilidad total y formulo un plan de contención de 3 pasos.',
  gestion_aburrimiento_desmotivacion text DEFAULT 'No negocio con mi estado de ánimo. El foco no depende del entusiasmo, sino del compromiso con el estándar elegido.',
  rutina_inicio text DEFAULT '06:00 AM: Luz natural, hidratación inmediata, 10 min de silencio y apertura del Plan de Vuelo sin pantallas.',
  bloque_trabajo_profundo text DEFAULT '08:00 AM a 11:30 AM: 3 horas netas sin notificaciones, teléfono en otra habitación, inmersión en la frontera del problema más complejo.',
  cierre_desconexion text DEFAULT '21:30 PM: Protocolo de Cierre formal, revisión de métricas, apagado de pantallas y confinar pensamientos hasta el alba.',
  habilidades_maestria text DEFAULT 'Arquitectura de software de alto impacto, pensamiento estructurado de primer orden y capacidad de concentración prolongada.',
  metodo_evaluacion_progreso text DEFAULT 'Auditoría diaria en el Arco del Punto y Aparte: registro de horas netas, ratio de incomodidad y cumplimiento de compromisos.',
  valor_concreto_aportado text DEFAULT 'Sistemas confiables, claridad operativa para mis proyectos y liderazgo sereno para mi entorno.',
  estandar_alimentacion text DEFAULT 'Comida limpia y nutritiva como combustible cognitivo. Hidratación constante y evitar picos de glucosa que nublen la lucidez mental.',
  entrenamiento_fisico text DEFAULT '4 a 5 sesiones semanales de fuerza y resistencia cardiovascular. El esfuerzo muscular templa la resiliencia mental.',
  higiene_sueno text DEFAULT '8 horas no negociables en oscuridad y frescura total. Sin pantallas 60 minutos antes de dormir.',
  acceso_tiempo_energia text DEFAULT 'Acceso selectivo y deliberado. Mi tiempo productivo está blindado contra urgencias ajenas y distracciones.',
  como_dice_no text DEFAULT 'Digo no de forma sobria, rápida y cortés, sin excusas elaboradas ni culpa: "En este momento mi foco está asignado a otra prioridad."',
  trato_colaboradores_cercanos text DEFAULT 'Generosidad en la escucha, exigencia con los estándares compartidos y empatía profunda con su desarrollo humano.',
  filtro_higgins_aprobado boolean DEFAULT true,
  filtro_higgins_notas text DEFAULT 'Auditado: Cada principio expande mi potencial real y no proviene de la necesidad de aprobación social.',
  filtro_boyatzis_aprobado boolean DEFAULT true,
  filtro_boyatzis_notas text DEFAULT 'Auditado: Al leer este compás siento dirección, calma y convicción de tracción; no asfixia por autoexigencia tóxica.',
  principio_aproximacion_notas text DEFAULT 'Calibración activa: Busco al menos un 70% de congruencia diaria entre mis decisiones y este diseño.',
  creado_a timestamptz DEFAULT now(),
  actualizado_a timestamptz DEFAULT now()
);

ALTER TABLE public.mi_yo_ideal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total a mi_yo_ideal" ON public.mi_yo_ideal FOR ALL USING (true) WITH CHECK (true);
`;

export const IdealSelfView: React.FC = () => {
  const [yoIdeal, setYoIdeal] = useState<MiYoIdeal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [needsMigration, setNeedsMigration] = useState<boolean>(false);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeDimensionTab, setActiveDimensionTab] = useState<number>(1);
  const [nuevoPrincipio, setNuevoPrincipio] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchYoIdeal = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/yo-ideal');
      if (!res.ok) throw new Error('Error al obtener perfil');
      const data = await res.json();
      if (data.yoIdeal) {
        setYoIdeal(data.yoIdeal);
        setNeedsMigration(Boolean(data.needsMigration));
      }
    } catch (err) {
      console.error(err);
      showToast('Error al cargar datos del Yo Ideal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYoIdeal();
  }, []);

  const handleSave = async () => {
    if (!yoIdeal) return;
    try {
      setSaving(true);
      const res = await fetch('/api/yo-ideal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(yoIdeal),
      });
      if (!res.ok) throw new Error('Error al guardar Yo Ideal');
      const data = await res.json();
      if (data.yoIdeal) {
        setYoIdeal(data.yoIdeal);
        setNeedsMigration(Boolean(data.needsMigration));
      }
      showToast('✓ Compás de Identidad guardado con excelencia.');
    } catch (err: any) {
      console.error(err);
      showToast('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5 MB.');
      return;
    }

    try {
      setUploadingImage(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Str = reader.result as string;
        try {
          const res = await fetch('/api/yo-ideal/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: base64Str }),
          });
          if (!res.ok) throw new Error('Error al subir imagen');
          const data = await res.json();
          const finalUrl = data.url || data.avatar_url || base64Str;
          setYoIdeal((prev) => (prev ? { ...prev, avatar_url: finalUrl } : prev));
          showToast('✓ Imagen del Yo Ideal actualizada');
        } catch (postErr) {
          console.warn('Fallback imagen local:', postErr);
          setYoIdeal((prev) => (prev ? { ...prev, avatar_url: base64Str } : prev));
          showToast('✓ Imagen cargada localmente');
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploadingImage(false);
      showToast('Error al leer imagen');
    }
  };

  const handleAddPrincipio = () => {
    if (!nuevoPrincipio.trim() || !yoIdeal) return;
    const current = yoIdeal.principios_rectores || [];
    setYoIdeal({
      ...yoIdeal,
      principios_rectores: [...current, nuevoPrincipio.trim()],
    });
    setNuevoPrincipio('');
  };

  const handleRemovePrincipio = (idx: number) => {
    if (!yoIdeal) return;
    const current = [...(yoIdeal.principios_rectores || [])];
    current.splice(idx, 1);
    setYoIdeal({ ...yoIdeal, principios_rectores: current });
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  if (loading && !yoIdeal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
        <EnsoLogo className="w-12 h-12 animate-pulse text-[#eed59b]" />
        <p className="font-serif italic text-sm text-[#94a3b8]">
          Invocando el Compás de Identidad Nuclear...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-6 z-50">
          <div className="px-5 py-3 rounded-full bg-[#0a0a0a]/95 text-[#f8fafc] border border-white/15 shadow-midnight flex items-center gap-2.5 text-xs font-sans font-medium backdrop-blur-md">
            <span className="text-[#eed59b]">✦</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Alerta Discreta si falta ejecutar migración en Supabase */}
      {needsMigration && (
        <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-[#eed59b]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs w-full min-w-0">
          <div className="flex items-center gap-2.5 text-slate-300">
            <span className="text-base">ℹ️</span>
            <span>
              <strong className="text-[#eed59b]">Base de datos lista para sincronizar:</strong> Los cambios se están guardando en sesión. Para persistirlos permanentemente en tu Supabase, ejecuta el script SQL.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#141414] text-[#eed59b] hover:text-white hover:bg-[#202020] border border-white/15 transition-all font-medium text-[11px]"
          >
            Copiar Script SQL
          </button>
        </div>
      )}

      {/* CABECERA PRINCIPAL CON ENSŌ Y ARQUETIPO (Sin desborde de ventana) */}
      <section className="relative overflow-hidden rounded-3xl bg-[#060606] border border-white/10 p-5 sm:p-7 shadow-2xl w-full min-w-0">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
          {/* Lado Izquierdo: Avatar / Imagen & Datos Clave */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 flex-1 min-w-0 w-full">
            {/* Contenedor Avatar */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#0d0d0d] border-2 border-[#eed59b]/50 shadow-[0_0_20px_rgba(238,213,155,0.12)] flex items-center justify-center relative">
                {yoIdeal?.avatar_url ? (
                  <img
                    src={yoIdeal.avatar_url}
                    alt="Arquetipo Yo Ideal"
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-3 text-[#eed59b]/70">
                    <EnsoLogo className="w-10 h-10 opacity-80" />
                    <span className="text-[10px] mt-1 font-serif">Subir Imagen</span>
                  </div>
                )}

                {/* Overlay de carga */}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                    <span className="text-xs text-[#eed59b] font-medium animate-pulse">Subiendo...</span>
                  </div>
                )}
              </div>

              {/* Botón para cambiar imagen */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full text-center text-[11px] font-sans text-[#eed59b] hover:text-white transition-colors bg-[#111111] py-1 px-2 rounded-lg border border-white/10 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>📷</span>
                <span>{yoIdeal?.avatar_url ? 'Cambiar Foto' : 'Añadir Foto'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </div>

            {/* Arquetipo y Lema */}
            <div className="space-y-2.5 flex-1 min-w-0 text-center sm:text-left w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121212] border border-white/10 text-[11px] text-[#eed59b] font-serif tracking-wide">
                <span>⛩️</span>
                <span>Arco del Punto y Aparte • Diseño de Identidad</span>
              </div>

              <div className="space-y-0.5 min-w-0">
                <label className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold block">
                  Nombre del Arquetipo
                </label>
                <input
                  type="text"
                  value={yoIdeal?.nombre_arquetipo || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, nombre_arquetipo: e.target.value } : prev)}
                  placeholder="Ej: El Arquitecto Silencioso"
                  className="w-full min-w-0 bg-transparent font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-white border-b border-white/20 focus:border-[#eed59b] focus:outline-none transition-colors pb-1"
                />
              </div>

              <div className="space-y-0.5 min-w-0">
                <label className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold block">
                  Lema Personal de Criterio
                </label>
                <input
                  type="text"
                  value={yoIdeal?.lema_personal || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, lema_personal: e.target.value } : prev)}
                  placeholder="Elijo la incomodidad del esfuerzo antes que el alivio de la postergación."
                  className="w-full min-w-0 bg-transparent italic font-serif text-xs sm:text-sm text-[#eed59b] border-b border-white/10 focus:border-[#eed59b] focus:outline-none transition-colors pb-1"
                />
              </div>
            </div>
          </div>

          {/* Botón Guardar Cambios */}
          <div className="shrink-0 flex flex-col items-center lg:items-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#161616] hover:bg-[#222222] text-[#eed59b] hover:text-white border border-[#eed59b]/40 font-semibold text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <span>{saving ? 'Guardando...' : '💾 Guardar Compás de Identidad'}</span>
            </button>
            <span className="text-[10px] text-[#94a3b8] italic">
              Persistido para tu alineación diaria
            </span>
          </div>
        </div>
      </section>

      {/* PESTAÑAS DE LAS 6 DIMENSIONES & LOS 3 FILTROS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10 w-full min-w-0">
        {[
          { id: 1, label: '1. Identidad Nuclear', icon: '💎' },
          { id: 2, label: '2. Bajo Fuego (Fricción)', icon: '🛡️' },
          { id: 3, label: '3. Hábitos Atómicos', icon: '⏳' },
          { id: 4, label: '4. Maestría Profesional', icon: '📐' },
          { id: 5, label: '5. Disciplina Biológica', icon: '⚡' },
          { id: 6, label: '6. Fronteras y Relaciones', icon: '🏛️' },
          { id: 7, label: 'Auditoría: 3 Filtros', icon: '⚖️' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveDimensionTab(tab.id)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${
              activeDimensionTab === tab.id
                ? 'bg-[#181818] text-white border border-[#eed59b]/40 shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#0d0d0d]'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENIDO DE CADA DIMENSIÓN */}
      <div className="space-y-6">
        {/* =========================================================
            DIMENSIÓN 1: IDENTIDAD NUCLEAR Y VALORES
            ========================================================= */}
        {activeDimensionTab === 1 && (
          <div className="space-y-6 rounded-3xl bg-[#050505]/95 border border-white/10 p-6 sm:p-8">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>💎</span> Dimensión 1: Identidad Nuclear y Valores
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Escribe de 3 a 5 principios rectores expresados en <strong>presente y primera persona</strong>. Evita adjetivos vacíos ("ser exitoso"). Usa reglas de criterio firmes.
              </p>
            </div>

            {/* Lista de Principios Rectores */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#eed59b] block">
                Principios Rectores Actuales ({yoIdeal?.principios_rectores?.length || 0})
              </label>

              <div className="space-y-2.5">
                {(yoIdeal?.principios_rectores || []).map((principio, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#0a0a0a] border border-white/10 flex items-start justify-between gap-3 group hover:border-[#eed59b]/30 transition-all"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <span className="font-mono text-xs text-[#eed59b] pt-0.5">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <p className="text-sm text-slate-100 font-serif leading-relaxed">
                        &ldquo;{principio}&rdquo;
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePrincipio(idx)}
                      className="text-xs text-rose-400/60 hover:text-rose-400 p-1 opacity-60 group-hover:opacity-100 transition-opacity"
                      title="Eliminar principio"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Agregar nuevo principio */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={nuevoPrincipio}
                  onChange={(e) => setNuevoPrincipio(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPrincipio();
                    }
                  }}
                  placeholder="Ej: Hablo con honestidad directa y respeto absoluto..."
                  className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#eed59b]"
                />
                <button
                  type="button"
                  onClick={handleAddPrincipio}
                  className="px-4 py-2.5 rounded-2xl bg-[#1e293b] hover:bg-[#334155] text-white border border-slate-600 text-xs font-semibold shrink-0 transition-colors"
                >
                  + Añadir Principio
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            DIMENSIÓN 2: RESPUESTA OPERATIVA ANTE LA FRICCIÓN (BAJO FUEGO)
            ========================================================= */}
        {activeDimensionTab === 2 && (
          <div className="space-y-6 rounded-3xl bg-[#050505]/95 border border-white/10 p-6 sm:p-8">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>🛡️</span> Dimensión 2: Respuesta Operativa ante la Fricción (Diseñado Bajo Fuego)
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Cualquiera es disciplinado en un día soleado de vacaciones. Este protocolo define tu conducta exacta bajo presión, error o apatía.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>⚡</span> ¿Cómo reacciona ante el rechazo comercial o la crítica?
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.reaccion_rechazo_critica || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, reaccion_rechazo_critica: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>⏱️</span> ¿Qué hace durante los primeros 5 minutos tras cometer un error grave?
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.primeros_5min_error_grave || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, primeros_5min_error_grave: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🌊</span> ¿Cómo procesa el aburrimiento y la falta de motivación?
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.gestion_aburrimiento_desmotivacion || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, gestion_aburrimiento_desmotivacion: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            DIMENSIÓN 3: HÁBITOS ATÓMICOS DE SOPORTE
            ========================================================= */}
        {activeDimensionTab === 3 && (
          <div className="space-y-6 rounded-3xl bg-[#050505]/95 border border-white/10 p-6 sm:p-8">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>⏳</span> Dimensión 3: Hábitos Atómicos de Soporte (Evidencia Empírica Diaria)
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Define la evidencia tangible que valida tu identidad nuclear día a día. Sin ambigüedades de horario.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🌅</span> Rutina de Inicio del Día (Hora de despertar y primera acción consciente)
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.rutina_inicio || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, rutina_inicio: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🧠</span> Bloque de Trabajo Profundo (Duración, eliminación de estímulos y enfoque)
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.bloque_trabajo_profundo || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, bloque_trabajo_profundo: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🌙</span> Cierre y Desconexión (Límite exacto e innegociable de la jornada)
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.cierre_desconexion || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, cierre_desconexion: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            DIMENSIÓN 4: ESTÁNDAR DE COMPETENCIA PROFESIONAL
            ========================================================= */}
        {activeDimensionTab === 4 && (
          <div className="space-y-6 rounded-3xl bg-[#050505]/95 border border-white/10 p-6 sm:p-8">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>📐</span> Dimensión 4: Estándar de Competencia Profesional
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Habilidades técnicas dominadas con maestría, sistema de auto-medición y el valor concreto entregado al mundo.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🛠️</span> Habilidades que domina con maestría técnica y profundidad
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.habilidades_maestria || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, habilidades_maestria: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>📊</span> Cómo documenta, mide y evalúa su propio progreso sin supervisión externa
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.metodo_evaluacion_progreso || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, metodo_evaluacion_progreso: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🎁</span> Qué valor concreto aporta a su comunidad, clientes o proyectos
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.valor_concreto_aportado || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, valor_concreto_aportado: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            DIMENSIÓN 5: DISCIPLINA FISIOLÓGICA
            ========================================================= */}
        {activeDimensionTab === 5 && (
          <div className="space-y-6 rounded-3xl bg-[#050505]/95 border border-white/10 p-6 sm:p-8">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>⚡</span> Dimensión 5: Disciplina Fisiológica (Sustrato Biológico)
              </h2>
              <p className="text-xs text-[#94a3b8]">
                El Yo Ideal necesita un motor biológico limpio, fuerte y reparado para sostener horas de alta exigencia mental.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🥗</span> Estándar de Alimentación y Combustible Diario
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.estandar_alimentacion || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, estandar_alimentacion: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🏃</span> Entrenamiento Físico (Fuerza, resistencia muscular y movilidad)
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.entrenamiento_fisico || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, entrenamiento_fisico: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🌙</span> Higiene del Sueño y Recuperación Nerviosa
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.higiene_sueno || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, higiene_sueno: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            DIMENSIÓN 6: FRONTERAS Y DINÁMICA RELACIONAL
            ========================================================= */}
        {activeDimensionTab === 6 && (
          <div className="space-y-6 rounded-3xl bg-[#050505]/95 border border-white/10 p-6 sm:p-8">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>🏛️</span> Dimensión 6: Fronteras y Dinámica Relacional
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Protege tu energía con fronteras infranqueables y trata a tus personas clave con máxima nobleza y respeto.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🛡️</span> ¿Quiénes tienen acceso a su tiempo y energía?
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.acceso_tiempo_energia || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, acceso_tiempo_energia: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🚫</span> ¿Cómo dice "no" a peticiones que desvían su propósito?
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.como_dice_no || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, como_dice_no: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              <div className="space-y-1.5 p-4 rounded-2xl bg-[#0a0a0a] border border-white/10">
                <label className="text-xs font-bold text-[#eed59b] flex items-center gap-1.5">
                  <span>🤝</span> ¿Cómo trata a sus colaboradores, socios y personas cercanas?
                </label>
                <textarea
                  rows={3}
                  value={yoIdeal?.trato_colaboradores_cercanos || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, trato_colaboradores_cercanos: e.target.value } : prev)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            PESTAÑA 7: LOS 3 FILTROS DE VALIDACIÓN
            ========================================================= */}
        {activeDimensionTab === 7 && (
          <div className="space-y-6 rounded-3xl bg-[#050505]/95 border border-white/10 p-6 sm:p-8">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <span>⚖️</span> Los 3 Filtros de Validación (Auditoría Anti-Autoengaño)
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Somete cada una de tus respuestas a estos 3 filtros para garantizar que tu diseño sea auténtico, inspirador y sostenible.
              </p>
            </div>

            <div className="space-y-5">
              {/* Filtro 1: Higgins */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-serif font-bold text-[#eed59b] flex items-center gap-2">
                      <span>1.</span> El Filtro de Higgins (Purga del "Yo Debería")
                    </h3>
                    <p className="text-xs text-[#94a3b8] mt-1">
                      ¿Esto lo escribí porque realmente expande mi potencial, o porque quiero la validación de mis padres, conocidos o la sociedad? Si huele a obligación externa para "encajar", tápalo.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={yoIdeal?.filtro_higgins_aprobado ?? true}
                      onChange={(e) => setYoIdeal(prev => prev ? { ...prev, filtro_higgins_aprobado: e.target.checked } : prev)}
                      className="w-5 h-5 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-emerald-400">Auditado</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={yoIdeal?.filtro_higgins_notas || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, filtro_higgins_notas: e.target.value } : prev)}
                  placeholder="Notas de auditoría del filtro Higgins..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              {/* Filtro 2: Boyatzis */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-serif font-bold text-[#eed59b] flex items-center gap-2">
                      <span>2.</span> El Filtro de Boyatzis (Resonancia Positiva)
                    </h3>
                    <p className="text-xs text-[#94a3b8] mt-1">
                      Al leerlo en voz alta, ¿sientes claridad y dirección, o te invade una sensación de culpa y asfixia? El Yo Ideal debe inspirar tracción, no paralizar por autoexigencia tóxica.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={yoIdeal?.filtro_boyatzis_aprobado ?? true}
                      onChange={(e) => setYoIdeal(prev => prev ? { ...prev, filtro_boyatzis_aprobado: e.target.checked } : prev)}
                      className="w-5 h-5 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-emerald-400">Auditado</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={yoIdeal?.filtro_boyatzis_notas || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, filtro_boyatzis_notas: e.target.value } : prev)}
                  placeholder="Notas de resonancia y tracción..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>

              {/* Filtro 3: Principio de Aproximación Sucesiva */}
              <div className="p-4 rounded-2xl bg-[#0a0a0a] border border-white/10 space-y-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#eed59b] flex items-center gap-2">
                    <span>3.</span> El Principio de Aproximación Sucesiva (Compás de Calibración)
                  </h3>
                  <p className="text-xs text-[#94a3b8] mt-1">
                    El Yo Ideal no es un destino estático al que se llega de golpe; es un compás. Si tus decisiones del día convergen con esta hoja en un <strong>70% o más</strong>, estás cerrando la brecha de incongruencia y consolidando tu nueva identidad.
                  </p>
                </div>
                <textarea
                  rows={2}
                  value={yoIdeal?.principio_aproximacion_notas || ''}
                  onChange={(e) => setYoIdeal(prev => prev ? { ...prev, principio_aproximacion_notas: e.target.value } : prev)}
                  placeholder="Cómo calibrarás tu 70% de congruencia diaria..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#eed59b]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE SCRIPT SQL */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#080808] border border-white/15 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-serif font-bold text-white text-base flex items-center gap-2">
                <span>📜</span> Script SQL para Supabase (Tabla Yo Ideal y Horarios Flexibles)
              </h3>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="text-[#94a3b8] hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#94a3b8]">
              Copia y pega este código en tu <strong>Supabase SQL Editor</strong> para crear la tabla <code className="text-[#eed59b]">mi_yo_ideal</code> y desbloquear la flexibilidad de horarios sin restricciones.
            </p>

            <pre className="bg-[#030303] p-4 rounded-xl text-[11px] font-mono text-slate-300 max-h-64 overflow-y-auto border border-white/10">
              {SQL_MIGRATION_SCRIPT}
            </pre>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={copySqlToClipboard}
                className="px-5 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-semibold hover:bg-[#3b82f6] transition-colors flex items-center gap-1.5"
              >
                <span>{copiedSql ? '✓ ¡Copiado!' : '📋 Copiar Código SQL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdealSelfView;

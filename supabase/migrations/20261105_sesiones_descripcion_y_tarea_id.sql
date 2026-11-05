-- =========================================================================
-- MIGRACIÓN: CONGRUENCIA TOTAL TAREAS - SESIONES DE ACTIVIDAD
-- 1. Añadir campo 'descripcion' (nombre de la tarea/actividad) a sesiones_flujo
-- 2. Añadir campo 'tarea_id' (vínculo formal a la tarea planificada) a sesiones_flujo
-- =========================================================================

ALTER TABLE public.sesiones_flujo 
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS tarea_id uuid REFERENCES public.tareas_planificadas(id) ON DELETE SET NULL;

-- Notificar a PostgREST para recargar el esquema en Supabase
NOTIFY pgrst, 'reload schema';

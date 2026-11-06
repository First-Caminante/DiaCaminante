-- =========================================================================
-- MIGRACIÓN: CONGRUENCIA TOTAL TAREAS - SESIONES DE ACTIVIDAD
-- 1. Añadir campo 'descripcion' (nombre de la tarea/actividad) a sesiones_flujo
-- 2. Añadir campo 'tipo_trabajo' (PROFUNDO o SUPERFICIAL) a sesiones_flujo
-- 3. Añadir campo 'tarea_id' (vínculo formal a la tarea planificada) a sesiones_flujo
-- 4. Añadir campo 'categoria' ('trabajo', 'ejercicio', 'comida', 'sueno') a tareas_planificadas
-- =========================================================================

ALTER TABLE public.sesiones_flujo 
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS tipo_trabajo text DEFAULT 'PROFUNDO',
  ADD COLUMN IF NOT EXISTS tarea_id uuid REFERENCES public.tareas_planificadas(id) ON DELETE SET NULL;

ALTER TABLE public.tareas_planificadas 
  ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'trabajo';

-- Notificar a PostgREST para recargar el esquema en Supabase
NOTIFY pgrst, 'reload schema';

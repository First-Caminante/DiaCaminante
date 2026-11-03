-- Migración: Registro especializado de Sueño, Alimentación y Ejercicio Físico
-- Ejecutar en Supabase -> SQL Editor

-- 1. Tabla de Registros de Sueño y Descanso
CREATE TABLE IF NOT EXISTS public.registros_sueno (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_id uuid REFERENCES public.dias_salud(id) ON DELETE CASCADE,
  hora_inicio text NOT NULL,
  hora_fin text NOT NULL,
  horas numeric NOT NULL DEFAULT 8.0,
  calidad_sueno text NOT NULL DEFAULT 'Reparador',
  sensacion text DEFAULT 'Descansado',
  notas text DEFAULT '',
  registrado_a timestamptz DEFAULT now()
);

-- 2. Tabla de Registros de Comida / Alimentación
CREATE TABLE IF NOT EXISTS public.registros_comida (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_id uuid REFERENCES public.dias_salud(id) ON DELETE CASCADE,
  hora text NOT NULL,
  tipo_comida text NOT NULL DEFAULT 'Almuerzo',
  descripcion text NOT NULL,
  calidad text NOT NULL DEFAULT 'Limpio / Nutritivo',
  registrado_a timestamptz DEFAULT now()
);

-- 3. Tabla de Registros de Ejercicio Físico / Entrenamiento
CREATE TABLE IF NOT EXISTS public.registros_ejercicio (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_id uuid REFERENCES public.dias_salud(id) ON DELETE CASCADE,
  hora_inicio text NOT NULL,
  hora_fin text NOT NULL,
  duracion_horas numeric NOT NULL DEFAULT 1.0,
  tipo_ejercicio text NOT NULL DEFAULT 'Calistenia / Corporal',
  descripcion text NOT NULL DEFAULT '',
  intensidad text NOT NULL DEFAULT 'Alta',
  registrado_a timestamptz DEFAULT now()
);

-- 4. Columnas para sesiones_flujo (si aún no estuvieran presentes)
ALTER TABLE public.sesiones_flujo ADD COLUMN IF NOT EXISTS hora_inicio text;
ALTER TABLE public.sesiones_flujo ADD COLUMN IF NOT EXISTS hora_fin text;

-- Habilitar RLS e índices
ALTER TABLE public.registros_sueno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_comida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_ejercicio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total a registros_sueno" ON public.registros_sueno FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total a registros_comida" ON public.registros_comida FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total a registros_ejercicio" ON public.registros_ejercicio FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sueno_dia_id ON public.registros_sueno(dia_id);
CREATE INDEX IF NOT EXISTS idx_comida_dia_id ON public.registros_comida(dia_id);
CREATE INDEX IF NOT EXISTS idx_ejercicio_dia_id ON public.registros_ejercicio(dia_id);

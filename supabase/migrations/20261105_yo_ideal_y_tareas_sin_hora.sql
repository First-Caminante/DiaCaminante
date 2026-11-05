-- =========================================================================
-- MIGRACIÓN: ARCO DEL PUNTO Y APARTE
-- 1. Soporte para Tareas sin Horario Inicial (Horario Flexible)
-- 2. Tabla y Storage para "Mi Yo Ideal" con las 6 Dimensiones y 3 Filtros
-- =========================================================================

-- 1. FLEXIBILIZACIÓN DE HORARIOS EN TAREAS PLANIFICADAS
-- Permite guardar tareas sin hora_inicio ni hora_fin fija para asignarla después
ALTER TABLE public.tareas_planificadas ALTER COLUMN hora_inicio DROP NOT NULL;
ALTER TABLE public.tareas_planificadas ALTER COLUMN hora_fin DROP NOT NULL;

-- Actualizar o retirar restricción check_rango_horario para permitir tareas con horario flexible
ALTER TABLE public.tareas_planificadas DROP CONSTRAINT IF EXISTS check_rango_horario;
ALTER TABLE public.tareas_planificadas 
  ADD CONSTRAINT check_rango_horario 
  CHECK (
    hora_inicio IS NULL OR 
    hora_fin IS NULL OR 
    hora_inicio = '00:00' OR 
    hora_inicio <= hora_fin
  );

-- Columna opcional para registrar la hora exacta de finalización
ALTER TABLE public.tareas_planificadas ADD COLUMN IF NOT EXISTS hora_completada text;

-- =========================================================================
-- 2. TABLA PARA "MI YO IDEAL"
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mi_yo_ideal (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_arquetipo text DEFAULT 'El Arquitecto Silencioso',
  lema_personal text DEFAULT 'Elijo la incomodidad del esfuerzo antes que el alivio de la postergación.',
  avatar_url text DEFAULT '',
  
  -- Dimensión 1: Identidad Nuclear y Valores
  principios_rectores text[] DEFAULT ARRAY[
    'Elijo la incomodidad del esfuerzo antes que el alivio de la postergación.',
    'Hablo con honestidad directa y respeto absoluto.',
    'Construyo maestría en silencio; dejo que los entregables hablen.',
    'Trato mi cuerpo y mi descanso como instrumentos sagrados de mi propósito.'
  ],

  -- Dimensión 2: Respuesta Operativa ante la Fricción (Bajo Fuego)
  reaccion_rechazo_critica text DEFAULT 'Desvinculo mi ego del resultado. Analizo la crítica como datos objetivos de retroalimentación en 60 segundos y retomo el rumbo.',
  primeros_5min_error_grave text DEFAULT 'Detengo cualquier reactividad o justificación. Respiro profundo, asumo responsabilidad total y formulo un plan de contención de 3 pasos.',
  gestion_aburrimiento_desmotivacion text DEFAULT 'No negocio con mi estado de ánimo. El foco no depende del entusiasmo, sino del compromiso con el estándar elegido.',

  -- Dimensión 3: Hábitos Atómicos de Soporte
  rutina_inicio text DEFAULT '06:00 AM: Luz natural, hidratación inmediata, 10 min de silencio y apertura del Plan de Vuelo sin pantallas.',
  bloque_trabajo_profundo text DEFAULT '08:00 AM a 11:30 AM: 3 horas netas sin notificaciones, teléfono en otra habitación, inmersión en la frontera del problema más complejo.',
  cierre_desconexion text DEFAULT '21:30 PM: Protocolo de Cierre formal, revisión de métricas, apagado de pantallas y confinar pensamientos hasta el alba.',

  -- Dimensión 4: Estándar de Competencia Profesional
  habilidades_maestria text DEFAULT 'Arquitectura de software de alto impacto, pensamiento estructurado de primer orden y capacidad de concentración prolongada.',
  metodo_evaluacion_progreso text DEFAULT 'Auditoría diaria en el Arco del Punto y Aparte: registro de horas netas, ratio de incomodidad y cumplimiento de compromisos.',
  valor_concreto_aportado text DEFAULT 'Sistemas confiables, claridad operativa para mis proyectos y liderazgo sereno para mi entorno.',

  -- Dimensión 5: Disciplina Fisiológica
  estandar_alimentacion text DEFAULT 'Comida limpia y nutritiva como combustible cognitivo. Hidratación constante y evitar picos de glucosa que nublen la lucidez mental.',
  entrenamiento_fisico text DEFAULT '4 a 5 sesiones semanales de fuerza y resistencia cardiovascular. El esfuerzo muscular templa la resiliencia mental.',
  higiene_sueno text DEFAULT '8 horas no negociables en oscuridad y frescura total. Sin pantallas 60 minutos antes de dormir.',

  -- Dimensión 6: Fronteras y Dinámica Relacional
  acceso_tiempo_energia text DEFAULT 'Acceso selectivo y deliberado. Mi tiempo productivo está blindado contra urgencias ajenas y distracciones.',
  como_dice_no text DEFAULT 'Digo no de forma sobria, rápida y cortés, sin excusas elaboradas ni culpa: "En este momento mi foco está asignado a otra prioridad."',
  trato_colaboradores_cercanos text DEFAULT 'Generosidad en la escucha, exigencia con los estándares compartidos y empatía profunda con su desarrollo humano.',

  -- Los 3 Filtros de Validación
  filtro_higgins_aprobado boolean DEFAULT true,
  filtro_higgins_notas text DEFAULT 'Auditado: Cada principio expande mi potencial real y no proviene de la necesidad de aprobación social.',
  filtro_boyatzis_aprobado boolean DEFAULT true,
  filtro_boyatzis_notas text DEFAULT 'Auditado: Al leer este compás siento dirección, calma y convicción de tracción; no asfixia por autoexigencia tóxica.',
  principio_aproximacion_notas text DEFAULT 'Calibración activa: Busco al menos un 70% de congruencia diaria entre mis decisiones y este diseño.',

  creado_a timestamptz DEFAULT now(),
  actualizado_a timestamptz DEFAULT now()
);

-- RLS y Políticas
ALTER TABLE public.mi_yo_ideal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total a mi_yo_ideal" ON public.mi_yo_ideal FOR ALL USING (true) WITH CHECK (true);

-- Insertar perfil inicial por defecto si está vacío
INSERT INTO public.mi_yo_ideal (id)
SELECT 'a0000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM public.mi_yo_ideal LIMIT 1);

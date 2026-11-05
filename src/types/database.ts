export type Intensidad = 'Baja' | 'Media' | 'Alta';
export type Incomodidad = 'Baja' | 'Media' | 'Alta';
export type FrioMental = 'Frio total' | 'Inspirado' | 'Avido';
export type TipoTrabajo = 'PROFUNDO' | 'SUPERFICIAL';
export type EstadoTarea = 'pendiente' | 'hecho' | 'incompleto' | 'no_hecho';

// Tipos específicos para Sueño, Nutrición y Ejercicio
export type CalidadSueno = 'Profundo' | 'Reparador' | 'Ligero' | 'Interrumpido';
export type SensacionSueno = 'Energizado' | 'Descansado' | 'Neutro' | 'Cansado';

export type TipoComida = 'Desayuno' | 'Almuerzo' | 'Cena' | 'Merienda / Snack' | 'Pre-entreno' | 'Post-entreno';
export type CalidadComida = 'Limpio / Nutritivo' | 'Moderado' | 'Libre / Procesado';

export type TipoEjercicio =
  | 'Calistenia / Corporal'
  | 'Gimnasio / Pesas'
  | 'Running / Cardio'
  | 'Movilidad / Yoga'
  | 'Deporte / Marcial'
  | string;

export interface RegistroSueno {
  id: string;
  dia_id: string;
  hora_inicio: string; // HH:MM
  hora_fin: string;    // HH:MM
  horas: number;
  calidad_sueno: CalidadSueno;
  sensacion?: SensacionSueno | null;
  notas?: string | null;
  registrado_a: string;
}

export interface RegistroComida {
  id: string;
  dia_id: string;
  hora: string; // HH:MM
  tipo_comida: TipoComida;
  descripcion: string;
  calidad: CalidadComida;
  registrado_a: string;
}

export interface RegistroEjercicio {
  id: string;
  dia_id: string;
  hora_inicio: string; // HH:MM
  hora_fin: string;    // HH:MM
  duracion_horas: number;
  tipo_ejercicio: TipoEjercicio;
  descripcion: string; // Qué ejercicios hice (ej: 4x12 dominadas, sentadillas...)
  intensidad: Intensidad;
  registrado_a: string;
}

export interface DiaSalud {
  id: string;
  fecha: string; // YYYY-MM-DD
  alimento?: number | null; // 1-5
  ejercicio_horas?: number | null;
  ejercicio_intensidad?: Intensidad | null;
  frio_mental?: FrioMental | null;
  cierre_realizado: boolean;
  cierre_timestamp?: string | null;
}

export interface SesionFlujo {
  id: string;
  dia_id: string;
  tipo: string;
  horas_netas: number;
  intensidad: Intensidad;
  incomodidad: Incomodidad;
  calidad: string;
  registrado_a: string;
  hora_inicio?: string; // Formato HH:MM
  hora_fin?: string;    // Formato HH:MM
  descripcion?: string; // Nombre / Descripción concreta de la tarea o actividad
  tarea_id?: string;    // ID de la tarea planificada vinculada
}

export interface TareaPlanificada {
  id: string;
  dia_origen_id: string;
  fecha_objetivo: string; // YYYY-MM-DD
  hora_inicio?: string | null; // HH:MM (null o '00:00' para flexible)
  hora_fin?: string | null; // HH:MM (null o '00:01' para flexible)
  tipo_trabajo: TipoTrabajo;
  descripcion: string;
  horas_netas_estimadas: number;
  estado: EstadoTarea;
  motivo_desvio?: string | null;
  hora_completada?: string | null; // HH:MM de finalización o realización
  creado_a?: string;
}

export interface MiYoIdeal {
  id?: string;
  nombre_arquetipo: string;
  lema_personal: string;
  avatar_url?: string;
  
  // Dimensión 1: Identidad Nuclear y Valores
  principios_rectores: string[];

  // Dimensión 2: Respuesta Operativa ante la Fricción (Bajo Fuego)
  reaccion_rechazo_critica: string;
  primeros_5min_error_grave: string;
  gestion_aburrimiento_desmotivacion: string;

  // Dimensión 3: Hábitos Atómicos de Soporte
  rutina_inicio: string;
  bloque_trabajo_profundo: string;
  cierre_desconexion: string;

  // Dimensión 4: Estándar de Competencia Profesional
  habilidades_maestria: string;
  metodo_evaluacion_progreso: string;
  valor_concreto_aportado: string;

  // Dimensión 5: Disciplina Fisiológica
  estandar_alimentacion: string;
  entrenamiento_fisico: string;
  higiene_sueno: string;

  // Dimensión 6: Fronteras y Dinámica Relacional
  acceso_tiempo_energia: string;
  como_dice_no: string;
  trato_colaboradores_cercanos: string;

  // Los 3 Filtros de Validación
  filtro_higgins_aprobado: boolean;
  filtro_higgins_notas: string;
  filtro_boyatzis_aprobado: boolean;
  filtro_boyatzis_notas: string;
  principio_aproximacion_notas: string;

  creado_a?: string;
  actualizado_a?: string;
}

export interface VistaResumenDiario {
  id: string;
  fecha: string;
  cierre_realizado: boolean;
  cierre_timestamp?: string | null;
  alimento?: number | null;
  ejercicio_horas?: number | null;
  ejercicio_intensidad?: string | null;
  frio_mental?: string | null;
  total_horas_netas?: number | null;
  sesiones?: SesionFlujo[] | string | null;
  tareas?: TareaPlanificada[] | string | null;
  [key: string]: any;
}

export interface DiaHoyResponse {
  dia: DiaSalud;
  totalHorasNetas: number;
  cierreRealizado: boolean;
  sesiones: SesionFlujo[];
  tareas: TareaPlanificada[];
  suenos?: RegistroSueno[];
  comidas?: RegistroComida[];
  ejercicios?: RegistroEjercicio[];
  tiempoServidor?: {
    fecha: string;
    horaCompleta: string;
    horaCorta: string;
    hora: number;
    minuto: number;
    segundo: number;
    timestampMs: number;
  };
}

export interface TendenciaDia {
  fecha: string;
  horasNetas: number;
  sesionesCount: number;
  cierreRealizado: boolean;
  cierreTimestamp?: string | null;
  alimento?: number | null;
  ejercicioHoras?: number | null;
  ejercicioIntensidad?: string | null;
  frioMental?: string | null;
  distribucionIntensidad?: { Alta: number; Media: number; Baja: number };
  distribucionIncomodidad?: { Alta: number; Media: number; Baja: number };
  sesiones?: SesionFlujo[];
}

export interface DiaHistoricoResumen {
  fecha: string;
  horasNetas: number;
  sesionesCount: number;
  sesiones: SesionFlujo[];
  cierreRealizado: boolean;
  cierreTimestamp?: string | null;
  alimento?: number | null;
  ejercicioHoras?: number | null;
  ejercicioIntensidad?: string | null;
  frioMental?: string | null;
}

export interface DetalleDiaHistorico {
  fecha: string;
  dia?: DiaSalud | null;
  totalHorasNetas: number;
  sesionesCount: number;
  cierreRealizado: boolean;
  cierreTimestamp?: string | null;
  alimento?: number | null;
  ejercicioHoras?: number | null;
  ejercicioIntensidad?: string | null;
  frioMental?: string | null;
  sesiones: SesionFlujo[];
  tareas: TareaPlanificada[];
  suenos?: RegistroSueno[];
  comidas?: RegistroComida[];
  ejercicios?: RegistroEjercicio[];
  tiempoServidor?: {
    fecha: string;
    horaCompleta: string;
    horaCorta: string;
    hora: number;
    minuto: number;
    segundo: number;
    timestampMs: number;
  };
}

export interface DistribucionTipo {
  tipo: string;
  horas: number;
  porcentaje: number;
  count: number;
}

export interface MetricasHoy {
  fecha: string;
  horasNetas: number;
  sesionesCount: number;
  cierreRealizado: boolean;
  ejercicioHoras: number;
  alimento?: number | null;
  frioMental?: string | null;
  distribucionIntensidad: { Alta: number; Media: number; Baja: number };
  distribucionIncomodidad: { Alta: number; Media: number; Baja: number };
  sesiones?: SesionFlujo[];
}

export interface MatrizCalidad {
  Alta: { Alta: number; Media: number; Baja: number };
  Media: { Alta: number; Media: number; Baja: number };
  Baja: { Alta: number; Media: number; Baja: number };
}

export interface EstadisticasResponse {
  totalHorasNetas: number;
  totalSesiones: number;
  diasActivosCount: number;
  promedioHorasDiarias: number;
  rachaActual: number;
  rachaMaxima: number;
  tasaCierre: number;
  distribucionTipos: DistribucionTipo[];
  distribucionIntensidad: { Alta: number; Media: number; Baja: number };
  distribucionIncomodidad: { Alta: number; Media: number; Baja: number };
  matrizCalidad: MatrizCalidad;
  matrizCalidadHoy: MatrizCalidad;
  hoy: MetricasHoy;
  tendenciaDias: TendenciaDia[];
  diasHistoricosConActividad?: DiaHistoricoResumen[];
  salud: {
    promedioAlimento: number;
    totalEjercicioHoras: number;
    diasConEjercicio: number;
    distribucionFrioMental: Record<string, number>;
  };
  tareas: {
    total: number;
    hechas: number;
    incompletas: number;
    noHechas: number;
    pendientes: number;
    tasaCumplimiento: number;
  };
}

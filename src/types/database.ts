export type Intensidad = 'Baja' | 'Media' | 'Alta';
export type Incomodidad = 'Baja' | 'Media' | 'Alta';
export type FrioMental = 'Frio total' | 'Inspirado' | 'Avido';
export type TipoTrabajo = 'PROFUNDO' | 'SUPERFICIAL';
export type EstadoTarea = 'pendiente' | 'hecho' | 'incompleto' | 'no_hecho';

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
}

export interface TareaPlanificada {
  id: string;
  dia_origen_id: string;
  fecha_objetivo: string; // YYYY-MM-DD
  hora_inicio: string; // HH:MM
  hora_fin: string; // HH:MM
  tipo_trabajo: TipoTrabajo;
  descripcion: string;
  horas_netas_estimadas: number;
  estado: EstadoTarea;
  motivo_desvio?: string | null;
  creado_a?: string;
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

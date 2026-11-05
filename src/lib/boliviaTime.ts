/**
 * Utilitario oficial para la gestión del tiempo y fecha en Bolivia (La Paz).
 * Zona Horaria: America/La_Paz (UTC-4 todo el año, sin cambio de horario de verano).
 * 
 * Garantiza que sin importar la hora o zona horaria configurada en la computadora
 * o dispositivo móvil del usuario, la jornada, el reloj en pantalla y los cierres
 * se rijan estrictamente por la hora oficial de Bolivia.
 */

let serverTimeOffsetMs = 0;
let isSynced = false;

/**
 * Sincroniza el offset con el timestamp UTC real provisto por el servidor
 */
export function setServerTimeSync(serverTimestampMs: number): void {
  if (typeof serverTimestampMs === 'number' && !isNaN(serverTimestampMs) && serverTimestampMs > 0) {
    serverTimeOffsetMs = serverTimestampMs - Date.now();
    isSynced = true;
  }
}

export function isServerTimeSynced(): boolean {
  return isSynced;
}

/**
 * Obtiene un objeto Date calibrado con el tiempo del servidor
 */
export function getCalibratedDate(): Date {
  return new Date(Date.now() + serverTimeOffsetMs);
}

export interface BoliviaDateTime {
  fecha: string;        // 'YYYY-MM-DD'
  horaCompleta: string; // 'HH:MM:SS'
  horaCorta: string;    // 'HH:MM'
  hora: number;         // 0-23
  minuto: number;       // 0-59
  segundo: number;      // 0-59
  diaSemana: string;    // 'lunes', 'martes', etc.
  textoFechaLarga: string; // 'Jueves, 5 de noviembre'
  timestampMs: number;
}

/**
 * Obtiene la fecha y hora exacta en la zona horaria de Bolivia (America/La_Paz)
 */
export function getBoliviaNow(customDate?: Date): BoliviaDateTime {
  const targetDate = customDate || getCalibratedDate();

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(targetDate);
    const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    const year = getVal('year');
    const month = getVal('month');
    const day = getVal('day');
    const hourStr = getVal('hour');
    const minuteStr = getVal('minute');
    const secondStr = getVal('second');

    const hora = parseInt(hourStr, 10);
    const minuto = parseInt(minuteStr, 10);
    const segundo = parseInt(secondStr, 10);

    // Formateador en español para fecha larga
    const dateEspanolFormatter = new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const weekdayFormatter = new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      weekday: 'long',
    });

    const textoFechaLarga = dateEspanolFormatter.format(targetDate);
    const diaSemana = weekdayFormatter.format(targetDate);

    return {
      fecha: `${year}-${month}-${day}`,
      horaCompleta: `${hourStr}:${minuteStr}:${secondStr}`,
      horaCorta: `${hourStr}:${minuteStr}`,
      hora,
      minuto,
      segundo,
      diaSemana,
      textoFechaLarga: textoFechaLarga.charAt(0).toUpperCase() + textoFechaLarga.slice(1),
      timestampMs: targetDate.getTime(),
    };
  } catch (err) {
    // Fallback matemático exacto para Bolivia (UTC - 4 horas siempre)
    const utcMs = targetDate.getTime() + targetDate.getTimezoneOffset() * 60000;
    const boliviaMs = utcMs - 4 * 3600000;
    const bDate = new Date(boliviaMs);

    const year = bDate.getFullYear();
    const month = String(bDate.getMonth() + 1).padStart(2, '0');
    const day = String(bDate.getDate()).padStart(2, '0');
    const hour = bDate.getHours();
    const minute = bDate.getMinutes();
    const second = bDate.getSeconds();

    const hourStr = String(hour).padStart(2, '0');
    const minStr = String(minute).padStart(2, '0');
    const secStr = String(second).padStart(2, '0');

    return {
      fecha: `${year}-${month}-${day}`,
      horaCompleta: `${hourStr}:${minStr}:${secStr}`,
      horaCorta: `${hourStr}:${minStr}`,
      hora: hour,
      minuto: minute,
      segundo: second,
      diaSemana: 'hoy',
      textoFechaLarga: `${day}/${month}/${year}`,
      timestampMs: targetDate.getTime(),
    };
  }
}

/**
 * Helper para obtener la fecha de hoy en Bolivia (formato YYYY-MM-DD)
 */
export function getBoliviaTodayStr(): string {
  return getBoliviaNow().fecha;
}

/**
 * Helper para obtener la hora corta actual de Bolivia (formato HH:MM)
 */
export function getBoliviaShortTimeStr(): string {
  return getBoliviaNow().horaCorta;
}

/**
 * Consulta la hora oficial del servidor vía API para calibrar el offset
 */
export async function fetchServerTime(): Promise<BoliviaDateTime> {
  try {
    const res = await fetch('/api/tiempo');
    if (res.ok) {
      const data = await res.json();
      if (data?.timestampMs) {
        setServerTimeSync(data.timestampMs);
      }
    }
  } catch (e) {
    console.warn('No se pudo calibrar tiempo contra /api/tiempo, usando hora local de Bolivia:', e);
  }
  return getBoliviaNow();
}

import { linearScale, type ContinuousScale, type Domain, type Range } from './linear';

/**
 * Escala de tiempo: lineal en milisegundos UTC, pero con ticks alineados al calendario.
 *
 * Un paso "bonito" de 2.5 días no sirve para fechas: la gente espera lunes, inicios de mes,
 * horas en punto. Por eso cada intervalo sabe hacer dos cosas: `floor` (bajar un instante al
 * inicio de su unidad) y `next` (avanzar una unidad). Los ticks se generan en UTC para que el
 * resultado no dependa de la zona horaria del navegador que renderiza.
 */

export interface TimeInterval {
  /** Nombre corto, p. ej. `5m`, `1d`, `3M`. */
  readonly name: string;
  /** Duración aproximada en ms; meses y años usan un promedio solo para elegir intervalo. */
  readonly approxMs: number;
  floor(ms: number): number;
  next(ms: number): number;
  /** Formato de etiqueta cuando este es el intervalo entre ticks. */
  readonly format: Intl.DateTimeFormatOptions;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Intervalos de duración fija: múltiplos de segundo, minuto, hora o día. */
function fixed(
  name: string,
  unit: number,
  mult: number,
  format: Intl.DateTimeFormatOptions,
): TimeInterval {
  const ms = unit * mult;
  return {
    name,
    approxMs: ms,
    // Para horas/minutos/segundos alinear por módulo equivale a alinear al reloj UTC, porque
    // la época (1970-01-01T00:00Z) cae en una hora en punto.
    floor: (t) => Math.floor(t / ms) * ms,
    next: (t) => t + ms,
    format,
  };
}

/** Semanas que empiezan en lunes (la época, 1970-01-01, fue jueves). */
function week(): TimeInterval {
  const ms = 7 * DAY;
  return {
    name: '7d',
    approxMs: ms,
    floor: (t) => Math.floor((t + 3 * DAY) / ms) * ms - 3 * DAY,
    next: (t) => t + ms,
    format: dm,
  };
}

function months(name: string, mult: number, format: Intl.DateTimeFormatOptions): TimeInterval {
  return {
    name,
    approxMs: 30.44 * DAY * mult,
    floor(t) {
      const d = new Date(t);
      const m = Math.floor(d.getUTCMonth() / mult) * mult;
      return Date.UTC(d.getUTCFullYear(), m, 1);
    },
    next(t) {
      const d = new Date(t);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mult, 1);
    },
    format,
  };
}

function years(name: string, mult: number): TimeInterval {
  return {
    name,
    approxMs: 365.25 * DAY * mult,
    floor(t) {
      const y = new Date(t).getUTCFullYear();
      return Date.UTC(Math.floor(y / mult) * mult, 0, 1);
    },
    next(t) {
      return Date.UTC(new Date(t).getUTCFullYear() + mult, 0, 1);
    },
    format: { year: 'numeric' },
  };
}

const hm: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const ms: Intl.DateTimeFormatOptions = { minute: '2-digit', second: '2-digit' };
const dm: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const my: Intl.DateTimeFormatOptions = { month: 'short', year: '2-digit' };

/** Candidatos de menor a mayor. Se elige el primero cuyo paso dé ≤ `count` ticks. */
export const TIME_INTERVALS: readonly TimeInterval[] = [
  fixed('1s', SECOND, 1, ms),
  fixed('5s', SECOND, 5, ms),
  fixed('15s', SECOND, 15, ms),
  fixed('30s', SECOND, 30, ms),
  fixed('1m', MINUTE, 1, hm),
  fixed('5m', MINUTE, 5, hm),
  fixed('15m', MINUTE, 15, hm),
  fixed('30m', MINUTE, 30, hm),
  fixed('1h', HOUR, 1, hm),
  fixed('3h', HOUR, 3, hm),
  fixed('6h', HOUR, 6, hm),
  fixed('12h', HOUR, 12, hm),
  fixed('1d', DAY, 1, dm),
  fixed('2d', DAY, 2, dm),
  week(),
  months('1M', 1, my),
  months('3M', 3, my),
  months('6M', 6, my),
  years('1Y', 1),
  years('2Y', 2),
  years('5Y', 5),
  years('10Y', 10),
  years('20Y', 20),
  years('50Y', 50),
  years('100Y', 100),
];

/** Intervalo cuyo paso produce como máximo `count` ticks en `span` ms (o el mayor si ninguno). */
export function pickInterval(span: number, count: number): TimeInterval {
  const target = span / Math.max(1, count);
  for (const it of TIME_INTERVALS) if (it.approxMs >= target) return it;
  return TIME_INTERVALS[TIME_INTERVALS.length - 1] as TimeInterval;
}

/** Ticks alineados al calendario dentro de `[lo, hi]`. */
export function timeTicks(
  domain: Domain,
  count: number,
): { values: number[]; interval: TimeInterval } {
  const lo = Math.min(domain[0], domain[1]);
  const hi = Math.max(domain[0], domain[1]);
  const interval = pickInterval(hi - lo, count);
  const values: number[] = [];
  let t = interval.floor(lo);
  if (t < lo) t = interval.next(t);
  // Cota de seguridad: nunca más de 10× lo pedido, aunque el dominio sea raro.
  while (t <= hi && values.length < count * 10) {
    values.push(t);
    t = interval.next(t);
  }
  return { values, interval };
}

/**
 * Formateador para un intervalo. Cuando los ticks son de horas/minutos y el rango cruza un
 * día, el primer tick de cada día lleva también la fecha, para no perder el contexto.
 */
export function timeTickFormatter(
  interval: TimeInterval,
  locale = 'es-MX',
  timeZone = 'UTC',
): (value: number, index: number, values: readonly number[]) => string {
  const main = new Intl.DateTimeFormat(locale, { ...interval.format, timeZone });
  const subDay = interval.approxMs < DAY;
  const dayFmt = new Intl.DateTimeFormat(locale, { ...dm, timeZone });
  return (v, i, values) => {
    const label = main.format(v);
    if (!subDay) return label;
    const prev = values[i - 1];
    const dayChanged = i === 0 || (prev !== undefined && dayOf(prev) !== dayOf(v));
    return dayChanged ? `${dayFmt.format(v)} ${label}` : label;
  };
}

function dayOf(t: number): number {
  return Math.floor(t / DAY);
}

/**
 * Escala continua para columnas `time`. Igual que `linearScale` para píxeles; distinta en
 * `ticks`, `tickStep` y `nice`, que trabajan con intervalos de calendario.
 */
export function timeScale(domain: Domain, range: Range): ContinuousScale {
  const base = linearScale(domain, range);
  const scale: ContinuousScale = {
    ...base,
    kind: 'time',
    ticks: (count) => timeTicks(base.domain, count).values,
    tickStep: (count) => pickInterval(Math.abs(base.domain[1] - base.domain[0]), count).approxMs,
    /**
     * Extiende a límites de calendario de un intervalo 4× más fino que el de los ticks:
     * redondear un año de datos a trimestres dejaría meses vacíos a los lados.
     */
    nice(count) {
      const [d0, d1] = base.domain;
      const lo = Math.min(d0, d1);
      const hi = Math.max(d0, d1);
      const it = pickInterval(hi - lo, count * 4);
      const nlo = it.floor(lo);
      const ceil = it.floor(hi);
      const nhi = ceil === hi ? hi : it.next(ceil);
      return timeScale(d0 <= d1 ? [nlo, nhi] : [nhi, nlo], range);
    },
    withRange: (next) => timeScale(base.domain, next),
  };
  return scale;
}

export type TimeUnit =
  'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'decade';

/** Inicio de la unidad de calendario (UTC) que contiene `ms`; la semana empieza en lunes. */
export function floorTime(ms: number, unit: TimeUnit): number {
  if (ms !== ms) return ms;
  switch (unit) {
    case 'second':
      return Math.floor(ms / SECOND) * SECOND;
    case 'minute':
      return Math.floor(ms / MINUTE) * MINUTE;
    case 'hour':
      return Math.floor(ms / HOUR) * HOUR;
    case 'day':
      return Math.floor(ms / DAY) * DAY;
    case 'week': {
      // La época (jueves) está 3 días después del lunes anterior.
      return Math.floor((ms + 3 * DAY) / (7 * DAY)) * 7 * DAY - 3 * DAY;
    }
    case 'decade': {
      const d = new Date(ms);
      return Date.UTC(Math.floor(d.getUTCFullYear() / 10) * 10, 0, 1);
    }
    case 'month':
    case 'quarter':
    case 'year': {
      const d = new Date(ms);
      const m =
        unit === 'year'
          ? 0
          : unit === 'quarter'
            ? Math.floor(d.getUTCMonth() / 3) * 3
            : d.getUTCMonth();
      return Date.UTC(d.getUTCFullYear(), m, 1);
    }
  }
}

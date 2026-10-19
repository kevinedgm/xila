import { quantiles, type NumericArray } from './stats';

/**
 * Ranura de estado (`type: 'box'` con `box.orientation: 'horizontal'`): responde en cinco
 * segundos "¿este dato está donde debería?" para varios grupos a la vez. Cada grupo es una fila;
 * su referencia define el "100 %" y el estado se lee en el relleno del punto y en una palabra.
 * Este módulo solo calcula: recibe el historial de cada grupo (el último valor es "hoy") y el
 * margen de evidencia que viene de fuera (pandas), y devuelve las filas con su estado, su unidad
 * y sus distancias. El dibujo vive en `Chart`.
 */

/**
 * Contra qué se compara cada grupo. `'history'`: su propio rango típico (banda de percentiles).
 * `'peak'`: su propio máximo como 100 %. `'previous'`: el periodo anterior como 0 %.
 * `{ group }`: otro grupo de la misma tabla, como línea común. `{ value }`: una cifra fija (meta).
 */
export type StatusReference =
  'history' | 'peak' | 'previous' | { readonly group: string } | { readonly value: number };

/**
 * Qué se lee en cinco segundos. `'evidence'`: claro / posible / dentro, con el margen.
 * `'direction'`: subiendo / estable / bajando frente a `window` periodos atrás. `'side'`: arriba /
 * abajo (o dentro) de la referencia. `'auto'` elige `'evidence'` si hay margen, `'direction'` con
 * referencia `'peak'` y `'side'` en los demás casos.
 */
export type StatusMode = 'auto' | 'evidence' | 'direction' | 'side' | 'none';

export type StatusLevel =
  'clear' | 'possible' | 'inside' | 'up' | 'stable' | 'down' | 'above' | 'below' | 'none';

export interface StatusGroup {
  /** Código de la categoría en la tabla. */
  readonly code: number;
  readonly name: string;
  /** Historial en el orden de las filas; el último es "hoy". */
  readonly values: Float64Array;
  /** Periodo de cada valor (ms o número), alineado con `values`; `null` si no se declaró. */
  readonly periods: Float64Array | null;
  /** Margen de evidencia de hoy; `NaN` si no viene. */
  readonly low: number;
  readonly high: number;
  /** Tamaño de muestra de hoy, si viene en una columna; `NaN` si no. */
  readonly count: number;
}

export interface StatusOptions {
  readonly reference: StatusReference;
  readonly status: StatusMode;
  /** `'direction'`: cambio relativo (0.05 = ±5 %) por debajo del cual el grupo está estable. */
  readonly threshold: number;
  /** `'direction'`: cuántos periodos atrás se compara. */
  readonly window: number;
  /** `'history'`: percentiles de la banda. */
  readonly range: readonly [number, number];
  readonly sort: 'status' | 'distance' | 'input';
  /** Con más grupos que esto se muestran los 8 más lejos de su referencia. */
  readonly maxRows: number;
}

export interface StatusRow {
  readonly code: number;
  readonly name: string;
  /** Valor de hoy en la unidad de la fila (absoluta, o % con `'peak'` y `'previous'`). */
  readonly value: number;
  /** Valor de hoy en la unidad de los datos. */
  readonly raw: number;
  /** Margen en la unidad de la fila; `NaN` sin margen. */
  readonly low: number;
  readonly high: number;
  /** Banda de rango típico (unidad de la fila) con referencia `'history'`; `null` en el resto. */
  readonly band: {
    readonly lo: number;
    readonly q1: number;
    readonly q3: number;
    readonly hi: number;
  } | null;
  /** Línea de referencia (unidad de la fila); `NaN` con `'history'`. */
  readonly reference: number;
  /** Historial sin el de hoy, en la unidad de la fila. */
  readonly history: Float64Array;
  /** Valor `window` periodos atrás (unidad de la fila), para la flecha de dirección; `NaN` si no hay. */
  readonly previous: number;
  readonly status: StatusLevel;
  /** Distancia con signo a la referencia (al borde de la banda si está fuera; 0 dentro). */
  readonly distance: number;
  /** Tamaño de muestra de hoy: la columna si viene, si no cuántos valores tiene el grupo. */
  readonly count: number;
  /** Periodo de hoy; `NaN` sin columna de periodo. */
  readonly period: number;
  /** `{ group }`: periodo desde el que está del mismo lado de la referencia; `NaN` si no se sabe. */
  readonly crossing: number;
}

export interface StatusLayout {
  readonly rows: readonly StatusRow[];
  /** Modo ya resuelto (sin `'auto'`). */
  readonly mode: Exclude<StatusMode, 'auto'>;
  /** `'percent'` con `'peak'` y `'previous'`: las filas comparten un eje en %. */
  readonly unit: 'absolute' | 'percent';
  /** `'history'`: cada fila tiene su propia escala; no hay eje común. */
  readonly ownScale: boolean;
  /** Línea de referencia común (unidad de la fila), `NaN` si cada fila tiene la suya. */
  readonly reference: number;
  /** Nombre del grupo de referencia, con `{ group }`. */
  readonly referenceName: string | null;
  /** Grupos que se quedaron fuera por `maxRows`. */
  readonly remaining: number;
  /** Avisos para la consola (una vez). */
  readonly warnings: readonly string[];
}

/** Claro / posible / dentro: el valor contra la banda `[lo, hi]`, con su margen `[low, high]`. */
export function evidenceStatus(
  value: number,
  low: number,
  high: number,
  lo: number,
  hi: number,
): StatusLevel {
  if (value !== value) return 'none';
  if (value >= lo && value <= hi) return 'inside';
  const a = low === low ? Math.min(low, value) : value;
  const b = high === high ? Math.max(high, value) : value;
  // El margen toca la banda: la evidencia no alcanza para decir "fuera".
  return a <= hi && b >= lo ? 'possible' : 'clear';
}

/** Subiendo / estable / bajando: cambio relativo de `previous` a `value` contra el umbral. */
export function directionStatus(value: number, previous: number, threshold: number): StatusLevel {
  if (value !== value || previous !== previous) return 'none';
  if (previous === 0) return value === 0 ? 'stable' : value > 0 ? 'up' : 'down';
  const ratio = (value - previous) / Math.abs(previous);
  if (Math.abs(ratio) <= threshold) return 'stable';
  return ratio > 0 ? 'up' : 'down';
}

/** Arriba / abajo / dentro de la banda `[lo, hi]` (una línea es una banda sin ancho). */
export function sideStatus(value: number, lo: number, hi: number): StatusLevel {
  if (value !== value) return 'none';
  if (value > hi) return 'above';
  if (value < lo) return 'below';
  return 'inside';
}

/** Orden por estado: primero lo que salió, después lo dudoso, al final lo que está en su sitio. */
const RANK: Record<StatusLevel, number> = {
  clear: 0,
  up: 0,
  down: 0,
  above: 0,
  below: 0,
  possible: 1,
  inside: 2,
  stable: 2,
  none: 3,
};

export function sortStatusRows(
  rows: readonly StatusRow[],
  sort: StatusOptions['sort'],
): StatusRow[] {
  const out = [...rows];
  if (sort === 'input') return out;
  const far = (r: StatusRow): number => (r.distance === r.distance ? Math.abs(r.distance) : -1);
  if (sort === 'distance') return out.sort((a, b) => far(b) - far(a));
  return out.sort((a, b) => RANK[a.status] - RANK[b.status] || far(b) - far(a));
}

function max(values: NumericArray): number {
  let m = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (v === v && v > m) m = v;
  }
  return m;
}

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/**
 * Filas de la ranura. Cada grupo se pasa a la unidad de su referencia (absoluta, % del pico o
 * % frente al periodo anterior), se calcula su estado y se ordenan. El grupo de referencia
 * (`{ group }`) no es una fila: es la línea que cruza todas.
 */
export function statusLayout(groups: readonly StatusGroup[], options: StatusOptions): StatusLayout {
  const { reference } = options;
  const warnings: string[] = [];
  const refGroup =
    typeof reference === 'object' && 'group' in reference
      ? groups.find((g) => g.name === reference.group)
      : undefined;
  if (typeof reference === 'object' && 'group' in reference && !refGroup) {
    warnings.push(`box.reference: no hay un grupo "${reference.group}" en la columna x`);
  }
  const candidates = groups.filter((g) => g !== refGroup && g.values.length > 0);
  const hasMargin = candidates.some((g) => g.low === g.low && g.high === g.high);
  const mode: Exclude<StatusMode, 'auto'> =
    options.status === 'auto'
      ? hasMargin
        ? 'evidence'
        : reference === 'peak'
          ? 'direction'
          : 'side'
      : options.status;
  if (mode === 'evidence' && !hasMargin) {
    warnings.push(
      'box.status "evidence" necesita yLow y yHigh en la serie; sin margen el estado solo distingue dentro y fuera, nunca "posible"',
    );
  }
  const unit: StatusLayout['unit'] =
    reference === 'peak' || reference === 'previous' ? 'percent' : 'absolute';
  const common =
    reference === 'peak'
      ? 100
      : reference === 'previous'
        ? 0
        : refGroup
          ? (refGroup.values[refGroup.values.length - 1] as number)
          : typeof reference === 'object' && 'value' in reference
            ? reference.value
            : NaN;

  const rows: StatusRow[] = [];
  for (const g of candidates) {
    const n = g.values.length;
    const raw = g.values[n - 1] as number;
    const prevRaw = n > 1 ? (g.values[n - 2] as number) : NaN;
    const peak = max(g.values);
    // Paso a la unidad de la fila.
    const scale: (v: number) => number =
      reference === 'peak'
        ? (v) => (v / peak) * 100
        : reference === 'previous'
          ? (v) => (v / prevRaw - 1) * 100
          : (v) => v;
    const value = scale(raw);
    const low = scale(g.low);
    const high = scale(g.high);
    let history: Float64Array;
    if (reference === 'previous') {
      // El historial de "frente al anterior" son los cambios de cada periodo al siguiente.
      history = new Float64Array(Math.max(0, n - 2));
      for (let i = 1; i < n - 1; i++) {
        const a = g.values[i - 1] as number;
        history[i - 1] = a === 0 ? NaN : ((g.values[i] as number) / a - 1) * 100;
      }
    } else {
      history = Float64Array.from(g.values.subarray(0, n - 1), scale);
    }
    let band: StatusRow['band'] = null;
    if (reference === 'history') {
      const [lo, q1, q3, hi] = quantiles(g.values, [
        options.range[0],
        0.25,
        0.75,
        options.range[1],
      ]) as [number, number, number, number];
      band = { lo, q1, q3, hi };
    }
    const back = n - 1 - options.window;
    const previousRaw = back >= 0 ? (g.values[back] as number) : NaN;
    const previous = reference === 'previous' ? NaN : scale(previousRaw);
    const ref = common;
    const lo = band ? band.lo : ref;
    const hi = band ? band.hi : ref;
    let status: StatusLevel;
    switch (mode) {
      case 'evidence':
        status = evidenceStatus(value, low, high, lo, hi);
        break;
      case 'direction':
        status = directionStatus(raw, previousRaw, options.threshold);
        break;
      case 'side':
        status = sideStatus(value, lo, hi);
        break;
      default:
        status = 'none';
    }
    const distance = value !== value ? NaN : value > hi ? value - hi : value < lo ? value - lo : 0;
    // Desde cuándo está del mismo lado que hoy, alineando los dos grupos por el final.
    let crossing = NaN;
    if (refGroup && g.periods) {
      const m = refGroup.values.length;
      const side = sign(raw - (refGroup.values[m - 1] as number));
      let k = 0;
      while (
        k + 1 < n &&
        k + 1 < m &&
        sign((g.values[n - 2 - k] as number) - (refGroup.values[m - 2 - k] as number)) === side
      ) {
        k++;
      }
      crossing = g.periods[n - 1 - k] as number;
    }
    rows.push({
      code: g.code,
      name: g.name,
      value,
      raw,
      low,
      high,
      band,
      reference: ref,
      history,
      previous,
      status,
      distance,
      count: g.count === g.count ? g.count : n,
      period: g.periods ? (g.periods[n - 1] as number) : NaN,
      crossing,
    });
  }

  let shown = sortStatusRows(rows, options.sort);
  let remaining = 0;
  if (shown.length > options.maxRows) {
    const top = new Set(sortStatusRows(rows, 'distance').slice(0, 8));
    remaining = shown.length - 8;
    shown = shown.filter((r) => top.has(r));
  }
  return {
    rows: shown,
    mode,
    unit,
    ownScale: reference === 'history',
    reference: common,
    referenceName: refGroup?.name ?? null,
    remaining,
    warnings,
  };
}

/**
 * Grupos para `statusLayout` a partir del formato largo: `codes[i]` es el grupo de la fila `i`
 * y `values[i]` su valor; la última fila de cada grupo es "hoy", de la que se leen el margen
 * (`low`/`high`) y el tamaño de muestra (`counts`).
 */
export function statusGroups(
  codes: ArrayLike<number>,
  values: ArrayLike<number>,
  names: readonly string[],
  extra: {
    readonly low?: ArrayLike<number> | undefined;
    readonly high?: ArrayLike<number> | undefined;
    readonly periods?: ArrayLike<number> | undefined;
    readonly counts?: ArrayLike<number> | undefined;
  } = {},
): StatusGroup[] {
  const buckets: number[][] = names.map(() => []);
  const periods: number[][] = names.map(() => []);
  const last = new Int32Array(names.length).fill(-1);
  for (let i = 0; i < values.length; i++) {
    const g = codes[i] as number;
    const v = values[i] as number;
    if (!(g >= 0 && g < names.length) || v !== v) continue;
    (buckets[g] as number[]).push(v);
    (periods[g] as number[]).push(extra.periods ? (extra.periods[i] as number) : NaN);
    last[g] = i;
  }
  return names.map((name, g) => {
    const i = last[g] as number;
    const pick = (a: ArrayLike<number> | undefined): number =>
      a && i >= 0 ? (a[i] as number) : NaN;
    return {
      code: g,
      name,
      values: Float64Array.from(buckets[g] as number[]),
      periods: extra.periods ? Float64Array.from(periods[g] as number[]) : null,
      low: pick(extra.low),
      high: pick(extra.high),
      count: pick(extra.counts),
    };
  });
}

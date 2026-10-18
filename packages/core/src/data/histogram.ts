import { DataTable, categoryColumn, numberColumn } from './table';
import { formatNumber } from '../format/number';
import { max, min, quantiles, type NumericArray } from '../stats';

/** Cómo elegir el número de cubetas cuando no se da un entero. */
export type BinRule = 'fd' | 'sturges' | 'sqrt';

export interface HistogramOptions {
  /** Número de cubetas, o la regla para calcularlo. Por defecto `'fd'`. */
  readonly bins?: number | BinRule;
  /** Rango a cubrir; por defecto `[min, max]` de los datos. Los valores fuera se descartan. */
  readonly range?: readonly [number, number];
  /** `true` para que las alturas sumen 1 (frecuencia relativa) en vez de contar. */
  readonly density?: boolean;
}

export interface Histogram {
  /** Bordes de las cubetas: `bins + 1` valores crecientes. */
  readonly edges: Float64Array;
  /** Conteo (o frecuencia relativa) por cubeta: `bins` valores. */
  readonly counts: Float64Array;
  /** Ancho de cada cubeta (todas miden igual). */
  readonly width: number;
  /** Valores finitos que cayeron dentro del rango. */
  readonly total: number;
}

function finite(values: NumericArray): Float64Array {
  let n = 0;
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i] as number)) n++;
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (Number.isFinite(v)) out[j++] = v;
  }
  return out;
}

/**
 * Número de cubetas según la regla pedida, para `n` valores finitos.
 *
 * - `fd` (Freedman–Diaconis): ancho `2·IQR / n^(1/3)`. Usa el rango intercuartílico, así que
 *   un puñado de atípicos no infla el ancho como pasaría con la desviación estándar. Si el
 *   IQR es 0 (muchos valores repetidos) cae a `sturges`.
 * - `sturges`: `⌈log2(n)⌉ + 1`; bien para muestras pequeñas y aproximadamente normales.
 * - `sqrt`: `⌈√n⌉`, la regla de Excel.
 */
export function binCount(values: NumericArray, rule: BinRule = 'fd'): number {
  const v = finite(values);
  const n = v.length;
  if (n === 0 || !(max(v) - min(v) > 0)) return 1; // sin datos o todos iguales: una cubeta
  if (rule === 'sqrt') return Math.max(1, Math.ceil(Math.sqrt(n)));
  const sturges = Math.max(1, Math.ceil(Math.log2(n)) + 1);
  if (rule === 'sturges') return sturges;
  const [q1, q3] = quantiles(v, [0.25, 0.75]) as [number, number];
  const iqr = q3 - q1;
  const span = max(v) - min(v);
  if (!(iqr > 0)) return sturges;
  const width = (2 * iqr) / Math.cbrt(n);
  return Math.max(1, Math.ceil(span / width));
}

/**
 * Histograma de cubetas iguales. Los `NaN` e infinitos se ignoran. El último borde es
 * inclusivo (como `numpy.histogram`), para que el máximo caiga en la última cubeta.
 */
export function histogram(values: NumericArray, options: HistogramOptions = {}): Histogram {
  const v = finite(values);
  const bins =
    typeof options.bins === 'number'
      ? Math.max(1, Math.floor(options.bins))
      : binCount(v, options.bins);
  let [lo, hi] = options.range ?? [min(v), max(v)];
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (lo === hi) {
    // Todos los valores iguales: una cubeta centrada en el valor (como numpy: ±0.5).
    lo -= 0.5;
    hi += 0.5;
  }
  const width = (hi - lo) / bins;
  const edges = new Float64Array(bins + 1);
  for (let i = 0; i <= bins; i++) edges[i] = lo + i * width;
  edges[bins] = hi; // sin error acumulado en el último borde
  const counts = new Float64Array(bins);
  let total = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i] as number;
    if (x < lo || x > hi) continue;
    let k = Math.floor((x - lo) / width);
    if (k >= bins) k = bins - 1; // x === hi
    counts[k] = (counts[k] as number) + 1;
    total++;
  }
  if (options.density && total > 0) {
    for (let k = 0; k < bins; k++) counts[k] = (counts[k] as number) / total;
  }
  return { edges, counts, width, total };
}

export interface HistogramTableOptions extends HistogramOptions {
  /** Nombre de la columna de cubetas (por defecto `'bin'`). */
  readonly binColumn?: string;
  /** Nombre de la columna de conteos (por defecto `'count'`). */
  readonly countColumn?: string;
  /** Etiqueta de cada cubeta; por defecto `"lo – hi"` con decimales según el ancho. */
  readonly label?: (lo: number, hi: number, index: number) => string;
}

/**
 * El histograma como `DataTable` lista para un gráfico de barras: una columna de categorías con
 * la etiqueta de cada cubeta y otra con el conteo. Así el histograma reutiliza la escala de
 * banda, el tooltip y la leyenda de las barras sin un tipo de gráfico aparte.
 */
export function histogramTable(
  values: NumericArray,
  options: HistogramTableOptions = {},
): DataTable {
  const h = histogram(values, options);
  const label =
    options.label ??
    ((lo: number, hi: number) =>
      `${formatNumber(lo, { step: h.width })} – ${formatNumber(hi, { step: h.width })}`);
  const labels: string[] = [];
  for (let k = 0; k < h.counts.length; k++) {
    labels.push(label(h.edges[k] as number, h.edges[k + 1] as number, k));
  }
  return new DataTable({
    [options.binColumn ?? 'bin']: categoryColumn(labels),
    [options.countColumn ?? 'count']: numberColumn(h.counts),
  });
}

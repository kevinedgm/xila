import { quantiles, type NumericArray } from '../stats';

/** Resumen de cinco números más atípicos, como lo dibuja un box plot. */
export interface BoxStats {
  readonly count: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  /** Extremo del bigote inferior: el menor dato ≥ q1 − k·IQR. */
  readonly low: number;
  /** Extremo del bigote superior: el mayor dato ≤ q3 + k·IQR. */
  readonly high: number;
  /** Datos fuera de los bigotes. */
  readonly outliers: Float64Array;
}

/**
 * Estadísticos de un box plot al estilo Tukey: cuartiles con interpolación lineal (los mismos
 * de `df.describe()`), bigotes al último dato dentro de `q1 − k·IQR` y `q3 + k·IQR` (no al
 * límite teórico) y atípicos fuera de ellos. `k = 1.5` por defecto, el valor de pandas y R.
 */
export function boxStats(values: NumericArray, whisker = 1.5): BoxStats {
  const [q1, median, q3] = quantiles(values, [0.25, 0.5, 0.75]) as [number, number, number];
  const iqr = q3 - q1;
  const fenceLow = q1 - whisker * iqr;
  const fenceHigh = q3 + whisker * iqr;
  let low = Infinity;
  let high = -Infinity;
  let count = 0;
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (v !== v) continue;
    count++;
    if (v < fenceLow || v > fenceHigh) {
      out.push(v);
      continue;
    }
    if (v < low) low = v;
    if (v > high) high = v;
  }
  if (count === 0) {
    return { count, q1, median, q3, low: NaN, high: NaN, outliers: new Float64Array(0) };
  }
  return { count, q1, median, q3, low, high, outliers: Float64Array.from(out) };
}

/**
 * Un `BoxStats` por categoría a partir de datos en formato largo: `codes[i]` dice a qué grupo
 * pertenece `values[i]`. Grupos sin datos dan `count: 0`.
 */
export function boxGroups(
  codes: ArrayLike<number>,
  values: NumericArray,
  groupCount: number,
  whisker = 1.5,
): BoxStats[] {
  const buckets: number[][] = Array.from({ length: groupCount }, () => []);
  for (let i = 0; i < values.length; i++) {
    const g = codes[i] as number;
    const v = values[i] as number;
    if (g >= 0 && g < groupCount && v === v) (buckets[g] as number[]).push(v);
  }
  return buckets.map((b) => boxStats(b, whisker));
}

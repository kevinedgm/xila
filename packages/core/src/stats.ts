/**
 * Estadísticas de resumen sobre arreglos numéricos. Los `NaN` se ignoran (como `nanmean`
 * de numpy) y las convenciones siguen a numpy para que los números coincidan con los
 * notebooks: `std` con `ddof = 0` y cuantiles con interpolación lineal.
 */

export type NumericArray = Float64Array | Float32Array | readonly number[];

function clean(values: NumericArray): Float64Array {
  let n = 0;
  for (let i = 0; i < values.length; i++) if (!Number.isNaN(values[i] as number)) n++;
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (!Number.isNaN(v)) out[j++] = v;
  }
  return out;
}

export function min(values: NumericArray): number {
  let m = Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (v < m) m = v;
  }
  return m === Infinity ? NaN : m;
}

export function max(values: NumericArray): number {
  let m = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (v > m) m = v;
  }
  return m === -Infinity ? NaN : m;
}

export function sum(values: NumericArray): number {
  // Suma de Kahan: compensa el error de redondeo al acumular muchos valores.
  let s = 0;
  let c = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (Number.isNaN(v)) continue;
    const y = v - c;
    const t = s + y;
    c = t - s - y;
    s = t;
  }
  return s;
}

export function mean(values: NumericArray): number {
  const v = clean(values);
  return v.length === 0 ? NaN : sum(v) / v.length;
}

/**
 * Varianza con el algoritmo de Welford: una pasada y estable. La fórmula ingenua
 * `E[x²] − E[x]²` pierde precisión con valores grandes y parecidos (10⁹ + 1, 10⁹ + 2, …).
 * `ddof = 0` como numpy; `ddof = 1` para la muestral.
 */
export function variance(values: NumericArray, ddof = 0): number {
  let n = 0;
  let m = 0;
  let m2 = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (Number.isNaN(v)) continue;
    n++;
    const delta = v - m;
    m += delta / n;
    m2 += delta * (v - m);
  }
  return n - ddof <= 0 ? NaN : m2 / (n - ddof);
}

export function std(values: NumericArray, ddof = 0): number {
  return Math.sqrt(variance(values, ddof));
}

/**
 * Cuantil `q` en [0, 1] con interpolación lineal entre los dos valores vecinos (el método
 * por defecto de numpy). Ordena una copia: O(n log n).
 */
export function quantile(values: NumericArray, q: number): number {
  const v = clean(values).sort();
  if (v.length === 0 || !(q >= 0 && q <= 1)) return NaN;
  const pos = q * (v.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = v[lo] as number;
  const b = v[hi] as number;
  return a + (b - a) * (pos - lo);
}

/** Varios cuantiles con una sola ordenación. */
export function quantiles(values: NumericArray, qs: readonly number[]): number[] {
  const v = clean(values).sort();
  return qs.map((q) => {
    if (v.length === 0 || !(q >= 0 && q <= 1)) return NaN;
    const pos = q * (v.length - 1);
    const lo = Math.floor(pos);
    const a = v[lo] as number;
    const b = v[Math.ceil(pos)] as number;
    return a + (b - a) * (pos - lo);
  });
}

export function median(values: NumericArray): number {
  return quantile(values, 0.5);
}

export interface Summary {
  readonly count: number;
  readonly mean: number;
  readonly std: number;
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
}

/** Resumen al estilo `describe()` de pandas (std con ddof = 1, como pandas). */
export function summary(values: NumericArray): Summary {
  const v = clean(values);
  const [q1, med, q3] = quantiles(v, [0.25, 0.5, 0.75]) as [number, number, number];
  return {
    count: v.length,
    mean: mean(v),
    std: std(v, 1),
    min: min(v),
    q1,
    median: med,
    q3,
    max: max(v),
  };
}

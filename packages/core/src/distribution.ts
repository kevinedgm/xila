import { binCount, type BinRule } from './data/histogram';
import { quantiles, type NumericArray } from './stats';

/** Valores de cada grupo en el orden de las filas (formato largo: `codes[i]` es el grupo de `values[i]`). */
export function groupValues(
  codes: ArrayLike<number>,
  values: ArrayLike<number>,
  groupCount: number,
): Float64Array[] {
  const buckets: number[][] = Array.from({ length: groupCount }, () => []);
  for (let i = 0; i < values.length; i++) {
    const g = codes[i] as number;
    const v = values[i] as number;
    if (g >= 0 && g < groupCount && v === v) (buckets[g] as number[]).push(v);
  }
  return buckets.map((b) => Float64Array.from(b));
}

/** Bordes de cubetas iguales entre el mínimo y el máximo de todos los grupos (compartidos, para que las filas se alineen). */
export function sharedEdges(groups: readonly Float64Array[], bins: number | BinRule): Float64Array {
  const all: number[] = [];
  for (const g of groups) for (let i = 0; i < g.length; i++) all.push(g[i] as number);
  if (all.length === 0) return Float64Array.of(0, 1);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of all) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const n = typeof bins === 'number' ? Math.max(1, Math.floor(bins)) : binCount(all, bins);
  if (!(hi > lo)) return Float64Array.of(lo, lo + 1);
  const edges = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) edges[i] = lo + ((hi - lo) * i) / n;
  return edges;
}

/** Cubeta de cada valor (la última es inclusiva, como `numpy.histogram`). */
export function binIndex(v: number, edges: Float64Array): number {
  const n = edges.length - 1;
  const lo = edges[0] as number;
  const hi = edges[n] as number;
  if (!(v >= lo && v <= hi)) return -1;
  return Math.min(n - 1, Math.floor(((v - lo) / (hi - lo)) * n));
}

/** Conteo por cubeta. */
export function binCounts(values: Float64Array, edges: Float64Array): Uint32Array {
  const out = new Uint32Array(edges.length - 1);
  for (let i = 0; i < values.length; i++) {
    const k = binIndex(values[i] as number, edges);
    if (k >= 0) out[k] = (out[k] as number) + 1;
  }
  return out;
}

/** Fracción de valores ≤ `v` (0 a 1); `NaN` sin datos. */
export function percentileOf(values: ArrayLike<number>, v: number): number {
  let n = 0;
  let below = 0;
  for (let i = 0; i < values.length; i++) {
    const u = values[i] as number;
    if (u !== u) continue;
    n++;
    if (u <= v) below++;
  }
  return n === 0 ? NaN : below / n;
}

/** Bandas de un grupo: percentiles exteriores, cuartiles y mediana. */
export function rangeBands(
  values: NumericArray,
  outer: readonly [number, number],
): { lo: number; q1: number; median: number; q3: number; hi: number } {
  const [lo, q1, median, q3, hi] = quantiles(values, [outer[0], 0.25, 0.5, 0.75, outer[1]]) as [
    number,
    number,
    number,
    number,
    number,
  ];
  return { lo, q1, median, q3, hi };
}

/**
 * Radio con el que `maxCount` puntos caben en una celda de `width` × `height` píxeles,
 * entre `min` y `max`; si ni con el mínimo caben, devuelve el mínimo.
 */
export function fitRadius(
  width: number,
  height: number,
  maxCount: number,
  min = 1,
  max = 3.5,
): number {
  for (let r = max; r >= min; r -= 0.25) {
    const d = 2 * r + 1;
    if (Math.floor(width / d) * Math.floor(height / d) >= maxCount) return r;
  }
  return min;
}

/**
 * Enjambre: desplazamiento horizontal de cada punto (en píxeles, respecto al centro) para que
 * círculos de radio `r` con esas posiciones verticales no se encimen. Se prueba el centro y
 * después ±d, ±2d… y se toma el primer hueco libre. Devuelve `null` si algún punto necesita más
 * de `maxHalf` píxeles, para que quien llama pruebe con un radio menor.
 */
export function beeswarm(ys: ArrayLike<number>, r: number, maxHalf: number): Float64Array | null {
  const n = ys.length;
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => (ys[a] as number) - (ys[b] as number),
  );
  const d = 2 * r + 1;
  const out = new Float64Array(n);
  const placedX: number[] = [];
  const placedY: number[] = [];
  for (const i of order) {
    const y = ys[i] as number;
    // Solo compiten los ya colocados a menos de d en vertical (los últimos, por el orden).
    let from = placedY.length;
    while (from > 0 && y - (placedY[from - 1] as number) < d) from--;
    let chosen = NaN;
    for (let k = 0; Number.isNaN(chosen); k++) {
      for (const sign of k === 0 ? [1] : [1, -1]) {
        const x = sign * k * d;
        if (Math.abs(x) > maxHalf) return null;
        let free = true;
        for (let j = from; j < placedY.length; j++) {
          const dx = x - (placedX[j] as number);
          const dy = y - (placedY[j] as number);
          if (dx * dx + dy * dy < d * d) {
            free = false;
            break;
          }
        }
        if (free) {
          chosen = x;
          break;
        }
      }
    }
    out[i] = chosen;
    placedX.push(chosen);
    placedY.push(y);
  }
  return out;
}

/** Media móvil de ventana 3 sobre los conteos (suaviza el ruido de cubetas estrechas). */
export function smooth3(counts: ArrayLike<number>): Float64Array {
  const n = counts.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = counts[Math.max(0, i - 1)] as number;
    const b = counts[i] as number;
    const c = counts[Math.min(n - 1, i + 1)] as number;
    out[i] = (a + b + c) / 3;
  }
  return out;
}

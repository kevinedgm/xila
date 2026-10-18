import { histogram, type BinRule } from './data/histogram';
import type { Rect } from './plugin';
import type { ContinuousScale } from './scales/linear';

/**
 * Gráfico de unidades: un punto por caso. Dos modos con la misma lista de puntos, así el
 * cambio de modo es una interpolación de posiciones y no un gráfico distinto:
 *
 * - `strip`: tira con dispersión vertical determinista (el índice decide la altura), para ver
 *   la nube real de casos y su cola.
 * - `binned`: cada punto va a su cubeta (Freedman–Diaconis por defecto) y se apila en una
 *   rejilla de `cols` columnas; la barra queda explicada como pila de casos.
 *
 * El radio se ajusta para que la cubeta más alta quepa en el área, y la capacidad en unidades
 * del eje Y (`capacity`) es lineal con los píxeles, así los ticks salen "bonitos" (0, 100, 200…)
 * y no múltiplos de la capacidad.
 */
export type DotsMode = 'strip' | 'binned';

export interface DotsOptions {
  readonly mode: DotsMode;
  readonly bins: number | BinRule;
  readonly radius: number | 'auto';
}

export interface DotsLayout {
  readonly mode: DotsMode;
  /** Posición de cada punto en píxeles CSS; `NaN` si el valor no es finito. */
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly radius: number;
  /** Unidades que caben en la altura del área (modo cubetas); 1 en modo tira. */
  readonly capacity: number;
  /** Bordes de las cubetas, para que una selección pueda saltar a ellos. */
  readonly edges: Float64Array | null;
  readonly counts: Float64Array | null;
}

/** Dispersión vertical determinista y bien repartida: el mismo índice cae siempre igual. */
export function jitter(index: number): number {
  return ((index * 7919) % 1000) / 1000;
}

export function autoRadius(area: Rect): number {
  return Math.max(1.5, Math.min(3, area.width / 400));
}

export function dotsLayout(
  values: Float64Array,
  area: Rect,
  x: ContinuousScale,
  options: DotsOptions,
): DotsLayout {
  const n = values.length;
  const px = new Float64Array(n);
  const py = new Float64Array(n);

  if (options.mode === 'strip') {
    const radius = options.radius === 'auto' ? autoRadius(area) : options.radius;
    const span = Math.max(0, area.height - 2 * radius);
    for (let i = 0; i < n; i++) {
      const v = values[i] as number;
      if (v !== v) {
        px[i] = NaN;
        py[i] = NaN;
        continue;
      }
      px[i] = x.toPixel(v);
      py[i] = area.y + area.height - radius - jitter(i) * span;
    }
    return { mode: 'strip', px, py, radius, capacity: 1, edges: null, counts: null };
  }

  const h = histogram(values, { bins: options.bins });
  const k = h.counts.length;
  const lo = h.edges[0] as number;
  const hi = h.edges[k] as number;
  const width = (hi - lo) / k;
  let cmax = 0;
  for (let i = 0; i < k; i++) if ((h.counts[i] as number) > cmax) cmax = h.counts[i] as number;

  // Ancho mínimo de cubeta en píxeles (en escala log difieren; se usa el menor para que todas
  // compartan `cols` y el eje Y sea lineal).
  let bw = Infinity;
  for (let i = 0; i < k; i++) {
    const w = Math.abs(x.toPixel(h.edges[i + 1] as number) - x.toPixel(h.edges[i] as number));
    if (w < bw) bw = w;
  }
  if (!Number.isFinite(bw)) bw = area.width / Math.max(1, k);

  // Radio: el mayor (hasta `radius` o 4) con el que la cubeta más alta cabe en el área.
  const rMax = options.radius === 'auto' ? 4 : options.radius;
  let r = rMax;
  let u = 2 * r + 1;
  let cols = Math.max(1, Math.floor((bw - 2) / u));
  for (; r >= 1; r -= 0.25) {
    u = 2 * r + 1;
    cols = Math.max(1, Math.floor((bw - 2) / u));
    if (Math.ceil(cmax / cols) * u <= area.height) break;
  }
  if (r < 1) {
    // Ni con radio 1 cabe: la celda se encoge por debajo del píxel y los puntos se solapan,
    // pero la columna más alta llega exactamente al borde en vez de salirse del área.
    cols = Math.max(1, Math.floor((bw - 2) / 3));
    const rows = Math.max(1, Math.ceil(cmax / cols));
    u = area.height / rows;
    r = Math.max(0.5, Math.min(1, (u - 1) / 2));
  }
  // No se redondea: así la pendiente del eje Y es exactamente `u / cols` píxeles por unidad.
  const capacity = Math.max(1, (area.height / u) * cols);

  const counters = new Uint32Array(k);
  const radius = r;
  for (let i = 0; i < n; i++) {
    const v = values[i] as number;
    if (v !== v || v < lo || v > hi) {
      px[i] = NaN;
      py[i] = NaN;
      continue;
    }
    let bi = Math.floor((v - lo) / width);
    if (bi >= k) bi = k - 1;
    const slot = counters[bi] as number;
    counters[bi] = slot + 1;
    const left = x.toPixel(h.edges[bi] as number);
    const right = x.toPixel(h.edges[bi + 1] as number);
    const start = Math.min(left, right) + (Math.abs(right - left) - cols * u) / 2;
    px[i] = start + radius + (slot % cols) * u;
    py[i] = area.y + area.height - radius - Math.floor(slot / cols) * u;
  }
  return { mode: 'binned', px, py, radius, capacity, edges: h.edges, counts: h.counts };
}

/** Cuántos valores finitos caen en `[a, b]` (inclusivo). */
export function countInRange(values: Float64Array, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let c = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (v >= lo && v <= hi) c++;
  }
  return c;
}

/** Ajusta un rango a los bordes de cubeta más cercanos por fuera. */
export function snapToEdges(
  range: readonly [number, number],
  edges: Float64Array,
): [number, number] {
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  let a = edges[0] as number;
  let b = edges[edges.length - 1] as number;
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i] as number;
    if (e <= lo) a = e;
    if (e >= hi) {
      b = e;
      break;
    }
  }
  if (b <= a) b = edges[Math.min(edges.length - 1, edges.indexOf(a) + 1)] as number;
  return [a, b];
}

/** Interpolación con suavizado cúbico de salida, la del wireframe original. */
export function easeOutCubic(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u * u;
}

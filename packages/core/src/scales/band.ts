import type { Range } from './linear';

/**
 * Escala para categorías: reparte el rango en `count` tramos iguales.
 *
 * Con `padding` p, cada barra ocupa `paso × (1 − p)` y el hueco entre barras es `paso × p`.
 * El hueco exterior, antes de la primera y después de la última, también mide `paso × p`.
 * Para 4 categorías en 400 px y padding 0, cada banda mide 100 px.
 */
export interface BandScale {
  readonly kind: 'band';
  readonly count: number;
  readonly range: Range;
  readonly step: number;
  readonly bandwidth: number;
  /** Píxel donde empieza la banda `index`. */
  start(index: number): number;
  /** Píxel del centro de la banda `index`, para las etiquetas. */
  center(index: number): number;
  /** Índice de la banda bajo un píxel, o -1 si cae fuera. */
  indexAt(pixel: number): number;
  withRange(range: Range): BandScale;
}

export function bandScale(count: number, range: Range, padding = 0): BandScale {
  const [r0, r1] = range;
  const p = Math.min(Math.max(padding, 0), 0.99);
  const width = r1 - r0;
  const step = count > 0 ? width / (count - p + 2 * p) : width;
  const bandwidth = step * (1 - p);
  const outer = step * p;

  const start = (i: number) => r0 + outer + i * step;
  return {
    kind: 'band',
    count,
    range,
    step,
    bandwidth,
    start,
    center: (i) => start(i) + bandwidth / 2,
    indexAt(px) {
      const i = Math.floor((px - r0 - outer) / step);
      return i >= 0 && i < count ? i : -1;
    },
    withRange: (next) => bandScale(count, next, p),
  };
}

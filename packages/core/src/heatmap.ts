import type { NumericArray } from './stats';

/**
 * Estadísticas por fila de un heatmap, para `heatmap.scale: 'row'` y `rowLabels: 'max'`:
 * mediana, mínimo, máximo y columna del máximo de cada fila. `cells` es la rejilla
 * `ny × nx` con el índice de fila de la tabla (o -1 si la celda está vacía).
 */
export interface RowStats {
  readonly median: number;
  readonly min: number;
  readonly max: number;
  /** Índice de la columna (categoría de `x`) donde está el máximo; -1 si la fila está vacía. */
  readonly argmax: number;
}

export function rowStats(
  values: NumericArray,
  cells: Int32Array,
  nx: number,
  ny: number,
): RowStats[] {
  const out: RowStats[] = [];
  for (let yi = 0; yi < ny; yi++) {
    const vs: number[] = [];
    let max = -Infinity;
    let argmax = -1;
    for (let xi = 0; xi < nx; xi++) {
      const row = cells[yi * nx + xi] as number;
      if (row < 0) continue;
      const v = values[row] as number;
      if (v !== v) continue;
      vs.push(v);
      if (v > max) {
        max = v;
        argmax = xi;
      }
    }
    vs.sort((a, b) => a - b);
    const n = vs.length;
    const median =
      n === 0
        ? NaN
        : n % 2
          ? (vs[(n - 1) / 2] as number)
          : ((vs[n / 2 - 1] as number) + (vs[n / 2] as number)) / 2;
    out.push({ median, min: n ? (vs[0] as number) : NaN, max: n ? max : NaN, argmax });
  }
  return out;
}

/**
 * Posición de `v` en el mapa divergente de su fila: 0,5 en la mediana, 0 en el mínimo de la
 * fila y 1 en su máximo. Así "azul fuerte" en India son 0,4 t y en Estados Unidos 14 t: cada
 * fila cuenta su propia historia.
 */
export function rowPosition(v: number, s: RowStats): number {
  if (v !== v || s.median !== s.median) return NaN;
  if (v >= s.median) {
    const span = s.max - s.median;
    return span > 0 ? 0.5 + (0.5 * (v - s.median)) / span : 0.5;
  }
  const span = s.median - s.min;
  return span > 0 ? 0.5 - (0.5 * (s.median - v)) / span : 0.5;
}

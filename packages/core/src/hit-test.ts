import { lowerBound } from './data/search';
import type { ResolvedSeries } from './data/series';
import type { ChartScales } from './chart';
import type { Rect } from './plugin';

export interface Hit {
  readonly seriesIndex: number;
  readonly seriesId: string;
  readonly index: number;
  /** Valor de los datos bajo el cursor. */
  readonly x: number;
  readonly y: number;
  /** Posición del dato en píxeles CSS. */
  readonly px: number;
  readonly py: number;
  /** Distancia en píxeles entre el cursor y el dato. */
  readonly distance: number;
}

export interface HitTester {
  /** Dato más cercano al píxel `(px, py)` dentro de `maxDistance`, o `null`. */
  nearest(px: number, py: number, maxDistance: number): Hit | null;
  /** Para líneas: el dato de cada serie cuya `x` está más cerca de `px`. */
  nearestX(px: number, maxDistance: number): Hit[];
}

/** Un `NaN` nunca es un acierto. */
function valid(v: number): boolean {
  return v === v;
}

/**
 * Líneas y series con `x` ordenado: búsqueda binaria en `x`, O(log n) por serie.
 */
export function sortedHitTester(series: readonly ResolvedSeries[], scales: ChartScales): HitTester {
  if (scales.x.kind === 'band') throw new TypeError('sortedHitTester requiere una escala continua');
  const xScale = scales.x;
  const { y: yScale } = scales;

  const nearestX = (px: number, maxDistance: number): Hit[] => {
    const value = xScale.toValue(px);
    const hits: Hit[] = [];
    series.forEach((s, seriesIndex) => {
      const i = lowerBound(s.x, value);
      let best = -1;
      let bestDx = Infinity;
      // Candidatos: el primero ≥ value y su vecino anterior; se salta NaN hacia los lados.
      for (const candidate of [i - 1, i, i - 2, i + 1]) {
        if (candidate < 0 || candidate >= s.length || !valid(s.y[candidate] as number)) continue;
        const dx = Math.abs(xScale.toPixel(s.x[candidate] as number) - px);
        if (dx < bestDx) {
          bestDx = dx;
          best = candidate;
        }
      }
      if (best < 0 || bestDx > maxDistance) return;
      const x = s.x[best] as number;
      const y = s.y[best] as number;
      hits.push({
        seriesIndex,
        seriesId: s.id,
        index: best,
        x,
        y,
        px: xScale.toPixel(x),
        py: yScale.toPixel(y),
        distance: bestDx,
      });
    });
    return hits;
  };

  return {
    nearestX,
    nearest(px, py, maxDistance) {
      let best: Hit | null = null;
      for (const h of nearestX(px, maxDistance)) {
        const d = Math.hypot(h.px - px, h.py - py);
        if (d <= maxDistance && (!best || d < best.distance)) best = { ...h, distance: d };
      }
      return best;
    },
  };
}

/**
 * Dispersión: cuadrícula espacial de celdas de `cellSize` píxeles. Solo se revisan las
 * celdas vecinas al cursor, así que el costo no depende del total de puntos.
 */
export function gridHitTester(
  series: readonly ResolvedSeries[],
  scales: ChartScales,
  area: Rect,
  cellSize = 16,
): HitTester {
  if (scales.x.kind === 'band') throw new TypeError('gridHitTester requiere una escala continua');
  const xScale = scales.x;
  const { y: yScale } = scales;
  const cols = Math.max(1, Math.ceil(area.width / cellSize) + 2);
  const rows = Math.max(1, Math.ceil(area.height / cellSize) + 2);
  // Cada celda guarda índices codificados como serie * 2^32 + índice, en un array por celda.
  const cells: number[][] = Array.from({ length: cols * rows }, () => []);
  const cellOf = (px: number, py: number): number => {
    const c = Math.floor((px - area.x) / cellSize) + 1;
    const r = Math.floor((py - area.y) / cellSize) + 1;
    if (c < 0 || c >= cols || r < 0 || r >= rows) return -1;
    return r * cols + c;
  };
  series.forEach((s, si) => {
    for (let i = 0; i < s.length; i++) {
      const y = s.y[i] as number;
      if (!valid(y)) continue;
      const cell = cellOf(xScale.toPixel(s.x[i] as number), yScale.toPixel(y));
      if (cell >= 0) (cells[cell] as number[]).push(si * 2 ** 32 + i);
    }
  });

  const nearest = (px: number, py: number, maxDistance: number): Hit | null => {
    const reach = Math.ceil(maxDistance / cellSize);
    const c0 = Math.floor((px - area.x) / cellSize) + 1;
    const r0 = Math.floor((py - area.y) / cellSize) + 1;
    let best: Hit | null = null;
    for (let r = r0 - reach; r <= r0 + reach; r++) {
      for (let c = c0 - reach; c <= c0 + reach; c++) {
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        for (const code of cells[r * cols + c] as number[]) {
          const si = Math.floor(code / 2 ** 32);
          const i = code % 2 ** 32;
          const s = series[si] as ResolvedSeries;
          const x = s.x[i] as number;
          const y = s.y[i] as number;
          const hx = xScale.toPixel(x);
          const hy = yScale.toPixel(y);
          const d = Math.hypot(hx - px, hy - py);
          if (d <= maxDistance && (!best || d < best.distance)) {
            best = { seriesIndex: si, seriesId: s.id, index: i, x, y, px: hx, py: hy, distance: d };
          }
        }
      }
    }
    return best;
  };

  return {
    nearest,
    nearestX: (px, maxDistance) => {
      const h = nearest(px, area.y + area.height / 2, Math.max(maxDistance, area.height));
      return h && Math.abs(h.px - px) <= maxDistance ? [h] : [];
    },
  };
}

/** Barras: la banda bajo el cursor, y dentro de ella la barra de la serie que lo contiene. */
/**
 * Heatmap: la celda bajo el cursor. `rows[yi * nx + xi]` es la fila de la tabla que llenó la
 * celda (−1 si está vacía); `y` es una escala lineal de `[0, ny]` con una unidad por fila.
 */
export function heatmapHitTester(
  series: ResolvedSeries,
  rows: Int32Array,
  nx: number,
  ny: number,
  scales: ChartScales,
): HitTester {
  if (scales.x.kind !== 'band')
    throw new TypeError('heatmapHitTester requiere una escala de banda');
  const band = scales.x;
  const { y: yScale } = scales;
  const values = series.value;
  const at = (px: number, py: number): Hit | null => {
    const xi = band.indexAt(px);
    const yi = Math.floor(yScale.toValue(py));
    if (xi < 0 || yi < 0 || yi >= ny) return null;
    const row = rows[yi * nx + xi] as number;
    if (row < 0 || !values) return null;
    const v = values[row] as number;
    if (!valid(v)) return null;
    return {
      seriesIndex: 0,
      seriesId: series.id,
      index: row,
      x: xi,
      y: v,
      px: band.center(xi),
      py: yScale.toPixel(yi + 0.5),
      distance: 0,
    };
  };
  return {
    nearest: (px, py) => at(px, py),
    // Sin coordenada vertical no hay celda; el gráfico usa `nearest` para el heatmap.
    nearestX: () => [],
  };
}

export function bandHitTester(
  series: readonly ResolvedSeries[],
  scales: ChartScales,
  stacked: boolean,
): HitTester {
  if (scales.x.kind !== 'band') throw new TypeError('bandHitTester requiere una escala de banda');
  const band = scales.x;
  const { y: yScale } = scales;
  const slot = stacked ? band.bandwidth : band.bandwidth / Math.max(1, series.length);

  const hitsAt = (px: number): Hit[] => {
    const i = band.indexAt(px);
    if (i < 0) return [];
    const positive = { acc: 0 };
    const negative = { acc: 0 };
    return series.flatMap((s, si) => {
      const y = s.y[i] as number;
      if (i >= s.length || !valid(y)) return [];
      const start = band.start(i) + (stacked ? 0 : si * slot);
      let top = y;
      if (stacked) {
        const acc = y >= 0 ? positive : negative;
        acc.acc += y;
        top = acc.acc;
      }
      return [
        {
          seriesIndex: si,
          seriesId: s.id,
          index: i,
          x: i,
          y,
          px: start + slot / 2,
          py: yScale.toPixel(top),
          distance: Math.abs(start + slot / 2 - px),
        },
      ];
    });
  };

  return {
    nearestX: (px) => hitsAt(px),
    nearest(px, py) {
      const hits = hitsAt(px);
      if (stacked) {
        // En apiladas, la barra bajo el cursor es la cuyo tramo vertical contiene `py`.
        let prevPos = yScale.toPixel(0);
        let prevNeg = prevPos;
        for (const h of hits) {
          const base = h.y >= 0 ? prevPos : prevNeg;
          if (py >= Math.min(base, h.py) && py <= Math.max(base, h.py)) return h;
          if (h.y >= 0) prevPos = h.py;
          else prevNeg = h.py;
        }
        return null;
      }
      return hits.find((h) => Math.abs(h.px - px) <= slot / 2) ?? null;
    },
  };
}

/**
 * Índice para puntos cuya posición en píxeles ya está calculada (gráfico de unidades): la
 * misma rejilla que `gridHitTester`, pero el acierto devuelve el valor del dato, no el píxel.
 */
export function pixelHitTester(
  series: ResolvedSeries,
  seriesIndex: number,
  px: Float64Array,
  py: Float64Array,
  area: Rect,
  cellSize = 16,
): HitTester {
  const cols = Math.max(1, Math.ceil(area.width / cellSize) + 2);
  const rows = Math.max(1, Math.ceil(area.height / cellSize) + 2);
  const cells: number[][] = Array.from({ length: cols * rows }, () => []);
  const cellOf = (x: number, y: number): number => {
    const c = Math.floor((x - area.x) / cellSize) + 1;
    const r = Math.floor((y - area.y) / cellSize) + 1;
    if (c < 0 || c >= cols || r < 0 || r >= rows) return -1;
    return r * cols + c;
  };
  for (let i = 0; i < px.length; i++) {
    const x = px[i] as number;
    if (x !== x) continue;
    const cell = cellOf(x, py[i] as number);
    if (cell >= 0) (cells[cell] as number[]).push(i);
  }
  const hit = (i: number, d: number): Hit => ({
    seriesIndex,
    seriesId: series.id,
    index: i,
    x: series.x[i] as number,
    y: series.y[i] as number,
    px: px[i] as number,
    py: py[i] as number,
    distance: d,
  });
  const nearest = (x: number, y: number, maxDistance: number): Hit | null => {
    const reach = Math.ceil(maxDistance / cellSize);
    const c0 = Math.floor((x - area.x) / cellSize) + 1;
    const r0 = Math.floor((y - area.y) / cellSize) + 1;
    let best: Hit | null = null;
    for (let r = r0 - reach; r <= r0 + reach; r++) {
      for (let c = c0 - reach; c <= c0 + reach; c++) {
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        for (const i of cells[r * cols + c] as number[]) {
          const d = Math.hypot((px[i] as number) - x, (py[i] as number) - y);
          if (d <= maxDistance && (!best || d < best.distance)) best = hit(i, d);
        }
      }
    }
    return best;
  };
  return {
    nearest,
    nearestX: (x, maxDistance) => {
      const h = nearest(x, area.y + area.height / 2, Math.max(maxDistance, area.height));
      return h ? [h] : [];
    },
  };
}

/**
 * Unidades del total: el cuadro bajo el cursor (o el más cercano por su centro). El acierto
 * lleva la categoría en `index` y `x`, y en `y` el valor de esa categoría.
 */
export function waffleHitTester(
  series: ResolvedSeries,
  layout: {
    readonly cells: readonly { x: number; y: number; size: number; category: number }[];
  },
): HitTester {
  const hitOf = (k: number, d: number): Hit | null => {
    const cell = layout.cells[k];
    if (!cell) return null;
    const value = series.y[cell.category] as number;
    return {
      seriesIndex: 0,
      seriesId: series.id,
      index: k,
      x: cell.category,
      y: value === value ? value : NaN,
      px: cell.x + cell.size / 2,
      py: cell.y + cell.size / 2,
      distance: d,
    };
  };
  const nearest = (px: number, py: number, maxDistance: number): Hit | null => {
    let best = -1;
    let bestD = Infinity;
    layout.cells.forEach((c, k) => {
      const inside = px >= c.x && px <= c.x + c.size && py >= c.y && py <= c.y + c.size;
      const d = inside ? 0 : Math.hypot(px - (c.x + c.size / 2), py - (c.y + c.size / 2));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    return best >= 0 && bestD <= maxDistance ? hitOf(best, bestD) : null;
  };
  return { nearest, nearestX: () => [] };
}

export interface DecimatedSeries {
  x: Float64Array;
  y: Float64Array;
  length: number;
}

/**
 * Reduce una serie ordenada por `x` a como máximo 4 puntos por columna de píxel:
 * el primero, el mínimo, el máximo y el último de cada columna, en orden de `x`.
 *
 * Una línea no puede mostrar más que eso dentro de una columna (lo visible es el trazo
 * vertical entre su mínimo y su máximo, más la entrada y la salida), así que el resultado
 * se ve igual que la serie completa, incluidos los picos.
 *
 * La columna de un punto es `floor((x - xOrigin) * pxPerUnit)`. Un tramo de `NaN` en `y`
 * se conserva como un solo punto `NaN`, para que el renderer corte la línea ahí. `out`
 * permite reutilizar buffers entre fotogramas y evitar basura.
 */
export function minMaxDecimate(
  xs: Float64Array,
  ys: Float64Array,
  from: number,
  to: number,
  xOrigin: number,
  pxPerUnit: number,
  out?: DecimatedSeries,
): DecimatedSeries {
  const count = Math.max(0, to - from);
  const result = ensureCapacity(
    out,
    Math.min(count, estimateCapacity(xs, from, to, xOrigin, pxPerUnit)),
  );
  result.length = 0;

  let col = Number.NaN;
  let first = -1;
  let last = -1;
  let minI = -1;
  let maxI = -1;

  let gap = false;

  for (let i = from; i < to; i++) {
    const y = ys[i] as number;
    if (y !== y) {
      // NaN: cerrar la columna pendiente y dejar una marca de corte (una sola por tramo).
      if (first >= 0) emitColumn(xs, ys, result, first, minI, maxI, last);
      first = -1;
      col = Number.NaN;
      if (!gap && result.length > 0) {
        push(xs, ys, result, i);
        gap = true;
      }
      continue;
    }
    gap = false;
    const c = Math.floor(((xs[i] as number) - xOrigin) * pxPerUnit);
    if (c !== col) {
      if (first >= 0) emitColumn(xs, ys, result, first, minI, maxI, last);
      col = c;
      first = last = minI = maxI = i;
      continue;
    }
    last = i;
    if (y < (ys[minI] as number)) minI = i;
    if (y > (ys[maxI] as number)) maxI = i;
  }
  if (first >= 0) emitColumn(xs, ys, result, first, minI, maxI, last);
  return result;
}

function estimateCapacity(
  xs: Float64Array,
  from: number,
  to: number,
  xOrigin: number,
  pxPerUnit: number,
): number {
  if (to <= from) return 0;
  const c0 = Math.floor(((xs[from] as number) - xOrigin) * pxPerUnit);
  const c1 = Math.floor(((xs[to - 1] as number) - xOrigin) * pxPerUnit);
  return (Math.abs(c1 - c0) + 1) * 4;
}

function ensureCapacity(out: DecimatedSeries | undefined, capacity: number): DecimatedSeries {
  if (out && out.x.length >= capacity) return out;
  return { x: new Float64Array(capacity), y: new Float64Array(capacity), length: 0 };
}

// Emite los índices distintos de la columna en orden ascendente (a lo sumo 4).
function emitColumn(
  xs: Float64Array,
  ys: Float64Array,
  out: DecimatedSeries,
  first: number,
  minI: number,
  maxI: number,
  last: number,
): void {
  const lo = Math.min(minI, maxI);
  const hi = Math.max(minI, maxI);
  push(xs, ys, out, first);
  if (lo !== first) push(xs, ys, out, lo);
  if (hi !== lo && hi !== first) push(xs, ys, out, hi);
  if (last !== hi && last !== lo && last !== first) push(xs, ys, out, last);
}

function push(xs: Float64Array, ys: Float64Array, out: DecimatedSeries, i: number): void {
  if (out.length >= out.x.length) grow(out);
  out.x[out.length] = xs[i] as number;
  out.y[out.length] = ys[i] as number;
  out.length++;
}

// Las marcas de corte por NaN no entran en la estimación inicial; se crece al doble si hace falta.
function grow(out: DecimatedSeries): void {
  const x = new Float64Array(Math.max(8, out.x.length * 2));
  const y = new Float64Array(x.length);
  x.set(out.x);
  y.set(out.y);
  out.x = x;
  out.y = y;
}

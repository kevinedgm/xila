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
 * La columna de un punto es `floor((x - xOrigin) * pxPerUnit)`. Los valores `NaN` de `y`
 * se ignoran. `out` permite reutilizar buffers entre fotogramas y evitar basura.
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

  for (let i = from; i < to; i++) {
    const y = ys[i] as number;
    if (y !== y) continue; // NaN
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
  out.x[out.length] = xs[i] as number;
  out.y[out.length] = ys[i] as number;
  out.length++;
}

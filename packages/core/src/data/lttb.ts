import type { DecimatedSeries } from './decimate';

/**
 * Largest Triangle Three Buckets (Steinarsson, 2013): reduce una serie ordenada por `x` a
 * `threshold` puntos representativos.
 *
 * Cómo funciona: se reparten los puntos interiores en `threshold − 2` cubetas; en cada una se
 * elige el punto que forma el triángulo de mayor área con el punto elegido en la cubeta
 * anterior y el promedio de la cubeta siguiente. Un área grande significa que el punto se
 * aleja de la tendencia, así que es el que más importa visualmente. El primero y el último
 * siempre se conservan.
 *
 * Cuándo usarlo: min/max (`minMaxDecimate`) es exacto para dibujar en pantalla, porque
 * depende del ancho en píxeles. LTTB da un número fijo de puntos independiente de la pantalla:
 * sirve para exportar, miniaturas o mandar menos datos. Los `NaN` en `y` se saltan.
 */
export function lttb(
  xs: Float64Array,
  ys: Float64Array,
  threshold: number,
  from = 0,
  to = xs.length,
): DecimatedSeries {
  const n = Math.max(0, to - from);
  if (threshold >= n || threshold < 3) {
    const count = Math.min(n, threshold < 3 && n > threshold ? Math.max(0, threshold) : n);
    return { x: xs.slice(from, from + count), y: ys.slice(from, from + count), length: count };
  }
  const outX = new Float64Array(threshold);
  const outY = new Float64Array(threshold);
  let outLen = 0;

  const bucketSize = (n - 2) / (threshold - 2);
  let a = from; // índice del último punto elegido
  outX[outLen] = xs[a] as number;
  outY[outLen] = ys[a] as number;
  outLen++;

  for (let b = 0; b < threshold - 2; b++) {
    // Promedio de la cubeta siguiente (el "tercer vértice").
    let nextStart = from + 1 + Math.floor((b + 1) * bucketSize);
    let nextEnd = from + 1 + Math.floor((b + 2) * bucketSize);
    if (nextEnd > to - 1) nextEnd = to - 1;
    if (nextStart > nextEnd) nextStart = nextEnd;
    let avgX = 0;
    let avgY = 0;
    let avgN = 0;
    for (let i = nextStart; i < nextEnd; i++) {
      const y = ys[i] as number;
      if (y !== y) continue;
      avgX += xs[i] as number;
      avgY += y;
      avgN++;
    }
    if (avgN === 0) {
      // Cubeta siguiente vacía o toda NaN: usar el último punto como vértice.
      avgX = xs[to - 1] as number;
      avgY = ys[to - 1] as number;
    } else {
      avgX /= avgN;
      avgY /= avgN;
    }

    // Punto de esta cubeta con mayor área respecto a `a` y al promedio.
    const start = from + 1 + Math.floor(b * bucketSize);
    const end = Math.min(from + 1 + Math.floor((b + 1) * bucketSize), to - 1);
    const ax = xs[a] as number;
    const ay = ys[a] as number;
    let best = -1;
    let bestArea = -1;
    for (let i = start; i < end; i++) {
      const y = ys[i] as number;
      if (y !== y) continue;
      const area = Math.abs((ax - avgX) * (y - ay) - (ax - (xs[i] as number)) * (avgY - ay));
      if (area > bestArea) {
        bestArea = area;
        best = i;
      }
    }
    if (best < 0) continue; // cubeta sin datos válidos
    outX[outLen] = xs[best] as number;
    outY[outLen] = ys[best] as number;
    outLen++;
    a = best;
  }

  outX[outLen] = xs[to - 1] as number;
  outY[outLen] = ys[to - 1] as number;
  outLen++;
  return { x: outX.subarray(0, outLen), y: outY.subarray(0, outLen), length: outLen };
}

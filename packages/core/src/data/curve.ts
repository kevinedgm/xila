/**
 * Formas del trazo de una línea, aplicadas al buffer ya decimado (pequeño: unos pocos puntos
 * por columna de píxel). Todas devuelven arreglos nuevos; un `NaN` en `y` sigue cortando la
 * línea salvo que `spanGaps` lo quite antes.
 */

export interface Polyline {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly length: number;
}

/**
 * Une la línea a través de los huecos (`NaN`): quita esos puntos. Con `maxGap` numérico solo
 * se une si la distancia en X entre los dos puntos válidos vecinos es `≤ maxGap` (en unidades
 * de X; milisegundos en un eje de tiempo); un hueco más largo sigue cortando.
 */
export function spanGaps(
  x: Float64Array,
  y: Float64Array,
  length: number,
  maxGap: number = Infinity,
): Polyline {
  const ox = new Float64Array(length);
  const oy = new Float64Array(length);
  let n = 0;
  let lastX = NaN;
  let gap = false;
  for (let i = 0; i < length; i++) {
    const v = y[i] as number;
    const u = x[i] as number;
    if (v !== v || u !== u) {
      gap = true;
      continue;
    }
    // El hueco es demasiado largo para unirlo: se conserva un NaN que corta.
    if (gap && n > 0 && u - lastX > maxGap) {
      ox[n] = NaN;
      oy[n++] = NaN;
    }
    gap = false;
    ox[n] = u;
    oy[n++] = v;
    lastX = u;
  }
  return { x: ox, y: oy, length: n };
}

/**
 * Escalones: el valor se mantiene hasta el siguiente X (`step-after`, como `drawstyle='steps-post'`
 * de matplotlib). Cada tramo `(x0, y0) → (x1, y1)` se vuelve `(x0, y0) → (x1, y0) → (x1, y1)`.
 */
export function stepCurve(x: Float64Array, y: Float64Array, length: number): Polyline {
  const ox = new Float64Array(Math.max(0, length * 2 - 1));
  const oy = new Float64Array(ox.length);
  let n = 0;
  for (let i = 0; i < length; i++) {
    const u = x[i] as number;
    const v = y[i] as number;
    const pv = i > 0 ? (y[i - 1] as number) : NaN;
    // Solo se inserta la esquina entre dos puntos válidos; junto a un NaN la línea ya se corta.
    if (i > 0 && v === v && pv === pv) {
      ox[n] = u;
      oy[n++] = pv;
    }
    ox[n] = u;
    oy[n++] = v;
  }
  return { x: ox, y: oy, length: n };
}

/**
 * Curva suave que no inventa máximos ni mínimos entre datos (interpolación cúbica monótona de
 * Fritsch–Carlson, la `curveMonotoneX` de d3 y `cubicInterpolationMode: 'monotone'` de
 * Chart.js). Entre dos puntos la curva queda dentro de sus dos valores, así que un valor
 * nunca parece más alto de lo que fue. `samples` es cuántos tramos rectos dibujan cada
 * segmento. Requiere X creciente; cada tramo entre `NaN` se suaviza por separado.
 */
export function monotoneCurve(
  x: Float64Array,
  y: Float64Array,
  length: number,
  samples: number,
): Polyline {
  const k = Math.max(1, Math.floor(samples));
  const ox = new Float64Array(Math.max(0, (length - 1) * k + length));
  const oy = new Float64Array(ox.length);
  let n = 0;
  let start = 0;
  while (start < length) {
    // Tramo continuo [start, end).
    let end = start;
    while (end < length && (y[end] as number) === (y[end] as number)) end++;
    if (end > start) n = monotoneRun(x, y, start, end, k, ox, oy, n);
    if (end < length) {
      ox[n] = NaN;
      oy[n++] = NaN;
    }
    start = end + 1;
  }
  return { x: ox, y: oy, length: n };
}

function monotoneRun(
  x: Float64Array,
  y: Float64Array,
  from: number,
  to: number,
  k: number,
  ox: Float64Array,
  oy: Float64Array,
  n: number,
): number {
  const count = to - from;
  if (count < 3) {
    for (let i = from; i < to; i++) {
      ox[n] = x[i] as number;
      oy[n++] = y[i] as number;
    }
    return n;
  }
  // Pendientes de cada segmento y tangentes en cada punto.
  const d = new Float64Array(count - 1);
  for (let i = 0; i < count - 1; i++) {
    const h = (x[from + i + 1] as number) - (x[from + i] as number);
    d[i] = h > 0 ? ((y[from + i + 1] as number) - (y[from + i] as number)) / h : 0;
  }
  const m = new Float64Array(count);
  m[0] = d[0] as number;
  m[count - 1] = d[count - 2] as number;
  for (let i = 1; i < count - 1; i++) {
    const a = d[i - 1] as number;
    const b = d[i] as number;
    // Cambio de dirección o tramo plano: tangente horizontal, así no hay sobrepaso.
    m[i] = a * b <= 0 ? 0 : (a + b) / 2;
  }
  for (let i = 0; i < count - 1; i++) {
    const di = d[i] as number;
    if (di === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = (m[i] as number) / di;
    const b = (m[i + 1] as number) / di;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * di;
      m[i + 1] = t * b * di;
    }
  }
  for (let i = 0; i < count - 1; i++) {
    const x0 = x[from + i] as number;
    const x1 = x[from + i + 1] as number;
    const y0 = y[from + i] as number;
    const y1 = y[from + i + 1] as number;
    const h = x1 - x0;
    const m0 = (m[i] as number) * h;
    const m1 = (m[i + 1] as number) * h;
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const t2 = t * t;
      const t3 = t2 * t;
      ox[n] = x0 + h * t;
      oy[n++] =
        (2 * t3 - 3 * t2 + 1) * y0 +
        (t3 - 2 * t2 + t) * m0 +
        (-2 * t3 + 3 * t2) * y1 +
        (t3 - t2) * m1;
    }
  }
  ox[n] = x[to - 1] as number;
  oy[n++] = y[to - 1] as number;
  return n;
}

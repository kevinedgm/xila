export interface ColumnarSeries {
  x: Float64Array;
  y: Float64Array;
}

/** PRNG pequeño y determinista: la misma semilla produce siempre los mismos datos. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Serie parecida a un sensor real: tendencia lenta + ciclo + ruido + picos ocasionales.
 * `x` son milisegundos desde 2026-01-01 a 1 kHz, para ejercitar valores grandes de tiempo.
 */
export function generateSeries(n: number, seed = 42): ColumnarSeries {
  const rand = mulberry32(seed);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const t0 = Date.UTC(2026, 0, 1);
  let walk = 0;
  for (let i = 0; i < n; i++) {
    x[i] = t0 + i;
    walk += (rand() - 0.5) * 0.05;
    const spike = rand() < 0.0005 ? (rand() - 0.5) * 20 : 0;
    y[i] = 20 + walk + 3 * Math.sin(i / 5000) + (rand() - 0.5) + spike;
  }
  return { x, y };
}

export function toObjects(series: ColumnarSeries): { x: number; y: number }[] {
  const out = new Array<{ x: number; y: number }>(series.x.length);
  for (let i = 0; i < series.x.length; i++) {
    out[i] = { x: series.x[i] as number, y: series.y[i] as number };
  }
  return out;
}

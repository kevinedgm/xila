import { describe, expect, it } from 'vitest';
import { minMaxDecimate } from './decimate';
import { buildPyramid, pyramidDecimate } from './pyramid';

// Generador determinista (LCG) para que las pruebas sean reproducibles.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function series(n: number, seed: number, nanRuns = 0, duplicates = false) {
  const r = rng(seed);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += duplicates && r() < 0.3 ? 0 : r() * 2;
    x[i] = t;
    y[i] = Math.sin(i / 37) * 10 + r() * 3 + (r() < 0.002 ? 100 : 0);
  }
  for (let k = 0; k < nanRuns; k++) {
    const start = Math.floor(r() * n);
    const len = 1 + Math.floor(r() * 40);
    for (let i = start; i < Math.min(n, start + len); i++) y[i] = Number.NaN;
  }
  return { x, y };
}

function same(
  x: Float64Array,
  y: Float64Array,
  from: number,
  to: number,
  origin: number,
  k: number,
) {
  const a = minMaxDecimate(x, y, from, to, origin, k);
  const b = pyramidDecimate(x, y, buildPyramid(y), from, to, origin, k);
  expect(b.length).toBe(a.length);
  expect(Array.from(b.x.subarray(0, b.length))).toEqual(Array.from(a.x.subarray(0, a.length)));
  expect(Array.from(b.y.subarray(0, b.length))).toEqual(Array.from(a.y.subarray(0, a.length)));
}

describe('pyramidDecimate', () => {
  it('da exactamente la misma salida que minMaxDecimate en series sin huecos', () => {
    const { x, y } = series(50_000, 1);
    for (const k of [0.0005, 0.01, 0.37, 1, 3]) same(x, y, 0, x.length, 0, k);
  });

  it('coincide también con tramos de NaN, incluidos cortes y columnas partidas', () => {
    const { x, y } = series(40_000, 7, 60);
    for (const k of [0.001, 0.02, 0.5, 2]) same(x, y, 0, x.length, 0, k);
  });

  it('coincide con rangos parciales, orígenes desplazados y x repetidas', () => {
    const { x, y } = series(30_000, 3, 10, true);
    const r = rng(11);
    for (let t = 0; t < 40; t++) {
      const from = Math.floor(r() * x.length);
      const to = from + Math.floor(r() * (x.length - from));
      const origin = (x[from] as number) - r() * 50;
      same(x, y, from, to, origin, 0.0003 + r() * 2);
    }
  });

  it('coincide en los extremos: serie vacía, un punto, todo NaN, empieza en NaN', () => {
    same(new Float64Array(0), new Float64Array(0), 0, 0, 0, 1);
    same(new Float64Array([5]), new Float64Array([2]), 0, 1, 0, 1);
    const nan = new Float64Array(100).fill(Number.NaN);
    const xs = Float64Array.from({ length: 100 }, (_, i) => i);
    same(xs, nan, 0, 100, 0, 0.1);
    nan.fill(1, 40);
    same(xs, nan, 0, 100, 0, 0.1);
  });

  it('no toca más que O(log n) bloques por columna: 1M puntos en pocas operaciones', () => {
    const { x, y } = series(1_000_000, 5, 5);
    const pyramid = buildPyramid(y);
    // Calentamiento y comparación de referencia, una sola vez.
    same(x, y, 0, x.length, 0, 1000 / (x[x.length - 1] as number));
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      pyramidDecimate(x, y, pyramid, 0, x.length, 0, 1000 / (x[x.length - 1] as number));
    }
    const perFrame = (performance.now() - t0) / 20;
    const t1 = performance.now();
    for (let i = 0; i < 20; i++) {
      minMaxDecimate(x, y, 0, x.length, 0, 1000 / (x[x.length - 1] as number));
    }
    const scan = (performance.now() - t1) / 20;
    // La pirámide debe ganar con margen al recorrido completo; el umbral es holgado para CI.
    expect(perFrame).toBeLessThan(scan / 2);
  });

  it('rechaza una pirámide de otra serie', () => {
    const { x, y } = series(100, 2);
    const other = buildPyramid(new Float64Array(50));
    expect(() => pyramidDecimate(x, y, other, 0, 100, 0, 1)).toThrow(RangeError);
  });
});

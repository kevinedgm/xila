import { describe, expect, it } from 'vitest';
import { minMaxDecimate } from './decimate';
import { lowerBound } from './search';

function series(n: number, f: (i: number) => number) {
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = i;
    y[i] = f(i);
  }
  return { x, y };
}

describe('minMaxDecimate', () => {
  it('no cambia una serie con un punto por columna', () => {
    const { x, y } = series(10, (i) => i * 2);
    const out = minMaxDecimate(x, y, 0, 10, 0, 1);
    expect(out.length).toBe(10);
    expect(Array.from(out.y.subarray(0, out.length))).toEqual(Array.from(y));
  });

  it('deja como máximo 4 puntos por columna', () => {
    const { x, y } = series(100_000, (i) => Math.sin(i / 50) + ((i * 7919) % 13) / 13);
    const columns = 1000;
    const out = minMaxDecimate(x, y, 0, x.length, 0, columns / x.length);
    expect(out.length).toBeLessThanOrEqual(columns * 4);
    expect(out.length).toBeGreaterThan(columns);
  });

  it('conserva el mínimo y el máximo de cada columna, incluido un pico aislado', () => {
    const { x, y } = series(10_000, (i) => (i === 5_123 ? 1000 : Math.sin(i)));
    const pxPerUnit = 100 / 10_000;
    const out = minMaxDecimate(x, y, 0, x.length, 0, pxPerUnit);
    for (let c = 0; c < 100; c++) {
      let min = Infinity;
      let max = -Infinity;
      for (let i = c * 100; i < (c + 1) * 100; i++) {
        min = Math.min(min, y[i] as number);
        max = Math.max(max, y[i] as number);
      }
      const kept: number[] = [];
      for (let k = 0; k < out.length; k++) {
        if (Math.floor((out.x[k] as number) * pxPerUnit) === c) kept.push(out.y[k] as number);
      }
      expect(Math.min(...kept)).toBe(min);
      expect(Math.max(...kept)).toBe(max);
    }
  });

  it('mantiene el orden de x', () => {
    const { x, y } = series(5_000, (i) => Math.cos(i / 3));
    const out = minMaxDecimate(x, y, 0, x.length, 0, 0.05);
    for (let k = 1; k < out.length; k++) {
      expect(out.x[k] as number).toBeGreaterThan(out.x[k - 1] as number);
    }
  });

  it('conserva un corte por cada tramo de NaN, sin duplicarlo', () => {
    const { x, y } = series(10, (i) => (i >= 3 && i <= 5 ? Number.NaN : i));
    const out = minMaxDecimate(x, y, 0, 10, 0, 1);
    expect(Array.from(out.y.subarray(0, out.length))).toEqual([0, 1, 2, NaN, 6, 7, 8, 9]);
  });

  it('no empieza con un corte si la serie arranca en NaN', () => {
    const { x, y } = series(4, (i) => (i < 2 ? Number.NaN : i));
    const out = minMaxDecimate(x, y, 0, 4, 0, 1);
    expect(Array.from(out.y.subarray(0, out.length))).toEqual([2, 3]);
  });

  it('crece el buffer cuando los cortes superan la estimación', () => {
    const { x, y } = series(200, (i) => (i % 2 ? Number.NaN : i));
    const out = minMaxDecimate(x, y, 0, 200, 0, 0.01); // 2 columnas estimadas, ~100 cortes
    expect(out.length).toBeGreaterThan(8);
    expect(out.x.length).toBeGreaterThanOrEqual(out.length);
  });

  it('reutiliza el buffer de salida si alcanza', () => {
    const { x, y } = series(1_000, (i) => i);
    const first = minMaxDecimate(x, y, 0, 1_000, 0, 0.1);
    const second = minMaxDecimate(x, y, 0, 1_000, 0, 0.1, first);
    expect(second).toBe(first);
  });
});

describe('lowerBound', () => {
  it('encuentra el primer índice mayor o igual', () => {
    const xs = new Float64Array([0, 1, 1, 3, 5]);
    expect(lowerBound(xs, 1)).toBe(1);
    expect(lowerBound(xs, 2)).toBe(3);
    expect(lowerBound(xs, -1)).toBe(0);
    expect(lowerBound(xs, 9)).toBe(5);
  });
});

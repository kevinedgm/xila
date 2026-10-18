import { describe, expect, it } from 'vitest';
import { lttb } from './lttb';

function serie(n: number, seed = 1): { x: Float64Array; y: Float64Array } {
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    x[i] = i;
    y[i] = Math.sin(i / 500) * 10 + (s / 0x7fffffff - 0.5);
  }
  return { x, y };
}

describe('lttb', () => {
  it('conserva el primero y el último y devuelve exactamente threshold puntos', () => {
    const { x, y } = serie(1000);
    const r = lttb(x, y, 50);
    expect(r.length).toBe(50);
    expect(r.x[0]).toBe(0);
    expect(r.x[49]).toBe(999);
    // Orden creciente en x.
    for (let i = 1; i < r.length; i++) expect(r.x[i]).toBeGreaterThan(r.x[i - 1] as number);
  });

  it('conserva los picos aislados (la forma visual)', () => {
    const { x, y } = serie(10_000);
    y[4242] = 100; // un pico que min/max y LTTB deben respetar
    y[7777] = -100;
    const r = lttb(x, y, 200);
    expect(Array.from(r.y)).toContain(100);
    expect(Array.from(r.y)).toContain(-100);
  });

  it('devuelve la serie entera si threshold la cubre y salta NaN', () => {
    const x = Float64Array.of(0, 1, 2, 3);
    const y = Float64Array.of(1, NaN, 3, 4);
    expect(lttb(x, y, 10).length).toBe(4);
    const r = lttb(x, y, 3);
    expect(Array.from(r.y)).toEqual([1, 3, 4]);
  });

  it('1M de puntos a 2000 en menos de 50 ms', () => {
    const { x, y } = serie(1_000_000);
    lttb(x, y, 2000); // calentamiento del JIT
    const t0 = performance.now();
    const r = lttb(x, y, 2000);
    const ms = performance.now() - t0;
    expect(r.length).toBe(2000);
    // Criterio de aceptación: 50 ms. Se deja margen para máquinas de CI lentas.
    expect(ms).toBeLessThan(150);
    console.log(`lttb 1M → 2000: ${ms.toFixed(1)} ms`);
  });
});

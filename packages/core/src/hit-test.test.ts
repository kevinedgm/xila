import { describe, expect, it } from 'vitest';
import type { ChartScales } from './chart';
import type { ResolvedSeries } from './data/series';
import { bandHitTester, gridHitTester, sortedHitTester } from './hit-test';
import { bandScale } from './scales/band';
import { linearScale } from './scales/linear';

function series(id: string, xs: number[], ys: number[]): ResolvedSeries {
  return {
    id,
    name: id,
    x: Float64Array.from(xs),
    y: Float64Array.from(ys),
    size: undefined,
    length: xs.length,
  };
}

const area = { x: 0, y: 0, width: 100, height: 100 };
const scales: ChartScales = {
  x: linearScale([0, 10], [0, 100]),
  y: linearScale([0, 10], [100, 0]),
};

describe('sortedHitTester', () => {
  const s = series('a', [0, 2, 4, 6, 8, 10], [1, 3, NaN, 7, 9, 5]);
  const tester = sortedHitTester([s], scales);

  it('encuentra el punto con x más cercana por búsqueda binaria', () => {
    const [hit] = tester.nearestX(63, 50);
    expect(hit?.index).toBe(3);
    expect(hit?.x).toBe(6);
    expect(hit?.px).toBe(60);
  });

  it('salta los NaN', () => {
    const [hit] = tester.nearestX(41, 50);
    expect(hit?.index).not.toBe(2);
  });

  it('respeta la distancia máxima', () => {
    expect(tester.nearestX(70, 5)).toEqual([]);
    // El punto 3 está en (60, 30): a 10 px en vertical no se alcanza, a 4 px sí.
    expect(tester.nearest(60, 20, 5)).toBeNull();
    expect(tester.nearest(60, 26, 5)?.index).toBe(3);
  });

  it('con 100K puntos responde en menos de 1 ms', () => {
    const n = 100_000;
    const xs = Array.from({ length: n }, (_, i) => i / 10_000);
    const big = sortedHitTester([series('b', xs, xs)], scales);
    const t = performance.now();
    for (let i = 0; i < 100; i++) big.nearest(i, 100 - i, 20);
    expect((performance.now() - t) / 100).toBeLessThan(1);
  });
});

describe('gridHitTester', () => {
  it('encuentra el punto más cercano sin revisar todos', () => {
    const n = 50_000;
    const xs = Array.from({ length: n }, (_, i) => ((i * 7919) % 1000) / 100);
    const ys = Array.from({ length: n }, (_, i) => ((i * 104729) % 1000) / 100);
    const tester = gridHitTester([series('p', xs, ys)], scales, area);
    const hit = tester.nearest(50, 50, 10);
    expect(hit).not.toBeNull();
    // Verificación por fuerza bruta.
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      best = Math.min(
        best,
        Math.hypot((xs[i] as number) * 10 - 50, 100 - (ys[i] as number) * 10 - 50),
      );
    }
    expect(hit?.distance).toBeCloseTo(best, 9);
  });

  it('devuelve null fuera del alcance', () => {
    const tester = gridHitTester([series('p', [1], [1])], scales, area);
    expect(tester.nearest(90, 10, 5)).toBeNull();
  });
});

describe('bandHitTester', () => {
  const bandScales: ChartScales = {
    x: bandScale(2, [0, 100]),
    y: linearScale([-10, 10], [100, 0]),
  };
  const a = series('a', [0, 1], [4, -2]);
  const b = series('b', [0, 1], [6, 3]);

  it('agrupadas: la barra de la serie bajo el cursor', () => {
    const tester = bandHitTester([a, b], bandScales, false);
    expect(tester.nearest(10, 50, 0)?.seriesId).toBe('a');
    expect(tester.nearest(40, 50, 0)?.seriesId).toBe('b');
    expect(tester.nearest(-1, 50, 0)).toBeNull();
  });

  it('apiladas: distingue el tramo vertical y los negativos', () => {
    const tester = bandHitTester([a, b], bandScales, true);
    // Banda 0: a de 0 a 4 (px 50→30), b de 4 a 10 (px 30→0).
    expect(tester.nearest(25, 40, 0)?.seriesId).toBe('a');
    expect(tester.nearest(25, 10, 0)?.seriesId).toBe('b');
    // Banda 1: a es negativa, de 0 a -2 (px 50→60).
    expect(tester.nearest(75, 55, 0)?.seriesId).toBe('a');
    expect(tester.nearest(75, 90, 0)).toBeNull();
  });
});

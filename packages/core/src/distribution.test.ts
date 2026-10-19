import { describe, expect, it } from 'vitest';
import {
  binCounts,
  binIndex,
  fitRadius,
  groupValues,
  percentileOf,
  rangeBands,
  sharedEdges,
} from './distribution';

describe('distribution', () => {
  it('agrupa por código en el orden de las filas e ignora NaN', () => {
    const g = groupValues([0, 1, 0, 1], [1, 2, NaN, 4], 2);
    expect(Array.from(g[0] as Float64Array)).toEqual([1]);
    expect(Array.from(g[1] as Float64Array)).toEqual([2, 4]);
  });
  it('bordes compartidos y cubeta inclusiva al final', () => {
    const edges = sharedEdges([Float64Array.of(0, 5), Float64Array.of(10)], 5);
    expect(Array.from(edges)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(binIndex(10, edges)).toBe(4);
    expect(binIndex(3.9, edges)).toBe(1);
    expect(binIndex(11, edges)).toBe(-1);
    expect(Array.from(binCounts(Float64Array.of(0, 1, 9, 10), edges))).toEqual([2, 0, 0, 0, 2]);
  });
  it('percentil y bandas', () => {
    expect(percentileOf([1, 2, 3, 4], 2)).toBe(0.5);
    expect(percentileOf([], 2)).toBeNaN();
    const b = rangeBands([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [0.1, 0.9]);
    expect(b.median).toBe(5);
    expect(b.lo).toBe(1);
    expect(b.hi).toBe(9);
  });
  it('el radio baja hasta que caben los puntos', () => {
    expect(fitRadius(40, 40, 4)).toBe(3.5);
    expect(fitRadius(40, 40, 200)).toBe(1);
    expect(fitRadius(40, 10, 9)).toBeLessThan(3.5);
  });
});

import { beeswarm, smooth3 } from './distribution';

describe('beeswarm', () => {
  it('separa puntos a la misma altura y deja solos a los lejanos', () => {
    const off = beeswarm([10, 10, 10, 100], 3, 50) as Float64Array;
    expect(off[3]).toBe(0);
    const xs = [off[0], off[1], off[2]].sort((a, b) => (a as number) - (b as number));
    expect(xs).toEqual([-7, 0, 7]);
  });
  it('devuelve null si no cabe', () => {
    expect(beeswarm([0, 0, 0, 0, 0], 3, 8)).toBeNull();
  });
  it('smooth3 promedia con los vecinos', () => {
    expect(Array.from(smooth3([0, 3, 0]))).toEqual([1, 1, 1]);
  });
});

import { describe, expect, it } from 'vitest';
import { monotoneCurve, spanGaps, stepCurve } from './curve';

const f = (v: number[]) => Float64Array.from(v);
const take = (a: Float64Array, n: number) => Array.from(a.subarray(0, n));

describe('spanGaps', () => {
  it('quita los NaN y une los vecinos', () => {
    const r = spanGaps(f([0, 1, 2, 3]), f([1, NaN, NaN, 4]), 4);
    expect(take(r.x, r.length)).toEqual([0, 3]);
    expect(take(r.y, r.length)).toEqual([1, 4]);
  });

  it('con distancia máxima, un hueco más largo sigue cortando', () => {
    const r = spanGaps(f([0, 1, 2, 10, 11, 12]), f([1, NaN, 3, NaN, NaN, 6]), 6, 3);
    // 0→2 mide 2 (se une); 2→12 mide 10 (corta).
    expect(take(r.y, r.length)).toEqual([1, 3, NaN, 6]);
  });
});

describe('stepCurve', () => {
  it('mantiene el valor hasta el siguiente X', () => {
    const r = stepCurve(f([0, 1, 2]), f([5, 7, 6]), 3);
    expect(take(r.x, r.length)).toEqual([0, 1, 1, 2, 2]);
    expect(take(r.y, r.length)).toEqual([5, 5, 7, 7, 6]);
  });

  it('no dibuja esquinas junto a un hueco', () => {
    const r = stepCurve(f([0, 1, 2]), f([5, NaN, 6]), 3);
    expect(take(r.y, r.length)).toEqual([5, NaN, 6]);
  });
});

describe('monotoneCurve', () => {
  it('pasa por todos los datos', () => {
    const x = f([0, 1, 2, 3]);
    const y = f([0, 3, 1, 2]);
    const r = monotoneCurve(x, y, 4, 4);
    for (let i = 0; i < 4; i++) {
      const j = Array.from(r.x.subarray(0, r.length)).indexOf(i);
      expect(r.y[j]).toBeCloseTo(y[i] as number, 10);
    }
  });

  it('no inventa picos: cada tramo queda entre sus dos valores', () => {
    const x = f([0, 1, 2, 3, 4]);
    const y = f([0, 10, 10.5, 2, 3]);
    const r = monotoneCurve(x, y, 5, 10);
    for (let i = 0; i < r.length; i++) {
      const u = r.x[i] as number;
      const seg = Math.min(3, Math.floor(u));
      const lo = Math.min(y[seg] as number, y[seg + 1] as number);
      const hi = Math.max(y[seg] as number, y[seg + 1] as number);
      expect(r.y[i]).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(r.y[i]).toBeLessThanOrEqual(hi + 1e-9);
    }
  });

  it('un NaN corta y cada tramo se suaviza por separado', () => {
    const r = monotoneCurve(f([0, 1, 2, 3, 4, 5, 6]), f([0, 1, 4, NaN, 2, 3, 1]), 7, 2);
    const ys = take(r.y, r.length);
    expect(ys.filter((v) => Number.isNaN(v))).toHaveLength(1);
    expect(ys[0]).toBe(0);
    expect(ys[ys.length - 1]).toBe(1);
  });
});

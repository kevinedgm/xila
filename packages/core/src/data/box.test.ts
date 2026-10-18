import { describe, expect, it } from 'vitest';
import { boxGroups, boxStats } from './box';

describe('boxStats', () => {
  it('coincide con pandas describe() y con los bigotes de matplotlib', () => {
    // pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 30]).describe(): 25 % = 3.25, 50 % = 5.5, 75 % = 7.75
    // IQR = 4.5 → cercas [-3.5, 14.5]: 30 es atípico; bigotes en 1 y 9 (último dato dentro).
    const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 30]);
    expect(b.count).toBe(10);
    expect(b.q1).toBeCloseTo(3.25, 12);
    expect(b.median).toBeCloseTo(5.5, 12);
    expect(b.q3).toBeCloseTo(7.75, 12);
    expect(b.low).toBe(1);
    expect(b.high).toBe(9);
    expect(Array.from(b.outliers)).toEqual([30]);
  });

  it('ignora NaN, respeta el factor del bigote y devuelve NaN sin datos', () => {
    // q1 = 2, q3 = 4, IQR = 2: con k = 50 la cerca superior es 104 y 100 deja de ser atípico.
    const b = boxStats([NaN, 1, 2, 3, 4, 100], 50);
    expect(b.count).toBe(5);
    expect(b.outliers.length).toBe(0);
    expect(b.high).toBe(100);
    const vacio = boxStats([NaN]);
    expect(vacio.count).toBe(0);
    expect(vacio.low).toBeNaN();
  });

  it('boxGroups separa por código de categoría', () => {
    const codes = Uint32Array.of(0, 1, 0, 1, 0, 2);
    const values = Float64Array.of(1, 10, 2, 20, 3, NaN);
    const g = boxGroups(codes, values, 3);
    expect(g.map((s) => s.count)).toEqual([3, 2, 0]);
    expect(g[0]?.median).toBe(2);
    expect(g[1]?.median).toBe(15);
  });
});

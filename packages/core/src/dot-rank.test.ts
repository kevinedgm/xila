import { describe, expect, it } from 'vitest';
import { deviationRows, rowLabels } from './dot-rank';
import { DataTable, categoryColumn, numberColumn } from './data/table';

describe('deviationRows', () => {
  it('desviación contra el promedio, ordenada de mayor a menor', () => {
    const { reference, rows } = deviationRows(['a', 'b', 'c'], [2, 6, 4]);
    expect(reference).toBe(4);
    expect(rows.map((r) => r.label)).toEqual(['b', 'c', 'a']);
    expect(rows.map((r) => r.delta)).toEqual([2, 0, -2]);
  });

  it('acepta mediana o un valor fijo, y descarta NaN', () => {
    expect(deviationRows(['a', 'b', 'c'], [1, 2, 100], 'median').reference).toBe(2);
    const r = deviationRows(['a', 'b'], [NaN, 5], 3);
    expect(r.reference).toBe(3);
    expect(r.rows).toEqual([{ label: 'b', value: 5, delta: 2 }]);
  });
});

describe('rowLabels', () => {
  it('lee categorías o números', () => {
    const t = new DataTable({ p: categoryColumn(['x', 'y', 'x']), n: numberColumn([1, 2, 3]) });
    expect(rowLabels(t, 'p')).toEqual(['x', 'y', 'x']);
    expect(rowLabels(t, 'n')).toEqual(['1', '2', '3']);
  });
});

import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { bucketTime, filterRows, groupBy, pivot, splitBy, takeRows } from './transform';

// Los valores esperados se calcularon con pandas 3.0 sobre este mismo CSV
// (groupby(sort=False).agg, pivot_table(aggfunc='sum'), isin + comparación).
const CSV = `fecha,region,monto,unidades
2026-01-05,Norte,100,3
2026-01-20,Sur,80,
2026-02-03,Norte,,2
2026-02-10,Sur,120,5
2026-02-28,Norte,60,1
2026-03-01,Centro,200,4
2026-03-15,Norte,40,2
`;
const tabla = () => parseCsv(CSV).table;
const cats = (t: ReturnType<typeof tabla>, name: string): string[] => {
  const c = t.column(name);
  if (c.kind !== 'category') throw new Error(`${name} no es categórica`);
  return Array.from(c.codes, (code) => c.categories[code] as string);
};
const nums = (t: ReturnType<typeof tabla>, name: string): number[] => Array.from(t.numeric(name));

describe('groupBy', () => {
  it('coincide con pandas en sum, mean, count, min y max por región', () => {
    const g = groupBy(tabla(), 'region', [
      { agg: 'sum', column: 'monto', as: 'suma' },
      { agg: 'mean', column: 'monto', as: 'media' },
      { agg: 'count', column: 'monto', as: 'n' },
      { agg: 'min', column: 'monto', as: 'mn' },
      { agg: 'max', column: 'monto', as: 'mx' },
    ]);
    expect(cats(g, 'region')).toEqual(['Norte', 'Sur', 'Centro']);
    expect(nums(g, 'suma')).toEqual([200, 200, 200]);
    expect(nums(g, 'media').map((v) => Number(v.toFixed(10)))).toEqual([66.6666666667, 100, 200]);
    expect(nums(g, 'n')).toEqual([3, 2, 1]);
    expect(nums(g, 'mn')).toEqual([40, 80, 200]);
    expect(nums(g, 'mx')).toEqual([100, 120, 200]);
  });

  it('agrupa por mes con bucketTime, como to_period("M") en pandas', () => {
    const t = bucketTime(tabla(), 'fecha', 'month', 'mes');
    const g = groupBy(t, 'mes', [
      { agg: 'sum', column: 'monto', as: 'suma' },
      { agg: 'sum', column: 'unidades' },
    ]);
    expect(nums(g, 'mes').map((v) => new Date(v).toISOString().slice(0, 10))).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
    expect(nums(g, 'suma')).toEqual([180, 180, 240]);
    expect(nums(g, 'unidades')).toEqual([3, 8, 6]);
    expect(g.column('mes').kind).toBe('time');
  });

  it('first y last funcionan en categorías; sum no', () => {
    const g = groupBy(tabla(), 'region', [
      { agg: 'first', column: 'fecha', as: 'primera' },
      { agg: 'last', column: 'fecha', as: 'ultima' },
    ]);
    expect(nums(g, 'primera')[0]).toBe(Date.UTC(2026, 0, 5));
    expect(nums(g, 'ultima')[0]).toBe(Date.UTC(2026, 2, 15));
    expect(() => groupBy(tabla(), 'fecha', { agg: 'sum', column: 'region' })).toThrow('categórica');
  });
});

describe('pivot', () => {
  it('de largo a ancho con NaN donde falta, como pivot_table', () => {
    const t = bucketTime(tabla(), 'fecha', 'month', 'mes');
    const p = pivot(t, { index: 'mes', columns: 'region', values: 'monto' });
    expect(p.names()).toEqual(['mes', 'Norte', 'Sur', 'Centro']);
    expect(nums(p, 'Norte')).toEqual([100, 60, 40]);
    expect(nums(p, 'Sur')).toEqual([80, 120, Number.NaN]);
    expect(nums(p, 'Centro')).toEqual([Number.NaN, Number.NaN, 200]);
  });
});

describe('filterRows', () => {
  it('condiciones declarativas: in sobre categoría y min sobre número', () => {
    const f = filterRows(tabla(), [
      { column: 'region', in: ['Norte', 'Sur'] },
      { column: 'monto', min: 60 },
    ]);
    expect(cats(f, 'region')).toEqual(['Norte', 'Sur', 'Sur', 'Norte']);
    expect(nums(f, 'monto')).toEqual([100, 80, 120, 60]);
  });

  it('rango de fechas en ISO y predicado por función', () => {
    const f = filterRows(tabla(), { column: 'fecha', min: '2026-02-01', max: '2026-02-28' });
    expect(f.length).toBe(3);
    const g = filterRows(tabla(), (i) => i % 2 === 0);
    expect(g.length).toBe(4);
  });

  it('los nulos quedan fuera de un rango salvo keepNull', () => {
    expect(filterRows(tabla(), { column: 'monto', min: 0 }).length).toBe(6);
    expect(filterRows(tabla(), { column: 'monto', min: 0, keepNull: true }).length).toBe(7);
  });
});

describe('splitBy y takeRows', () => {
  it('una tabla por región con el diccionario intacto', () => {
    const partes = splitBy(tabla(), 'region');
    expect([...partes.keys()]).toEqual(['Norte', 'Sur', 'Centro']);
    expect(nums(partes.get('Sur')!, 'monto')).toEqual([80, 120]);
    expect(cats(partes.get('Centro')!, 'region')).toEqual(['Centro']);
  });

  it('takeRows reordena', () => {
    const t = takeRows(tabla(), [6, 0]);
    expect(nums(t, 'monto')).toEqual([40, 100]);
  });
});

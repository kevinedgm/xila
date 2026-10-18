import { describe, expect, it } from 'vitest';
import { isSorted, resolveSeries } from './series';
import { categoryColumn, DataTable, numberColumn, timeColumn } from './table';

describe('DataTable', () => {
  it('construye columnas tipadas', () => {
    const t = new DataTable({
      fecha: timeColumn(['2026-01-01', '2026-01-02']),
      region: categoryColumn(['Norte', 'Sur']),
      monto: numberColumn([10, 20]),
    });
    expect(t.length).toBe(2);
    expect(t.names()).toEqual(['fecha', 'region', 'monto']);
    expect(t.column('fecha').kind).toBe('time');
    expect(t.numeric('fecha')[0]).toBe(Date.UTC(2026, 0, 1));
  });

  it('rechaza columnas de distinta longitud con un mensaje claro', () => {
    expect(() => new DataTable({ a: numberColumn([1, 2, 3]), b: numberColumn([1]) })).toThrow(
      /"b" \(1\)/,
    );
  });

  it('falla con el nombre de la columna que no existe', () => {
    const t = new DataTable({ a: numberColumn([1]) });
    expect(() => t.column('b')).toThrow(/"b" no existe. Disponibles: a/);
  });

  it('las categorías se guardan como códigos más diccionario', () => {
    const c = categoryColumn(['Sur', 'Norte', 'Sur', 'Sur']);
    expect(Array.from(c.codes)).toEqual([0, 1, 0, 0]);
    expect(c.categories).toEqual(['Sur', 'Norte']);
  });

  it('infiere tipos desde filas', () => {
    const t = DataTable.fromRows([
      { fecha: '2026-01-01', region: 'Norte', monto: 1.5 },
      { fecha: '2026-01-02', region: 'Sur', monto: null },
    ]);
    expect(t.column('fecha').kind).toBe('time');
    expect(t.column('region').kind).toBe('category');
    expect(t.column('monto').kind).toBe('number');
    expect(t.numeric('monto')[1]).toBeNaN();
  });
});

describe('resolveSeries', () => {
  const t = new DataTable({
    x: numberColumn([0, 1, 2]),
    y: numberColumn([5, 6, 7]),
    r: categoryColumn(['a', 'b', 'a']),
  });

  it('entrega buffers y el nombre por defecto', () => {
    const s = resolveSeries(t, { id: 's1', x: 'x', y: 'y' });
    expect(s.name).toBe('s1');
    expect(s.length).toBe(3);
    expect(s.x).toBeInstanceOf(Float64Array);
    expect(s.size).toBeUndefined();
  });

  it('rechaza una columna categórica en un eje continuo', () => {
    expect(() => resolveSeries(t, { id: 's', x: 'r', y: 'y' })).toThrow(/categórica/);
  });

  it('detecta si x está ordenado', () => {
    expect(isSorted(new Float64Array([1, 1, 2]))).toBe(true);
    expect(isSorted(new Float64Array([2, 1]))).toBe(false);
  });
});

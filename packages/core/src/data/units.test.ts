import { describe, expect, it } from 'vitest';
import { loosePositions, stackGeometry, stackedPositions, unitBins } from './units';

const f = (...v: number[]): Float64Array => Float64Array.from(v);

describe('unitBins', () => {
  it('cuenta por cubeta y numera en el orden de la tabla', () => {
    const b = unitBins(f(3, 1, 2, 9), 2);
    expect(Array.from(b.edges)).toEqual([1, 5, 9]);
    expect(Array.from(b.counts)).toEqual([3, 1]);
    // 3, 1 y 2 caen en la primera cubeta: lugares 0, 1 y 2 en el orden de la tabla.
    expect(Array.from(b.slot)).toEqual([0, 1, 2, 0]);
    expect(b.max).toBe(3);
    expect(b.total).toBe(4);
  });

  it('NaN no se dibuja', () => {
    const b = unitBins(f(1, NaN, 2), 1);
    expect(b.bin[1]).toBe(-1);
    expect(b.total).toBe(2);
  });

  it('en log las cubetas miden lo mismo en log10 y los ≤ 0 se excluyen', () => {
    const b = unitBins(f(1, 10, 100, 0), 2, true);
    expect(Array.from(b.edges).map((e) => Math.round(e))).toEqual([1, 10, 100]);
    expect(b.bin[3]).toBe(-1);
  });

  it('un solo valor distinto: una cubeta (K-06)', () => {
    const b = unitBins(f(5, 5, 5));
    expect(b.counts.length).toBe(1);
    expect(b.counts[0]).toBe(3);
  });

  it('sin datos no falla', () => {
    const b = unitBins(new Float64Array(0));
    expect(b.total).toBe(0);
    expect(b.max).toBe(0);
  });
});

describe('stackGeometry', () => {
  it('elige el radio más grande con el que cabe la columna más alta', () => {
    const g = stackGeometry(10, 20, 100, { maxRadius: 4, gap: 1 });
    expect(g.radius).toBe(4);
    expect(g.perMark).toBe(1);
    expect(Math.ceil(10 / g.cols)).toBeLessThanOrEqual(g.rows);
  });

  it('si no cabe ni con el radio mínimo, cada marca vale varios casos (K-04)', () => {
    const g = stackGeometry(10_000, 9, 60, { maxRadius: 4, minRadius: 1, gap: 1 });
    expect(g.radius).toBe(1);
    expect(g.perMark).toBeGreaterThan(1);
    expect(Math.ceil(10_000 / g.perMark / g.cols)).toBeLessThanOrEqual(g.rows);
    expect(g.capacity).toBeGreaterThanOrEqual(10_000);
  });
});

describe('posiciones', () => {
  it('apiladas: crecen hacia arriba desde el fondo, dentro de su columna', () => {
    const b = unitBins(f(1, 1.1, 1.2, 9), 2);
    const g = stackGeometry(b.max, 10, 100, { maxRadius: 2, gap: 1 });
    const { x, y } = stackedPositions(b, f(0, 10, 20), 100, g);
    for (let i = 0; i < 3; i++) {
      expect(x[i]).toBeGreaterThanOrEqual(0);
      expect(x[i]).toBeLessThanOrEqual(10);
      expect(y[i]).toBeLessThan(100);
    }
    expect(x[3]).toBeGreaterThan(10);
  });

  it('sueltas: x por valor, y dentro de la banda y deterministas', () => {
    const v = f(0, 5, 10);
    const a = loosePositions(v, (x) => x * 10, 0, 50, 2);
    const b = loosePositions(v, (x) => x * 10, 0, 50, 2);
    expect(Array.from(a.x)).toEqual([0, 50, 100]);
    expect(Array.from(a.y)).toEqual(Array.from(b.y));
    for (const yy of a.y) {
      expect(yy).toBeGreaterThanOrEqual(2);
      expect(yy).toBeLessThanOrEqual(48);
    }
  });
});

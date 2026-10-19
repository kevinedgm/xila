import { describe, expect, it } from 'vitest';
import { countInRange, moveRange, resizeRange, snapRange } from './brush';

describe('moveRange (K-01)', () => {
  it('se detiene en los bordes sin cambiar de ancho', () => {
    expect(moveRange([10, 20], -50, [0, 100])).toEqual([0, 10]);
    expect(moveRange([80, 90], 50, [0, 100])).toEqual([90, 100]);
    expect(moveRange([10, 20], 5, [0, 100])).toEqual([15, 25]);
  });

  it('Inicio/Fin: desplazamiento infinito lleva al extremo', () => {
    expect(moveRange([40, 50], -Infinity, [0, 100])).toEqual([0, 10]);
    expect(moveRange([40, 50], Infinity, [0, 100])).toEqual([90, 100]);
  });
});

describe('resizeRange (K-02)', () => {
  it('Shift ajusta el final y Alt el inicio', () => {
    expect(resizeRange([10, 20], 'end', 5, [0, 100], 1)).toEqual([10, 25]);
    expect(resizeRange([10, 20], 'start', -5, [0, 100], 1)).toEqual([5, 20]);
  });

  it('no cruza el otro borde ni sale de los datos', () => {
    expect(resizeRange([10, 20], 'end', -50, [0, 100], 2)).toEqual([10, 12]);
    expect(resizeRange([10, 20], 'start', 50, [0, 100], 2)).toEqual([18, 20]);
    expect(resizeRange([10, 20], 'end', 500, [0, 100], 2)).toEqual([10, 100]);
    expect(resizeRange([10, 20], 'start', -500, [0, 100], 2)).toEqual([0, 20]);
  });
});

describe('snapRange (K-05)', () => {
  const edges = [0, 10, 20, 30];

  it('amplía hasta columnas enteras', () => {
    expect(snapRange([3, 17], edges)).toEqual([0, 20]);
    expect(snapRange([10, 20], edges)).toEqual([10, 20]);
  });

  it('dentro de una sola cubeta: la cubeta completa', () => {
    expect(snapRange([12, 13], edges)).toEqual([10, 20]);
  });
});

describe('countInRange', () => {
  const values = Float64Array.from([1, 2, 3, NaN, 5]);

  it('cuenta con extremos incluidos e ignora NaN', () => {
    expect(countInRange([values], [2, 3])).toEqual({ count: 2, total: 4 });
  });

  it('sin rango, el conteo es el total', () => {
    expect(countInRange([values], null)).toEqual({ count: 4, total: 4 });
  });
});

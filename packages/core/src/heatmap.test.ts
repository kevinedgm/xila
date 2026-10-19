import { describe, expect, it } from 'vitest';
import { rowPosition, rowStats } from './heatmap';
import { colormap, inkOn } from './colormap';

describe('rowStats', () => {
  // Rejilla 2 × 3: fila 0 = [1, 5, 3], fila 1 = [vacía, 2, 2].
  const values = Float64Array.from([1, 5, 3, 2, 2]);
  const cells = Int32Array.from([0, 1, 2, -1, 3, 4]);
  const stats = rowStats(values, cells, 3, 2);

  it('calcula mediana, extremos y columna del máximo por fila', () => {
    expect(stats[0]).toEqual({ median: 3, min: 1, max: 5, argmax: 1 });
    expect(stats[1]).toEqual({ median: 2, min: 2, max: 2, argmax: 1 });
  });

  it('ignora celdas vacías y NaN', () => {
    const s = rowStats(Float64Array.from([NaN, 4]), Int32Array.from([0, 1, -1]), 3, 1);
    expect(s[0]).toEqual({ median: 4, min: 4, max: 4, argmax: 1 });
    expect(rowStats(values, Int32Array.from([-1, -1]), 2, 1)[0]?.argmax).toBe(-1);
  });

  it('rowPosition pone la mediana en 0,5 y los extremos en 0 y 1', () => {
    const s = stats[0]!;
    expect(rowPosition(3, s)).toBe(0.5);
    expect(rowPosition(1, s)).toBe(0);
    expect(rowPosition(5, s)).toBe(1);
    expect(rowPosition(4, s)).toBe(0.75);
    // Fila constante: todo en el centro, sin dividir por cero.
    expect(rowPosition(2, stats[1]!)).toBe(0.5);
    expect(rowPosition(NaN, s)).toBeNaN();
  });
});

describe('cobalto-naranja e inkOn', () => {
  it('el centro del divergente es casi blanco y los extremos azul y naranja', () => {
    const map = colormap('cobalto-naranja');
    const [r, g, b] = map(0.5);
    expect(Math.min(r, g, b)).toBeGreaterThan(240);
    expect(map(0)[2]).toBeGreaterThan(map(0)[0]);
    expect(map(1)[0]).toBeGreaterThan(map(1)[2]);
  });

  it('inkOn elige blanco sobre oscuro y el texto del tema sobre claro', () => {
    expect(inkOn([16, 42, 110], '#15181d')).toBe('#ffffff');
    expect(inkOn([238, 242, 251], '#15181d')).toBe('#15181d');
  });
});

import { describe, expect, it } from 'vitest';
import { waffleParts } from './waffle';

describe('waffleParts', () => {
  it('reparte exactamente 100 cuadros por restos mayores', () => {
    const p = waffleParts(['a', 'b', 'c'], [1, 1, 1]);
    expect(p.reduce((s, x) => s + x.cells, 0)).toBe(100);
    expect(p.map((x) => x.cells).sort()).toEqual([33, 33, 34]);
  });

  it('ordena de mayor a menor y conserva el índice original (para el color)', () => {
    const p = waffleParts(['chico', 'grande'], [10, 90]);
    expect(p.map((x) => x.label)).toEqual(['grande', 'chico']);
    expect(p[0]!.index).toBe(1);
    expect(p[0]!.share).toBeCloseTo(90);
  });

  it('ignora valores no positivos o no finitos; sin total no hay partes', () => {
    expect(waffleParts(['a', 'b'], [NaN, -3])).toEqual([]);
    expect(waffleParts(['a', 'b'], [0, 5]).length).toBe(1);
  });
});

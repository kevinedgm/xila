import { describe, expect, it } from 'vitest';
import { findMoments } from './narrate';

describe('findMoments', () => {
  it('marca máximo, mínimo y las caídas más fuertes, en orden', () => {
    const y = [10, 12, 14, 7, 9, 11, 10, 5, 6];
    const m = findMoments(y, { drops: 2, minGap: 1 });
    expect(m.map((x) => x.kind)).toEqual(['max', 'drop', 'drop', 'min']);
    expect(m.find((x) => x.kind === 'max')?.index).toBe(2);
    expect(m.find((x) => x.kind === 'min')?.index).toBe(7);
  });

  it('no marca dos momentos más cerca que minGap', () => {
    const y = [10, 20, 5, 30];
    const m = findMoments(y, { drops: 3, minGap: 2 });
    for (let i = 1; i < m.length; i++)
      expect(m[i]!.index - m[i - 1]!.index).toBeGreaterThanOrEqual(2);
  });

  it('ignora NaN y series vacías', () => {
    expect(findMoments([])).toEqual([]);
    expect(findMoments([NaN, 3, NaN]).map((x) => x.kind)).toEqual(['max']);
  });
});

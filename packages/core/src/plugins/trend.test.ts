import { describe, expect, it } from 'vitest';
import { trendFit } from './trend';

describe('trendFit', () => {
  it('recupera una recta exacta e ignora pares no finitos', () => {
    const fit = trendFit([1, 2, 3, NaN, 4], [3, 5, 7, 1, 9], false);
    expect(fit.n).toBe(4);
    expect(fit.b).toBeCloseTo(2);
    expect(fit.a).toBeCloseTo(1);
    expect(fit.predict(10)).toBeCloseTo(21);
  });
  it('ajusta sobre log10 de x cuando se pide', () => {
    const fit = trendFit([10, 100, 1000], [1, 2, 3], true);
    expect(fit.b).toBeCloseTo(1);
    expect(fit.predict(10000)).toBeCloseTo(4);
  });
  it('con menos de dos pares no hay ajuste', () => {
    expect(trendFit([1], [2]).predict(5)).toBeNaN();
  });
});

import { describe, expect, it } from 'vitest';
import { referenceValue } from './reference';

describe('referenceValue', () => {
  const ys = [Float64Array.from([1, 2, NaN]), Float64Array.from([10])];
  it('devuelve el número tal cual, o el promedio o la mediana de todos los valores finitos', () => {
    expect(referenceValue(3, ys)).toBe(3);
    expect(referenceValue('mean', ys)).toBeCloseTo(13 / 3);
    expect(referenceValue('median', ys)).toBe(2);
    expect(referenceValue('median', [Float64Array.from([1, 2, 3, 4])])).toBe(2.5);
  });
  it('sin datos da NaN', () => {
    expect(referenceValue('mean', [Float64Array.from([NaN])])).toBeNaN();
  });
});

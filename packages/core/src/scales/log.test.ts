import { describe, expect, it } from 'vitest';
import { logScale, logTicks } from './log';

describe('logScale', () => {
  it('lleva potencias de 10 a píxeles equidistantes y vuelve', () => {
    const s = logScale([1, 1e6], [0, 600]);
    expect(s.toPixel(1)).toBe(0);
    expect(s.toPixel(1000)).toBeCloseTo(300, 9);
    expect(s.toPixel(1e6)).toBeCloseTo(600, 9);
    expect(s.toValue(300)).toBeCloseTo(1000, 6);
    expect(s.toPixel(0)).toBe(-Infinity);
    expect(s.toPixel(-5)).toBeNaN();
  });

  it('dominio [1, 1e6]: ticks 1, 10, …, 1e6', () => {
    expect(logScale([1, 1e6], [0, 600]).ticks(7)).toEqual([1, 10, 100, 1000, 1e4, 1e5, 1e6]);
  });

  it('pocas décadas: subticks 2 y 5', () => {
    expect(logTicks([1, 100], 10)).toEqual([1, 2, 5, 10, 20, 50, 100]);
    expect(logTicks([3, 40], 10)).toEqual([5, 10, 20]);
  });

  it('muchas décadas: salta algunas', () => {
    expect(logTicks([1, 1e12], 4)).toEqual([1, 1e3, 1e6, 1e9, 1e12]);
  });

  it('rechaza dominios con cero o negativos y nice() extiende a décadas', () => {
    expect(() => logScale([0, 10], [0, 1])).toThrow(RangeError);
    expect(() => logScale([-1, 10], [0, 1])).toThrow(/positivo/);
    expect(logScale([3, 4000], [0, 1]).nice(5).domain).toEqual([1, 10000]);
  });

  it('map() trabaja en espacio log10 con transform', () => {
    const s = logScale([10, 1000], [0, 200]);
    const m = s.map();
    expect(s.transform?.(100)).toBe(2);
    expect(m.base + ((s.transform as (v: number) => number)(100) - m.offset) * m.scale).toBe(100);
  });
});

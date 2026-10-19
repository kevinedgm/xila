import { describe, expect, it } from 'vitest';
import { trajectoryHead, trajectoryTimeline } from './trajectory';

describe('trajectoryTimeline', () => {
  it('ordena los instantes distintos y finitos', () => {
    expect(Array.from(trajectoryTimeline([3, 1, 2, 1, NaN, Infinity]))).toEqual([1, 2, 3]);
  });
});

describe('trajectoryHead', () => {
  it('es la última fila con x e y finitas', () => {
    const s = { x: Float64Array.of(1, 2, 3, NaN), y: Float64Array.of(1, NaN, 3, 4), length: 4 };
    expect(trajectoryHead(s)).toBe(2);
    expect(trajectoryHead({ x: Float64Array.of(NaN), y: Float64Array.of(1), length: 1 })).toBe(-1);
  });
});

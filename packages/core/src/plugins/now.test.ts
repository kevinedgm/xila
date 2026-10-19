import { describe, expect, it } from 'vitest';
import { indexAt, nowTimeline, nowValue } from './now';

const serie = (id: string, xs: number[], ys: number[]) => ({
  id,
  x: Float64Array.from(xs),
  y: Float64Array.from(ys),
  length: xs.length,
});

describe('nowPlugin: línea de tiempo y cifras', () => {
  it('la línea de tiempo une las X de las series visibles, sin repetir ni NaN', () => {
    const a = serie('a', [0, 1, 2, NaN], [1, 2, 3, 4]);
    const b = serie('b', [1, 3], [5, 6]);
    expect(Array.from(nowTimeline([a, b], new Set()))).toEqual([0, 1, 2, 3]);
    expect(Array.from(nowTimeline([a, b], new Set(['a'])))).toEqual([1, 3]);
  });

  it('indexAt da el último punto con x ≤ t', () => {
    const s = serie('s', [0, 2, 4], [1, 1, 1]);
    expect(indexAt(s, 3)).toBe(1);
    expect(indexAt(s, 4)).toBe(2);
    expect(indexAt(s, -1)).toBe(-1);
  });

  it('la cifra es la del instante y el cambio compara contra lookback instantes atrás', () => {
    const s = serie('s', [0, 1, 2, 3, 4], [1, 2, 3, 4, 6]);
    const times = nowTimeline([s], new Set());
    expect(nowValue(s, times, 4, 2)).toEqual({ value: 6, delta: 3, steps: 2 });
    // Al inicio no hay con qué comparar.
    expect(nowValue(s, times, 0, 2)).toEqual({ value: 1, delta: NaN, steps: 0 });
    // Un instante sin dato en la serie toma el último anterior.
    const corta = serie('c', [0, 2], [10, 20]);
    expect(nowValue(corta, times, 3, 1).value).toBe(20);
  });
});

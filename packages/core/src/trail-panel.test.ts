import { describe, expect, it } from 'vitest';
import { deltaText, trailAlpha } from './trail-panel';

describe('trailAlpha', () => {
  it('lo reciente es opaco y lo viejo se desvanece hasta un mínimo', () => {
    expect(trailAlpha(0, 50)).toBe(1);
    expect(trailAlpha(25, 50)).toBeCloseTo(0.2);
    expect(trailAlpha(50, 50)).toBe(0.06);
  });
});

describe('deltaText', () => {
  const v = Float64Array.from([10, 12, 15, 11]);
  const f = (x: number): string => x.toFixed(1);
  it('lleva flecha y signo además del número', () => {
    expect(deltaText(v, 2, 2, f, 'en 2 años')).toBe('▲ +5.0 en 2 años');
    expect(deltaText(v, 3, 1, f, 'en 1 año')).toBe('▼ −4.0 en 1 año');
  });
  it('sin historia suficiente no hay comparación', () => {
    expect(deltaText(v, 1, 5, f, 'x')).toBeNull();
  });
});

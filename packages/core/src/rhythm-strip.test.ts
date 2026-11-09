import { describe, expect, it } from 'vitest';
import { rhythm } from './rhythm-strip';

describe('rhythm', () => {
  it('cambio relativo por paso contra la ventana', () => {
    const r = rhythm([100, 110, 121, 121], 1);
    expect(r[0]).toBeNaN();
    expect(r[1]).toBeCloseTo(0.1);
    expect(r[2]).toBeCloseTo(0.1);
    expect(r[3]).toBeCloseTo(0);
  });

  it('con ventana 2 promedia por paso y al inicio usa lo que hay', () => {
    const r = rhythm([100, 110, 120], 2);
    expect(r[1]).toBeCloseTo(0.1);
    expect(r[2]).toBeCloseTo(0.1);
  });

  it('referencia 0 o NaN no da ritmo', () => {
    expect(rhythm([0, 5], 1)[1]).toBeNaN();
    expect(rhythm([NaN, 5], 1)[1]).toBeNaN();
  });
});

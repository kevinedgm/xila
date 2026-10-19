import { describe, expect, it } from 'vitest';
import { MarkTransition, easeInOutCubic, staggerDelays } from './transitions';

const f = (...v: number[]): Float64Array => Float64Array.from(v);

describe('easeInOutCubic', () => {
  it('empieza en 0, pasa por 0.5 a la mitad y termina en 1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });
});

describe('MarkTransition', () => {
  it('jump coloca las marcas sin animar', () => {
    const t = new MarkTransition();
    t.jump(f(1, 2), f(3, 4), 2);
    expect(Array.from(t.x)).toEqual([1, 2]);
    expect(t.radius).toBe(2);
    expect(t.running).toBe(false);
  });

  it('interpola y llega exacto al destino', () => {
    const t = new MarkTransition({ duration: 100, stagger: 0 });
    t.jump(f(0, 0), f(0, 0), 1);
    t.animateTo(f(10, 20), f(10, 20), 3, 0);
    expect(t.sample(50)).toBe(true);
    expect(t.x[0]).toBeCloseTo(5);
    expect(t.radius).toBeCloseTo(2);
    expect(t.sample(100)).toBe(false);
    expect(Array.from(t.x)).toEqual([10, 20]);
    expect(t.radius).toBe(3);
  });

  it('interrumpir arranca desde la posición actual, sin salto', () => {
    const t = new MarkTransition({ duration: 100, stagger: 0 });
    t.jump(f(0), f(0), 1);
    t.animateTo(f(100), f(0), 1, 0);
    t.sample(50);
    const mid = t.x[0] as number;
    t.animateTo(f(0), f(0), 1, 50);
    t.sample(50);
    expect(t.x[0]).toBeCloseTo(mid);
  });

  it('si cambia el número de marcas salta al destino', () => {
    const t = new MarkTransition({ duration: 100 });
    t.jump(f(0), f(0), 1);
    t.animateTo(f(1, 2), f(1, 2), 1, 0);
    expect(t.running).toBe(false);
    expect(Array.from(t.x)).toEqual([1, 2]);
  });

  it('con escalonado la marca de más a la izquierda se mueve primero', () => {
    const t = new MarkTransition({ duration: 100, stagger: 0.5 });
    t.jump(f(0, 0), f(0, 0), 1);
    t.animateTo(f(0, 10), f(10, 10), 1, 0);
    t.sample(25);
    expect(t.y[0]).toBeGreaterThan(t.y[1] as number);
  });
});

describe('staggerDelays', () => {
  it('reparte el retraso según x', () => {
    expect(Array.from(staggerDelays(f(0, 5, 10), 0.4))).toEqual([0, 0.2, 0.4]);
    expect(Array.from(staggerDelays(f(3, 3), 0.4))).toEqual([0, 0]);
  });
});

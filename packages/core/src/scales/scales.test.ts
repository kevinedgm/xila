import { describe, expect, it } from 'vitest';
import { bandScale } from './band';
import { linearScale, niceStep } from './linear';

describe('linearScale', () => {
  it('genera [0, 20, 40, 60, 80, 100] para [0, 100] con 5 ticks', () => {
    expect(linearScale([0, 100], [0, 500]).ticks(5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('convierte en ambas direcciones', () => {
    const s = linearScale([0, 100], [0, 500]);
    expect(s.toPixel(25)).toBe(125);
    expect(s.toValue(125)).toBe(25);
    for (const v of [0, 3.7, 99.99]) expect(s.toValue(s.toPixel(v))).toBeCloseTo(v, 10);
  });

  it('acepta rango invertido para el eje Y', () => {
    const s = linearScale([0, 10], [400, 0]);
    expect(s.toPixel(0)).toBe(400);
    expect(s.toPixel(10)).toBe(0);
    expect(s.map().scale).toBeLessThan(0);
  });

  it('nice extiende el dominio hasta ticks enteros', () => {
    const s = linearScale([3, 97], [0, 1]).nice(5);
    expect(s.domain).toEqual([0, 100]);
  });

  it('maneja dominios negativos, muy pequeños y degenerados', () => {
    expect(linearScale([-50, 50], [0, 1]).ticks(5)).toEqual([-40, -20, 0, 20, 40]);
    expect(linearScale([0, 1e-9], [0, 1]).ticks(5)).toEqual([0, 2e-10, 4e-10, 6e-10, 8e-10, 1e-9]);
    const flat = linearScale([5, 5], [0, 1]);
    expect(flat.domain[0]).toBeLessThan(5);
    expect(flat.domain[1]).toBeGreaterThan(5);
    expect(Number.isFinite(flat.toPixel(5))).toBe(true);
  });

  it('los ticks no traen ruido binario', () => {
    expect(linearScale([0, 1], [0, 1]).ticks(10)).toEqual([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
    ]);
  });

  it('niceStep elige múltiplos de 1, 2 y 5', () => {
    expect(niceStep(100, 5)).toBe(20);
    expect(niceStep(100, 3)).toBe(50);
    expect(niceStep(7, 7)).toBe(1);
    expect(niceStep(0.35, 5)).toBe(0.05);
  });
});

describe('bandScale', () => {
  it('con 4 categorías en 400 px y padding 0 cada banda mide 100 px', () => {
    const s = bandScale(4, [0, 400]);
    expect(s.bandwidth).toBe(100);
    expect(s.start(2)).toBe(200);
    expect(s.center(0)).toBe(50);
  });

  it('con padding 0.2 deja huecos del 20 % del paso, también en los bordes', () => {
    const s = bandScale(4, [0, 400], 0.2);
    expect(s.step).toBeCloseTo(400 / 4.2);
    expect(s.bandwidth).toBeCloseTo(s.step * 0.8);
    expect(s.start(0)).toBeCloseTo(s.step * 0.2);
    expect(s.start(3) + s.bandwidth + s.step * 0.2).toBeCloseTo(400);
  });

  it('encuentra la banda bajo un píxel', () => {
    const s = bandScale(4, [0, 400]);
    expect(s.indexAt(150)).toBe(1);
    expect(s.indexAt(-5)).toBe(-1);
    expect(s.indexAt(400)).toBe(-1);
  });
});

import { describe, expect, it } from 'vitest';
import { autoUnit, waffleLayout } from './waffle';

describe('autoUnit', () => {
  it('elige un paso redondo que dé entre 100 y 250 cuadros', () => {
    for (const total of [22122, 999, 1, 0.37, 150000]) {
      const u = autoUnit(total);
      const n = total / u;
      expect(n, `total ${total} → unit ${u}`).toBeGreaterThanOrEqual(100);
      expect(n).toBeLessThanOrEqual(250);
      const m = u / 10 ** Math.floor(Math.log10(u));
      expect([1, 2, 5]).toContain(Math.round(m));
    }
    expect(autoUnit(0)).toBe(1);
  });
});

describe('waffleLayout', () => {
  const area = { x: 10, y: 20, width: 100, height: 50 };

  it('reparte los cuadros por categoría, juntos y en orden, con al menos uno por valor positivo', () => {
    const l = waffleLayout([300, 100, 1, 0], area, { unit: 100, columns: 5, gap: 2 });
    expect(l.counts).toEqual([3, 1, 1, 0]);
    expect(l.cells.map((c) => c.category)).toEqual([0, 0, 0, 1, 2]);
    expect(l.columns).toBe(5);
    expect(l.rows).toBe(1);
    expect(l.size).toBe(20);
    expect(l.cells[1]).toEqual({ x: 30, y: 20, size: 18, category: 0 });
  });

  it('con columnas automáticas la cuadrícula cabe en el área', () => {
    const l = waffleLayout([5000, 3000, 2000], area, { unit: 100, columns: 'auto', gap: 2 });
    expect(l.cells).toHaveLength(100);
    expect(l.rows * l.size).toBeLessThanOrEqual(area.height + 1e-9);
    expect(l.columns * l.size).toBeLessThanOrEqual(area.width + 1e-9);
    const last = l.cells[99] as { x: number; y: number; size: number };
    expect(last.x + last.size).toBeLessThanOrEqual(area.x + area.width + 1e-9);
    expect(last.y + last.size).toBeLessThanOrEqual(area.y + area.height + 1e-9);
  });

  it('sin valores positivos no hay cuadros', () => {
    expect(waffleLayout([0, -1], area, { unit: 'auto', columns: 'auto', gap: 2 }).cells).toEqual(
      [],
    );
  });
});

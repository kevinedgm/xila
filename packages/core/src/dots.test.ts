import { describe, expect, it } from 'vitest';
import { countInRange, dotsLayout, easeOutCubic, jitter, snapToEdges } from './dots';
import { linearScale } from './scales/linear';

const area = { x: 40, y: 10, width: 800, height: 300 };

function lognormal(n: number): Float64Array {
  // Determinista: misma semilla, mismos datos (mulberry32 como en el wireframe original).
  let a = 42;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const z = Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
    v[i] = Math.exp(2.6 + 0.45 * z) + (rand() < 0.03 ? 40 + rand() * 60 : 0);
  }
  return v;
}

describe('dotsLayout', () => {
  const values = lognormal(1240);
  const x = linearScale([0, 120], [area.x, area.x + area.width]);

  it('en modo tira cada punto queda en su x y dentro del área, con dispersión determinista', () => {
    const l = dotsLayout(values, area, x, { mode: 'strip', bins: 'fd', radius: 'auto' });
    expect(l.mode).toBe('strip');
    expect(l.capacity).toBe(1);
    for (let i = 0; i < values.length; i++) {
      expect(l.px[i]).toBeCloseTo(x.toPixel(values[i] as number));
      expect(l.py[i]).toBeGreaterThanOrEqual(area.y + l.radius - 1e-9);
      expect(l.py[i]).toBeLessThanOrEqual(area.y + area.height - l.radius + 1e-9);
    }
    const again = dotsLayout(values, area, x, { mode: 'strip', bins: 'fd', radius: 'auto' });
    expect(Array.from(again.py)).toEqual(Array.from(l.py));
    expect(jitter(0)).toBe(0);
    expect(jitter(1)).toBeCloseTo(0.919);
  });

  it('en modo cubetas apila sin salirse del área y la capacidad es lineal con los píxeles', () => {
    const l = dotsLayout(values, area, x, { mode: 'binned', bins: 'fd', radius: 'auto' });
    expect(l.edges).not.toBeNull();
    expect(l.counts).not.toBeNull();
    const counts = l.counts as Float64Array;
    const cmax = Math.max(...counts);
    expect(l.capacity).toBeGreaterThanOrEqual(cmax);
    let total = 0;
    for (const c of counts) total += c;
    expect(total).toBe(values.length);
    for (let i = 0; i < values.length; i++) {
      expect(l.py[i]).toBeGreaterThanOrEqual(area.y + l.radius - 1e-9);
      expect(l.py[i]).toBeLessThanOrEqual(area.y + area.height - l.radius + 1e-9);
      expect(l.px[i]).toBeGreaterThanOrEqual(area.x);
      expect(l.px[i]).toBeLessThanOrEqual(area.x + area.width);
    }
    // Eje Y en unidades: el tick "200" cae a la altura de la unidad 200 de una columna.
    const y = linearScale([0, l.capacity], [area.y + area.height, area.y]);
    const u = 2 * l.radius + 1;
    const edges = l.edges as Float64Array;
    const bw = x.toPixel(edges[1] as number) - x.toPixel(edges[0] as number);
    const cols = Math.max(1, Math.floor((bw - 2) / u));
    expect(y.toPixel(cols)).toBeCloseTo(area.y + area.height - u, 6);
  });

  it('en un área muy baja reduce el radio hasta que la columna más alta cabe', () => {
    const chico = { ...area, height: 60 };
    const l = dotsLayout(values, chico, x, { mode: 'binned', bins: 'fd', radius: 'auto' });
    expect(l.radius).toBeLessThanOrEqual(1);
    for (let i = 0; i < values.length; i++) {
      expect(l.py[i]).toBeGreaterThanOrEqual(chico.y - 1e-9);
    }
  });

  it('ignora NaN y los deja fuera del dibujo', () => {
    const v = Float64Array.of(1, NaN, 3, 2);
    const l = dotsLayout(v, area, linearScale([0, 4], [0, 100]), {
      mode: 'binned',
      bins: 2,
      radius: 3,
    });
    expect(l.px[1]).toBeNaN();
    expect(l.py[1]).toBeNaN();
    expect(Array.from(l.counts as Float64Array)).toEqual([1, 2]);
  });
});

describe('selección', () => {
  it('cuenta inclusivo y en cualquier orden del rango', () => {
    const v = Float64Array.of(1, 2, 3, 4, 5, NaN);
    expect(countInRange(v, 2, 4)).toBe(3);
    expect(countInRange(v, 4, 2)).toBe(3);
    expect(countInRange(v, 10, 20)).toBe(0);
  });

  it('salta a los bordes de cubeta por fuera y nunca deja un rango vacío', () => {
    const edges = Float64Array.of(0, 10, 20, 30);
    expect(snapToEdges([12, 18], edges)).toEqual([10, 20]);
    expect(snapToEdges([5, 25], edges)).toEqual([0, 30]);
    expect(snapToEdges([10, 10], edges)).toEqual([10, 20]);
    expect(snapToEdges([-5, 35], edges)).toEqual([0, 30]);
  });

  it('la curva de transición empieza en 0, termina en 1 y es monótona', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    let prev = 0;
    for (let t = 0.1; t <= 1; t += 0.1) {
      const e = easeOutCubic(t);
      expect(e).toBeGreaterThan(prev);
      prev = e;
    }
  });
});

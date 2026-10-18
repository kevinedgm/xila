import { describe, expect, it } from 'vitest';
import { binCount, histogram, histogramTable } from './histogram';
import type { Column } from './table';

function etiquetas(c: Column): string[] {
  if (c.kind !== 'category') throw new Error('se esperaba columna categórica');
  return Array.from(c.codes, (i) => c.categories[i] as string);
}

/** Normal estándar con Box–Muller y semilla fija (reproducible). */
function normal(n: number, seed = 7): Float64Array {
  const out = new Float64Array(n);
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i += 2) {
    const u = rand() || 1e-12;
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return out;
}

describe('histogram', () => {
  it('coincide con numpy.histogram en un caso a mano', () => {
    // np.histogram([1, 2, 2, 3, 3, 3, 4, 10], bins=3) → counts [6, 1, 1], edges [1, 4, 7, 10]
    const h = histogram([1, 2, 2, 3, 3, 3, 4, 10], { bins: 3 });
    expect(Array.from(h.edges)).toEqual([1, 4, 7, 10]);
    expect(Array.from(h.counts)).toEqual([6, 1, 1]);
    expect(h.total).toBe(8);
  });

  it('el máximo cae en la última cubeta y los NaN se ignoran', () => {
    const h = histogram([0, NaN, 5, 10, Infinity], { bins: 2 });
    expect(Array.from(h.counts)).toEqual([1, 2]);
    expect(h.total).toBe(3);
  });

  it('respeta range, density y un valor único', () => {
    const h = histogram([1, 2, 3, 50], { bins: 2, range: [0, 4], density: true });
    expect(Array.from(h.counts)).toEqual([1 / 3, 2 / 3]);
    const uno = histogram([7, 7, 7]);
    expect(Array.from(uno.edges)).toEqual([6.5, 7.5]);
    expect(Array.from(uno.counts)).toEqual([3]);
  });

  it('Freedman–Diaconis: 10K normales dan una campana con un número razonable de cubetas', () => {
    const datos = normal(10_000);
    const bins = binCount(datos, 'fd');
    // numpy da ~60 cubetas para N(0,1) con n = 10K (ancho ≈ 2·1.35/21.5 ≈ 0.125, rango ≈ 7.5).
    expect(bins).toBeGreaterThan(40);
    expect(bins).toBeLessThan(90);
    const h = histogram(datos);
    expect(h.counts.length).toBe(bins);
    // Forma de campana: la cubeta más alta queda cerca de 0 y supera a las colas.
    let top = 0;
    for (let k = 1; k < h.counts.length; k++)
      if ((h.counts[k] as number) > (h.counts[top] as number)) top = k;
    const centro = ((h.edges[top] as number) + (h.edges[top + 1] as number)) / 2;
    expect(Math.abs(centro)).toBeLessThan(0.5);
    expect(h.counts[0] as number).toBeLessThan((h.counts[top] as number) / 10);
  });

  it('con atípicos, FD no infla el ancho y sturges/sqrt siguen sus fórmulas', () => {
    const datos = Array.from(normal(1000));
    datos.push(1000); // un atípico extremo
    const fd = binCount(datos, 'fd');
    // El ancho sigue siendo ~0.27; el rango ahora es ~1000: muchas cubetas, no pocas.
    expect(fd).toBeGreaterThan(1000);
    expect(binCount(datos, 'sturges')).toBe(Math.ceil(Math.log2(1001)) + 1);
    expect(binCount(datos, 'sqrt')).toBe(Math.ceil(Math.sqrt(1001)));
    // IQR cero → cae a sturges.
    expect(binCount([5, 5, 5, 5, 5, 5, 5, 9], 'fd')).toBe(4);
  });

  it('histogramTable etiqueta cada cubeta y conserva los conteos', () => {
    const t = histogramTable([1, 2, 2, 3, 3, 3, 4, 10], { bins: 3 });
    expect(t.length).toBe(3);
    expect(etiquetas(t.column('bin'))).toEqual(['1 – 4', '4 – 7', '7 – 10']);
    expect(Array.from(t.numeric('count'))).toEqual([6, 1, 1]);
    const custom = histogramTable([0.5, 1.5], {
      bins: 2,
      binColumn: 'rango',
      label: (lo) => `≥${lo}`,
    });
    expect(etiquetas(custom.column('rango'))).toEqual(['≥0.5', '≥1']);
  });
});

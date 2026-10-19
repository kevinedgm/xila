import { describe, expect, it } from 'vitest';
import { colormap, colormapCss, contrastRatio, readableOn, stopsColormap } from './colormap';

/** Referencias de matplotlib (`cm.viridis(0)`, etc.), en 0–255. */
const REF = {
  viridis: { 0: [68, 1, 84], 1: [253, 231, 37], 0.5: [33, 145, 140] },
  magma: { 0: [0, 0, 4], 1: [252, 253, 191] },
  inferno: { 0: [0, 0, 4], 1: [252, 255, 164] },
  plasma: { 0: [13, 8, 135], 1: [240, 249, 33] },
} as const;

function cerca(a: readonly number[], b: readonly number[], tol: number): boolean {
  return a.every((v, i) => Math.abs(v - (b[i] as number)) <= tol);
}

describe('colormap', () => {
  it('los mapas perceptuales se acercan a matplotlib en los extremos (±16/255)', () => {
    for (const [name, refs] of Object.entries(REF)) {
      const map = colormap(name as keyof typeof REF);
      for (const [t, ref] of Object.entries(refs)) {
        const got = map(Number(t));
        expect(cerca(got, ref, 16), `${name}(${t}) = ${got.join(',')}`).toBe(true);
      }
    }
  });

  it('la luminosidad de viridis crece de forma monótona', () => {
    const map = colormap('viridis');
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const [r, g, b] = map(i / 20);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      expect(lum).toBeGreaterThan(prev);
      prev = lum;
    }
  });

  it('cobalto es un solo tono con luminosidad decreciente de forma monótona', () => {
    const map = colormap('cobalto');
    let prev = Infinity;
    for (let i = 0; i <= 20; i++) {
      const [r, g, b] = map(i / 20);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      expect(lum).toBeLessThan(prev);
      prev = lum;
    }
    expect(map(0)).toEqual([246, 241, 232]);
    expect(map(1)).toEqual([11, 31, 92]);
  });

  it('rdbu es divergente con gris neutro en el centro y recorta fuera de [0, 1]', () => {
    const map = colormap('rdbu');
    expect(map(0.5)).toEqual([247, 247, 247]);
    expect(map(-3)).toEqual(map(0));
    expect(map(7)).toEqual(map(1));
  });

  it('acepta paradas propias y produce CSS', () => {
    const map = stopsColormap(['#000', '#ffffff']);
    expect(map(0.5)).toEqual([128, 128, 128]);
    expect(colormapCss(map, 0)).toBe('rgb(0, 0, 0)');
    expect(() => stopsColormap(['#000'])).toThrow(RangeError);
  });
});

describe('readableOn', () => {
  it('oscurece el hilo sobre manta hasta el AA de texto y deja igual lo que ya pasa', () => {
    expect(contrastRatio('#d14e0a', '#f6f1e8')).toBeLessThan(4.5);
    const hilo = readableOn('#d14e0a', '#f6f1e8');
    expect(contrastRatio(hilo, '#f6f1e8')).toBeGreaterThanOrEqual(4.5);
    expect(readableOn('#15171f', '#f6f1e8')).toBe('#15171f');
    // Sobre fondo oscuro aclara.
    expect(contrastRatio(readableOn('#1f4bd8', '#15171f'), '#15171f')).toBeGreaterThanOrEqual(4.5);
  });
});

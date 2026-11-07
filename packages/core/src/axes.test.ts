import { describe, expect, it } from 'vitest';
import { labelRows, staggerLabels, thinLabels, type AxisTicks } from './axes';
import type { Renderer } from './renderer';
import { themes } from './theme';

// Ancho fijo por carácter: basta para probar la regla sin un lienzo.
const renderer = { measureText: (t: string) => t.length * 7 } as unknown as Renderer;
const theme = themes.light;
const paises = ['Alemania', 'Brasil', 'China', 'España', 'Estados Unidos', 'India', 'México'];
const ticks = (step: number): AxisTicks => ({
  values: paises.map((_, i) => i),
  labels: [...paises],
  positions: paises.map((_, i) => 20 + i * step),
});

describe('staggerLabels', () => {
  it('con espacio de sobra deja un renglón', () => {
    const t = staggerLabels(renderer, theme, ticks(120));
    expect(t && labelRows(t)).toBe(1);
  });

  it('en un teléfono escalona en dos renglones en vez de quitar países', () => {
    const t = staggerLabels(renderer, theme, ticks(50))!;
    expect(t.labels).toEqual(paises);
    expect(t.rows).toEqual([0, 1, 0, 1, 0, 1, 0]);
    // Antes se quitaba uno de cada dos: Brasil, España e India no salían.
    expect(thinLabels(renderer, theme, ticks(50)).labels).not.toContain('Brasil');
  });

  it('si ni en tres renglones caben, devuelve null para ralear como antes', () => {
    expect(staggerLabels(renderer, theme, ticks(15))).toBeNull();
  });
});

/**
 * Tokens de tema. Todo color del gráfico sale de aquí, nunca de valores sueltos en el código.
 *
 * Paleta Xila (foundations, 2026-10-18): moderna, tecnológica, editorial y pulcra. Superficie
 * blanca pura y tinta casi negra con sesgo frío; una categórica de siete tonos en orden fijo
 * (azul cobalto como firma) con luminosidad acotada (OKLCH L 0.43–0.77 en claro, 0.48–0.67 en
 * oscuro), croma ≥ 0.10, separación bajo protanopia y deuteranopia ΔE ≥ 10.8 entre vecinos y
 * contraste ≥ 3:1 sobre la superficie en ambos modos. Los pasos oscuros son los mismos tonos
 * reajustados a la superficie oscura, no una paleta aparte. Los valores están validados con el
 * verificador de seis comprobaciones (.fruti/tokens.json guarda el informe).
 */
export interface Theme {
  /** Colores de las series, en orden. */
  readonly palette: readonly string[];
  readonly background: string;
  readonly text: string;
  readonly axis: string;
  readonly grid: string;
  /** Marcas atenuadas (fuera de una selección); si falta se usa `grid`. */
  readonly muted?: string;
  readonly fontFamily: string;
  readonly fontSize: number;
}

export type ThemeName = 'light' | 'dark';

// Inter primero: es la fuente que instala CI (fonts-inter) para que las capturas coincidan.
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Orden fijo: cobalto, naranja, verde azulado, ocre, magenta, verde hoja, violeta.
const PALETTE_LIGHT = ['#2456d6', '#e0702a', '#139f82', '#b08c00', '#d05a9c', '#4f8a10', '#6f5be0'];
const PALETTE_DARK = ['#3f6fe8', '#dc6a30', '#1fa98b', '#ad8a18', '#d4659f', '#5f9a1c', '#8678ea'];

export const themes: Readonly<Record<ThemeName, Theme>> = {
  light: {
    palette: PALETTE_LIGHT,
    background: '#ffffff',
    text: '#15181d',
    axis: '#5b6470',
    grid: '#e8ebef',
    muted: '#c9ced5',
    fontFamily: FONT,
    fontSize: 12,
  },
  dark: {
    palette: PALETTE_DARK,
    background: '#121418',
    text: '#eceef1',
    axis: '#9aa3ad',
    grid: '#262b32',
    muted: '#3a4149',
    fontFamily: FONT,
    fontSize: 12,
  },
};

export function resolveTheme(theme: ThemeName | Theme | undefined): Theme {
  if (theme === undefined) return themes.light;
  return typeof theme === 'string' ? themes[theme] : theme;
}

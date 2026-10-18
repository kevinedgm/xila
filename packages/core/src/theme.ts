/**
 * Tokens de tema. Todo color del gráfico sale de aquí, nunca de valores sueltos en el
 * código: así el tema Xila (E4.07) es solo otro objeto como este.
 */
export interface Theme {
  /** Colores de las series, en orden. */
  readonly palette: readonly string[];
  readonly background: string;
  readonly text: string;
  readonly axis: string;
  readonly grid: string;
  readonly fontFamily: string;
  readonly fontSize: number;
}

export type ThemeName = 'light' | 'dark';

// Inter primero: es la fuente que instala CI (fonts-inter) para que las capturas coincidan.
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Paleta provisional, legible para daltonismo (derivada de Okabe-Ito). E0.07 la reemplaza.
const PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442'];

export const themes: Readonly<Record<ThemeName, Theme>> = {
  light: {
    palette: PALETTE,
    background: '#ffffff',
    text: '#1f2933',
    axis: '#52606d',
    grid: '#e4e7eb',
    fontFamily: FONT,
    fontSize: 12,
  },
  dark: {
    palette: PALETTE,
    background: '#15191e',
    text: '#e4e7eb',
    axis: '#9aa5b1',
    grid: '#2b323a',
    fontFamily: FONT,
    fontSize: 12,
  },
};

export function resolveTheme(theme: ThemeName | Theme | undefined): Theme {
  if (theme === undefined) return themes.light;
  return typeof theme === 'string' ? themes[theme] : theme;
}

/**
 * Tokens de tema. Todo color del gráfico sale de aquí, nunca de valores sueltos en el código.
 *
 * Marca Xila (identidad 2026-10-19, paleta Cobalto): la superficie es «manta», el algodón crudo
 * del huipil (#f6f1e8) y en oscuro la «tinta» (#15171f); el cobalto #1f4bd8 es el único color de
 * marca y abre la categórica; el «hilo» naranja del bordado es la segunda serie. Las otras cinco
 * se re-escalonaron con el verificador de seis comprobaciones (luminosidad OKLCH 0.43–0.77 en
 * claro y 0.48–0.67 en oscuro, croma ≥ 0.10, ΔE ≥ 15 entre vecinas con visión normal y ≥ 8 bajo
 * protanopia y deuteranopia, contraste ≥ 3:1 sobre la superficie); la categórica de siete de la
 * página de marca no pasaba (índigo y ciruela a ΔE 10). Informe en .fruti/tokens.json.
 *
 * Tipografía: Instrument Sans para la interfaz, JetBrains Mono para las cifras (último valor,
 * deltas, celdas) y Fraunces para el título del hallazgo. `xilaplot/fuentes/xila.css` las carga.
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
  /** Fuente de las cifras (monoespaciada, tabular). Si falta se usa `fontFamily`. */
  readonly fontMono?: string;
  /** Fuente del título del hallazgo (`titlePlugin`). Si falta se usa `fontFamily`. */
  readonly fontDisplay?: string;
}

export type ThemeName = 'light' | 'dark';

// Las tres familias van en packages/core/fuentes; CI instala las TTF para que las capturas coincidan.
const FONT = '"Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const DISPLAY = 'Fraunces, Georgia, "Times New Roman", serif';

// Orden fijo: cobalto, hilo, jade, ocre, ciruela, nopal, jacaranda.
const PALETTE_LIGHT = ['#1f4bd8', '#d14e0a', '#12957a', '#a58400', '#d05a9c', '#4f8a10', '#6f5be0'];
const PALETTE_DARK = ['#5c86f0', '#e06c2c', '#1fa98b', '#ad8a18', '#d4659f', '#5f9a1c', '#8678ea'];

export const themes: Readonly<Record<ThemeName, Theme>> = {
  light: {
    palette: PALETTE_LIGHT,
    background: '#f6f1e8',
    text: '#15171f',
    axis: '#5b5f6e',
    grid: '#e3ddd1',
    muted: '#cfc9bd',
    fontFamily: FONT,
    fontSize: 12,
    fontMono: MONO,
    fontDisplay: DISPLAY,
  },
  dark: {
    palette: PALETTE_DARK,
    background: '#15171f',
    text: '#f6f1e8',
    axis: '#a9adbd',
    grid: '#2b2f3d',
    muted: '#3b4050',
    fontFamily: FONT,
    fontSize: 12,
    fontMono: MONO,
    fontDisplay: DISPLAY,
  },
};

export function resolveTheme(theme: ThemeName | Theme | undefined): Theme {
  if (theme === undefined) return themes.light;
  return typeof theme === 'string' ? themes[theme] : theme;
}

/** Fuente de las cifras del tema, o la de interfaz si el tema no la define. */
export function monoFont(theme: Theme): string {
  return theme.fontMono ?? theme.fontFamily;
}

/** Fuente del título del hallazgo, o la de interfaz si el tema no la define. */
export function displayFont(theme: Theme): string {
  return theme.fontDisplay ?? theme.fontFamily;
}

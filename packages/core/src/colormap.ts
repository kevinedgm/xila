/**
 * Mapas de color para heatmaps.
 *
 * Por qué perceptuales: en un arcoíris (jet) la luminosidad sube y baja, así que el ojo ve
 * bordes donde los datos cambian suavemente. Viridis, magma, inferno y plasma aumentan la
 * luminosidad de forma uniforme: igual diferencia de datos se ve como igual diferencia de color,
 * funcionan con daltonismo y en blanco y negro. Los cuatro se evalúan con la aproximación
 * polinómica de grado 6 de Matt Zucker (error máximo ≈ 1 % respecto a las tablas de matplotlib),
 * así no hace falta cargar 256 entradas por mapa.
 *
 * `rdbu` es divergente (ColorBrewer RdBu): para correlaciones y cualquier variable con un centro
 * significativo (0), donde el color debe decir "cuánto y hacia qué lado".
 *
 * `cobalto-naranja` es el divergente de la paleta: del azul de la serie 1 a un gris casi
 * blanco en el centro y de ahí al naranja de acento. Es el que usa `heatmap.scale: 'row'`.
 *
 * `cobalto` es el secuencial de un solo tono de la paleta (de la manta al cobalto de la marca
 * y de ahí a marino): la magnitud se lee como claro → oscuro y el mapa no compite con la
 * paleta categórica del resto del tablero. Es el valor por defecto.
 */

export type ColormapName =
  'cobalto' | 'cobalto-naranja' | 'viridis' | 'magma' | 'inferno' | 'plasma' | 'rdbu';

/** `t` en [0, 1] → `[r, g, b]` en [0, 255]. */
export type Colormap = (t: number) => readonly [number, number, number];

type Poly = readonly (readonly [number, number, number])[];

const VIRIDIS: Poly = [
  [0.2777273272234177, 0.005407344544966578, 0.3340998053353061],
  [0.1050930431085774, 1.404613529898575, 1.384590162594685],
  [-0.3308618287255563, 0.214847559468213, 0.09509516302823659],
  [-4.634230498983486, -5.799100973351585, -19.33244095627987],
  [6.228269936347081, 14.17993336680509, 56.69055260068105],
  [4.776384997670288, -13.74514537774601, -65.35303263337234],
  [-5.435455855934631, 4.645852612178535, 26.3124352495832],
];
const MAGMA: Poly = [
  [-0.002136485053939582, -0.000749655052795221, -0.005386127855323933],
  [0.2516605407371642, 0.6775232436837668, 2.494026599312351],
  [8.353717279216625, -3.577719514958484, 0.3144679030132573],
  [-27.66873308576866, 14.26473078096533, -13.68926297732492],
  [52.17613981234068, -27.94360607168351, 12.94416944238394],
  [-50.76852536473588, 29.04658282127291, 4.23415299384598],
  [18.65570506591883, -11.48977351997711, -5.601961508734096],
];
const INFERNO: Poly = [
  [0.0002189403691192265, 0.001651004631001012, -0.01948089843709184],
  [0.1065134194856116, 0.5639564367884091, 3.932712388889277],
  [11.60249308247187, -3.972853965665698, -15.9423941062914],
  [-41.70399613139459, 17.43639888205313, 44.35414519872813],
  [77.162935699427, -33.40235894210092, -81.80730925738993],
  [-71.31942824499214, 32.62606426397723, 73.20951985803202],
  [25.13112622477341, -12.24266895238567, -23.07032500287172],
];
const PLASMA: Poly = [
  [0.05873234392399702, 0.02333670892565664, 0.5433401826748754],
  [2.176514634195958, 0.2383834171260182, 0.7539604599784036],
  [-2.689460476458034, -7.455851135738909, 3.110799939717086],
  [6.130348345893603, 42.3461881477227, -28.51885465332158],
  [-11.10743619062271, -82.66631109428045, 60.13984767418263],
  [10.02306557647065, 71.41361770095349, -54.07218655560067],
  [-3.658713842777788, -22.93153465461149, 18.19190277308203],
];

const RDBU = ['#b2182b', '#ef8a62', '#fddbc7', '#f7f7f7', '#d1e5f0', '#67a9cf', '#2166ac'];
// De manta a marino pasando por el cobalto de la marca.
const COBALTO = ['#f6f1e8', '#cfd6ee', '#9fb3e8', '#5f80e0', '#1f4bd8', '#15338f', '#0b1f5c'];
const COBALTO_NARANJA = [
  '#1f4bd8',
  '#5f80e0',
  '#9fb3e8',
  '#cfd6ee',
  '#f3efe6',
  '#f4d4bd',
  '#eba87a',
  '#d14e0a',
  '#8f3507',
];

function polynomial(p: Poly): Colormap {
  return (t) => {
    const u = t < 0 ? 0 : t > 1 ? 1 : t;
    let r = 0;
    let g = 0;
    let b = 0;
    let pow = 1;
    for (const [cr, cg, cb] of p) {
      r += cr * pow;
      g += cg * pow;
      b += cb * pow;
      pow *= u;
    }
    return [clamp255(r * 255), clamp255(g * 255), clamp255(b * 255)];
  };
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Interpolación lineal en RGB entre paradas equiespaciadas. */
export function stopsColormap(stops: readonly string[]): Colormap {
  if (stops.length < 2) throw new RangeError('Un mapa de color necesita al menos dos paradas');
  const rgb = stops.map(hexToRgb);
  return (t) => {
    const u = t < 0 ? 0 : t > 1 ? 1 : t;
    const pos = u * (rgb.length - 1);
    const i = Math.min(rgb.length - 2, Math.floor(pos));
    const f = pos - i;
    const a = rgb[i] as [number, number, number];
    const b = rgb[i + 1] as [number, number, number];
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
    ];
  };
}

const NAMED: Record<ColormapName, Colormap> = {
  cobalto: stopsColormap(COBALTO),
  'cobalto-naranja': stopsColormap(COBALTO_NARANJA),
  viridis: polynomial(VIRIDIS),
  magma: polynomial(MAGMA),
  inferno: polynomial(INFERNO),
  plasma: polynomial(PLASMA),
  rdbu: stopsColormap(RDBU),
};

/** Mapa por nombre, o uno propio a partir de paradas hexadecimales. */
export function colormap(spec: ColormapName | readonly string[]): Colormap {
  return typeof spec === 'string' ? NAMED[spec] : stopsColormap(spec);
}

/** Color CSS `rgb(r, g, b)` de un mapa en `t`. */
export function colormapCss(map: Colormap, t: number): string {
  const [r, g, b] = map(t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Color de texto legible sobre un color de celda: blanco sobre fondos oscuros, el color de
 * texto del tema sobre claros. Umbral en la luminancia relativa (WCAG), no en la suma de canales.
 */
export function inkOn(
  rgb: readonly [number, number, number],
  dark: string,
  light = '#ffffff',
): string {
  const lin = (c: number): number => {
    const u = c / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return l < 0.4 ? light : dark;
}

function luminance(rgb: readonly [number, number, number]): number {
  const lin = (c: number): number => {
    const u = c / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** Contraste WCAG entre dos colores hexadecimales (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * El mismo color, oscurecido (sobre fondo claro) o aclarado (sobre oscuro) en pasos del 4 %
 * hasta llegar al contraste `min` con el fondo: 4,5 es el AA para texto normal. El hilo
 * #d14e0a sobre manta da 3,9:1; como texto pasa a #b84509.
 */
export function readableOn(color: string, background: string, min = 4.5): string {
  if (!color.startsWith('#') || !background.startsWith('#')) return color;
  const target = luminance(hexToRgb(background)) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  const rgb = hexToRgb(color);
  const hex = (c: readonly number[]): string =>
    '#' + c.map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
  for (let k = 0; k <= 25; k++) {
    const f = k * 0.04;
    const mixed = rgb.map((v, i) => v + ((target[i] as number) - v) * f);
    const out = hex(mixed);
    if (contrastRatio(out, background) >= min) return out;
  }
  return hex(target);
}

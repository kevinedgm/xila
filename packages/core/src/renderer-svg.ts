import {
  applyMap,
  type BarStyle,
  type Layer,
  type LineStyle,
  type PointStyle,
  type RectStyle,
  type Renderer,
  type TextStyle,
  type Transform,
} from './renderer';

const LAYERS: readonly Layer[] = ['background', 'data', 'overlay'];

export interface SvgRendererOptions {
  /**
   * A partir de cuántos puntos una serie de marcadores deja de ser vectorial y se incrusta
   * como imagen (`<image>`), para que un millón de puntos no produzca un archivo gigante.
   */
  readonly rasterPoints?: number;
  /** Densidad de las imágenes incrustadas (puntos rasterizados); 2 se ve nítido en pantalla. */
  readonly rasterScale?: number;
}

interface LayerState {
  parts: string[];
  /** Id del `clipPath` activo, hasta el `clear` siguiente. */
  clip: string | null;
}

let counter = 0;

/**
 * Backend SVG: en vez de pintar, acumula elementos y devuelve el documento con `toString()`.
 * Implementa el mismo contrato que Canvas, así que el gráfico y los plugins dibujan en él sin
 * saberlo; `Chart.toSvg()` lo usa como destino temporal de un dibujo.
 *
 * Geometría idéntica a Canvas (mismo redondeo de reglas, mismas esquinas de barra) para que el
 * SVG rasterizado coincida con la captura del canvas. El texto se mide con un canvas oculto,
 * porque el SVG no tiene medidor y los márgenes dependen del ancho de las etiquetas.
 */
export class SvgRenderer implements Renderer {
  readonly element: HTMLElement;
  private readonly layers = new Map<Layer, LayerState>();
  private readonly defs: string[] = [];
  private readonly measurer: CanvasRenderingContext2D | null;
  private readonly rasterPoints: number;
  private readonly rasterScale: number;
  private readonly prefix: string;
  private width = 0;
  private height = 0;
  private background = '#ffffff';
  private ids = 0;

  constructor(options: SvgRendererOptions = {}) {
    this.element = document.createElement('div');
    this.element.className = 'xila-svg';
    this.measurer = document.createElement('canvas').getContext('2d');
    this.rasterPoints = options.rasterPoints ?? 5000;
    this.rasterScale = options.rasterScale ?? 2;
    this.prefix = `xila${(counter++).toString(36)}`;
    for (const layer of LAYERS) this.layers.set(layer, { parts: [], clip: null });
  }

  setBackground(color: string): void {
    this.background = color;
  }

  /** El `dpr` no aplica: un SVG no tiene píxeles propios. */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const layer of LAYERS) this.clear(layer);
  }

  clear(layer: Layer): void {
    this.layers.set(layer, { parts: [], clip: null });
  }

  clip(layer: Layer, x: number, y: number, width: number, height: number): void {
    const state = this.state(layer);
    const id = `${this.prefix}-clip${this.ids++}`;
    this.defs.push(
      `<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}"/></clipPath>`,
    );
    state.clip = id;
  }

  drawLineSeries(
    layer: Layer,
    x: Float64Array,
    y: Float64Array,
    from: number,
    to: number,
    style: LineStyle,
    t: Transform,
  ): void {
    const d: string[] = [];
    let pen = false;
    for (let i = from; i < to; i++) {
      const v = y[i] as number;
      const u = x[i] as number;
      if (v !== v || u !== u) {
        pen = false;
        continue;
      }
      d.push(`${pen ? 'L' : 'M'}${n(applyMap(t.x, u))} ${n(applyMap(t.y, v))}`);
      pen = true;
    }
    if (d.length === 0) return;
    this.push(layer, `<path d="${d.join('')}" fill="none"${lineAttrs(style)}/>`);
  }

  drawBand(
    layer: Layer,
    x: Float64Array,
    low: Float64Array,
    high: Float64Array,
    from: number,
    to: number,
    style: RectStyle,
    t: Transform,
  ): void {
    const paths: string[] = [];
    let start = from;
    while (start < to) {
      while (start < to && !finitePair(low, high, start)) start++;
      let end = start;
      while (end < to && finitePair(low, high, end)) end++;
      if (end - start >= 2) {
        const d: string[] = [];
        for (let i = start; i < end; i++) {
          d.push(
            `${i === start ? 'M' : 'L'}${n(applyMap(t.x, x[i] as number))} ${n(applyMap(t.y, high[i] as number))}`,
          );
        }
        for (let i = end - 1; i >= start; i--) {
          d.push(`L${n(applyMap(t.x, x[i] as number))} ${n(applyMap(t.y, low[i] as number))}`);
        }
        paths.push(`${d.join('')}Z`);
      }
      start = end;
    }
    if (paths.length === 0) return;
    this.push(layer, `<path d="${paths.join('')}" fill="${style.fill}"${opacity(style.opacity)}/>`);
  }

  drawErrorBars(
    layer: Layer,
    x: Float64Array,
    low: Float64Array,
    high: Float64Array,
    from: number,
    to: number,
    style: LineStyle,
    t: Transform,
    cap = 4,
  ): void {
    const d: string[] = [];
    for (let i = from; i < to; i++) {
      if (!finitePair(low, high, i)) continue;
      const px = applyMap(t.x, x[i] as number);
      const y0 = applyMap(t.y, low[i] as number);
      const y1 = applyMap(t.y, high[i] as number);
      d.push(`M${n(px)} ${n(y0)}L${n(px)} ${n(y1)}`);
      if (cap > 0) {
        d.push(`M${n(px - cap / 2)} ${n(y0)}L${n(px + cap / 2)} ${n(y0)}`);
        d.push(`M${n(px - cap / 2)} ${n(y1)}L${n(px + cap / 2)} ${n(y1)}`);
      }
    }
    if (d.length === 0) return;
    this.push(layer, `<path d="${d.join('')}" fill="none"${lineAttrs(style)}/>`);
  }

  drawPointSeries(
    layer: Layer,
    x: Float64Array,
    y: Float64Array,
    from: number,
    to: number,
    style: PointStyle,
    t: Transform,
    radii?: Float64Array,
  ): void {
    if (to - from > this.rasterPoints) {
      this.rasterizePoints(layer, x, y, from, to, style, t, radii);
      return;
    }
    const d: string[] = [];
    for (let i = from; i < to; i++) {
      const v = y[i] as number;
      if (v !== v) continue;
      const px = applyMap(t.x, x[i] as number);
      const py = applyMap(t.y, v);
      const r = radii ? (radii[i] as number) : style.radius;
      if (!(r > 0)) continue;
      // Dos arcos de media vuelta: un círculo cerrado por marcador, todos en un solo path.
      d.push(
        `M${n(px + r)} ${n(py)}A${n(r)} ${n(r)} 0 1 0 ${n(px - r)} ${n(py)}A${n(r)} ${n(r)} 0 1 0 ${n(px + r)} ${n(py)}Z`,
      );
    }
    if (d.length === 0) return;
    const stroke =
      style.stroke && style.strokeWidth
        ? ` stroke="${style.stroke}" stroke-width="${n(style.strokeWidth)}"`
        : '';
    this.push(
      layer,
      `<path d="${d.join('')}" fill="${style.fill}"${stroke}${opacity(style.opacity)}/>`,
    );
  }

  drawBars(
    layer: Layer,
    x0: Float64Array,
    x1: Float64Array,
    y0: Float64Array,
    y1: Float64Array,
    from: number,
    to: number,
    style: BarStyle,
    t: Transform,
  ): void {
    const half = (style.gap ?? 0) / 2;
    const gapStart = style.gapStart ?? 0;
    const radius = style.radius ?? 0;
    // Coordenadas (u, v) como en Canvas. Al trasponer, el giro de los arcos se invierte.
    const swap = style.horizontal === true;
    const P = (u: number, v: number) => (swap ? `${n(v)} ${n(u)}` : `${n(u)} ${n(v)}`);
    const A = (r: number, u: number, v: number) =>
      `A${n(r)} ${n(r)} 0 0 ${swap ? 0 : 1} ${P(u, v)}`;
    const d: string[] = [];
    for (let i = from; i < to; i++) {
      const b = y1[i] as number;
      if (b !== b) continue;
      const pu0 = applyMap(t.x, x0[i] as number) + half;
      const pu1 = applyMap(t.x, x1[i] as number) - half;
      const pv0 = applyMap(t.y, y0[i] as number);
      const pv1 = applyMap(t.y, b);
      const base = pv1 < pv0 ? pv0 - gapStart : pv0 + gapStart;
      const w = Math.abs(pu1 - pu0);
      const h = Math.abs(pv1 - base);
      if (w <= 0 || h <= 0) continue;
      const left = Math.min(pu0, pu1);
      const top = Math.min(pv1, base);
      const r = Math.min(radius, w / 2, h);
      const right = left + w;
      const bottom = top + h;
      if (r <= 0) {
        d.push(`M${P(left, top)}L${P(right, top)}L${P(right, bottom)}L${P(left, bottom)}Z`);
      } else if (pv1 < base) {
        d.push(
          `M${P(left, bottom)}L${P(left, top + r)}${A(r, left + r, top)}L${P(right - r, top)}${A(r, right, top + r)}L${P(right, bottom)}Z`,
        );
      } else {
        d.push(
          `M${P(left, top)}L${P(right, top)}L${P(right, bottom - r)}${A(r, right - r, bottom)}L${P(left + r, bottom)}${A(r, left, bottom - r)}Z`,
        );
      }
    }
    if (d.length === 0) return;
    const stroke =
      style.stroke && style.strokeWidth
        ? ` stroke="${style.stroke}" stroke-width="${n(style.strokeWidth)}"`
        : '';
    this.push(
      layer,
      `<path d="${d.join('')}" fill="${style.fill}"${stroke}${opacity(style.opacity)}/>`,
    );
  }

  drawRule(layer: Layer, x1: number, y1: number, x2: number, y2: number, style: LineStyle): void {
    // Mismo ajuste de medio píxel que Canvas, para que coincidan al rasterizar.
    const snap = style.width % 2 === 1 ? 0.5 : 0;
    this.push(
      layer,
      `<line x1="${n(Math.round(x1) + snap)}" y1="${n(Math.round(y1) + snap)}" x2="${n(Math.round(x2) + snap)}" y2="${n(Math.round(y2) + snap)}"${lineAttrs(style)}/>`,
    );
  }

  drawRect(
    layer: Layer,
    x: number,
    y: number,
    width: number,
    height: number,
    style: RectStyle,
  ): void {
    const stroke =
      style.stroke && style.strokeWidth
        ? ` stroke="${style.stroke}" stroke-width="${n(style.strokeWidth)}"`
        : '';
    this.push(
      layer,
      `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${style.fill}"${stroke}${opacity(style.opacity)}/>`,
    );
  }

  drawText(layer: Layer, text: string, x: number, y: number, style: TextStyle): void {
    if (!text) return;
    const font = parseFont(style.font);
    const anchor = style.align === 'center' ? 'middle' : style.align === 'right' ? 'end' : 'start';
    const baseline = BASELINES[style.baseline ?? 'alphabetic'];
    const position = style.rotate
      ? ` transform="translate(${n(x)} ${n(y)}) rotate(${n(style.rotate)})"`
      : ` x="${n(x)}" y="${n(y)}"`;
    const weight = font.weight === '400' ? '' : ` font-weight="${font.weight}"`;
    const italic = font.style === 'italic' ? ' font-style="italic"' : '';
    this.push(
      layer,
      `<text${position} fill="${style.fill}" font-family="${escapeAttr(font.family)}" font-size="${font.size}"${weight}${italic} text-anchor="${anchor}" dominant-baseline="${baseline}">${escapeText(text)}</text>`,
    );
  }

  measureText(text: string, style: TextStyle): number {
    if (!this.measurer) return text.length * 7;
    this.measurer.font = style.font;
    return this.measurer.measureText(text).width;
  }

  drawImage(
    layer: Layer,
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number,
    drawWidth: number,
    drawHeight: number,
  ): void {
    if (width <= 0 || height <= 0) return;
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const ctx = source.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
    this.pushImage(layer, source.toDataURL('image/png'), x, y, drawWidth, drawHeight, true);
  }

  toDataURL(): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.toString())}`;
  }

  destroy(): void {
    this.element.remove();
    for (const layer of LAYERS) this.clear(layer);
    this.defs.length = 0;
  }

  /** Documento SVG completo: fondo sólido y las tres capas en orden. */
  toString(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(this.width)}" height="${n(this.height)}" viewBox="0 0 ${n(this.width)} ${n(this.height)}">${this.body()}</svg>`;
  }

  /**
   * Contenido sin el elemento `<svg>` raíz: `defs`, fondo y capas. Para componerlo dentro de
   * otro documento (título y leyenda encima, por ejemplo) con un `<g transform>`.
   */
  body(): string {
    const defs = this.defs.length > 0 ? `<defs>${this.defs.join('')}</defs>` : '';
    const bg = `<rect width="${n(this.width)}" height="${n(this.height)}" fill="${this.background}"/>`;
    const layers = LAYERS.map((layer) => {
      const parts = this.state(layer).parts;
      return parts.length > 0 ? `<g data-layer="${layer}">${parts.join('')}</g>` : '';
    });
    return `${defs}${bg}${layers.join('')}`;
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  private rasterizePoints(
    layer: Layer,
    x: Float64Array,
    y: Float64Array,
    from: number,
    to: number,
    style: PointStyle,
    t: Transform,
    radii?: Float64Array,
  ): void {
    const scale = this.rasterScale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(this.width * scale));
    canvas.height = Math.max(1, Math.round(this.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const v = y[i] as number;
      if (v !== v) continue;
      const px = applyMap(t.x, x[i] as number);
      const py = applyMap(t.y, v);
      const r = radii ? (radii[i] as number) : style.radius;
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = style.fill;
    ctx.fill();
    if (style.stroke && style.strokeWidth) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth;
      ctx.stroke();
    }
    this.pushImage(
      layer,
      canvas.toDataURL('image/png'),
      0,
      0,
      this.width,
      this.height,
      false,
      `${to - from} puntos rasterizados`,
    );
  }

  private pushImage(
    layer: Layer,
    href: string,
    x: number,
    y: number,
    width: number,
    height: number,
    pixelated: boolean,
    desc?: string,
  ): void {
    const rendering = pixelated
      ? ' image-rendering="pixelated" style="image-rendering:pixelated"'
      : '';
    const inner = desc ? `<desc>${escapeText(desc)}</desc>` : '';
    this.push(
      layer,
      `<image x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" preserveAspectRatio="none"${rendering} href="${href}">${inner}</image>`,
    );
  }

  private push(layer: Layer, element: string): void {
    const state = this.state(layer);
    state.parts.push(state.clip ? `<g clip-path="url(#${state.clip})">${element}</g>` : element);
  }

  private state(layer: Layer): LayerState {
    const state = this.layers.get(layer);
    if (!state) throw new Error(`Capa desconocida: ${layer}`);
    return state;
  }
}

const BASELINES: Record<NonNullable<TextStyle['baseline']>, string> = {
  top: 'text-before-edge',
  middle: 'central',
  bottom: 'text-after-edge',
  alphabetic: 'alphabetic',
};

/** Número corto: dos decimales bastan para píxeles y el archivo queda a la mitad. */
function n(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

function opacity(value: number | undefined): string {
  return value !== undefined && value !== 1 ? ` opacity="${n(value)}"` : '';
}

function lineAttrs(style: LineStyle): string {
  const dash =
    style.dash && style.dash.length > 0 ? ` stroke-dasharray="${style.dash.map(n).join(' ')}"` : '';
  return ` stroke="${style.stroke}" stroke-width="${n(style.width)}" stroke-linecap="round" stroke-linejoin="round"${dash}${opacity(style.opacity)}`;
}

function finitePair(a: Float64Array, b: Float64Array, i: number): boolean {
  const u = a[i] as number;
  const v = b[i] as number;
  return u === u && v === v;
}

export interface ParsedFont {
  readonly style: 'normal' | 'italic';
  readonly weight: string;
  /** Tamaño en píxeles. */
  readonly size: number;
  readonly family: string;
}

/**
 * Descompone una fuente CSS corta ("600 14px Instrument Sans, sans-serif") en sus partes,
 * porque SVG no acepta `font` como atributo con fiabilidad y sí `font-family`, `font-size` y
 * `font-weight` por separado.
 */
export function parseFont(font: string): ParsedFont {
  const match = /^(.*?)(\d+(?:\.\d+)?)px\s+(.+)$/.exec(font.trim());
  if (!match) return { style: 'normal', weight: '400', size: 12, family: font };
  const before = (match[1] ?? '').trim().split(/\s+/).filter(Boolean);
  let weight = '400';
  let style: 'normal' | 'italic' = 'normal';
  for (const token of before) {
    if (token === 'italic' || token === 'oblique') style = 'italic';
    else if (token === 'bold') weight = '700';
    else if (/^\d{3}$/.test(token)) weight = token;
  }
  return { style, weight, size: Number(match[2]), family: (match[3] ?? '').trim() };
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeText(text).replace(/"/g, '&quot;');
}

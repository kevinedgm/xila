import {
  applyMap,
  type Layer,
  type LineStyle,
  type PointStyle,
  type BarStyle,
  type RectStyle,
  type Renderer,
  type TextStyle,
  type Transform,
} from './renderer';

const LAYERS: readonly Layer[] = ['background', 'data', 'overlay'];

/**
 * Backend Canvas 2D con tres canvas apilados. Mover el ratón solo redibuja `overlay`,
 * así que el tooltip no cuesta volver a trazar un millón de puntos.
 */
export class CanvasRenderer implements Renderer {
  readonly element: HTMLDivElement;
  private readonly canvases = new Map<Layer, HTMLCanvasElement>();
  private readonly contexts = new Map<Layer, CanvasRenderingContext2D>();
  private readonly clipped = new Set<Layer>();
  private width = 0;
  private height = 0;
  private dpr = 1;
  private background = '#ffffff';

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'xila-canvas';
    this.element.style.position = 'relative';
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    for (const layer of LAYERS) {
      const canvas = document.createElement('canvas');
      canvas.dataset['layer'] = layer;
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D no disponible');
      this.canvases.set(layer, canvas);
      this.contexts.set(layer, ctx);
      this.element.appendChild(canvas);
    }
    container.appendChild(this.element);
  }

  setBackground(color: string): void {
    this.background = color;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    for (const layer of LAYERS) {
      const canvas = this.canvases.get(layer) as HTMLCanvasElement;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      this.ctx(layer).setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.clipped.clear();
  }

  clear(layer: Layer): void {
    const ctx = this.ctx(layer);
    if (this.clipped.delete(layer)) ctx.restore();
    ctx.clearRect(0, 0, this.width, this.height);
  }

  clip(layer: Layer, x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx(layer);
    if (this.clipped.has(layer)) ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    this.clipped.add(layer);
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
    const ctx = this.ctx(layer);
    ctx.beginPath();
    let pen = false;
    for (let i = from; i < to; i++) {
      const v = y[i] as number;
      const u = x[i] as number;
      if (v !== v || u !== u) {
        pen = false; // NaN corta la línea
        continue;
      }
      const px = applyMap(t.x, u);
      const py = applyMap(t.y, v);
      if (pen) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      pen = true;
    }
    this.applyLineStyle(ctx, style);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
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
    const ctx = this.ctx(layer);
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.fillStyle = style.fill;
    // Polígono: ida por el límite superior y vuelta por el inferior; cada tramo sin NaN es uno.
    let start = from;
    while (start < to) {
      while (start < to && !finitePair(low, high, start)) start++;
      let end = start;
      while (end < to && finitePair(low, high, end)) end++;
      if (end - start >= 2) {
        ctx.beginPath();
        for (let i = start; i < end; i++) {
          const px = applyMap(t.x, x[i] as number);
          const py = applyMap(t.y, high[i] as number);
          if (i === start) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        for (let i = end - 1; i >= start; i--) {
          ctx.lineTo(applyMap(t.x, x[i] as number), applyMap(t.y, low[i] as number));
        }
        ctx.closePath();
        ctx.fill();
      }
      start = end;
    }
    ctx.globalAlpha = 1;
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
    const ctx = this.ctx(layer);
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      if (!finitePair(low, high, i)) continue;
      const px = applyMap(t.x, x[i] as number);
      const y0 = applyMap(t.y, low[i] as number);
      const y1 = applyMap(t.y, high[i] as number);
      ctx.moveTo(px, y0);
      ctx.lineTo(px, y1);
      if (cap > 0) {
        ctx.moveTo(px - cap / 2, y0);
        ctx.lineTo(px + cap / 2, y0);
        ctx.moveTo(px - cap / 2, y1);
        ctx.lineTo(px + cap / 2, y1);
      }
    }
    this.applyLineStyle(ctx, style);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
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
    const ctx = this.ctx(layer);
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
    ctx.globalAlpha = 1;
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
    const ctx = this.ctx(layer);
    ctx.globalAlpha = style.opacity ?? 1;
    const half = (style.gap ?? 0) / 2;
    const gapStart = style.gapStart ?? 0;
    const radius = style.radius ?? 0;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const b = y1[i] as number;
      if (b !== b) continue;
      const px0 = applyMap(t.x, x0[i] as number) + half;
      const px1 = applyMap(t.x, x1[i] as number) - half;
      const py0 = applyMap(t.y, y0[i] as number);
      const py1 = applyMap(t.y, b);
      // El hueco de la base se quita del lado `y0`, hacia el extremo de datos.
      const base = py1 < py0 ? py0 - gapStart : py0 + gapStart;
      const w = Math.abs(px1 - px0);
      const h = Math.abs(py1 - base);
      if (w <= 0 || h <= 0) continue;
      const left = Math.min(px0, px1);
      const top = Math.min(py1, base);
      const r = Math.min(radius, w / 2, h);
      if (r <= 0) {
        ctx.rect(left, top, w, h);
        continue;
      }
      const right = left + w;
      const bottom = top + h;
      if (py1 < base) {
        // Barra hacia arriba: esquinas redondeadas en el borde superior.
        ctx.moveTo(left, bottom);
        ctx.lineTo(left, top + r);
        ctx.arcTo(left, top, left + r, top, r);
        ctx.lineTo(right - r, top);
        ctx.arcTo(right, top, right, top + r, r);
        ctx.lineTo(right, bottom);
      } else {
        // Barra hacia abajo (valores negativos): redondeo en el borde inferior.
        ctx.moveTo(left, top);
        ctx.lineTo(right, top);
        ctx.lineTo(right, bottom - r);
        ctx.arcTo(right, bottom, right - r, bottom, r);
        ctx.lineTo(left + r, bottom);
        ctx.arcTo(left, bottom, left, bottom - r, r);
      }
      ctx.closePath();
    }
    ctx.fillStyle = style.fill;
    ctx.fill();
    if (style.stroke && style.strokeWidth) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawRule(layer: Layer, x1: number, y1: number, x2: number, y2: number, style: LineStyle): void {
    const ctx = this.ctx(layer);
    ctx.beginPath();
    // Medio píxel de desplazamiento para que las líneas de 1 px no salgan borrosas.
    const snap = style.width % 2 === 1 ? 0.5 : 0;
    ctx.moveTo(Math.round(x1) + snap, Math.round(y1) + snap);
    ctx.lineTo(Math.round(x2) + snap, Math.round(y2) + snap);
    this.applyLineStyle(ctx, style);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  drawRect(
    layer: Layer,
    x: number,
    y: number,
    width: number,
    height: number,
    style: RectStyle,
  ): void {
    const ctx = this.ctx(layer);
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.fillStyle = style.fill;
    ctx.fillRect(x, y, width, height);
    if (style.stroke && style.strokeWidth) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeRect(x, y, width, height);
    }
    ctx.globalAlpha = 1;
  }

  drawText(layer: Layer, text: string, x: number, y: number, style: TextStyle): void {
    const ctx = this.ctx(layer);
    ctx.font = style.font;
    ctx.fillStyle = style.fill;
    ctx.textAlign = style.align ?? 'left';
    ctx.textBaseline = style.baseline ?? 'alphabetic';
    if (style.rotate) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((style.rotate * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(text, x, y);
    }
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
    // putImageData ignora transformaciones y recortes, así que primero va a un canvas auxiliar
    // y luego drawImage lo escala respetando el clip y el dpr de la capa.
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const sctx = source.getContext('2d');
    if (!sctx) return;
    // Copia: ImageData exige un Uint8ClampedArray sobre un ArrayBuffer normal (no compartido).
    sctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
    const ctx = this.ctx(layer);
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, x, y, drawWidth, drawHeight);
    ctx.imageSmoothingEnabled = smoothing;
  }

  measureText(text: string, style: TextStyle): number {
    const ctx = this.ctx('overlay');
    ctx.font = style.font;
    return ctx.measureText(text).width;
  }

  toDataURL(type = 'image/png'): string {
    const out = document.createElement('canvas');
    out.width = Math.round(this.width * this.dpr);
    out.height = Math.round(this.height * this.dpr);
    const ctx = out.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, out.width, out.height);
    for (const layer of LAYERS) ctx.drawImage(this.canvases.get(layer) as HTMLCanvasElement, 0, 0);
    return out.toDataURL(type);
  }

  destroy(): void {
    this.element.remove();
    this.canvases.clear();
    this.contexts.clear();
  }

  /** Color de fondo actual, para componer exportaciones en subclases. */
  protected currentBackground(): string {
    return this.background;
  }

  protected ctx(layer: Layer): CanvasRenderingContext2D {
    const ctx = this.contexts.get(layer);
    if (!ctx) throw new Error(`Capa desconocida: ${layer}`);
    return ctx;
  }

  private applyLineStyle(ctx: CanvasRenderingContext2D, style: LineStyle): void {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.setLineDash(style.dash ? [...style.dash] : []);
  }
}

function finitePair(a: Float64Array, b: Float64Array, i: number): boolean {
  const u = a[i] as number;
  const v = b[i] as number;
  return u === u && v === v;
}

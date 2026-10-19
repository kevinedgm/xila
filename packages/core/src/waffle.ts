import type { DataTable } from './data/table';
import { rowLabels } from './dot-rank';
import { formatNumber } from './format/number';
import { resolveTheme, type Theme, type ThemeName } from './theme';

export interface WaffleOptions {
  readonly data: DataTable;
  /** Columna con el nombre de cada parte. */
  readonly category: string;
  /** Columna numérica con la cantidad de cada parte. */
  readonly value: string;
  /** Cuadros en total (100 = cada cuadro es 1 %). */
  readonly cells?: number;
  /** Cuadros por columna de la rejilla. */
  readonly rows?: number;
  readonly theme?: ThemeName | Theme;
  /** Formato de la cantidad en el tooltip. */
  readonly format?: (value: number) => string;
  readonly unit?: string;
}

export interface WafflePart {
  readonly label: string;
  readonly value: number;
  /** Porcentaje del total, de 0 a 100. */
  readonly share: number;
  /** Cuadros asignados. */
  readonly cells: number;
  /** Posición original de la parte: decide su color (el color sigue a la parte, no a su rango). */
  readonly index: number;
}

/**
 * Reparte `cells` cuadros entre las partes por restos mayores, para que sumen exactamente el
 * total. Las partes salen ordenadas de mayor a menor; valores no finitos o negativos se ignoran.
 */
export function waffleParts(
  labels: readonly string[],
  values: ArrayLike<number>,
  cells = 100,
): WafflePart[] {
  const items: { label: string; value: number; index: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (Number.isFinite(v) && v > 0) items.push({ label: labels[i] ?? '', value: v, index: i });
  }
  const total = items.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return [];
  const raw = items.map((x) => ({ ...x, exact: (x.value / total) * cells }));
  const base = raw.map((x) => Math.floor(x.exact));
  let left = cells - base.reduce((s, n) => s + n, 0);
  const order = raw
    .map((x, i) => ({ i, rest: x.exact - Math.floor(x.exact) }))
    .sort((a, b) => b.rest - a.rest);
  for (const o of order) {
    if (left <= 0) break;
    base[o.i] = (base[o.i] as number) + 1;
    left--;
  }
  return raw
    .map((x, i) => ({
      label: x.label,
      value: x.value,
      share: (x.value / total) * 100,
      cells: base[i] as number,
      index: x.index,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Cien cuadros: una rejilla donde cada cuadro es una fracción fija del total (1 % con 100
 * cuadros). Los porcentajes se cuentan en lugar de estimarse; lo entiende cualquier público.
 */
export class Waffle {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly tip: HTMLDivElement;
  private readonly theme: Theme;
  private readonly parts: WafflePart[];
  private readonly total: number;
  private readonly cells: number;
  private readonly perCol: number;
  private readonly format: (v: number) => string;
  private readonly unit: string;
  private readonly observer: ResizeObserver | null;
  private zones: { x: number; y: number; s: number; part: WafflePart }[] = [];

  constructor(container: HTMLElement, options: WaffleOptions) {
    const t = (this.theme = resolveTheme(options.theme));
    this.cells = Math.max(1, Math.floor(options.cells ?? 100));
    this.perCol = Math.max(1, Math.floor(options.rows ?? 10));
    const values = options.data.numeric(options.value);
    this.parts = waffleParts(rowLabels(options.data, options.category), values, this.cells);
    this.total = this.parts.reduce((s, p) => s + p.value, 0);
    this.format = options.format ?? ((v) => formatNumber(v));
    this.unit = options.unit ?? '';

    this.root = document.createElement('div');
    this.root.className = 'xila-waffle';
    Object.assign(this.root.style, {
      position: 'relative',
      font: `${t.fontSize}px ${t.fontFamily}`,
    });
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', this.summary());
    Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '280px' });
    this.tip = document.createElement('div');
    this.tip.hidden = true;
    Object.assign(this.tip.style, {
      position: 'absolute',
      pointerEvents: 'none',
      background: t.text,
      color: t.background,
      padding: '4px 8px',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
      transform: 'translate(-50%, -120%)',
      fontVariantNumeric: 'tabular-nums',
    });
    this.root.append(this.canvas, this.tip);
    container.append(this.root);
    this.canvas.addEventListener('pointermove', (e) => this.hover(e));
    this.canvas.addEventListener('pointerleave', () => (this.tip.hidden = true));
    this.observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.draw());
    this.observer?.observe(this.root);
    this.draw();
  }

  getParts(): readonly WafflePart[] {
    return this.parts;
  }

  destroy(): void {
    this.observer?.disconnect();
    this.root.remove();
  }

  private pct(p: WafflePart): string {
    return `${formatNumber(p.share, { decimals: p.share < 10 ? 1 : 0 })} %`;
  }

  private summary(): string {
    const each = formatNumber(100 / this.cells, { decimals: this.cells === 100 ? 0 : 1 });
    return `Reparto del total (${this.format(this.total)}${this.unit ? ` ${this.unit}` : ''}); cada cuadro es ${each} %. ${this.parts.map((p) => `${p.label}: ${this.pct(p)}`).join(', ')}.`;
  }

  private draw(): void {
    const t = this.theme;
    const c = this.canvas;
    const W = c.clientWidth || 600;
    const H = c.clientHeight || 280;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.zones = [];
    const cols = Math.ceil(this.cells / this.perCol);
    // La leyenda va a la derecha si cabe; si no (teléfono), debajo.
    const side = W >= 460;
    const legendH = side ? 0 : this.parts.length * 22 + 8;
    const size = Math.max(
      4,
      Math.min((H - 8 - legendH) / this.perCol, (side ? W * 0.55 : W - 4) / cols),
    );
    const gap = Math.max(1, Math.round(size * 0.12));
    let k = 0;
    for (const p of this.parts) {
      const color = t.palette[p.index % t.palette.length] ?? t.text;
      for (let j = 0; j < p.cells; j++, k++) {
        const col = Math.floor(k / this.perCol);
        const row = k % this.perCol;
        const x = col * size;
        const y = 4 + (this.perCol - 1 - row) * size;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, size - gap, size - gap);
        this.zones.push({ x, y, s: size, part: p });
      }
    }
    const lx = side ? cols * size + 20 : 0;
    const ly0 = side ? 18 : 4 + this.perCol * size + 18;
    const step = side ? Math.min(34, (H - 24) / Math.max(1, this.parts.length)) : 22;
    this.parts.forEach((p, i) => {
      const y = ly0 + i * step;
      ctx.fillStyle = t.palette[p.index % t.palette.length] ?? t.text;
      ctx.fillRect(lx, y - 5, 10, 10);
      ctx.fillStyle = t.text;
      ctx.font = `600 ${t.fontSize + (side ? 6 : 2)}px ${t.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const pct = this.pct(p);
      ctx.fillText(pct, lx + 18, y);
      const pw = ctx.measureText(pct).width;
      ctx.font = `400 ${t.fontSize + 1}px ${t.fontFamily}`;
      ctx.fillStyle = t.axis;
      ctx.fillText(p.label, lx + 18 + Math.max(pw, side ? 64 : 48) + 10, y);
    });
  }

  private hover(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const z = this.zones.find((q) => x >= q.x && x <= q.x + q.s && y >= q.y && y <= q.y + q.s);
    if (!z) {
      this.tip.hidden = true;
      return;
    }
    this.tip.textContent = `${z.part.label} · ${this.pct(z.part)} (${this.format(z.part.value)}${this.unit ? ` ${this.unit}` : ''})`;
    this.tip.style.left = `${Math.min(Math.max(x, 110), r.width - 110)}px`;
    this.tip.style.top = `${y}px`;
    this.tip.hidden = false;
  }
}

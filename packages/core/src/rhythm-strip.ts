import type { DataTable } from './data/table';
import { mixHex } from './plugins/focus';
import { resolveTheme, type Theme, type ThemeName } from './theme';

export interface RhythmStripSeries {
  readonly id: string;
  readonly name?: string;
  readonly y: string;
}

export interface RhythmStripOptions {
  readonly data: DataTable;
  /** Columna del eje ordenado (año, fecha). */
  readonly x: string;
  readonly series: readonly RhythmStripSeries[];
  readonly theme?: ThemeName | Theme;
  /** Pasos que se promedian para medir el ritmo (suaviza el ruido de un solo paso). */
  readonly window?: number;
  /** Ritmo por paso que ya se pinta con el color pleno (0.06 = 6 % por paso). */
  readonly cap?: number;
  readonly formatX?: (value: number) => string;
  /** Texto de la unidad de paso para el tooltip ("al año"). */
  readonly stepLabel?: string;
  /** Colores de baja, sin cambio y sube; por defecto salen del tema. */
  readonly colors?: readonly [string, string, string];
}

/**
 * Ritmo de cambio por paso: cambio relativo contra `window` pasos atrás, dividido entre los pasos.
 * `NaN` donde no hay historia suficiente o el valor de referencia es 0.
 */
export function rhythm(values: ArrayLike<number>, window: number): Float64Array {
  const w = Math.max(1, Math.floor(window));
  const out = new Float64Array(values.length).fill(NaN);
  for (let i = 1; i < values.length; i++) {
    const j = Math.max(0, i - w);
    const a = values[j] as number;
    const b = values[i] as number;
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) continue;
    out[i] = (b - a) / Math.abs(a) / (i - j);
  }
  return out;
}

/**
 * Tira de ritmo: una fila por serie y una celda por paso; el color es qué tan rápido sube o baja,
 * no el nivel. Los cambios de color se detectan mucho mejor que los cambios de pendiente, así que
 * las aceleraciones y las crisis (columnas del mismo color en todas las filas) saltan a la vista.
 */
export class RhythmStrip {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly tip: HTMLDivElement;
  private readonly theme: Theme;
  private readonly xs: Float64Array;
  private readonly rows: { name: string; rates: Float64Array }[];
  private readonly cap: number;
  private readonly formatX: (v: number) => string;
  private readonly stepLabel: string;
  private readonly colors: readonly [string, string, string];
  private readonly observer: ResizeObserver | null;
  private geo = { left: 0, top: 0, cw: 0, rh: 0 };

  constructor(container: HTMLElement, options: RhythmStripOptions) {
    const t = (this.theme = resolveTheme(options.theme));
    this.xs = options.data.numeric(options.x);
    const w = options.window ?? 3;
    this.rows = options.series.map((s) => ({
      name: s.name ?? s.id,
      rates: rhythm(options.data.numeric(s.y), w),
    }));
    this.cap = options.cap ?? 0.06;
    this.formatX = options.formatX ?? ((v) => String(v));
    this.stepLabel = options.stepLabel ?? 'por paso';
    this.colors = options.colors ?? [
      t.palette[0] ?? t.axis,
      mixHex(t.grid, t.background, 0.5),
      t.palette[1] ?? t.text,
    ];

    this.root = document.createElement('div');
    this.root.className = 'xila-rhythm-strip';
    Object.assign(this.root.style, {
      position: 'relative',
      font: `${t.fontSize}px ${t.fontFamily}`,
    });
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', this.summary());
    Object.assign(this.canvas.style, {
      display: 'block',
      width: '100%',
      height: `${Math.max(120, this.rows.length * 34 + 30)}px`,
    });
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

  destroy(): void {
    this.observer?.disconnect();
    this.root.remove();
  }

  /** Color de una celda: interpola hacia "baja" o "sube" según el ritmo, saturando en `cap`. */
  colorFor(rate: number): string {
    const [down, mid, up] = this.colors;
    if (!Number.isFinite(rate)) return mid;
    const k = Math.min(1, Math.abs(rate) / this.cap);
    return mixHex(mid, rate >= 0 ? up : down, 0.15 + 0.85 * k);
  }

  /** Resumen accesible: la caída y la subida más rápidas de cada serie. */
  private summary(): string {
    const parts = this.rows.map(({ name, rates }) => {
      let lo = -1;
      let hi = -1;
      rates.forEach((r, i) => {
        if (!Number.isFinite(r)) return;
        if (lo < 0 || r < (rates[lo] as number)) lo = i;
        if (hi < 0 || r > (rates[hi] as number)) hi = i;
      });
      if (lo < 0) return `${name}: sin datos`;
      const pct = (r: number): string => `${r > 0 ? '+' : '−'}${(Math.abs(r) * 100).toFixed(1)} %`;
      return `${name}: mayor caída ${pct(rates[lo] as number)} en ${this.formatX(this.xs[lo] as number)}, mayor subida ${pct(rates[hi] as number)} en ${this.formatX(this.xs[hi] as number)}`;
    });
    return `Ritmo de cambio ${this.stepLabel}. ${parts.join('. ')}.`;
  }

  private draw(): void {
    const t = this.theme;
    const c = this.canvas;
    const w = c.clientWidth || 600;
    const h = c.clientHeight || 200;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${t.fontSize}px ${t.fontFamily}`;
    const labelW = Math.max(...this.rows.map((r) => ctx.measureText(r.name).width)) + 14;
    const left = Math.min(labelW, w * 0.4);
    const top = 4;
    const n = this.xs.length;
    const cw = (w - left - 4) / Math.max(1, n - 1);
    const rh = (h - top - 24) / Math.max(1, this.rows.length);
    this.geo = { left, top, cw, rh };
    this.rows.forEach((row, ri) => {
      const y = top + ri * rh;
      for (let i = 1; i < n; i++) {
        ctx.fillStyle = this.colorFor(row.rates[i] as number);
        ctx.fillRect(left + (i - 1) * cw, y + 2, Math.ceil(cw), rh - 4);
      }
      ctx.fillStyle = t.text;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.name, left - 10, y + rh / 2);
    });
    // Ticks del eje cada ~70 px. Si las etiquetas son números (años) se eligen los "redondos":
    // múltiplos de un paso bonito (1, 2, 5, 10, 20, 25, 50…); si no, un paso fijo.
    ctx.fillStyle = t.axis;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const minStep = Math.max(1, Math.ceil(70 / Math.max(cw, 1)));
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((k) => k >= minStep) ?? minStep;
    const ty = top + this.rows.length * rh + 6;
    for (let i = 1; i < n; i++) {
      const label = this.formatX(this.xs[i] as number);
      const num = Number(label);
      const show = Number.isFinite(num) ? num % step === 0 : (i - 1) % step === 0;
      if (show) ctx.fillText(label, left + (i - 1) * cw + cw / 2, ty);
    }
  }

  private hover(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const { left, top, cw, rh } = this.geo;
    const i = Math.floor((x - left) / cw) + 1;
    const ri = Math.floor((y - top) / rh);
    const row = this.rows[ri];
    if (!row || i < 1 || i >= this.xs.length) {
      this.tip.hidden = true;
      return;
    }
    const rate = row.rates[i] as number;
    const pct = Number.isFinite(rate)
      ? `${rate >= 0 ? '+' : '−'}${(Math.abs(rate) * 100).toFixed(1)} % ${this.stepLabel}`
      : 'sin dato';
    this.tip.textContent = `${row.name} · ${this.formatX(this.xs[i] as number)} · ${pct}`;
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
    this.tip.hidden = false;
  }
}

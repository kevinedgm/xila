import type { DataTable } from './data/table';
import { formatNumber } from './format/number';
import { prefersReducedMotion } from './transitions';
import { resolveTheme, type Theme, type ThemeName } from './theme';

export interface TrailPanelSeries {
  readonly id: string;
  readonly name?: string;
  /** Columna numérica con el valor de la serie. */
  readonly y: string;
}

export interface TrailPanelOptions {
  readonly data: DataTable;
  /** Columna del eje ordenado (año, fecha): da la etiqueta del momento mostrado. */
  readonly x: string;
  readonly series: readonly TrailPanelSeries[];
  readonly theme?: ThemeName | Theme;
  /** Formato de la cifra grande. */
  readonly format?: (value: number) => string;
  /** Formato del momento (por ejemplo, el año). */
  readonly formatX?: (value: number) => string;
  /** Pasos hacia atrás contra los que se compara (10 = "en 10 años"). */
  readonly compareSteps?: number;
  /** Texto del periodo de comparación. */
  readonly compareLabel?: (steps: number) => string;
  /** Unidad que acompaña a la cifra en la descripción accesible. */
  readonly unit?: string;
  /** Índice inicial; por defecto, el último (el "ahora"). */
  readonly index?: number;
}

/** Opacidad de un tramo de la estela según su antigüedad: lo reciente pesa, lo viejo se desvanece. */
export function trailAlpha(age: number, span: number): number {
  if (!(span > 0)) return 1;
  return Math.max(0.06, 1 - (age / span) * 1.6);
}

/** Cambio contra `steps` pasos atrás, con flecha y signo (el sentido nunca depende solo del color). */
export function deltaText(
  values: Float64Array,
  index: number,
  steps: number,
  format: (v: number) => string,
  label: string,
): string | null {
  const j = index - steps;
  if (j < 0) return null;
  const now = values[index] as number;
  const before = values[j] as number;
  if (!Number.isFinite(now) || !Number.isFinite(before)) return null;
  const d = now - before;
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '=';
  return `${arrow} ${d > 0 ? '+' : d < 0 ? '−' : ''}${format(Math.abs(d))} ${label}`;
}

interface Tile {
  readonly id: string;
  readonly name: string;
  readonly values: Float64Array;
  readonly color: string;
  readonly root: HTMLDivElement;
  readonly value: HTMLDivElement;
  readonly delta: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly max: number;
}

/**
 * Ahora con estela: una cifra grande por serie (dónde está hoy) y su historia como una estela que
 * se desvanece hacia atrás (de dónde viene). Responde "¿dónde está cada uno y de dónde viene?" en
 * un vistazo; al recorrer el tiempo, el "ahora" avanza y la estela se dibuja detrás.
 */
export class TrailPanel {
  readonly length: number;
  private index: number;
  private readonly root: HTMLDivElement;
  private readonly tiles: Tile[];
  private readonly xs: Float64Array;
  private readonly theme: Theme;
  private readonly format: (v: number) => string;
  private readonly formatX: (v: number) => string;
  private readonly steps: number;
  private readonly label: string;
  private readonly unit: string;
  private readonly observer: ResizeObserver | null;
  private timer = 0;
  private listeners = new Set<(index: number) => void>();

  constructor(container: HTMLElement, options: TrailPanelOptions) {
    this.theme = resolveTheme(options.theme);
    this.xs = options.data.numeric(options.x);
    this.length = this.xs.length;
    this.index = Math.min(this.length - 1, Math.max(0, options.index ?? this.length - 1));
    this.format = options.format ?? ((v) => formatNumber(v, { step: Math.abs(v) / 100 || 1 }));
    this.formatX = options.formatX ?? ((v) => String(v));
    this.steps = Math.max(1, options.compareSteps ?? 10);
    this.label = (options.compareLabel ?? ((s) => `en ${s} pasos`))(this.steps);
    this.unit = options.unit ?? '';
    const t = this.theme;

    this.root = document.createElement('div');
    this.root.className = 'xila-trail-panel';
    Object.assign(this.root.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px',
      font: `${t.fontSize}px ${t.fontFamily}`,
      color: t.text,
    });
    this.tiles = options.series.map((spec, i) => {
      const values = options.data.numeric(spec.y);
      let max = 0;
      for (const v of values) if (Number.isFinite(v) && v > max) max = v;
      const color = t.palette[i % t.palette.length] ?? t.text;
      const root = document.createElement('div');
      root.setAttribute('role', 'group');
      Object.assign(root.style, {
        border: `1px solid ${t.grid}`,
        borderRadius: '8px',
        padding: '10px 12px',
        minWidth: '0',
        background: t.background,
      });
      const head = document.createElement('div');
      Object.assign(head.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: t.axis,
        fontSize: `${t.fontSize + 1}px`,
      });
      const dot = document.createElement('i');
      Object.assign(dot.style, {
        width: '9px',
        height: '9px',
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flex: 'none',
      });
      const name = document.createElement('span');
      name.textContent = spec.name ?? spec.id;
      Object.assign(name.style, {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
      head.append(dot, name);
      const value = document.createElement('div');
      Object.assign(value.style, {
        fontSize: '30px',
        lineHeight: '1.1',
        fontWeight: '600',
        fontVariantNumeric: 'tabular-nums',
        margin: '2px 0',
      });
      const delta = document.createElement('div');
      Object.assign(delta.style, {
        fontSize: `${t.fontSize}px`,
        color: t.axis,
        fontVariantNumeric: 'tabular-nums',
        minHeight: '1.4em',
      });
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, {
        display: 'block',
        width: '100%',
        height: '34px',
        marginTop: '6px',
      });
      root.append(head, value, delta, canvas);
      this.root.append(root);
      return {
        id: spec.id,
        name: spec.name ?? spec.id,
        values,
        color,
        root,
        value,
        delta,
        canvas,
        max,
      };
    });
    container.append(this.root);
    this.observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.render());
    this.observer?.observe(this.root);
    this.render();
  }

  getIndex(): number {
    return this.index;
  }

  /** Valor del eje ordenado en el índice mostrado (por ejemplo, el año). */
  getX(): number {
    return this.xs[this.index] as number;
  }

  setIndex(index: number): void {
    const i = Math.min(this.length - 1, Math.max(0, Math.round(index)));
    if (i === this.index) return;
    this.index = i;
    this.render();
    for (const l of this.listeners) l(i);
  }

  /** Avisa cada vez que cambia el momento mostrado. Devuelve la función para dejar de escuchar. */
  onChange(listener: (index: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Recorre del índice `from` al último, un paso cada `stepMs`. Con reduced-motion salta al final. */
  play(from = Math.min(this.steps, this.length - 1), stepMs = 120): void {
    this.stop();
    if (prefersReducedMotion()) {
      this.setIndex(this.length - 1);
      return;
    }
    this.setIndex(from);
    this.timer = window.setInterval(() => {
      if (this.index >= this.length - 1) return this.stop();
      this.setIndex(this.index + 1);
    }, stepMs);
  }

  stop(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
  }

  isPlaying(): boolean {
    return this.timer !== 0;
  }

  destroy(): void {
    this.stop();
    this.observer?.disconnect();
    this.listeners.clear();
    this.root.remove();
  }

  private render(): void {
    const i = this.index;
    const when = this.formatX(this.xs[i] as number);
    for (const tile of this.tiles) {
      const v = tile.values[i] as number;
      const valueText = Number.isFinite(v) ? this.format(v) : '–';
      tile.value.textContent = valueText;
      const d = deltaText(tile.values, i, this.steps, this.format, this.label);
      tile.delta.textContent = d ?? '';
      tile.root.setAttribute(
        'aria-label',
        `${tile.name}: ${valueText}${this.unit ? ` ${this.unit}` : ''} en ${when}${d ? `, ${d.replace(/^[▲▼=] /, '')}` : ''}`,
      );
      this.drawTrail(tile, i);
    }
  }

  private drawTrail(tile: Tile, index: number): void {
    const { canvas, values, color, max } = tile;
    const w = canvas.clientWidth || 120;
    const h = canvas.clientHeight || 34;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const top = max > 0 ? max * 1.05 : 1;
    const span = Math.max(1, this.length - 1);
    const px = (j: number): number => 4 + (j / span) * (w - 8);
    const py = (j: number): number => h - 3 - ((values[j] as number) / top) * (h - 6);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    for (let j = 1; j <= index; j++) {
      if (!Number.isFinite(values[j] as number) || !Number.isFinite(values[j - 1] as number))
        continue;
      ctx.globalAlpha = trailAlpha(index - j, span);
      ctx.beginPath();
      ctx.moveTo(px(j - 1), py(j - 1));
      ctx.lineTo(px(j), py(j));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (Number.isFinite(values[index] as number)) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(index), py(index), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.theme.background;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

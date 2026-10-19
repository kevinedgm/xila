import type { DataTable } from './data/table';
import { formatNumber } from './format/number';
import { niceStep } from './scales/linear';
import { mean, median } from './stats';
import { resolveTheme, type Theme, type ThemeName } from './theme';

export interface DotRankOptions {
  readonly data: DataTable;
  /** Columna con el nombre de cada fila (categórica o numérica). */
  readonly category: string;
  /** Columna numérica a comparar. */
  readonly value: string;
  /** Línea de referencia: promedio, mediana o un valor fijo (una meta, un límite). */
  readonly reference?: 'mean' | 'median' | number;
  /** Texto de la referencia; por defecto "promedio del grupo", "mediana" o "referencia". */
  readonly referenceLabel?: string;
  readonly sort?: 'desc' | 'asc' | 'none';
  readonly theme?: ThemeName | Theme;
  readonly format?: (value: number) => string;
  /** Unidad para el tooltip y la descripción accesible ("t por persona"). */
  readonly unit?: string;
  /** Colores de "por debajo" y "por encima"; por defecto, los dos primeros de la paleta. */
  readonly colors?: readonly [string, string];
}

export interface DeviationRow {
  readonly label: string;
  readonly value: number;
  /** `value − referencia`. */
  readonly delta: number;
}

/** Nombre de cada fila de una columna, sea categórica o numérica. */
export function rowLabels(table: DataTable, column: string): string[] {
  const c = table.column(column);
  if (c.kind === 'category') return Array.from(c.codes, (k) => c.categories[k] ?? '');
  return Array.from(c.values, (v) => String(v));
}

/** Filas con su desviación respecto a la referencia, ordenadas; descarta valores no finitos. */
export function deviationRows(
  labels: readonly string[],
  values: ArrayLike<number>,
  reference: 'mean' | 'median' | number = 'mean',
  sort: 'desc' | 'asc' | 'none' = 'desc',
): { reference: number; rows: DeviationRow[] } {
  const finite: number[] = [];
  for (let i = 0; i < values.length; i++)
    if (Number.isFinite(values[i] as number)) finite.push(values[i] as number);
  const ref =
    typeof reference === 'number'
      ? reference
      : finite.length === 0
        ? 0
        : reference === 'median'
          ? median(finite)
          : mean(finite);
  const rows: DeviationRow[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (!Number.isFinite(v)) continue;
    rows.push({ label: labels[i] ?? '', value: v, delta: v - ref });
  }
  if (sort === 'desc') rows.sort((a, b) => b.value - a.value);
  if (sort === 'asc') rows.sort((a, b) => a.value - b.value);
  return { reference: ref, rows };
}

/**
 * Puntos y promedio: cada fila es un punto sobre una regla, con una línea en la referencia
 * (promedio, mediana o una meta) y un tallo que mide cuánto se pasa o le falta. Responde "¿quién
 * está por encima y quién por debajo de lo normal?" con la mitad de tinta que una barra.
 */
export class DotRank {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly tip: HTMLDivElement;
  private readonly theme: Theme;
  private readonly rows: DeviationRow[];
  private readonly reference: number;
  private readonly refLabel: string;
  private readonly format: (v: number) => string;
  private readonly unit: string;
  private readonly colors: readonly [string, string];
  private readonly observer: ResizeObserver | null;
  private zones: { x: number; y: number; w: number; h: number; text: string }[] = [];

  constructor(container: HTMLElement, options: DotRankOptions) {
    const t = (this.theme = resolveTheme(options.theme));
    const { reference, rows } = deviationRows(
      rowLabels(options.data, options.category),
      options.data.numeric(options.value),
      options.reference ?? 'mean',
      options.sort ?? 'desc',
    );
    this.rows = rows;
    this.reference = reference;
    this.refLabel =
      options.referenceLabel ??
      (options.reference === 'median'
        ? 'mediana'
        : typeof options.reference === 'number'
          ? 'referencia'
          : 'promedio del grupo');
    this.format = options.format ?? ((v) => formatNumber(v, { step: Math.abs(v) / 100 || 0.1 }));
    this.unit = options.unit ?? '';
    this.colors = options.colors ?? [t.palette[0] ?? t.axis, t.palette[1] ?? t.text];

    this.root = document.createElement('div');
    this.root.className = 'xila-dot-rank';
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
      height: `${Math.max(140, rows.length * 36 + 56)}px`,
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

  getReference(): number {
    return this.reference;
  }

  destroy(): void {
    this.observer?.disconnect();
    this.root.remove();
  }

  private describe(r: DeviationRow): string {
    const side = r.delta >= 0 ? 'por encima' : 'por debajo';
    const u = this.unit ? ` ${this.unit}` : '';
    return `${r.label}: ${this.format(r.value)}${u}, ${this.format(Math.abs(r.delta))} ${side} de ${this.refLabel}`;
  }

  private summary(): string {
    return `Comparación contra ${this.refLabel} (${this.format(this.reference)}${this.unit ? ` ${this.unit}` : ''}). ${this.rows.map((r) => this.describe(r)).join('. ')}.`;
  }

  private draw(): void {
    const t = this.theme;
    const c = this.canvas;
    const W = c.clientWidth || 600;
    const H = c.clientHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.zones = [];
    const font = (w: number, s = t.fontSize): string => `${w} ${s}px ${t.fontFamily}`;
    ctx.font = font(500, t.fontSize + 1);
    const labelW = Math.min(
      W * 0.35,
      Math.max(0, ...this.rows.map((r) => ctx.measureText(r.label).width)) + 14,
    );
    // Las cifras van del lado de afuera de cada punto: a la derecha las de arriba de la
    // referencia y a la izquierda las de abajo. Se reserva espacio para ambas, así nunca chocan
    // con los nombres ni se salen del lienzo.
    ctx.font = font(400);
    const valueText = (r: DeviationRow): string =>
      `${this.format(r.value)}  (${r.delta >= 0 ? '+' : '−'}${this.format(Math.abs(r.delta))})`;
    const widest = (rows: DeviationRow[]): number =>
      rows.length ? Math.max(...rows.map((r) => ctx.measureText(valueText(r)).width)) + 16 : 0;
    const leftW = widest(this.rows.filter((r) => r.delta < 0));
    const rightW = widest(this.rows.filter((r) => r.delta >= 0));
    const a = { x: labelW + leftW, y: 28, w: Math.max(40, W - labelW - leftW - rightW), h: H - 56 };
    const rawMax = Math.max(this.reference, ...this.rows.map((r) => r.value));
    const rawMin = Math.min(0, ...this.rows.map((r) => r.value));
    const step = niceStep(rawMax - rawMin || 1, 4);
    const maxV = Math.ceil(rawMax / step) * step || step;
    const minV = Math.floor(rawMin / step) * step;
    const X = (v: number): number => a.x + ((v - minV) / (maxV - minV)) * a.w;
    const rh = a.h / Math.max(1, this.rows.length);

    // Regla (ticks redondos) y referencia
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    for (let v = minV; v <= maxV + step / 2; v += step) {
      ctx.beginPath();
      ctx.moveTo(X(v), a.y);
      ctx.lineTo(X(v), a.y + a.h);
      ctx.stroke();
      ctx.fillStyle = t.axis;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(formatNumber(v, { step }), X(v), a.y + a.h + 8);
    }
    const rx = X(this.reference);
    ctx.strokeStyle = t.text;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(rx, a.y - 6);
    ctx.lineTo(rx, a.y + a.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.text;
    ctx.font = font(500);
    ctx.textAlign = rx > W * 0.7 ? 'right' : rx < W * 0.3 ? 'left' : 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      `${this.refLabel}: ${this.format(this.reference)}${this.unit ? ` ${this.unit}` : ''}`,
      rx,
      a.y - 10,
    );

    this.rows.forEach((r, i) => {
      const y = a.y + i * rh + rh / 2;
      const above = r.delta >= 0;
      const color = above ? this.colors[1] : this.colors[0];
      const px = X(r.value);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx, y);
      ctx.lineTo(px, y);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = t.background;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = font(500, t.fontSize + 1);
      ctx.fillStyle = t.text;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.label, labelW - 12, y);
      ctx.font = font(400);
      ctx.fillStyle = t.axis;
      ctx.textAlign = above ? 'left' : 'right';
      // El signo y el lado dicen la dirección: nunca solo el color.
      ctx.fillText(valueText(r), px + (above ? 12 : -12), y);
      this.zones.push({
        x: Math.min(rx, px) - 8,
        y: y - rh / 2,
        w: Math.abs(px - rx) + 16,
        h: rh,
        text: this.describe(r),
      });
    });
  }

  private hover(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const z = this.zones.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (!z) {
      this.tip.hidden = true;
      return;
    }
    this.tip.textContent = z.text;
    this.tip.style.left = `${Math.min(Math.max(x, 120), r.width - 120)}px`;
    this.tip.style.top = `${y}px`;
    this.tip.hidden = false;
  }
}

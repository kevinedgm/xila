import type { ChartPlugin, PluginContext } from '../plugin';
import { formatNumber } from '../format/number';

export type MomentKind = 'max' | 'min' | 'drop' | 'rise';

export interface Moment {
  readonly kind: MomentKind;
  readonly index: number;
  /** Cambio relativo contra el paso anterior (solo `drop` y `rise`). */
  readonly change?: number;
}

export interface MomentOptions {
  /** Cuántas caídas de un paso al siguiente marcar (las más fuertes). */
  readonly drops?: number;
  /** Cuántas subidas marcar. */
  readonly rises?: number;
  /** Separación mínima, en pasos, entre dos momentos marcados. */
  readonly minGap?: number;
}

/**
 * Los momentos que vale la pena contar en una serie: máximo, mínimo y los cambios relativos más
 * fuertes de un paso al siguiente. Si dos quedan a menos de `minGap` pasos se conserva el primero
 * en importancia (máximo, mínimo, luego el cambio más grande).
 */
export function findMoments(y: ArrayLike<number>, options: MomentOptions = {}): Moment[] {
  const drops = options.drops ?? 3;
  const rises = options.rises ?? 0;
  const gap = Math.max(0, options.minGap ?? 2);
  let imax = -1;
  let imin = -1;
  const changes: { index: number; change: number }[] = [];
  for (let i = 0; i < y.length; i++) {
    const v = y[i] as number;
    if (!Number.isFinite(v)) continue;
    if (imax < 0 || v > (y[imax] as number)) imax = i;
    if (imin < 0 || v < (y[imin] as number)) imin = i;
    const p = y[i - 1] as number;
    if (i > 0 && Number.isFinite(p) && p !== 0)
      changes.push({ index: i, change: (v - p) / Math.abs(p) });
  }
  const candidates: Moment[] = [];
  if (imax >= 0) candidates.push({ kind: 'max', index: imax });
  if (imin >= 0 && imin !== imax) candidates.push({ kind: 'min', index: imin });
  const byDrop = changes.filter((c) => c.change < 0).sort((a, b) => a.change - b.change);
  const byRise = changes.filter((c) => c.change > 0).sort((a, b) => b.change - a.change);
  for (const c of byDrop.slice(0, drops * 3))
    candidates.push({ kind: 'drop', index: c.index, change: c.change });
  for (const c of byRise.slice(0, rises * 3))
    candidates.push({ kind: 'rise', index: c.index, change: c.change });

  const out: Moment[] = [];
  let nDrop = 0;
  let nRise = 0;
  for (const m of candidates) {
    if (m.kind === 'drop' && nDrop >= drops) continue;
    if (m.kind === 'rise' && nRise >= rises) continue;
    if (out.some((o) => Math.abs(o.index - m.index) < gap)) continue;
    out.push(m);
    if (m.kind === 'drop') nDrop++;
    if (m.kind === 'rise') nRise++;
  }
  return out.sort((a, b) => a.index - b.index);
}

export interface NarrateOptions extends MomentOptions {
  /** Serie a narrar; por defecto la primera. Una serie a la vez: con varias, las notas se pisan. */
  readonly series?: string;
  readonly format?: (value: number) => string;
  readonly formatX?: (value: number) => string;
  /** Texto de cada momento; por defecto "Máximo: 14.3 en 1979", "2009: −8 % en un paso". */
  readonly describe?: (
    m: Moment,
    value: number,
    x: string,
    format: (v: number) => string,
  ) => string;
}

export interface NarratePlugin extends ChartPlugin {
  /** Los momentos del último dibujo, con su texto (también sirve como resumen accesible). */
  getMoments(): readonly (Moment & { readonly text: string })[];
}

function defaultDescribe(m: Moment, v: number, x: string, f: (v: number) => string): string {
  const pct =
    m.change === undefined
      ? ''
      : `${m.change > 0 ? '+' : '−'}${Math.round(Math.abs(m.change) * 100)} %`;
  switch (m.kind) {
    case 'max':
      return `Máximo: ${f(v)} en ${x}`;
    case 'min':
      return `Mínimo: ${f(v)} en ${x}`;
    case 'drop':
      return `${x}: ${pct} en un paso`;
    case 'rise':
      return `${x}: ${pct} en un paso`;
  }
}

/**
 * Línea narrada: la gráfica encuentra sola sus momentos (máximo, mínimo, caídas fuertes) y los
 * escribe junto al dato. El lector ya no busca; lee. Las notas se reparten arriba y abajo de la
 * línea y se apilan si quedan cerca, para no encimarse. Van en la capa de fondo: el hover limpia la
 * capa overlay y las notas tienen que seguir ahí mientras el cursor recorre la gráfica.
 */
export function narratePlugin(options: NarrateOptions = {}): NarratePlugin {
  let moments: (Moment & { text: string })[] = [];
  const LINE = 15;

  const fmt = (): ((v: number) => string) =>
    options.format ?? ((v) => formatNumber(v, { step: Math.abs(v) / 100 || 1 }));

  const fmtX = (c: PluginContext): ((v: number) => string) =>
    options.formatX ??
    (c.config.scales.x.type === 'time'
      ? (v) => String(new Date(v).getUTCFullYear())
      : (v) => formatNumber(v));

  return {
    id: 'narrate',
    getMoments() {
      return moments;
    },
    afterDraw(c) {
      const scales = c.getScales();
      if (!scales || scales.x.kind === 'band') return;
      const s = c.getSeries().find((q) => q.id === (options.series ?? c.config.series[0]?.id));
      if (!s || c.hiddenSeries.has(s.id)) {
        moments = [];
        return;
      }
      const f = fmt();
      const fx = fmtX(c);
      const describe = options.describe ?? defaultDescribe;
      const found = findMoments(s.y, options);
      moments = found.map((m) => ({
        ...m,
        text: describe(m, s.y[m.index] as number, fx(s.x[m.index] as number), f),
      }));

      const { theme } = c.config;
      const { plotArea } = c.layout;
      const color =
        theme.palette[c.config.series.findIndex((q) => q.id === s.id) % theme.palette.length] ??
        theme.text;
      const style = {
        font: `500 ${theme.fontSize}px ${theme.fontFamily}`,
        fill: theme.text,
      } as const;
      // Arriba van el máximo y las subidas; abajo, el mínimo y las caídas. Notas cercanas se apilan.
      const placed: { x: number; y: number; w: number }[] = [];
      for (const m of moments) {
        const px = scales.x.toPixel(s.x[m.index] as number);
        const py = scales.y.toPixel(s.y[m.index] as number);
        const up = m.kind === 'max' || m.kind === 'rise';
        const w = c.renderer.measureText(m.text, style);
        const right = px > plotArea.x + plotArea.width * 0.66;
        const x0 = right ? px - 8 - w : px + 8;
        let ty = up ? py - 22 : py + 24;
        while (
          placed.some((p) => Math.abs(p.y - ty) < LINE && x0 < p.x + p.w + 6 && x0 + w + 6 > p.x)
        ) {
          ty += up ? -LINE : LINE;
        }
        ty = Math.max(plotArea.y + 8, Math.min(plotArea.y + plotArea.height - 6, ty));
        placed.push({ x: x0, y: ty, w });
        c.renderer.drawRule('background', px, py + (up ? -6 : 6), px, ty + (up ? 6 : -10), {
          stroke: theme.axis,
          width: 1,
          dash: [2, 3],
        });
        c.renderer.drawPointSeries(
          'background',
          Float64Array.of(px),
          Float64Array.of(py),
          0,
          1,
          { fill: color, radius: 4, stroke: theme.background, strokeWidth: 2 },
          { x: { offset: 0, scale: 1, base: 0 }, y: { offset: 0, scale: 1, base: 0 } },
        );
        c.renderer.drawText('background', m.text, right ? px - 8 : px + 8, ty, {
          ...style,
          align: right ? 'right' : 'left',
          baseline: 'middle',
        });
      }
    },
  };
}

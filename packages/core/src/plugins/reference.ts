import { seriesColor } from '../config';
import { monoFont } from '../theme';
import type { ChartPlugin, PluginContext } from '../plugin';
import type { LineStyle } from '../renderer';
import { formatNumber } from '../format/number';

export interface ReferenceOptions {
  /** Valor de la referencia: un número, o `'mean'` / `'median'` de las series visibles. */
  readonly value: number | 'mean' | 'median';
  /** Texto junto a la línea; por defecto "promedio 6,0", "mediana 4,6" o el número. */
  readonly label?: string | ((value: number) => string);
  /** Escribir sobre cada marca su diferencia contra la referencia (`true`). */
  readonly deltas?: boolean;
  /** Tallos del color de la serie entre la referencia y cada punto, con `bar.mark: 'dot'` (`true`). */
  readonly stems?: boolean;
  /** Formato de la referencia y de las diferencias; por defecto el del eje Y. */
  readonly format?: (value: number) => string;
}

/** Promedio o mediana de los valores finitos de `ys`. */
export function referenceValue(
  spec: number | 'mean' | 'median',
  ys: readonly Float64Array[],
): number {
  if (typeof spec === 'number') return spec;
  const all: number[] = [];
  for (const y of ys)
    for (let i = 0; i < y.length; i++)
      if ((y[i] as number) === (y[i] as number)) all.push(y[i] as number);
  if (all.length === 0) return NaN;
  if (spec === 'mean') return all.reduce((s, v) => s + v, 0) / all.length;
  all.sort((a, b) => a - b);
  const mid = all.length >> 1;
  return all.length % 2
    ? (all[mid] as number)
    : ((all[mid - 1] as number) + (all[mid] as number)) / 2;
}

/**
 * Línea de referencia para comparar magnitudes: la distancia de cada marca a la línea es la
 * respuesta a "¿cuánto más o menos que…?". Dibuja la línea punteada con su texto, y sobre cada
 * marca su diferencia. Con `bar.mark: 'dot'` añade un tallo de la referencia al punto, así el
 * sentido y el tamaño de la diferencia se leen de un vistazo.
 */
export function referencePlugin(options: ReferenceOptions): ChartPlugin {
  const formatY = (v: number, c: PluginContext): string => {
    if (options.format) return options.format(v);
    const axis = c.config.axes.y.format;
    if (axis) return axis(v);
    const s = c.getScales()?.y;
    const step = s ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };
  const label = (v: number, c: PluginContext): string => {
    if (typeof options.label === 'function') return options.label(v);
    if (typeof options.label === 'string') return options.label;
    const kind =
      options.value === 'mean' ? 'promedio ' : options.value === 'median' ? 'mediana ' : '';
    return `${kind}${formatY(v, c)}`;
  };

  return {
    id: 'reference',
    afterDraw(c) {
      const scales = c.getScales();
      if (!scales || scales.x.kind !== 'band') return;
      const band = scales.x;
      const { theme, bar } = c.config;
      const visible = c.getSeries().filter((s) => !c.hiddenSeries.has(s.id));
      const ref = referenceValue(
        options.value,
        visible.map((s) => s.y),
      );
      if (ref !== ref) return;
      const area = c.layout.plotArea;
      const ry = scales.y.toPixel(ref);
      const dots = c.config.type === 'bar' && bar.mark === 'dot';
      // Barras horizontales: u (banda) va en vertical y el valor en horizontal.
      const flip = c.config.type === 'bar' && bar.orientation === 'horizontal';
      const rule = (u1: number, v1: number, u2: number, v2: number, style: LineStyle) =>
        flip
          ? c.renderer.drawRule('data', v1, u1, v2, u2, style)
          : c.renderer.drawRule('data', u1, v1, u2, v2, style);
      const slot = band.bandwidth / Math.max(1, visible.length);

      if (dots && options.stems !== false) {
        visible.forEach((s) => {
          const si = c.getSeries().indexOf(s);
          const n = Math.min(s.length, band.count);
          for (let i = 0; i < n; i++) {
            const v = s.y[i] as number;
            if (v !== v) continue;
            const x = band.start(i) + slot * (visible.indexOf(s) + 0.5);
            rule(x, ry, x, scales.y.toPixel(v), {
              stroke: seriesColor(c.config, si),
              width: 3,
              opacity: 0.55,
            });
          }
        });
      }
      const [u0, u1] = flip ? [area.y, area.y + area.height] : [area.x, area.x + area.width];
      rule(u0, ry, u1, ry, { stroke: theme.text, width: 1, dash: [4, 3] });
      const font = `500 ${theme.fontSize}px ${monoFont(theme)}`;
      if (flip) {
        // Arriba de la línea vertical, a su derecha.
        c.renderer.drawText('overlay', label(ref, c), ry + 5, area.y, {
          font,
          fill: theme.text,
          align: 'left',
          baseline: 'top',
        });
      } else {
        c.renderer.drawText('overlay', label(ref, c), area.x + area.width - 4, ry - 5, {
          font,
          fill: theme.text,
          align: 'right',
          baseline: 'bottom',
        });
      }
      if (options.deltas === false) return;
      visible.forEach((s, vi) => {
        const n = Math.min(s.length, band.count);
        for (let i = 0; i < n; i++) {
          const v = s.y[i] as number;
          if (v !== v) continue;
          const x = band.start(i) + slot * (vi + 0.5);
          const py = scales.y.toPixel(v);
          const d = v - ref;
          const text = `${d >= 0 ? '+' : '−'}${formatY(Math.abs(d), c)}`;
          const above = v >= ref;
          const small = `500 ${Math.round(theme.fontSize * 0.92)}px ${monoFont(theme)}`;
          if (flip) {
            c.renderer.drawText('overlay', text, above ? py + 9 : py - 9, x, {
              font: small,
              fill: theme.text,
              align: above ? 'left' : 'right',
              baseline: 'middle',
            });
            continue;
          }
          c.renderer.drawText('overlay', text, x, above ? py - 9 : py + 9, {
            font: small,
            fill: theme.text,
            align: 'center',
            baseline: above ? 'bottom' : 'top',
          });
        }
      });
    },
  };
}

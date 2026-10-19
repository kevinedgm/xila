import { seriesColor } from '../config';
import { formatNumber } from '../format/number';
import type { ChartPlugin, PluginContext } from '../plugin';

export interface TrendOptions {
  /**
   * Forma del ajuste: `'linear'` (y = a + b·x) o `'log'` (y = a + b·log10 x). Por defecto sigue
   * la escala X: `'log'` si es logarítmica, `'linear'` si no.
   */
  readonly fit?: 'linear' | 'log';
  /** Tallos de cada punto a la línea, con el color de "por encima" o "por debajo" (`true`). */
  readonly stems?: boolean;
  /** Lista a la derecha con las series ordenadas por su diferencia contra la línea (`true`). */
  readonly ranking?: boolean;
  /** Texto junto a la línea ("tendencia"). */
  readonly label?: string;
  /** Título de la lista ("Sobre lo esperado"). */
  readonly rankingTitle?: string;
  /** Texto de las diferencias; por defecto el formato del eje Y. */
  readonly format?: (value: number) => string;
  /** Colores de los tallos y las cifras: por encima y por debajo de la línea. Por defecto, el
   * segundo y el primer color de la paleta. */
  readonly colors?: { readonly above?: string; readonly below?: string };
}

export interface TrendFit {
  readonly a: number;
  readonly b: number;
  readonly n: number;
  /** Valor esperado de y para una x. */
  readonly predict: (x: number) => number;
}

/** Mínimos cuadrados de y sobre x (o sobre log10 x); ignora pares no finitos. */
export function trendFit(xs: ArrayLike<number>, ys: ArrayLike<number>, log = false): TrendFit {
  const f = log ? (x: number): number => Math.log10(x) : (x: number): number => x;
  let n = 0;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = f(xs[i] as number);
    const y = ys[i] as number;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    n++;
    mx += x;
    my += y;
  }
  if (n < 2) return { a: NaN, b: NaN, n, predict: () => NaN };
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = f(xs[i] as number);
    const y = ys[i] as number;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  const b = den > 0 ? num / den : 0;
  const a = my - b * mx;
  return { a, b, n, predict: (x) => a + b * f(x) };
}

/**
 * Contra lo esperado, la forma C de _Más allá de la dispersión_: una línea de tendencia dice
 * cuánto "debería" valer y para cada x, y de cada punto sale un tallo hasta la línea con el
 * color de "por encima" o "por debajo". La distancia es la respuesta a "¿quién se sale del
 * patrón?". La lista de la derecha ordena las series por esa diferencia. Solo para
 * dispersiones con eje X continuo; el ajuste se hace con las series visibles.
 */
export function trendPlugin(options: TrendOptions = {}): ChartPlugin {
  let widest = 0;
  const formatY = (v: number, c: PluginContext): string => {
    if (options.format) return options.format(v);
    const axis = c.config.axes.y.format;
    if (axis) return axis(v);
    const s = c.getScales()?.y;
    const step = s ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };
  const useLog = (c: PluginContext): boolean =>
    options.fit ? options.fit === 'log' : c.getScales()?.x.kind === 'log';
  const fitAll = (c: PluginContext): TrendFit => {
    const xs: number[] = [];
    const ys: number[] = [];
    c.getSeries().forEach((s) => {
      if (c.hiddenSeries.has(s.id)) return;
      for (let i = 0; i < s.length; i++) {
        xs.push(s.x[i] as number);
        ys.push(s.y[i] as number);
      }
    });
    return trendFit(xs, ys, useLog(c));
  };
  /** Por serie visible: su diferencia media contra la línea (una serie suele ser un punto). */
  const residuals = (
    c: PluginContext,
    fit: TrendFit,
  ): { index: number; name: string; delta: number }[] => {
    const out: { index: number; name: string; delta: number }[] = [];
    c.getSeries().forEach((s, i) => {
      if (c.hiddenSeries.has(s.id)) return;
      let sum = 0;
      let n = 0;
      for (let k = 0; k < s.length; k++) {
        const d = (s.y[k] as number) - fit.predict(s.x[k] as number);
        if (Number.isFinite(d)) {
          sum += d;
          n++;
        }
      }
      if (n > 0) out.push({ index: i, name: c.config.series[i]?.name ?? s.id, delta: sum / n });
    });
    return out.sort((p, q) => q.delta - p.delta);
  };
  const signed = (d: number, c: PluginContext): string =>
    `${d >= 0 ? '+' : '−'}${formatY(Math.abs(d), c)}`;

  return {
    id: 'trend',
    reserveSpace(c) {
      if (options.ranking === false) return undefined;
      const { theme } = c.config;
      const font = { font: `${theme.fontSize}px ${theme.fontFamily}`, fill: theme.text };
      widest = c.renderer.measureText(options.rankingTitle ?? 'Sobre lo esperado', {
        ...font,
        font: `600 ${theme.fontSize * 0.85}px ${theme.fontFamily}`,
      });
      c.getSeries().forEach((s, i) => {
        if (c.hiddenSeries.has(s.id)) return;
        const name = c.config.series[i]?.name ?? s.id;
        widest = Math.max(widest, c.renderer.measureText(`${name}  +00.0`, font) + 14);
      });
      return { right: Math.ceil(widest) + 24 };
    },
    afterDraw(c) {
      const scales = c.getScales();
      if (!scales || scales.x.kind === 'band') return;
      const fit = fitAll(c);
      if (!Number.isFinite(fit.b)) return;
      const { theme } = c.config;
      const area = c.layout.plotArea;
      const sx = scales.x;
      const sy = scales.y;
      const above = options.colors?.above ?? theme.palette[1] ?? theme.text;
      const below = options.colors?.below ?? theme.palette[0] ?? theme.text;
      const identity = { x: { base: 0, offset: 0, scale: 1 }, y: { base: 0, offset: 0, scale: 1 } };
      // Tallos, debajo de los puntos (capa de datos) y de la línea.
      if (options.stems !== false) {
        c.getSeries().forEach((s) => {
          if (c.hiddenSeries.has(s.id)) return;
          for (let k = 0; k < s.length; k++) {
            const x = s.x[k] as number;
            const y = s.y[k] as number;
            const e = fit.predict(x);
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(e)) continue;
            const px = sx.toPixel(x);
            c.renderer.drawRule('data', px, sy.toPixel(e), px, sy.toPixel(y), {
              stroke: y >= e ? above : below,
              width: 3,
              opacity: 0.7,
            });
          }
        });
      }
      // Línea punteada: se muestrea en píxeles para que en escala log sea una curva correcta.
      const n = 48;
      const lx = new Float64Array(n);
      const ly = new Float64Array(n);
      const [y0, y1] = sy.domain;
      const lo = Math.min(y0, y1);
      const hi = Math.max(y0, y1);
      for (let i = 0; i < n; i++) {
        const px = area.x + (area.width * i) / (n - 1);
        const e = fit.predict(sx.toValue(px));
        lx[i] = px;
        ly[i] = e >= lo && e <= hi ? sy.toPixel(e) : NaN;
      }
      c.renderer.drawLineSeries(
        'data',
        lx,
        ly,
        0,
        n,
        { stroke: theme.text, width: 1.5, dash: [6, 4] },
        identity,
      );
      // Etiqueta de la línea: debajo de su primer tramo visible, donde no hay tallos.
      const first = ly.findIndex((v) => v === v);
      if (first >= 0) {
        c.renderer.drawText(
          'overlay',
          options.label ?? 'tendencia',
          (lx[first] as number) + 4,
          (ly[first] as number) + 8,
          {
            font: `${theme.fontSize * 0.85}px ${theme.fontFamily}`,
            fill: theme.axis,
            baseline: 'top',
          },
        );
      }
      if (options.ranking === false) return;
      const rx = area.x + area.width + 20;
      const rows = residuals(c, fit);
      const lh = theme.fontSize * 1.5;
      c.renderer.drawText(
        'overlay',
        (options.rankingTitle ?? 'Sobre lo esperado').toUpperCase(),
        rx,
        area.y,
        {
          font: `600 ${theme.fontSize * 0.85}px ${theme.fontFamily}`,
          fill: theme.axis,
          baseline: 'top',
        },
      );
      rows.forEach(({ index, name, delta }, i) => {
        const y = area.y + lh * (i + 1) + 4;
        c.renderer.drawPointSeries(
          'overlay',
          Float64Array.of(rx + 4),
          Float64Array.of(y + theme.fontSize * 0.5),
          0,
          1,
          { fill: seriesColor(c.config, index), radius: 3.5 },
          identity,
        );
        c.renderer.drawText('overlay', name, rx + 14, y, {
          font: `${theme.fontSize}px ${theme.fontFamily}`,
          fill: theme.text,
          baseline: 'top',
        });
        c.renderer.drawText('overlay', signed(delta, c), rx + widest + 4, y, {
          font: `600 ${theme.fontSize}px ${theme.fontFamily}`,
          fill: delta >= 0 ? above : below,
          align: 'right',
          baseline: 'top',
        });
      });
    },
  };
}

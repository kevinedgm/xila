import type { ChartPlugin, PluginContext } from '../plugin';
import { formatNumber } from '../format/number';
import { seriesColor } from '../config';

export interface EndLabelsOptions {
  /** Escribir el nombre de la serie (`true`). */
  readonly name?: boolean;
  /** Escribir el último valor (`true`). */
  readonly value?: boolean;
  /** Formato del valor; por defecto el del eje Y o `formatNumber` con el paso de los ticks. */
  readonly format?: (value: number) => string;
  /** Separación mínima entre etiquetas en píxeles (1.1 líneas). */
  readonly minGap?: number;
  /** Radio del punto de cierre, ≥ 4 para que se vea (4). */
  readonly marker?: number;
}

/**
 * Etiquetas directas al final de cada línea (anatomía editorial): "Nombre 1,234" junto al último
 * punto visible, con un punto de cierre del color de la serie y anillo del color de la superficie.
 * El texto va en el color de tinta, nunca en el de la serie: la identidad la da el punto.
 * Si dos etiquetas chocan se separan en vertical, de arriba abajo, sin salirse del área.
 * Reserva a la derecha el ancho de la etiqueta más larga. Solo para escalas X continuas.
 */
/**
 * Separa posiciones verticales ya ordenadas para que ninguna quede a menos de `gap` de la
 * anterior: empuja hacia abajo y, si la última se sale de `bottom`, las sube en cadena.
 */
export function spreadLabels(
  sorted: readonly number[],
  gap: number,
  top: number,
  bottom: number,
): number[] {
  const ys = sorted.map((y) => Math.max(top, y));
  for (let i = 1; i < ys.length; i++) {
    if ((ys[i] as number) - (ys[i - 1] as number) < gap) ys[i] = (ys[i - 1] as number) + gap;
  }
  for (let i = ys.length - 1; i >= 0; i--) {
    const max = i === ys.length - 1 ? bottom : (ys[i + 1] as number) - gap;
    if ((ys[i] as number) > max) ys[i] = max;
  }
  return ys;
}

export function endLabelsPlugin(options: EndLabelsOptions = {}): ChartPlugin {
  const withName = options.name ?? true;
  const withValue = options.value ?? true;
  const marker = options.marker ?? 4;
  let widest = 0;

  const formatY = (v: number, c: PluginContext): string => {
    if (options.format) return options.format(v);
    const axis = c.config.axes.y.format;
    if (axis) return axis(v);
    const s = c.getScales()?.y;
    const step = s ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };

  const labels = (c: PluginContext): { text: string; x: number; y: number; color: string }[] => {
    const scales = c.getScales();
    if (!scales || scales.x.kind === 'band') return [];
    const sx = scales.x;
    const out: { text: string; x: number; y: number; color: string }[] = [];
    c.getSeries().forEach((s, i) => {
      if (c.hiddenSeries.has(s.id)) return;
      let last = s.length - 1;
      while (last >= 0 && (s.y[last] as number) !== (s.y[last] as number)) last--;
      if (last < 0) return;
      const spec = c.config.series[i];
      const parts: string[] = [];
      if (withName) parts.push(spec?.name ?? s.id);
      if (withValue) parts.push(formatY(s.y[last] as number, c));
      out.push({
        text: parts.join('  '),
        x: sx.toPixel(s.x[last] as number),
        y: scales.y.toPixel(s.y[last] as number),
        color: seriesColor(c.config, i),
      });
    });
    return out;
  };

  return {
    id: 'end-labels',
    reserveSpace(c) {
      const { theme } = c.config;
      const font = { font: `500 ${theme.fontSize}px ${theme.fontFamily}`, fill: theme.text };
      // Antes del primer layout no hay escalas: se mide con el último valor de cada serie.
      widest = 0;
      c.getSeries().forEach((s, i) => {
        if (c.hiddenSeries.has(s.id) || s.length === 0) return;
        const spec = c.config.series[i];
        const parts: string[] = [];
        if (withName) parts.push(spec?.name ?? s.id);
        if (withValue) parts.push(formatY(s.y[s.length - 1] as number, c));
        widest = Math.max(widest, c.renderer.measureText(parts.join('  '), font));
      });
      return widest > 0 ? { right: Math.ceil(widest) + marker + 10 } : undefined;
    },
    afterDraw(c) {
      const { theme } = c.config;
      const area = c.layout.plotArea;
      const items = labels(c).sort((a, b) => a.y - b.y);
      const ys = spreadLabels(
        items.map((it) => it.y),
        options.minGap ?? theme.fontSize * 1.1,
        area.y,
        area.y + area.height,
      );
      items.forEach((it, i) => {
        const ly = ys[i] as number;
        c.renderer.drawPointSeries(
          'overlay',
          Float64Array.of(it.x),
          Float64Array.of(it.y),
          0,
          1,
          { fill: it.color, radius: marker, stroke: theme.background, strokeWidth: 2 },
          { x: { base: 0, offset: 0, scale: 1 }, y: { base: 0, offset: 0, scale: 1 } },
        );
        c.renderer.drawText('overlay', it.text, it.x + marker + 6, ly, {
          font: `500 ${theme.fontSize}px ${theme.fontFamily}`,
          fill: theme.text,
          baseline: 'middle',
        });
      });
    },
  };
}

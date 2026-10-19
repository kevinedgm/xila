import type { ChartPlugin, PluginContext } from '../plugin';
import type { ChartConfig } from '../config';
import { resolveTheme } from '../theme';
import { formatNumber } from '../format/number';

export interface FocusOptions {
  /** Id de la serie protagonista. Por defecto, la primera. */
  readonly series?: string;
  /** Color de las series de contexto. Por defecto, una mezcla del eje con el fondo. */
  readonly ghost?: string;
  /** Etiquetas directas al final de cada línea (la leyenda sobra). `true` por defecto. */
  readonly labels?: boolean;
  /** Formato del último valor de la protagonista. */
  readonly format?: (value: number) => string;
}

export interface FocusPlugin extends ChartPlugin {
  /** Cambia la protagonista sin cambiar la forma del gráfico. */
  setFocus(seriesId: string): void;
  getFocus(): string | null;
}

/** Mezcla lineal de dos colores `#rrggbb`; `t` = 0 da `a`, 1 da `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const out = pa.map((v, i) => Math.round(v + ((pb[i] as number) - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(c: string): number[] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const n = parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Separa etiquetas en vertical para que no se encimen: las ordena y empuja hacia abajo las que
 * quedan a menos de `gap` px de la anterior. Devuelve las posiciones en el orden de entrada.
 */
export function spreadLabels(ys: readonly number[], gap: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1] as { y: number };
    const cur = order[k] as { y: number };
    if (cur.y - prev.y < gap) cur.y = prev.y + gap;
  }
  const out = new Array<number>(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}

/**
 * Protagonista y contexto: una serie en color y con nombre, el resto en gris y sin leyenda. Responde
 * "¿cómo va esta serie frente a las demás?" y escala a muchas series sin espagueti. La protagonista
 * se dibuja encima y se puede cambiar con `setFocus` (por ejemplo, desde un selector).
 */
export function focusPlugin(options: FocusOptions = {}): FocusPlugin {
  let focus: string | null = options.series ?? null;
  let ctx: PluginContext | null = null;
  const showLabels = options.labels ?? true;
  const GAP = 14;
  const PAD = 8;

  const labelFor = (c: PluginContext, id: string): string =>
    c.config.series.find((s) => s.id === id)?.name ?? id;

  const lastIndex = (y: Float64Array): number => {
    for (let i = y.length - 1; i >= 0; i--) if (Number.isFinite(y[i] as number)) return i;
    return -1;
  };

  const valueText = (c: PluginContext, v: number): string =>
    options.format ? options.format(v) : formatNumber(v, { step: Math.abs(v) / 100 || 1 });

  return {
    id: 'focus',
    setFocus(seriesId) {
      if (seriesId === focus) return;
      focus = seriesId;
      ctx?.reconfigure?.();
    },
    getFocus() {
      return focus;
    },
    install(c) {
      ctx = c;
    },
    beforeUpdate(config: ChartConfig): ChartConfig {
      const ids = config.series.map((s) => s.id);
      const id = focus && ids.includes(focus) ? focus : ids[0];
      if (!id) return config;
      focus = id;
      const theme = resolveTheme(config.theme);
      const original = ids.indexOf(id);
      const color = theme.palette[original % theme.palette.length] ?? theme.text;
      const ghost = options.ghost ?? mixHex(theme.axis, theme.background, 0.55);
      // La protagonista va al final (se dibuja encima) y es la única con color propio.
      const series = [...config.series.filter((s) => s.id !== id), config.series[original]!];
      const palette = series.map((s) => (s.id === id ? color : ghost));
      return { ...config, series, theme: { ...theme, palette } };
    },
    reserveSpace(c) {
      if (!showLabels) return;
      const style = {
        font: `600 ${c.config.theme.fontSize + 1}px ${c.config.theme.fontFamily}`,
        fill: '',
      };
      let widest = 0;
      for (const s of c.getSeries()) {
        const i = lastIndex(s.y);
        const text =
          s.id === focus && i >= 0
            ? `${labelFor(c, s.id)}  ${valueText(c, s.y[i] as number)}`
            : labelFor(c, s.id);
        widest = Math.max(widest, c.renderer.measureText(text, style));
      }
      return { right: Math.ceil(widest) + PAD * 2 };
    },
    afterDraw(c) {
      ctx = c;
      if (!showLabels) return;
      const scales = c.getScales();
      if (!scales || scales.x.kind === 'band') return;
      const { theme } = c.config;
      const { plotArea } = c.layout;
      const x = plotArea.x + plotArea.width + PAD;
      const visible = c.getSeries().filter((s) => !c.hiddenSeries.has(s.id));
      const points = visible.map((s) => ({ s, i: lastIndex(s.y) })).filter((p) => p.i >= 0);
      const ys = spreadLabels(
        points.map((p) => scales.y.toPixel(p.s.y[p.i] as number)),
        GAP,
      );
      points.forEach((p, k) => {
        const isFocus = p.s.id === focus;
        const v = p.s.y[p.i] as number;
        const text = isFocus ? `${labelFor(c, p.s.id)}  ${valueText(c, v)}` : labelFor(c, p.s.id);
        c.renderer.drawText('background', text, x, ys[k] as number, {
          font: `${isFocus ? 600 : 400} ${theme.fontSize + (isFocus ? 1 : 0)}px ${theme.fontFamily}`,
          fill: isFocus ? theme.text : theme.axis,
          align: 'left',
          baseline: 'middle',
        });
      });
      // Punto final de la protagonista: el "dónde va hoy". En la capa de fondo para que el hover
      // (que limpia la capa overlay) no lo borre y para que el recorte del área no lo corte.
      const f = points.find((p) => p.s.id === focus);
      if (f) {
        const color = theme.palette[theme.palette.length - 1] ?? theme.text;
        c.renderer.drawPointSeries(
          'background',
          Float64Array.of(scales.x.toPixel(f.s.x[f.i] as number)),
          Float64Array.of(scales.y.toPixel(f.s.y[f.i] as number)),
          0,
          1,
          { fill: color, radius: 4.5, stroke: theme.background, strokeWidth: 2 },
          { x: { offset: 0, scale: 1, base: 0 }, y: { offset: 0, scale: 1, base: 0 } },
        );
      }
    },
    uninstall() {
      ctx = null;
    },
  };
}

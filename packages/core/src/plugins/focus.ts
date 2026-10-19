import type { ChartConfig } from '../config';
import { seriesColor } from '../config';
import type { ChartPlugin, PluginContext } from '../plugin';
import { formatNumber } from '../format/number';
import { spreadLabels } from './end-labels';

export interface FocusOptions {
  /** `id` de la serie protagonista al inicio; por defecto, la primera. */
  readonly series?: string;
  /** Botones para cambiar de protagonista (`true`). */
  readonly selector?: boolean;
  /** Etiquetas al final: la protagonista con su valor, el resto solo con su nombre (`true`). */
  readonly labels?: boolean;
  /** Texto del último valor; por defecto el formato del eje Y. */
  readonly format?: (value: number) => string;
  /** Etiquetas de la interfaz. */
  readonly ui?: Partial<Record<'group', string>>;
}

/**
 * Protagonista y contexto: una serie en su color y con nombre y valor al final; las demás en el
 * color apagado del tema (`theme.muted`), sin leyenda, con solo su nombre al final. El contraste
 * de saturación ordena la lectura: primero la protagonista, después su posición en el grupo.
 * Los colores se fijan en `beforeUpdate` con `stroke`, así tooltip, leyenda y exportación los
 * ven iguales. La protagonista se vuelve a trazar en `afterDraw` para quedar encima.
 */
export function focusPlugin(options: FocusOptions = {}): ChartPlugin {
  let focus = options.series ?? null;
  let el: HTMLDivElement | null = null;
  let widest = 0;

  const formatY = (v: number, c: PluginContext): string => {
    if (options.format) return options.format(v);
    const axis = c.config.axes.y.format;
    if (axis) return axis(v);
    const s = c.getScales()?.y;
    const step = s ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };

  const paletteColor = (c: PluginContext, i: number): string => {
    const { palette } = c.config.theme;
    return palette[i % palette.length] ?? c.config.theme.text;
  };

  const renderSelector = (c: PluginContext): void => {
    if (!el) return;
    el.innerHTML = '';
    const { theme } = c.config;
    c.config.series.forEach((spec) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'xila-focus-item';
      b.setAttribute('data-series', spec.id);
      b.setAttribute('aria-pressed', String(spec.id === focus));
      b.textContent = spec.name ?? spec.id;
      const on = spec.id === focus;
      Object.assign(b.style, {
        font: `500 ${theme.fontSize}px ${theme.fontFamily}`,
        color: on ? theme.background : theme.text,
        background: on ? theme.text : 'transparent',
        border: `1px solid ${on ? theme.text : theme.grid}`,
        borderRadius: '6px',
        padding: '3px 10px',
        marginRight: '6px',
        cursor: 'pointer',
      });
      b.addEventListener('click', () => {
        focus = spec.id;
        renderSelector(c);
        c.update({});
      });
      el?.appendChild(b);
    });
  };

  return {
    id: 'focus',
    install(c) {
      if (!focus) focus = c.config.series[0]?.id ?? null;
      if (options.selector === false) return;
      el = document.createElement('div');
      el.className = 'xila-focus';
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', options.ui?.group ?? 'Serie protagonista');
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        bottom: '0',
        padding: '6px 8px 4px',
        pointerEvents: 'auto',
      });
      c.renderer.element.appendChild(el);
      renderSelector(c);
    },
    beforeUpdate(config: ChartConfig, c) {
      const muted = c.config.theme.muted ?? c.config.theme.grid;
      if (!focus || !config.series.some((s) => s.id === focus))
        focus = config.series[0]?.id ?? null;
      const palette = c.config.theme.palette;
      return {
        ...config,
        series: config.series.map((s, i) => ({
          ...s,
          stroke: s.id === focus ? (palette[i % palette.length] ?? s.stroke) : muted,
        })),
      } as ChartConfig;
    },
    reserveSpace(c) {
      const { theme } = c.config;
      const bottom = el?.offsetHeight ?? 0;
      if (options.labels === false) return { bottom };
      const font = { font: `600 ${theme.fontSize}px ${theme.fontFamily}`, fill: theme.text };
      widest = 0;
      c.getSeries().forEach((s, i) => {
        if (c.hiddenSeries.has(s.id) || s.length === 0) return;
        const spec = c.config.series[i];
        const name = spec?.name ?? s.id;
        const text = s.id === focus ? `${name}  ${formatY(s.y[s.length - 1] as number, c)}` : name;
        widest = Math.max(widest, c.renderer.measureText(text, font));
      });
      return { bottom, right: Math.ceil(widest) + 14 };
    },
    afterDraw(c) {
      const scales = c.getScales();
      if (!scales || scales.x.kind === 'band' || options.labels === false) return;
      const sx = scales.x;
      const { theme } = c.config;
      const area = c.layout.plotArea;
      const items: { text: string; y: number; focus: boolean; color: string; x: number }[] = [];
      c.getSeries().forEach((s, i) => {
        if (c.hiddenSeries.has(s.id)) return;
        let last = s.length - 1;
        while (last >= 0 && (s.y[last] as number) !== (s.y[last] as number)) last--;
        if (last < 0) return;
        const name = c.config.series[i]?.name ?? s.id;
        const isFocus = s.id === focus;
        items.push({
          text: isFocus ? `${name}  ${formatY(s.y[last] as number, c)}` : name,
          x: sx.toPixel(s.x[last] as number),
          y: scales.y.toPixel(s.y[last] as number),
          focus: isFocus,
          color: isFocus ? paletteColor(c, i) : seriesColor(c.config, i),
        });
      });
      // La protagonista se traza otra vez sobre la capa de datos para quedar encima del gris.
      if (c.config.type === 'line') {
        const fi = c.config.series.findIndex((sp) => sp.id === focus);
        const fs = c.getSeries()[fi];
        if (fs && !c.hiddenSeries.has(fs.id)) {
          const tx = sx.transform;
          const ty = scales.y.transform;
          c.renderer.drawLineSeries(
            'data',
            tx ? Float64Array.from(fs.x, (v) => tx(v)) : fs.x,
            ty ? Float64Array.from(fs.y, (v) => ty(v)) : fs.y,
            0,
            fs.length,
            { stroke: paletteColor(c, fi), width: c.config.line.width + 0.5 },
            { x: sx.map(), y: scales.y.map() },
          );
        }
      }
      items.sort((a, b) => a.y - b.y);
      const ys = spreadLabels(
        items.map((it) => it.y),
        theme.fontSize * 1.1,
        area.y,
        area.y + area.height,
      );
      items.forEach((it, i) => {
        if (it.focus) {
          c.renderer.drawPointSeries(
            'overlay',
            Float64Array.of(it.x),
            Float64Array.of(it.y),
            0,
            1,
            { fill: it.color, radius: 4, stroke: theme.background, strokeWidth: 2 },
            { x: { base: 0, offset: 0, scale: 1 }, y: { base: 0, offset: 0, scale: 1 } },
          );
        }
        c.renderer.drawText('overlay', it.text, it.x + 8, ys[i] as number, {
          font: `${it.focus ? 600 : 400} ${theme.fontSize}px ${theme.fontFamily}`,
          fill: it.focus ? theme.text : theme.axis,
          baseline: 'middle',
        });
      });
    },
    uninstall() {
      el?.remove();
      el = null;
    },
  };
}

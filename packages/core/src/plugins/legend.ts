import type { ChartPlugin, PluginContext } from '../plugin';
import { seriesColor } from '../config';

export interface LegendOptions {
  readonly position?: 'top' | 'bottom';
  /** Si es `false`, la leyenda solo informa y no oculta series. */
  readonly interactive?: boolean;
}

/**
 * Leyenda HTML. Al hacer clic en una serie la oculta y el núcleo recalcula el dominio Y
 * con las series visibles, así una serie grande oculta no sigue aplastando a las demás.
 */
export function legendPlugin(options: LegendOptions = {}): ChartPlugin {
  const interactive = options.interactive ?? true;
  let el: HTMLDivElement | null = null;
  let renderedKey = '';

  const render = (ctx: PluginContext): void => {
    if (!el) return;
    const { theme, series } = ctx.config;
    el.innerHTML = '';
    series.forEach((spec, i) => {
      const hidden = ctx.hiddenSeries.has(spec.id);
      const item = document.createElement(interactive ? 'button' : 'span');
      item.className = 'xila-legend-item';
      item.setAttribute('data-series', spec.id);
      if (interactive) {
        item.setAttribute('type', 'button');
        item.setAttribute('aria-pressed', String(!hidden));
      }
      Object.assign(item.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        marginRight: '14px',
        padding: '0',
        border: '0',
        background: 'none',
        font: `${theme.fontSize}px ${theme.fontFamily}`,
        color: theme.text,
        cursor: interactive ? 'pointer' : 'default',
        opacity: hidden ? '0.4' : '1',
        textDecoration: hidden ? 'line-through' : 'none',
      });
      const swatch = document.createElement('span');
      const color = seriesColor(ctx.config, i);
      Object.assign(swatch.style, {
        display: 'inline-block',
        width: '12px',
        height: '12px',
        borderRadius: '2px',
        background: color,
      });
      item.append(swatch, document.createTextNode(spec.name ?? spec.id));
      if (interactive) {
        item.addEventListener('click', () => {
          ctx.toggleSeries(spec.id);
          render(ctx);
        });
      }
      el?.appendChild(item);
    });
  };

  return {
    id: 'legend',
    install(ctx) {
      el = document.createElement('div');
      el.className = 'xila-legend';
      // `group` y no `list`: los elementos son botones, no `listitem` (axe: aria-required-children).
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', 'Series');
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        [options.position === 'bottom' ? 'bottom' : 'top']: '0',
        padding: '4px 8px',
        lineHeight: '1.4',
        pointerEvents: 'auto',
      });
      ctx.renderer.element.appendChild(el);
      renderedKey = ctx.config.series.map((s) => `${s.id}:${s.name ?? ''}`).join('|');
      render(ctx);
    },
    /** Se reconstruye solo si cambió la lista de series, no en cada redibujo. */
    afterLayout(_layout, ctx) {
      const key = ctx.config.series.map((s) => `${s.id}:${s.name ?? ''}`).join('|');
      if (key !== renderedKey) {
        renderedKey = key;
        render(ctx);
      }
    },
    /** Reserva espacio para la leyenda, para que no tape el gráfico; arriba, debajo del título. */
    reserveSpace() {
      const height = el?.offsetHeight ?? 0;
      if (options.position === 'bottom') return { bottom: height };
      const title = el?.parentElement?.querySelector<HTMLElement>('.xila-title');
      if (el) el.style.top = `${title?.offsetHeight ?? 0}px`;
      return { top: height };
    },
    uninstall() {
      el?.remove();
      el = null;
    },
  };
}

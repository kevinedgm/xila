import type { Hit } from '../hit-test';
import type { ChartPlugin, PluginContext } from '../plugin';
import { formatNumber } from '../format/number';

export interface TooltipOptions {
  /** `nearest`: un dato. `x`: todas las series en la misma x (líneas y barras). */
  readonly mode?: 'nearest' | 'x';
  /** Distancia máxima en píxeles para que el tooltip aparezca. */
  readonly maxDistance?: number;
  /** Devuelve HTML o texto para los aciertos; por defecto, nombre y valores formateados. */
  readonly format?: (hits: readonly Hit[], ctx: PluginContext) => string;
  readonly formatX?: (x: number) => string;
  readonly formatY?: (y: number) => string;
}

/**
 * Tooltip como elemento HTML sobre el canvas (texto nítido y accesible). Lee los aciertos
 * que el núcleo publica en el evento `hover`; no toca el canvas de datos.
 */
export function tooltipPlugin(options: TooltipOptions = {}): ChartPlugin {
  const mode = options.mode ?? 'x';
  const maxDistance = options.maxDistance ?? 24;
  let el: HTMLDivElement | null = null;
  let off: (() => void) | null = null;
  let hostStyle = '';

  const hide = (): void => {
    if (el) el.style.display = 'none';
  };

  const show = (hits: readonly Hit[], ctx: PluginContext): void => {
    if (!el || hits.length === 0) return hide();
    el.innerHTML = (options.format ?? defaultFormat(options))(hits, ctx);
    el.style.display = 'block';

    // Cerca del borde derecho, el tooltip va a la izquierda del cursor; igual en vertical.
    const anchor = hits[0] as Hit;
    const { width, height } = ctx.layout;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 12;
    const left = anchor.px + gap + w > width ? anchor.px - gap - w : anchor.px + gap;
    const top = Math.min(Math.max(0, anchor.py - h / 2), height - h);
    el.style.left = `${Math.max(0, left)}px`;
    el.style.top = `${top}px`;
  };

  return {
    id: 'tooltip',
    install(ctx) {
      const host = ctx.renderer.element;
      hostStyle = host.style.position;
      if (!hostStyle) host.style.position = 'relative';
      el = document.createElement('div');
      el.className = 'xila-tooltip';
      el.setAttribute('role', 'status');
      Object.assign(el.style, {
        position: 'absolute',
        display: 'none',
        pointerEvents: 'none',
        padding: '6px 8px',
        borderRadius: '4px',
        font: `${ctx.config.theme.fontSize}px ${ctx.config.theme.fontFamily}`,
        color: ctx.config.theme.text,
        background: ctx.config.theme.background,
        border: `1px solid ${ctx.config.theme.grid}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        whiteSpace: 'nowrap',
        zIndex: '1',
      });
      host.appendChild(el);
      off = ctx.events.on('hover', (payload) => {
        if (!payload) return hide();
        const hits = mode === 'nearest' ? [payload.nearest] : payload.hits;
        const visible = hits.filter((h): h is Hit => h !== null && h.distance <= maxDistance);
        show(visible, ctx);
      });
    },
    uninstall(ctx) {
      off?.();
      el?.remove();
      el = null;
      ctx.renderer.element.style.position = hostStyle;
    },
  };
}

function defaultFormat(
  options: TooltipOptions,
): (hits: readonly Hit[], ctx: PluginContext) => string {
  return (hits, ctx) => {
    const first = hits[0] as Hit;
    const { config } = ctx;
    const spec = config.series[first.seriesIndex];
    const xColumn = spec ? config.data.column(spec.x) : null;
    const fx =
      options.formatX ??
      (xColumn?.kind === 'time'
        ? (v: number) => new Date(v).toISOString().replace('T', ' ').slice(0, 19)
        : xColumn?.kind === 'category'
          ? (v: number) => xColumn.categories[v] ?? String(v)
          : (v: number) => formatNumber(v, { decimals: 2 }));
    const fy = options.formatY ?? ((v: number) => formatNumber(v, { decimals: 2 }));
    const rows = hits
      .map((h) => {
        const color = config.theme.palette[h.seriesIndex % config.theme.palette.length] ?? '#000';
        const name = config.series[h.seriesIndex]?.name ?? h.seriesId;
        return `<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${escape(name)}: <b>${escape(fy(h.y))}</b></div>`;
      })
      .join('');
    return `<div style="opacity:.7;margin-bottom:4px">${escape(fx(first.x))}</div>${rows}`;
  };
}

function escape(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );
}

import type { ChartPlugin, PluginContext } from '../plugin';
import type { Domain } from '../scales/linear';
import { formatNumber } from '../format/number';
import { quantile } from '../stats';

export type SummaryStat = 'median' | 'mean' | 'min' | 'max';

export interface SummaryOptions {
  /** Singular y plural de la unidad: `['caso', 'casos']`. Por defecto `['dato', 'datos']`. */
  readonly unit?: readonly [string, string];
  /** `'right'` reserva una columna; `'bottom'` una franja; `'auto'` (defecto) decide por el ancho. */
  readonly position?: 'right' | 'bottom' | 'auto';
  /** Ancho de la columna en píxeles (240). */
  readonly width?: number;
  /** Estadísticos del rango que se listan debajo de la cifra. Por defecto `['median']`. */
  readonly stats?: readonly SummaryStat[];
  /** Botones "Sueltos / Agrupados" cuando el gráfico es de unidades (`true`). */
  readonly modes?: boolean;
  /** Texto de los valores en X (por defecto, el formato del eje). */
  readonly format?: (v: number) => string;
  /** Etiquetas de la interfaz, por si el dashboard no está en español. */
  readonly labels?: Partial<
    Record<'total' | 'range' | 'all' | 'clear' | 'strip' | 'binned' | SummaryStat, string>
  >;
}

const LABELS = {
  total: 'en total',
  range: 'Rango',
  all: 'todo',
  clear: 'Quitar selección',
  strip: 'Sueltos',
  binned: 'Agrupados',
  median: 'Mediana',
  mean: 'Media',
  min: 'Mínimo',
  max: 'Máximo',
};

/**
 * Panel de resumen de la selección (estructura "A · Resumen al lado" de la ronda r01): cifra
 * grande con el conteo, porcentaje del total, rango y estadísticos, botones de forma para el
 * gráfico de unidades y una acción visible para quitar la selección. Lee la selección que guarda
 * el núcleo (la pone `selectionPlugin` o `chart.setSelection`), así que acompaña a
 * `selectionPlugin({ readout: false })`.
 *
 * Mecanismo: reserva espacio a la derecha o abajo según el ancho del gráfico, cuelga un `div`
 * del elemento raíz y lo vuelve a rellenar en cada evento `selection`, en el primer dibujo y
 * tras un cambio de datos. La columna de la derecha baja a franja inferior por debajo de 700 px.
 */
export function summaryPlugin(options: SummaryOptions = {}): ChartPlugin {
  const unit = options.unit ?? ['dato', 'datos'];
  const width = options.width ?? 240;
  const stats = options.stats ?? ['median'];
  const modesOn = options.modes ?? true;
  const L = { ...LABELS, ...options.labels };
  let ctx: PluginContext | null = null;
  let el: HTMLDivElement | null = null;
  let big: HTMLDivElement | null = null;
  let sub: HTMLDivElement | null = null;
  let kv: HTMLDivElement | null = null;
  let modes: HTMLDivElement | null = null;
  let clear: HTMLButtonElement | null = null;
  let stale = true;
  let side: 'right' | 'bottom' = 'right';

  const placement = (): 'right' | 'bottom' => {
    if (options.position && options.position !== 'auto') return options.position;
    const w = ctx?.renderer.element.clientWidth ?? 0;
    return w >= 700 ? 'right' : 'bottom';
  };

  const formatX = (v: number): string => {
    if (options.format) return options.format(v);
    const axis = ctx?.config.axes.x.format;
    if (axis) return axis(v);
    const s = ctx?.getScales()?.x;
    const step = s && s.kind !== 'band' ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };

  /** Valores finitos de X de las series visibles que caen en el rango (o todos). */
  const valuesIn = (range: Domain | null): Float64Array => {
    const out: number[] = [];
    if (!ctx) return new Float64Array(0);
    const lo = range ? Math.min(range[0], range[1]) : -Infinity;
    const hi = range ? Math.max(range[0], range[1]) : Infinity;
    for (const s of ctx.getSeries()) {
      if (ctx.hiddenSeries.has(s.id)) continue;
      for (let i = 0; i < s.x.length; i++) {
        const v = s.x[i] as number;
        if (v >= lo && v <= hi) out.push(v);
      }
    }
    return Float64Array.from(out);
  };

  const stat = (name: SummaryStat, v: Float64Array): number | null => {
    if (v.length === 0) return null;
    if (name === 'median') return quantile(v, 0.5);
    let acc = name === 'mean' ? 0 : name === 'min' ? Infinity : -Infinity;
    for (let i = 0; i < v.length; i++) {
      const x = v[i] as number;
      acc = name === 'mean' ? acc + x : name === 'min' ? Math.min(acc, x) : Math.max(acc, x);
    }
    return name === 'mean' ? acc / v.length : acc;
  };

  const render = (): void => {
    if (!ctx || !el || !big || !sub || !kv) return;
    const sel = ctx.getSelection();
    const { count, total } = ctx.countSelection(sel);
    const n = sel ? count : total;
    big.textContent = formatNumber(n);
    const name = n === 1 ? unit[0] : unit[1];
    sub.textContent = sel
      ? `${name} · ${(total ? (100 * count) / total : 0).toFixed(1)} % del total`
      : `${name} ${L.total}`;
    const rows: [string, string][] = [
      [L.range, sel ? `${formatX(sel[0])} a ${formatX(sel[1])}` : L.all],
    ];
    const v = valuesIn(sel);
    for (const s of stats) {
      const r = stat(s, v);
      rows.push([L[s], r === null ? '—' : formatX(r)]);
    }
    const axisColor = ctx.config.theme.axis;
    kv.replaceChildren(
      ...rows.flatMap(([k, val]) => {
        const dt = document.createElement('span');
        dt.textContent = k;
        dt.style.color = axisColor;
        const dd = document.createElement('b');
        dd.textContent = val;
        dd.style.fontWeight = '500';
        return [dt, dd];
      }),
    );
    if (clear) clear.disabled = !sel;
    if (modes) {
      const mode = ctx.config.type === 'dots' ? ctx.config.dots.mode : null;
      modes.hidden = mode === null;
      for (const b of Array.from(modes.children) as HTMLButtonElement[]) {
        const on = b.dataset['mode'] === mode;
        b.setAttribute('aria-pressed', String(on));
        b.style.background = on ? ctx.config.theme.text : ctx.config.theme.background;
        b.style.color = on ? ctx.config.theme.background : ctx.config.theme.axis;
      }
    }
  };

  const place = (): void => {
    if (!el) return;
    side = placement();
    const gap = 20;
    if (side === 'right') {
      Object.assign(el.style, {
        top: '0',
        right: '0',
        bottom: 'auto',
        left: 'auto',
        width: `${width - gap}px`,
        gridTemplateColumns: '1fr',
        borderLeft: `1px solid ${ctx?.config.theme.grid ?? '#ddd'}`,
        borderTop: '0',
        paddingLeft: `${gap}px`,
        paddingTop: '0',
      });
    } else {
      Object.assign(el.style, {
        top: 'auto',
        right: '0',
        bottom: '0',
        left: '0',
        width: 'auto',
        gridTemplateColumns: '1fr 1fr',
        borderLeft: '0',
        borderTop: `1px solid ${ctx?.config.theme.grid ?? '#ddd'}`,
        paddingLeft: '0',
        paddingTop: '12px',
      });
    }
  };

  return {
    id: 'summary',
    install(c) {
      ctx = c;
      const { theme } = c.config;
      el = document.createElement('div');
      el.className = 'xila-summary';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-label', unit[1]);
      Object.assign(el.style, {
        position: 'absolute',
        display: 'grid',
        gap: '12px',
        alignContent: 'start',
        boxSizing: 'border-box',
        font: `${theme.fontSize + 1}px ${theme.fontFamily}`,
        color: theme.text,
        fontVariantNumeric: 'tabular-nums',
      });
      const head = document.createElement('div');
      big = document.createElement('div');
      big.className = 'xila-summary-count';
      Object.assign(big.style, { fontSize: '32px', fontWeight: '600', lineHeight: '1' });
      sub = document.createElement('div');
      sub.className = 'xila-summary-sub';
      Object.assign(sub.style, { color: theme.axis, marginTop: '4px' });
      head.append(big, sub);
      kv = document.createElement('div');
      kv.className = 'xila-summary-stats';
      Object.assign(kv.style, {
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '2px 10px',
      });
      el.append(head, kv);
      if (modesOn) {
        modes = document.createElement('div');
        modes.className = 'xila-summary-modes';
        modes.setAttribute('role', 'group');
        modes.setAttribute('aria-label', `${L.strip} / ${L.binned}`);
        Object.assign(modes.style, {
          display: 'inline-flex',
          border: `1px solid ${theme.grid}`,
          borderRadius: '6px',
          overflow: 'hidden',
          justifySelf: 'start',
        });
        for (const m of ['strip', 'binned'] as const) {
          const b = document.createElement('button');
          b.type = 'button';
          b.dataset['mode'] = m;
          b.textContent = L[m];
          Object.assign(b.style, {
            font: `${theme.fontSize}px ${theme.fontFamily}`,
            padding: '6px 10px',
            border: '0',
            cursor: 'pointer',
            minHeight: '32px',
          });
          b.addEventListener('click', () => ctx?.update({ dots: { mode: m } }));
          modes.appendChild(b);
        }
        el.appendChild(modes);
      }
      clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'xila-summary-clear';
      clear.textContent = L.clear;
      Object.assign(clear.style, {
        font: `${theme.fontSize}px ${theme.fontFamily}`,
        padding: '6px 10px',
        border: `1px solid ${theme.grid}`,
        borderRadius: '6px',
        background: theme.background,
        color: theme.text,
        cursor: 'pointer',
        justifySelf: 'start',
        minHeight: '32px',
      });
      clear.addEventListener('click', () => ctx?.setSelection(null));
      el.appendChild(clear);
      if (!c.renderer.element.style.position) c.renderer.element.style.position = 'relative';
      c.renderer.element.appendChild(el);
      place();
      render();
    },
    reserveSpace(c) {
      ctx = c;
      place();
      return side === 'right' ? { right: width } : { bottom: (el?.offsetHeight ?? 0) + 12 };
    },
    afterLayout(_l, c) {
      ctx = c;
    },
    onEvent(name) {
      if (name === 'selection') {
        stale = false;
        render();
      } else if (name === 'draw' && stale) {
        stale = false;
        render();
      } else if (name === 'dataChanged') {
        stale = true;
      }
    },
    uninstall() {
      el?.remove();
      el = big = sub = kv = modes = null;
      clear = null;
      ctx = null;
    },
  };
}

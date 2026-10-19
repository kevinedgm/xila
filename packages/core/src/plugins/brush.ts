import type { ChartPlugin, PluginContext } from '../plugin';
import type { BrushPayload } from '../events';
import type { ContinuousScale, Domain } from '../scales/linear';
import { formatNumber } from '../format/number';

export interface BrushOptions {
  /**
   * `auto` (por defecto): si el gráfico agrupa en columnas (unidades apiladas) la selección se
   * ajusta a columnas enteras; si no, es continua. `none`: siempre continua.
   */
  readonly snap?: 'auto' | 'none';
  /** Nombre accesible del control de rango. */
  readonly label?: string;
  /** Formato de los extremos del rango en la lectura. */
  readonly format?: (value: number) => string;
  /** Texto de la lectura (también se anuncia). Por defecto, conteo, porcentaje y rango. */
  readonly describe?: (
    payload: Omit<BrushPayload, 'text'>,
    format: (v: number) => string,
  ) => string;
  /** Pasos de teclado a lo ancho del área cuando la selección es continua. */
  readonly steps?: number;
}

export interface BrushPlugin extends ChartPlugin {
  /** Fija (o limpia, con `null`) la selección en unidades de datos. */
  setRange(range: Domain | null): void;
  getRange(): Domain | null;
}

/** Desplaza `[a, b]` en `delta` sin salir de `[lo, hi]` y sin cambiar su ancho. */
export function moveRange(range: Domain, delta: number, limits: Domain): Domain {
  const [lo, hi] = limits;
  const width = Math.min(range[1] - range[0], hi - lo);
  let a = range[0] + delta;
  if (a < lo) a = lo;
  if (a + width > hi) a = hi - width;
  return [a, a + width];
}

/** Mueve un solo borde, sin cruzar el otro (queda al menos `minSpan`) ni salir de `[lo, hi]`. */
export function resizeRange(
  range: Domain,
  edge: 'start' | 'end',
  delta: number,
  limits: Domain,
  minSpan: number,
): Domain {
  const [lo, hi] = limits;
  if (edge === 'end') {
    return [range[0], Math.min(hi, Math.max(range[0] + minSpan, range[1] + delta))];
  }
  return [Math.max(lo, Math.min(range[1] - minSpan, range[0] + delta)), range[1]];
}

/** Amplía el rango hasta los bordes de cubeta que lo contienen (columnas enteras). */
export function snapRange(range: Domain, edges: ArrayLike<number>): Domain {
  const n = edges.length;
  if (n < 2) return range;
  let a = edges[0] as number;
  let b = edges[n - 1] as number;
  for (let i = 0; i < n; i++) {
    const e = edges[i] as number;
    if (e <= range[0] + 1e-12) a = e;
  }
  for (let i = n - 1; i >= 0; i--) {
    const e = edges[i] as number;
    if (e >= range[1] - 1e-12) b = e;
  }
  if (b <= a) {
    // Rango dentro de una sola cubeta: esa cubeta completa.
    for (let i = 0; i + 1 < n; i++) {
      if ((edges[i + 1] as number) > a) return [edges[i] as number, edges[i + 1] as number];
    }
  }
  return [a, b];
}

/** Valores dentro de `[a, b]` (NaN fuera) y total de valores finitos. */
export function countInRange(
  arrays: readonly ArrayLike<number>[],
  range: Domain | null,
): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const values of arrays) {
    for (let i = 0; i < values.length; i++) {
      const v = values[i] as number;
      if (v !== v) continue;
      total++;
      if (range && v >= range[0] && v <= range[1]) count++;
    }
  }
  return { count: range ? count : total, total };
}

function defaultDescribe(p: Omit<BrushPayload, 'text'>, format: (v: number) => string): string {
  const n = (v: number): string => v.toLocaleString();
  if (!p.range) return `${n(p.total)} en total. Arrastra sobre la gráfica para contar un rango.`;
  const pct = (p.share * 100).toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${n(p.count)} de ${n(p.total)} (${pct} %) entre ${format(p.range[0])} y ${format(p.range[1])}`;
}

const HIDDEN: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

/**
 * Selección de un rango en X que cuenta los valores dentro: arrastrar = contar. A diferencia de
 * `select` en zoom-pan (que hace zoom al rango), aquí la salida es el conteo, publicado como
 * evento `brush` y anunciado en una región `aria-live`.
 *
 * El control es un elemento propio encima del área de dibujo (no parte de la imagen), con rol
 * `slider`: ←/→ mueven la selección, Shift ajusta el borde final, Alt el inicial, Inicio/Fin la
 * llevan a los extremos y Esc la limpia. Siempre queda dentro del rango de los datos.
 */
export function brushPlugin(options: BrushOptions = {}): BrushPlugin {
  const snapMode = options.snap ?? 'auto';
  const steps = Math.max(4, options.steps ?? 40);
  let ctx: PluginContext | null = null;
  let range: Domain | null = null;
  let root: HTMLDivElement | null = null;
  let sel: HTMLDivElement | null = null;
  let dimStart: HTMLDivElement | null = null;
  let dimEnd: HTMLDivElement | null = null;
  let live: HTMLDivElement | null = null;
  let drag: number | null = null;
  let pointerFocus = false;
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  let lastEdges = '';
  let host: HTMLElement | null = null;
  let restorePosition = false;

  const format = (v: number): string => {
    if (options.format) return options.format(v);
    const scale = xScale();
    return scale
      ? formatNumber(v, { step: Math.abs(scale.domain[1] - scale.domain[0]) / 200 })
      : formatNumber(v);
  };

  const xScale = (): ContinuousScale | null => {
    const s = ctx?.getScales();
    return s && s.x.kind !== 'band' ? s.x : null;
  };

  const edges = (): Float64Array | null =>
    snapMode === 'auto' ? (ctx?.getBinEdges?.() ?? null) : null;

  const limits = (): Domain => {
    const e = edges();
    if (e && e.length > 1) return [e[0] as number, e[e.length - 1] as number];
    return ctx?.getDataDomain('x') ?? [0, 1];
  };

  const payload = (): BrushPayload => {
    const series = ctx?.getSeries() ?? [];
    const visible = series.filter((s) => !ctx?.hiddenSeries.has(s.id)).map((s) => s.x);
    const { count, total } = countInRange(visible, range);
    const base = { range, count, total, share: total > 0 ? count / total : 0 };
    return { ...base, text: (options.describe ?? defaultDescribe)(base, format) };
  };

  const announce = (text: string, immediate: boolean): void => {
    if (!live) return;
    clearTimeout(liveTimer);
    const write = (): void => {
      if (live) live.textContent = text;
    };
    if (immediate) write();
    else liveTimer = setTimeout(write, 250);
  };

  const paint = (p: BrushPayload = payload()): void => {
    const scale = xScale();
    if (!root || !sel || !dimStart || !dimEnd || !ctx || !scale) return;
    const { plotArea } = ctx.layout;
    root.setAttribute('aria-valuetext', p.text);
    const disabled = p.total === 0;
    root.setAttribute('aria-disabled', String(disabled));
    root.tabIndex = disabled ? -1 : 0;
    const [lo, hi] = limits();
    root.setAttribute('aria-valuemin', String(lo));
    root.setAttribute('aria-valuemax', String(hi));
    if (!range) {
      root.removeAttribute('aria-valuenow');
      for (const el of [sel, dimStart, dimEnd]) el.style.display = 'none';
      return;
    }
    root.setAttribute('aria-valuenow', String(range[0]));
    const x0 = scale.toPixel(range[0]) - plotArea.x;
    const x1 = scale.toPixel(range[1]) - plotArea.x;
    Object.assign(sel.style, {
      display: 'block',
      left: `${x0}px`,
      width: `${Math.max(1, x1 - x0)}px`,
    });
    Object.assign(dimStart.style, { display: 'block', left: '0', width: `${Math.max(0, x0)}px` });
    Object.assign(dimEnd.style, {
      display: 'block',
      left: `${x1}px`,
      width: `${Math.max(0, plotArea.width - x1)}px`,
    });
  };

  const commit = (next: Domain | null, immediate: boolean): void => {
    const e = edges();
    range = next && e ? snapRange(next, e) : next;
    const p = payload();
    paint(p);
    ctx?.events.emit('brush', p);
    announce(p.text, immediate);
  };

  const valueAt = (clientX: number): number | null => {
    const scale = xScale();
    if (!root || !ctx || !scale) return null;
    const rect = root.getBoundingClientRect();
    const { plotArea } = ctx.layout;
    const px = Math.max(0, Math.min(plotArea.width, clientX - rect.left));
    const [lo, hi] = limits();
    return Math.max(lo, Math.min(hi, scale.toValue(plotArea.x + px)));
  };

  /** Teclado en píxeles: el paso mide lo mismo en escala lineal y log. */
  const keyStep = (): number => {
    const scale = xScale();
    const e = edges();
    if (scale && e && e.length > 1) {
      return Math.abs(scale.toPixel(e[1] as number) - scale.toPixel(e[0] as number));
    }
    return (ctx?.layout.plotArea.width ?? 400) / steps;
  };

  const onKey = (ev: KeyboardEvent): void => {
    const scale = xScale();
    if (!scale || !ctx || root?.getAttribute('aria-disabled') === 'true') return;
    const [lo, hi] = limits();
    const pxLimits: Domain = [scale.toPixel(lo), scale.toPixel(hi)];
    const step = keyStep();
    const toPx = (r: Domain): Domain => [scale.toPixel(r[0]), scale.toPixel(r[1])];
    const toVal = (r: Domain): Domain => [scale.toValue(r[0]), scale.toValue(r[1])];
    const current: Domain = range ? toPx(range) : [pxLimits[0], pxLimits[0] + step * 4];
    let next: Domain | null;
    const dir = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (dir !== 0 && ev.shiftKey) next = resizeRange(current, 'end', dir * step, pxLimits, step);
    else if (dir !== 0 && ev.altKey)
      next = resizeRange(current, 'start', dir * step, pxLimits, step);
    else if (dir !== 0) next = range ? moveRange(current, dir * step, pxLimits) : current;
    else if (ev.key === 'Home') next = moveRange(current, -Infinity, pxLimits);
    else if (ev.key === 'End') next = moveRange(current, Infinity, pxLimits);
    else if (ev.key === 'Escape') next = null;
    else return;
    ev.preventDefault();
    commit(next ? toVal(next) : null, true);
  };

  const onDown = (ev: PointerEvent): void => {
    if (!root || root.getAttribute('aria-disabled') === 'true') return;
    pointerFocus = true;
    const v = valueAt(ev.clientX);
    if (v === null) return;
    drag = v;
    root.setPointerCapture?.(ev.pointerId);
    range = [v, v];
    paint();
  };

  const onMove = (ev: PointerEvent): void => {
    if (drag === null) {
      // Sin arrastre, el cursor sigue sirviendo al tooltip del gráfico.
      if (!root || !ctx) return;
      const rect = ctx.renderer.element.getBoundingClientRect();
      ctx.hoverAt(ev.clientX - rect.left, ev.clientY - rect.top);
      return;
    }
    const v = valueAt(ev.clientX);
    if (v === null) return;
    commit([Math.min(drag, v), Math.max(drag, v)], false);
  };

  const onUp = (): void => {
    if (drag === null) return;
    drag = null;
    const scale = xScale();
    // Un clic sin arrastre (menos de 3 px) limpia la selección.
    const tiny =
      !range || !scale || Math.abs(scale.toPixel(range[1]) - scale.toPixel(range[0])) < 3;
    commit(tiny ? null : range, true);
  };

  const onFocus = (): void => {
    if (!root || !ctx) return;
    if (!pointerFocus) root.style.outline = `2px solid ${ctx.config.theme.text}`;
  };
  const onBlur = (): void => {
    pointerFocus = false;
    if (root) root.style.outline = 'none';
  };
  const onLeave = (): void => ctx?.clearHover();

  const box = (): HTMLDivElement => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      bottom: '0',
      display: 'none',
      pointerEvents: 'none',
    });
    return el;
  };

  return {
    id: 'brush',
    setRange(next) {
      commit(next, true);
    },
    getRange() {
      return range;
    },
    install(c) {
      ctx = c;
      const { theme } = c.config;
      root = document.createElement('div');
      root.className = 'xila-brush';
      root.setAttribute('role', 'slider');
      root.setAttribute('aria-label', options.label ?? 'Rango seleccionado');
      root.setAttribute('aria-orientation', 'horizontal');
      root.tabIndex = 0;
      Object.assign(root.style, {
        position: 'absolute',
        cursor: 'crosshair',
        touchAction: 'pan-y',
        outline: 'none',
        outlineOffset: '2px',
        userSelect: 'none',
      });
      dimStart = box();
      dimEnd = box();
      for (const d of [dimStart, dimEnd]) {
        d.style.background = theme.background;
        d.style.opacity = '0.7';
      }
      sel = box();
      Object.assign(sel.style, {
        borderLeft: `1px solid ${theme.text}`,
        borderRight: `1px solid ${theme.text}`,
        background: 'transparent',
      });
      root.append(dimStart, dimEnd, sel);
      live = document.createElement('div');
      live.className = 'xila-brush-live';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('role', 'status');
      Object.assign(live.style, HIDDEN);
      // Fuera del elemento del gráfico: si el plugin de accesibilidad lo marca como imagen
      // (`role="img"`), un control dentro quedaría oculto al lector de pantalla (K-03). El
      // elemento llena el contenedor, así que las coordenadas son las mismas.
      host = c.renderer.element.parentElement ?? c.renderer.element;
      if (host !== c.renderer.element && getComputedStyle(host).position === 'static') {
        host.style.position = 'relative';
        restorePosition = true;
      }
      host.append(root, live);
      root.addEventListener('pointerdown', onDown);
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerup', onUp);
      root.addEventListener('pointercancel', onUp);
      root.addEventListener('pointerleave', onLeave);
      root.addEventListener('keydown', onKey);
      root.addEventListener('focus', onFocus);
      root.addEventListener('blur', onBlur);
    },
    afterLayout(layout, c) {
      ctx = c;
      if (!root) return;
      const { plotArea } = layout;
      Object.assign(root.style, {
        left: `${plotArea.x}px`,
        top: `${plotArea.y}px`,
        width: `${plotArea.width}px`,
        height: `${plotArea.height}px`,
      });
      // Si aparecen o cambian las cubetas (modo apilado), la selección se reajusta a ellas.
      const e = edges();
      const key = e ? Array.from(e).join(',') : '';
      if (key !== lastEdges) {
        lastEdges = key;
        if (range) {
          commit(range, true);
          return;
        }
      }
      paint();
    },
    uninstall() {
      clearTimeout(liveTimer);
      root?.remove();
      live?.remove();
      if (host && restorePosition) host.style.position = '';
      host = null;
      restorePosition = false;
      root = sel = dimStart = dimEnd = live = null;
      ctx = null;
    },
  };
}

import type { ChartPlugin, PluginContext } from '../plugin';
import type { Domain } from '../scales/linear';
import { snapToEdges } from '../dots';
import { formatNumber } from '../format/number';

/** Lo que el plugin sabe de la selección actual, para formatear la lectura. */
export interface SelectionSummary {
  readonly range: Domain | null;
  readonly count: number;
  readonly total: number;
  readonly percent: number;
}

export interface SelectionOptions {
  /** Nombre de la unidad para la lectura: `['caso', 'casos']`. Por defecto `['dato', 'datos']`. */
  readonly unit?: readonly [string, string];
  /** Texto de la lectura; por defecto "312 casos (25.2 %) entre 8 y 15 min". */
  readonly format?: (summary: SelectionSummary, formatX: (v: number) => string) => string;
  /** Mostrar la línea de lectura encima del gráfico (`aria-live`). */
  readonly readout?: boolean;
  /** Ajustar la selección a los bordes de cubeta cuando el gráfico los tiene (`'auto'`). */
  readonly snap?: 'auto' | 'none';
  readonly keyboard?: boolean;
  readonly onChange?: (summary: SelectionSummary) => void;
}

/**
 * Selección que cuenta en vez de hacer zoom: arrastrar sobre el área marca un rango en X, los
 * datos fuera se atenúan y una línea de texto responde "cuántos y qué porcentaje". Con teclado:
 * ← → mueven la selección, Shift+← → la encogen o amplían por el borde derecho, Alt+← → por el
 * izquierdo, Inicio y Fin la llevan a los extremos, Escape la quita. Todo con tope en el rango
 * de los datos. En un gráfico de unidades en modo cubetas la selección salta a los bordes de
 * cubeta, así una columna nunca queda a medias.
 */
export function selectionPlugin(options: SelectionOptions = {}): ChartPlugin {
  const unit = options.unit ?? ['dato', 'datos'];
  const readoutOn = options.readout ?? true;
  const snap = options.snap ?? 'auto';
  const keyboard = options.keyboard ?? true;
  let ctx: PluginContext | null = null;
  let el: HTMLElement | null = null;
  let readout: HTMLDivElement | null = null;
  let layout: PluginContext['layout'] | null = null;
  let anchor: number | null = null;
  // Tras un cambio de datos el conteo guardado ya no vale; se recalcula en el siguiente dibujo.
  let stale = true;
  let touchAction = '';
  let tabindexWasOurs = false;

  const scaleX = () => {
    const s = ctx?.getScales()?.x;
    return s && s.kind !== 'band' ? s : null;
  };

  const dataDomain = (): Domain => {
    const d = ctx?.getDataDomain('x') ?? [0, 1];
    return [Math.min(d[0], d[1]), Math.max(d[0], d[1])];
  };

  const clamp = (range: Domain): Domain => {
    const [lo, hi] = dataDomain();
    const a = Math.max(lo, Math.min(hi, Math.min(range[0], range[1])));
    const b = Math.max(lo, Math.min(hi, Math.max(range[0], range[1])));
    return [a, b];
  };

  const apply = (range: Domain | null): void => {
    if (!ctx) return;
    let next = range ? clamp(range) : null;
    if (next && snap === 'auto') {
      const edges = ctx.getBinEdges();
      if (edges && edges.length > 1) next = snapToEdges(next, edges);
    }
    ctx.setSelection(next);
  };

  // El núcleo publica el conteo en el evento `selection`; se guarda aquí para la lectura.
  let last: { count: number; total: number } = { count: 0, total: 0 };

  const summary = (): SelectionSummary => {
    const range = ctx?.getSelection() ?? null;
    const count = range ? last.count : last.total;
    const total = last.total;
    return { range, count, total, percent: total ? (count / total) * 100 : 0 };
  };

  const formatX = (v: number): string => {
    const s = scaleX();
    const axis = ctx?.config.axes.x.format;
    if (axis) return axis(v);
    const step = s ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };

  const defaultFormat = (s: SelectionSummary): string => {
    const name = s.total === 1 ? unit[0] : unit[1];
    if (!s.range)
      return `Arrastra sobre la gráfica para contar un rango · ${formatNumber(s.total)} ${name} en total`;
    const n = s.count === 1 ? unit[0] : unit[1];
    return `${formatNumber(s.count)} ${n} (${s.percent.toFixed(1)} %) entre ${formatX(s.range[0])} y ${formatX(s.range[1])}`;
  };

  const render = (): void => {
    const s = summary();
    const text = (options.format ?? defaultFormat)(s, formatX);
    if (readout) readout.textContent = text;
    el?.setAttribute('aria-valuetext', text);
    options.onChange?.(s);
  };

  const local = (e: PointerEvent): number => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return e.clientX - r.left;
  };
  const insidePlot = (e: PointerEvent): boolean => {
    const a = layout?.plotArea;
    if (!a || !el) return false;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height;
  };
  const valueAt = (px: number): number | null => {
    const s = scaleX();
    return s ? s.toValue(px) : null;
  };

  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!insidePlot(e)) return;
    const v = valueAt(local(e));
    if (v === null) return;
    anchor = v;
    el?.setPointerCapture(e.pointerId);
    apply([v, v]);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent): void => {
    if (anchor === null) return;
    const v = valueAt(local(e));
    if (v === null) return;
    apply([anchor, v]);
  };
  const onUp = (): void => {
    if (anchor === null) return;
    anchor = null;
    const sel = ctx?.getSelection();
    const [lo, hi] = dataDomain();
    // Un clic sin arrastre (menos del 0.5 % del rango) quita la selección.
    if (sel && Math.abs(sel[1] - sel[0]) < (hi - lo) * 0.005) apply(null);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (!ctx) return;
    const [lo, hi] = dataDomain();
    const step = (hi - lo) / 40;
    let sel = ctx.getSelection();
    const edges = snap === 'auto' ? ctx.getBinEdges() : null;
    const binStep = edges && edges.length > 1 ? (edges[1] as number) - (edges[0] as number) : step;
    const delta = edges ? binStep : step;
    if (e.key === 'Escape') {
      if (sel) apply(null);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    if (!sel) sel = [lo, lo + (hi - lo) / 4];
    let [a, b] = sel;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (e.key === 'Home') {
      const w = b - a;
      a = lo;
      b = lo + w;
    } else if (e.key === 'End') {
      const w = b - a;
      b = hi;
      a = hi - w;
    } else if (e.shiftKey) {
      b = Math.max(a + delta, Math.min(hi, b + dir * delta));
    } else if (e.altKey) {
      a = Math.min(b - delta, Math.max(lo, a + dir * delta));
    } else {
      const w = b - a;
      a = Math.max(lo, Math.min(hi - w, a + dir * delta));
      b = a + w;
    }
    e.preventDefault();
    apply([a, b]);
  };

  return {
    id: 'selection',
    install(c) {
      ctx = c;
      el = c.renderer.element;
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      touchAction = el.style.touchAction;
      el.style.touchAction = 'none';
      if (keyboard) {
        if (!el.hasAttribute('tabindex')) {
          el.setAttribute('tabindex', '0');
          tabindexWasOurs = true;
        }
        el.addEventListener('keydown', onKey);
      }
      if (readoutOn) {
        readout = document.createElement('div');
        readout.className = 'xila-readout';
        readout.setAttribute('role', 'status');
        readout.setAttribute('aria-live', 'polite');
        const { theme } = c.config;
        Object.assign(readout.style, {
          position: 'absolute',
          left: '0',
          right: '0',
          top: '0',
          height: '20px',
          lineHeight: '20px',
          font: `${theme.fontSize + 1}px ${theme.fontFamily}`,
          color: theme.axis,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          pointerEvents: 'none',
        });
        if (!el.style.position) el.style.position = 'relative';
        el.appendChild(readout);
      }
    },
    reserveSpace() {
      return readoutOn ? { top: 24 } : undefined;
    },
    afterLayout(l, c) {
      // El contexto de `install` trae el layout de ese momento; aquí llega el vigente.
      layout = l;
      ctx = c;
    },
    afterDraw(c) {
      ctx = c;
      const sel = c.getSelection();
      const s = scaleX();
      const area = c.layout.plotArea;
      if (sel && s) {
        const x0 = s.toPixel(sel[0]);
        const x1 = s.toPixel(sel[1]);
        c.renderer.drawRect('data', Math.min(x0, x1), area.y, Math.abs(x1 - x0), area.height, {
          fill: c.config.theme.text,
          opacity: 0.06,
          stroke: c.config.theme.text,
          strokeWidth: 1,
        });
      }
    },
    onEvent(name, payload) {
      if (name === 'selection') {
        const p = payload as { count: number; total: number };
        last = { count: p.count, total: p.total };
        stale = false;
        render();
      } else if (name === 'draw' && stale && ctx) {
        // Primer dibujo, o el primero tras cambiar los datos: se recuenta con lo que hay.
        const sel = ctx.getSelection();
        const c = ctx.countSelection(sel);
        last = { count: sel ? c.count : c.total, total: c.total };
        stale = false;
        render();
      } else if (name === 'dataChanged' && ctx) {
        // Los datos (o el modo) cambiaron: la selección se vuelve a acotar y se recuenta.
        stale = true;
        const sel = ctx.getSelection();
        if (sel) apply(sel);
      }
    },
    uninstall() {
      if (el) {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        el.removeEventListener('keydown', onKey);
        el.style.touchAction = touchAction;
        if (tabindexWasOurs) el.removeAttribute('tabindex');
      }
      readout?.remove();
      readout = null;
      el = null;
      ctx = null;
    },
  };
}

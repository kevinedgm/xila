import type { ChartPlugin, PluginContext } from '../plugin';
import type { ContinuousScale, Domain } from '../scales/linear';

export interface ZoomPanOptions {
  /** Ejes que responden al zoom y al pan. Por defecto solo X (series de tiempo). */
  readonly axis?: 'x' | 'y' | 'xy';
  /** Con esta tecla apretada la rueda hace zoom en X e Y a la vez (si `axis` es `'x'`). */
  readonly modifier?: 'shift' | 'ctrl' | 'alt';
  readonly wheel?: boolean;
  readonly drag?: boolean;
  readonly pinch?: boolean;
  /** `data`: no se puede salir del rango de los datos. `none`: libre. */
  readonly limits?: 'data' | 'none';
  /** Zoom máximo, como fracción del rango de datos (1e-6 = un millón de aumentos). */
  readonly minSpanRatio?: number;
  /** Doble clic vuelve al rango automático. */
  readonly doubleClickReset?: boolean;
  /** Arrastrar con la tecla `modifier` apretada selecciona un rango y hace zoom a él. */
  readonly select?: boolean;
  /** Sensibilidad de la rueda: factor por cada 100 px de desplazamiento. */
  readonly wheelFactor?: number;
}

/**
 * Zoom centrado en el cursor: el valor bajo el cursor se queda quieto. Si el cursor
 * apunta al valor `v` y el factor es `k`, el nuevo dominio es `[v − (v − min)/k, v + (max − v)/k]`.
 */
export function zoomDomain(domain: Domain, anchor: number, k: number): Domain {
  const [min, max] = domain;
  return [anchor - (anchor - min) / k, anchor + (max - anchor) / k];
}

/** Desplaza el dominio sin cambiar su tamaño. */
export function panDomain(domain: Domain, delta: number): Domain {
  return [domain[0] + delta, domain[1] + delta];
}

/**
 * Mantiene el dominio dentro de los datos y por encima del tamaño mínimo. Si el dominio es
 * más grande que los datos se devuelve el de los datos (no hay nada que ver fuera).
 */
export function clampDomain(domain: Domain, data: Domain, minSpan: number): Domain {
  const lo = Math.min(data[0], data[1]);
  const hi = Math.max(data[0], data[1]);
  let [a, b] = domain;
  if (b - a < minSpan) {
    const mid = (a + b) / 2;
    a = mid - minSpan / 2;
    b = mid + minSpan / 2;
  }
  if (b - a >= hi - lo) return [lo, hi];
  if (a < lo) return [lo, lo + (b - a)];
  if (b > hi) return [hi - (b - a), hi];
  return [a, b];
}

export function zoomPanPlugin(options: ZoomPanOptions = {}): ChartPlugin {
  const axis = options.axis ?? 'x';
  const modifier = options.modifier ?? 'shift';
  const limits = options.limits ?? 'data';
  const minSpanRatio = options.minSpanRatio ?? 1e-6;
  const wheelFactor = options.wheelFactor ?? 2;
  let el: HTMLElement | null = null;
  let ctx: PluginContext | null = null;
  let touchAction = '';
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = false;
  /** Selección en curso (zoom por rectángulo): origen en píxeles y el recuadro HTML. */
  let selection: { start: { x: number; y: number }; box: HTMLDivElement } | null = null;
  let pinchStart: { distance: number; mid: number; x: Domain; y: Domain } | null = null;

  const continuous = (which: 'x' | 'y'): ContinuousScale | null => {
    const scales = ctx?.getScales();
    if (!scales) return null;
    const s = scales[which];
    return s.kind === 'band' ? null : s;
  };

  /**
   * Dominio vigente del eje: el pedido por el último zoom/pan aunque aún no se haya
   * dibujado. Varios eventos de rueda en un mismo fotograma deben encadenarse, no partir
   * todos de la escala vieja, o el valor bajo el cursor se desplaza.
   */
  const current = (which: 'x' | 'y', s: ContinuousScale): Domain =>
    ctx?.getViewDomain(which) ?? s.domain;

  const valueAt = (which: 'x' | 'y', s: ContinuousScale, px: number): number => {
    const d = current(which, s);
    return d[0] + ((px - s.range[0]) / (s.range[1] - s.range[0])) * (d[1] - d[0]);
  };

  const apply = (which: 'x' | 'y', next: Domain): void => {
    if (!ctx) return;
    const data = ctx.getDataDomain(which);
    const span = Math.abs(data[1] - data[0]) || 1;
    const clamped = limits === 'data' ? clampDomain(next, data, span * minSpanRatio) : next;
    // Si ya vemos todos los datos, mejor volver al automático (con ticks "bonitos").
    const covers =
      clamped[0] <= Math.min(data[0], data[1]) && clamped[1] >= Math.max(data[0], data[1]);
    ctx.setViewDomain(which, limits === 'data' && covers ? null : clamped);
  };

  const axesFor = (modified: boolean): ('x' | 'y')[] => {
    if (axis === 'xy' || (axis === 'x' && modified)) return ['x', 'y'];
    return [axis];
  };

  const local = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const insidePlot = (p: { x: number; y: number }): boolean => {
    const a = ctx?.layout.plotArea;
    return !!a && p.x >= a.x && p.x <= a.x + a.width && p.y >= a.y && p.y <= a.y + a.height;
  };

  const isModified = (e: {
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
  }) =>
    modifier === 'shift' ? e.shiftKey : modifier === 'ctrl' ? e.ctrlKey || e.metaKey : e.altKey;

  const onWheel = (e: WheelEvent): void => {
    const p = local(e);
    if (!insidePlot(p)) return;
    e.preventDefault();
    const modified = isModified(e);
    // deltaMode 1 = líneas (Firefox); se normaliza a píxeles.
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const k = Math.pow(wheelFactor, -delta / 100);
    for (const which of axesFor(modified)) {
      const s = continuous(which);
      if (!s) continue;
      const anchor = valueAt(which, s, which === 'x' ? p.x : p.y);
      apply(which, zoomDomain(current(which, s), anchor, k));
    }
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !el) return;
    const p = local(e);
    if (!insidePlot(p)) return;
    el.setPointerCapture(e.pointerId);
    dragged = false;
    if (options.select !== false && isModified(e) && pointers.size === 0 && ctx) {
      const box = document.createElement('div');
      box.className = 'xila-zoom-selection';
      Object.assign(box.style, {
        position: 'absolute',
        pointerEvents: 'none',
        border: `1px dashed ${ctx.config.theme.axis}`,
        background: ctx.config.theme.axis,
        opacity: '0.25',
      });
      el.appendChild(box);
      selection = { start: p, box };
      updateSelection(p);
      return;
    }
    pointers.set(e.pointerId, p);
    if (pointers.size === 2 && options.pinch !== false) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const sx = continuous('x');
      const sy = continuous('y');
      if (sx && sy) {
        pinchStart = {
          distance: Math.hypot(b.x - a.x, b.y - a.y),
          mid: (a.x + b.x) / 2,
          x: sx.domain,
          y: sy.domain,
        };
      }
    }
  };

  /** Recuadro de selección: en `axis: 'x'` ocupa todo el alto del área (y viceversa). */
  const updateSelection = (p: { x: number; y: number }): void => {
    const a = ctx?.layout.plotArea;
    if (!selection || !a) return;
    const axes = axesFor(false);
    const x0 = axes.includes('x') ? Math.min(selection.start.x, p.x) : a.x;
    const x1 = axes.includes('x') ? Math.max(selection.start.x, p.x) : a.x + a.width;
    const y0 = axes.includes('y') ? Math.min(selection.start.y, p.y) : a.y;
    const y1 = axes.includes('y') ? Math.max(selection.start.y, p.y) : a.y + a.height;
    Object.assign(selection.box.style, {
      left: `${x0}px`,
      top: `${y0}px`,
      width: `${x1 - x0}px`,
      height: `${y1 - y0}px`,
    });
  };

  const finishSelection = (p: { x: number; y: number }): void => {
    if (!selection) return;
    const { start, box } = selection;
    box.remove();
    selection = null;
    for (const which of axesFor(false)) {
      const s = continuous(which);
      if (!s) continue;
      const [a, b] = which === 'x' ? [start.x, p.x] : [start.y, p.y];
      // Un clic con la tecla apretada no cuenta como selección.
      if (Math.abs(b - a) < 4) continue;
      const v0 = valueAt(which, s, a);
      const v1 = valueAt(which, s, b);
      apply(which, [Math.min(v0, v1), Math.max(v0, v1)]);
    }
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (selection) {
      updateSelection(local(e));
      dragged = true;
      return;
    }
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const sx = continuous('x');
      if (!sx || distance === 0) return;
      const k = distance / pinchStart.distance;
      const anchor =
        pinchStart.x[0] +
        ((pinchStart.mid - sx.range[0]) / (sx.range[1] - sx.range[0])) *
          (pinchStart.x[1] - pinchStart.x[0]);
      const mid = (a.x + b.x) / 2;
      const zoomed = zoomDomain(pinchStart.x, anchor, k);
      // Además de abrir/cerrar, los dos dedos pueden arrastrar.
      const perPx = (zoomed[1] - zoomed[0]) / (sx.range[1] - sx.range[0]);
      apply('x', panDomain(zoomed, -(mid - pinchStart.mid) * perPx));
      dragged = true;
      return;
    }
    if (pointers.size !== 1 || options.drag === false) return;
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 0) dragged = true;
    for (const which of axesFor(false)) {
      const s = continuous(which);
      if (!s) continue;
      const px = which === 'x' ? dx : dy;
      const d = current(which, s);
      const perPx = (d[1] - d[0]) / (s.range[1] - s.range[0]);
      apply(which, panDomain(d, -px * perPx));
    }
    if (el) el.style.cursor = 'grabbing';
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (selection) finishSelection(local(e));
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0 && el) el.style.cursor = '';
  };

  /** Un arrastre no debe contar como clic sobre un dato. */
  const onClickCapture = (e: MouseEvent): void => {
    if (dragged) {
      e.stopImmediatePropagation();
      dragged = false;
    }
  };

  const onDoubleClick = (): void => {
    ctx?.setViewDomain('x', null);
    ctx?.setViewDomain('y', null);
  };

  return {
    id: 'zoomPan',
    install(context) {
      ctx = context;
      el = context.renderer.element;
      touchAction = el.style.touchAction;
      el.style.touchAction = 'none';
      if (options.wheel !== false) el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
      el.addEventListener('click', onClickCapture, true);
      if (options.doubleClickReset !== false) el.addEventListener('dblclick', onDoubleClick);
    },
    afterLayout(_layout, context) {
      ctx = context;
    },
    uninstall() {
      if (!el) return;
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('click', onClickCapture, true);
      el.removeEventListener('dblclick', onDoubleClick);
      el.style.touchAction = touchAction;
      selection?.box.remove();
      selection = null;
      el = null;
      ctx = null;
    },
  };
}

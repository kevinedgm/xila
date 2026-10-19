import type { ChartPlugin, PluginContext, Rect } from '../plugin';
import type { ChartScales } from '../chart';
import type { HoverPayload } from '../events';
import type { LineStyle, TextStyle } from '../renderer';

/** Un valor de datos: número, fecha (eje de tiempo) o categoría (eje de barras). */
export type AnnotationValue = number | Date | string;

/** Dónde va la etiqueta a lo largo de la línea o banda: al inicio (arriba/izquierda) o al final. */
export type LabelPosition = 'start' | 'end';

interface AnnotationBase {
  readonly id?: string;
  readonly label?: string;
  /** Detalle que aparece al pasar el cursor por la anotación. */
  readonly description?: string;
  /** Color del trazo o relleno; por defecto el del texto del tema. */
  readonly color?: string;
  readonly opacity?: number;
  readonly labelPosition?: LabelPosition;
}

/** Línea vertical (`axis: 'x'`) u horizontal (`axis: 'y'`) en un valor. */
export interface LineAnnotation extends AnnotationBase {
  readonly type: 'line';
  readonly axis: 'x' | 'y';
  readonly value: AnnotationValue;
  readonly width?: number;
  readonly dash?: readonly number[];
}

/** Banda entre dos valores; `from` o `to` ausentes llegan hasta el borde del área. */
export interface BandAnnotation extends AnnotationBase {
  readonly type: 'band';
  readonly axis: 'x' | 'y';
  readonly from?: AnnotationValue;
  readonly to?: AnnotationValue;
}

/** Texto anclado a un punto de datos. */
export interface TextAnnotation extends AnnotationBase {
  readonly type: 'text';
  readonly x: AnnotationValue;
  readonly y: AnnotationValue;
  readonly text: string;
  readonly align?: 'left' | 'center' | 'right';
  /** Desplazamiento en píxeles respecto al punto, para no tapar el dato. */
  readonly offset?: readonly [number, number];
}

export type Annotation = LineAnnotation | BandAnnotation | TextAnnotation;

export interface AnnotationsOptions {
  /** Mostrar `label` y `description` al pasar el cursor por la anotación. */
  readonly hover?: boolean;
  /** Distancia en píxeles para que una línea o un texto cuenten como "bajo el cursor". */
  readonly hitDistance?: number;
}

export interface AnnotationsPlugin extends ChartPlugin {
  /** Reemplaza las anotaciones y redibuja. */
  set(items: readonly Annotation[]): void;
  get(): readonly Annotation[];
}

/**
 * Convierte un valor de datos a píxel con la escala actual. En un eje de barras una cadena
 * se busca entre las categorías y un número se toma como índice de banda.
 */
export function annotationPixel(
  value: AnnotationValue,
  axis: 'x' | 'y',
  scales: ChartScales,
  categories: readonly string[],
): number | null {
  const s = axis === 'x' ? scales.x : scales.y;
  if (s.kind === 'band') {
    const index = typeof value === 'string' ? categories.indexOf(value) : Number(value);
    if (index < 0 || index >= s.count || !Number.isFinite(index)) return null;
    return s.center(index);
  }
  const v = value instanceof Date ? value.getTime() : typeof value === 'string' ? NaN : value;
  return Number.isFinite(v) ? s.toPixel(v) : null;
}

/** Geometría de una anotación en píxeles, ya recortada al área de dibujo. */
export interface AnnotationBox {
  readonly annotation: Annotation;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * Píxeles que ocupa cada anotación (una línea tiene grosor 0; el texto, su punto de anclaje).
 * Las que caen fuera de la escala (valor inválido, categoría inexistente) se omiten.
 */
export function annotationBoxes(
  items: readonly Annotation[],
  scales: ChartScales,
  area: Rect,
  categories: readonly string[],
  flip = false,
): AnnotationBox[] {
  // `axis` es lógico (x = categoría o variable independiente). Con barras horizontales el eje
  // lógico x se dibuja en vertical y el y en horizontal: la geometría usa el eje físico.
  const physical = (axis: 'x' | 'y'): 'x' | 'y' => (flip ? (axis === 'x' ? 'y' : 'x') : axis);
  const out: AnnotationBox[] = [];
  const px = (v: AnnotationValue, axis: 'x' | 'y'): number | null =>
    annotationPixel(v, axis, scales, categories);
  for (const a of items) {
    if (a.type === 'line') {
      const p = px(a.value, a.axis);
      if (p === null) continue;
      out.push(
        physical(a.axis) === 'x'
          ? { annotation: a, x0: p, x1: p, y0: area.y, y1: area.y + area.height }
          : { annotation: a, x0: area.x, x1: area.x + area.width, y0: p, y1: p },
      );
    } else if (a.type === 'band') {
      const horizontal = physical(a.axis) === 'x';
      // Borde que corresponde al valor más bajo y al más alto: en Y el eje crece hacia arriba.
      const lo = horizontal ? area.x : area.y + area.height;
      const hi = horizontal ? area.x + area.width : area.y;
      const from = a.from === undefined ? lo : px(a.from, a.axis);
      const to = a.to === undefined ? hi : px(a.to, a.axis);
      if (from === null || to === null) continue;
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      out.push(
        horizontal
          ? { annotation: a, x0: start, x1: end, y0: area.y, y1: area.y + area.height }
          : { annotation: a, x0: area.x, x1: area.x + area.width, y0: start, y1: end },
      );
    } else {
      const u = px(a.x, 'x');
      const v = px(a.y, 'y');
      if (u === null || v === null) continue;
      const [x, y] = flip ? [v, u] : [u, v];
      out.push({ annotation: a, x0: x, x1: x, y0: y, y1: y });
    }
  }
  return out;
}

/** La anotación bajo el píxel `(px, py)`: la última dibujada gana (está encima). */
export function annotationAt(
  boxes: readonly AnnotationBox[],
  px: number,
  py: number,
  distance = 4,
): Annotation | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i] as AnnotationBox;
    const inX = b.x0 - distance <= px && px <= b.x1 + distance;
    const inY = b.y0 - distance <= py && py <= b.y1 + distance;
    if (inX && inY) return b.annotation;
  }
  return null;
}

const PAD = 4;

/**
 * Las anotaciones guardan su posición en valores de datos, no en píxeles: en cada dibujo se
 * convierten con la escala vigente, así siguen al zoom y al cambio de tamaño sin más código.
 * Se pintan en la capa `data`, recortadas al área de dibujo, después de las series. Las
 * etiquetas se colocan hacia dentro cuando no caben del lado natural, y al pasar el cursor
 * por una anotación aparece su `label` y `description`.
 */
export function annotationsPlugin(
  initial: readonly Annotation[] = [],
  options: AnnotationsOptions = {},
): AnnotationsPlugin {
  let items: readonly Annotation[] = initial;
  let ctx: PluginContext | null = null;
  let boxes: AnnotationBox[] = [];
  let tip: HTMLDivElement | null = null;
  let off: (() => void) | null = null;
  const hitDistance = options.hitDistance ?? 4;

  const categoriesOf = (c: PluginContext): readonly string[] => {
    const spec = c.config.series[0];
    if (!spec) return [];
    const column = c.config.data.column(spec.x);
    return column.kind === 'category' ? column.categories : [];
  };

  /**
   * Etiqueta pegada a una línea vertical en `x`: a la derecha de la línea salvo que no quepa,
   * entonces a la izquierda. `labelPosition` decide arriba (`start`) o abajo (`end`).
   */
  const labelByVertical = (
    c: PluginContext,
    text: string,
    x: number,
    style: TextStyle,
    position: LabelPosition,
  ): void => {
    const area = c.layout.plotArea;
    const w = c.renderer.measureText(text, style);
    const fits = x + PAD + w <= area.x + area.width;
    const tx = fits ? x + PAD : x - PAD;
    const ty = position === 'end' ? area.y + area.height - PAD : area.y + PAD;
    c.renderer.drawText('data', text, tx, ty, {
      ...style,
      align: fits ? 'left' : 'right',
      baseline: position === 'end' ? 'bottom' : 'top',
    });
  };

  /** Etiqueta sobre una línea horizontal en `y`: encima salvo que no quepa, entonces debajo. */
  const labelByHorizontal = (
    c: PluginContext,
    text: string,
    y: number,
    style: TextStyle,
    position: LabelPosition,
  ): void => {
    const area = c.layout.plotArea;
    const fits = y - PAD - c.config.theme.fontSize >= area.y;
    const ty = fits ? y - PAD : y + PAD;
    const tx = position === 'start' ? area.x + PAD : area.x + area.width - PAD;
    c.renderer.drawText('data', text, tx, ty, {
      ...style,
      align: position === 'start' ? 'left' : 'right',
      baseline: fits ? 'bottom' : 'top',
    });
  };

  const draw = (c: PluginContext): void => {
    const scales = c.getScales();
    if (!scales) return;
    const { renderer, layout, config } = c;
    const area = layout.plotArea;
    const font = `${config.theme.fontSize}px ${config.theme.fontFamily}`;
    boxes = annotationBoxes(
      items,
      scales,
      area,
      categoriesOf(c),
      c.config.type === 'bar' && c.config.bar.orientation === 'horizontal',
    );

    for (const b of boxes) {
      const a = b.annotation;
      const color = a.color ?? config.theme.text;
      const text: TextStyle = { font, fill: color };
      const position = a.labelPosition ?? 'start';
      if (a.type === 'line') {
        const style: LineStyle = {
          stroke: color,
          width: a.width ?? 1,
          opacity: a.opacity ?? 0.8,
          ...(a.dash ? { dash: a.dash } : {}),
        };
        renderer.drawRule('data', b.x0, b.y0, b.x1, b.y1, style);
        if (a.label) {
          if (a.axis === 'x') labelByVertical(c, a.label, b.x0, text, position);
          else labelByHorizontal(c, a.label, b.y0, text, position);
        }
      } else if (a.type === 'band') {
        renderer.drawRect('data', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, {
          fill: color,
          opacity: a.opacity ?? 0.12,
        });
        if (a.label) {
          // La etiqueta va en la esquina de la banda que queda dentro del área.
          const x = Math.max(b.x0, area.x) + PAD;
          const y =
            position === 'end'
              ? Math.min(b.y1, area.y + area.height) - PAD
              : Math.max(b.y0, area.y) + PAD;
          renderer.drawText('data', a.label, x, y, {
            ...text,
            baseline: position === 'end' ? 'bottom' : 'top',
          });
        }
      } else {
        const [dx, dy] = a.offset ?? [0, -8];
        const w = renderer.measureText(a.text, text);
        let align = a.align ?? 'center';
        // Un texto que se saldría por un lado se alinea hacia dentro.
        if (align === 'center' && b.x0 + dx + w / 2 > area.x + area.width) align = 'right';
        else if (align === 'center' && b.x0 + dx - w / 2 < area.x) align = 'left';
        // Y si no cabe arriba del punto, va debajo.
        const above = b.y0 + dy >= area.y + config.theme.fontSize;
        renderer.drawText('data', a.text, b.x0 + dx, above ? b.y0 + dy : b.y0 - dy, {
          ...text,
          align,
          baseline: above ? 'bottom' : 'top',
        });
      }
    }
  };

  const showTip = (a: Annotation | null, px: number, py: number): void => {
    if (!tip || !ctx) return;
    const title = a?.type === 'text' ? a.text : a?.label;
    if (!a || (!title && !a.description)) {
      tip.style.display = 'none';
      return;
    }
    tip.innerHTML = '';
    if (title) {
      const strong = document.createElement('strong');
      strong.textContent = title;
      tip.appendChild(strong);
    }
    if (a.description) {
      const p = document.createElement('div');
      p.textContent = a.description;
      tip.appendChild(p);
    }
    tip.style.display = 'block';
    const { width, height } = ctx.layout;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const gap = 12;
    const left = px + gap + w > width ? px - gap - w : px + gap;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.min(Math.max(0, py + gap), Math.max(0, height - h))}px`;
  };

  const onHover = (payload: HoverPayload | null): void => {
    if (!payload) return showTip(null, 0, 0);
    showTip(annotationAt(boxes, payload.px, payload.py, hitDistance), payload.px, payload.py);
  };

  return {
    id: 'annotations',
    install(c) {
      ctx = c;
      if (options.hover !== false) {
        tip = document.createElement('div');
        tip.className = 'xila-annotation-tip';
        tip.setAttribute('role', 'status');
        const { theme } = c.config;
        Object.assign(tip.style, {
          position: 'absolute',
          display: 'none',
          pointerEvents: 'none',
          maxWidth: '260px',
          padding: '6px 8px',
          borderRadius: '4px',
          font: `${theme.fontSize}px ${theme.fontFamily}`,
          color: theme.text,
          background: theme.background,
          border: `1px solid ${theme.grid}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          zIndex: '2',
        });
        c.renderer.element.appendChild(tip);
        off = c.events.on('hover', onHover);
      }
    },
    afterLayout(_layout, c) {
      ctx = c;
    },
    afterDraw(c) {
      ctx = c;
      draw(c);
    },
    uninstall() {
      off?.();
      tip?.remove();
      tip = null;
      ctx = null;
      boxes = [];
    },
    set(next) {
      items = next;
      ctx?.requestDraw();
    },
    get: () => items,
  };
}

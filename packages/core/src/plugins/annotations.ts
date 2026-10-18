import type { ChartPlugin, PluginContext } from '../plugin';
import type { ChartScales } from '../chart';
import type { LineStyle } from '../renderer';

/** Un valor de datos: número, fecha (eje de tiempo) o categoría (eje de barras). */
export type AnnotationValue = number | Date | string;

interface AnnotationBase {
  readonly id?: string;
  readonly label?: string;
  /** Color del trazo o relleno; por defecto el del texto del tema. */
  readonly color?: string;
  readonly opacity?: number;
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

/**
 * Las anotaciones guardan su posición en valores de datos, no en píxeles: en cada dibujo se
 * convierten con la escala vigente, así siguen al zoom y al cambio de tamaño sin más código.
 * Se pintan en la capa `data`, recortadas al área de dibujo, después de las series.
 */
export function annotationsPlugin(initial: readonly Annotation[] = []): AnnotationsPlugin {
  let items: readonly Annotation[] = initial;
  let ctx: PluginContext | null = null;

  const categoriesOf = (c: PluginContext): readonly string[] => {
    const spec = c.config.series[0];
    if (!spec) return [];
    const column = c.config.data.column(spec.x);
    return column.kind === 'category' ? column.categories : [];
  };

  const draw = (c: PluginContext): void => {
    const scales = c.getScales();
    if (!scales) return;
    const { renderer, layout, config } = c;
    const area = layout.plotArea;
    const categories = categoriesOf(c);
    const font = `${config.theme.fontSize}px ${config.theme.fontFamily}`;
    const px = (v: AnnotationValue, axis: 'x' | 'y'): number | null =>
      annotationPixel(v, axis, scales, categories);

    for (const a of items) {
      const color = a.color ?? config.theme.text;
      if (a.type === 'line') {
        const p = px(a.value, a.axis);
        if (p === null) continue;
        const style: LineStyle = {
          stroke: color,
          width: a.width ?? 1,
          opacity: a.opacity ?? 0.8,
          ...(a.dash ? { dash: a.dash } : {}),
        };
        if (a.axis === 'x') {
          renderer.drawRule('data', p, area.y, p, area.y + area.height, style);
          if (a.label)
            renderer.drawText('data', a.label, p + 4, area.y + 4, {
              font,
              fill: color,
              baseline: 'top',
            });
        } else {
          renderer.drawRule('data', area.x, p, area.x + area.width, p, style);
          if (a.label)
            renderer.drawText('data', a.label, area.x + area.width - 4, p - 4, {
              font,
              fill: color,
              align: 'right',
              baseline: 'bottom',
            });
        }
      } else if (a.type === 'band') {
        const horizontal = a.axis === 'x';
        // Borde que corresponde al valor más bajo y al más alto: en Y el eje crece hacia arriba.
        const lo = horizontal ? area.x : area.y + area.height;
        const hi = horizontal ? area.x + area.width : area.y;
        const from = a.from === undefined ? lo : px(a.from, a.axis);
        const to = a.to === undefined ? hi : px(a.to, a.axis);
        if (from === null || to === null) continue;
        const start = Math.min(from, to);
        const size = Math.abs(to - from);
        const style = { fill: color, opacity: a.opacity ?? 0.12 };
        if (horizontal) renderer.drawRect('data', start, area.y, size, area.height, style);
        else renderer.drawRect('data', area.x, start, area.width, size, style);
        if (a.label) {
          const text = { font, fill: color, baseline: 'top' as const };
          if (horizontal) renderer.drawText('data', a.label, start + 4, area.y + 4, text);
          else renderer.drawText('data', a.label, area.x + 4, start + 4, text);
        }
      } else {
        const x = px(a.x, 'x');
        const y = px(a.y, 'y');
        if (x === null || y === null) continue;
        const [dx, dy] = a.offset ?? [0, -8];
        renderer.drawText('data', a.text, x + dx, y + dy, {
          font,
          fill: color,
          align: a.align ?? 'center',
          baseline: 'bottom',
        });
      }
    }
  };

  return {
    id: 'annotations',
    install(c) {
      ctx = c;
    },
    afterDraw(c) {
      ctx = c;
      draw(c);
    },
    uninstall() {
      ctx = null;
    },
    set(next) {
      items = next;
      ctx?.requestDraw();
    },
    get: () => items,
  };
}

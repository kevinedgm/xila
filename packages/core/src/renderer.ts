/**
 * Contrato que implementan los backends (Canvas ahora; WebGL y SVG después).
 *
 * Las series llegan como lotes: buffers completos más un rango `[from, to)` y una
 * transformación lineal. Ninguna función del contrato se llama una vez por punto. Así
 * WebGL puede subir el buffer y dibujar todo en una llamada, y Canvas recorre el rango en
 * un solo path. Ver docs/adr/0002-renderer-por-lotes-y-decimacion.md.
 *
 * Las primitivas sueltas (`drawRule`, `drawRect`, `drawText`) existen solo para ejes,
 * grid, leyendas y anotaciones, y trabajan en píxeles CSS.
 */

/** `px = base + (value - offset) * scale`. Para el eje Y, `scale` es negativo. */
export interface LinearMap {
  readonly offset: number;
  readonly scale: number;
  readonly base: number;
}

export interface Transform {
  readonly x: LinearMap;
  readonly y: LinearMap;
}

export function applyMap(map: LinearMap, value: number): number {
  return map.base + (value - map.offset) * map.scale;
}

export interface LineStyle {
  readonly stroke: string;
  readonly width: number;
  readonly dash?: readonly number[];
  readonly opacity?: number;
}

export interface PointStyle {
  readonly fill: string;
  readonly radius: number;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}

export interface RectStyle {
  readonly fill: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}

export interface TextStyle {
  readonly font: string;
  readonly fill: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic';
  /** Rotación en grados, en sentido horario. */
  readonly rotate?: number;
}

/**
 * Capas separadas para no redibujar los datos cuando solo cambia el cursor o el tooltip.
 * Se pintan en este orden: `background`, `data`, `overlay`.
 */
export type Layer = 'background' | 'data' | 'overlay';

export interface Renderer {
  /** Elemento raíz del gráfico, donde los plugins cuelgan su HTML (tooltip, leyenda). */
  readonly element: HTMLElement;
  /** `dpr` es `devicePixelRatio`: el backend escala su superficie interna para verse nítido. */
  resize(width: number, height: number, dpr: number): void;
  clear(layer: Layer): void;

  /** Limita el dibujo al rectángulo (en píxeles CSS) hasta el `clear` siguiente de esa capa. */
  clip(layer: Layer, x: number, y: number, width: number, height: number): void;

  /** Línea que une los puntos `[from, to)`. Un `NaN` en `y` corta la línea. */
  drawLineSeries(
    layer: Layer,
    x: Float64Array,
    y: Float64Array,
    from: number,
    to: number,
    style: LineStyle,
    transform: Transform,
  ): void;

  /** Un marcador por punto; `radii` opcional da el radio de cada uno. */
  drawPointSeries(
    layer: Layer,
    x: Float64Array,
    y: Float64Array,
    from: number,
    to: number,
    style: PointStyle,
    transform: Transform,
    radii?: Float64Array,
  ): void;

  /** Rectángulos en unidades de datos: de `(x0, y0)` a `(x1, y1)` para cada índice. */
  drawBars(
    layer: Layer,
    x0: Float64Array,
    x1: Float64Array,
    y0: Float64Array,
    y1: Float64Array,
    from: number,
    to: number,
    style: RectStyle,
    transform: Transform,
  ): void;

  /** Banda sombreada entre `low` y `high` (intervalo de confianza). Un `NaN` la corta. */
  drawBand(
    layer: Layer,
    x: Float64Array,
    low: Float64Array,
    high: Float64Array,
    from: number,
    to: number,
    style: RectStyle,
    transform: Transform,
  ): void;

  /** Barra vertical de `low` a `high` por punto, con remates horizontales de `cap` px. */
  drawErrorBars(
    layer: Layer,
    x: Float64Array,
    low: Float64Array,
    high: Float64Array,
    from: number,
    to: number,
    style: LineStyle,
    transform: Transform,
    cap?: number,
  ): void;

  drawRule(layer: Layer, x1: number, y1: number, x2: number, y2: number, style: LineStyle): void;
  drawRect(
    layer: Layer,
    x: number,
    y: number,
    width: number,
    height: number,
    style: RectStyle,
  ): void;
  drawText(layer: Layer, text: string, x: number, y: number, style: TextStyle): void;
  /** Ancho del texto en píxeles CSS, para calcular márgenes y evitar solapes. */
  measureText(text: string, style: TextStyle): number;

  /** Imagen compuesta de todas las capas sobre fondo sólido. */
  toDataURL(type?: string): string;
  destroy(): void;
}

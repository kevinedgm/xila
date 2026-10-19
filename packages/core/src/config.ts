import type { DataTable } from './data/table';
import type { SeriesSpec } from './data/series';
import type { ChartPlugin } from './plugin';
import type { ColormapName } from './colormap';
import type { BinRule } from './data/histogram';
import { resolveTheme, type Theme, type ThemeName } from './theme';
import type { StatusLevel, StatusMode, StatusReference } from './status';

export type ChartType = 'line' | 'bar' | 'scatter' | 'box' | 'heatmap' | 'dots' | 'waffle';

export interface ScaleConfig {
  /** `band` solo tiene sentido para barras; `time` requiere una columna de tiempo. */
  readonly type?: 'linear' | 'log' | 'time' | 'band';
  /** Rango de valores a mostrar. `'auto'` lo calcula de los datos. */
  readonly domain?: readonly [number, number] | 'auto';
  /** Redondear el dominio automático a ticks "bonitos". */
  readonly nice?: boolean;
}

export interface AxisConfig {
  readonly title?: string;
  readonly show?: boolean;
  readonly grid?: boolean;
  readonly format?: (value: number) => string;
}

export interface Padding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

interface BaseChartConfig {
  readonly data: DataTable;
  readonly series: readonly SeriesSpec[];
  readonly scales?: { readonly x?: ScaleConfig; readonly y?: ScaleConfig };
  readonly axes?: { readonly x?: AxisConfig; readonly y?: AxisConfig };
  readonly plugins?: readonly ChartPlugin[];
  readonly theme?: ThemeName | Theme;
  /** Margen exterior. Los márgenes para ejes se calculan aparte (E3.13). */
  readonly padding?: Partial<Padding>;
  /**
   * Render diferido: no dibuja hasta que el contenedor está (casi) en pantalla, y no redibuja
   * mientras está fuera. Así una página con 30 gráficos solo paga los que se ven. `true` por
   * defecto; `false` dibuja siempre (por ejemplo, para exportar sin mostrar).
   */
  readonly lazy?: boolean;
  /**
   * Backend de dibujo. `'canvas'` (por defecto) usa Canvas 2D para todo; `'webgl'` dibuja los
   * puntos de dispersión en la GPU (ejes, líneas y barras siguen en Canvas) y cae a Canvas con
   * un aviso si WebGL2 no está disponible; `'auto'` elige WebGL para dispersiones de 50 000
   * puntos o más.
   */
  readonly renderer?: 'auto' | 'canvas' | 'webgl';
}

export interface LineChartConfig extends BaseChartConfig {
  readonly type: 'line';
  readonly line?: {
    readonly width?: number;
    /** Rellena debajo de la línea hasta el cero, con el color de la serie translúcido. */
    readonly area?: boolean;
    /** Atajo de `curve: 'step'` (se conserva por compatibilidad). */
    readonly step?: boolean;
    /**
     * Forma del trazo entre datos. `'linear'` (defecto): rectas. `'monotone'`: curva suave que
     * nunca sale del rango de sus dos puntos vecinos (no inventa picos); se aplica mientras haya
     * pocos puntos a la vista y, con decimación, el trazo vuelve a rectas porque a esa densidad
     * no se distinguen. `'step'`: escalones, el valor se mantiene hasta el siguiente X.
     */
    readonly curve?: 'linear' | 'monotone' | 'step';
    /**
     * Huecos (`NaN`, celdas vacías del CSV). `false` (defecto): la línea se corta, para que se
     * vea que falta el dato. `true`: une los puntos vecinos. Un número: une solo huecos de hasta
     * esa distancia en X (milisegundos en un eje de tiempo); los más largos siguen cortando.
     */
    readonly spanGaps?: boolean | number;
    /**
     * Cómo se reduce la serie a 4 puntos por columna de píxel. `'scan'` recorre el rango
     * visible en cada fotograma; `'pyramid'` construye una vez una pirámide de mínimos y
     * máximos (O(n), ~1 byte por punto) y después cada fotograma cuesta O(px · log n).
     * `'auto'` (por defecto) usa la pirámide a partir de 100 000 puntos con X ordenada.
     */
    readonly decimate?: 'auto' | 'scan' | 'pyramid';
  };
}

export interface BarChartConfig extends BaseChartConfig {
  readonly type: 'bar';
  readonly bar?: {
    readonly mode?: 'grouped' | 'stacked';
    /**
     * `'horizontal'`: categorías en el eje vertical (de arriba abajo, en el orden de los datos)
     * y valores en el horizontal; la forma de un ranking con nombres largos. Las opciones
     * siguen siendo lógicas: `x` es la categoría y `scales.y`/`axes.y` configuran el eje del
     * valor aunque se dibuje abajo.
     */
    readonly orientation?: 'vertical' | 'horizontal';
    /** Fracción de la banda que queda vacía entre barras, de 0 a 1. */
    readonly padding?: number;
    /** Radio del extremo de datos de cada barra en píxeles (4); 0 para esquinas rectas. */
    readonly radius?: number;
    /** Hueco en píxeles del color del fondo entre barras vecinas y entre segmentos apilados (2). */
    readonly gap?: number;
    /**
     * Marca de cada valor: `'bar'` (defecto) o `'dot'`, un punto donde terminaría la barra, sin
     * relleno. Con `referencePlugin` el punto se compara contra una línea de referencia.
     */
    readonly mark?: 'bar' | 'dot';
  };
}

/**
 * Unidades del total: cada categoría de `x` ocupa tantos cuadros como `y / unit`, en una
 * cuadrícula continua, así el lector cuenta la parte de cada una en vez de estimar áreas.
 */
export interface WaffleChartConfig extends BaseChartConfig {
  readonly type: 'waffle';
  readonly waffle?: {
    /** Valor de cada cuadro; `'auto'` elige un paso redondo que dé entre 100 y 250 cuadros. */
    readonly unit?: number | 'auto';
    /** Columnas de la cuadrícula; `'auto'` las ajusta al ancho y alto disponibles. */
    readonly columns?: number | 'auto';
    /** Hueco entre cuadros en píxeles (2). */
    readonly gap?: number;
    /** Nombre y porcentaje de cada categoría bajo la cuadrícula (`true`). */
    readonly labels?: boolean;
  };
}

export interface BoxChartConfig extends BaseChartConfig {
  readonly type: 'box';
  /**
   * Datos en formato largo: `x` es la columna categórica del grupo y `y` la del valor; el
   * gráfico calcula cuartiles, bigotes y atípicos por grupo (como `df.groupby(x)[y].describe()`).
   */
  readonly box?: {
    /** Factor del bigote sobre el IQR (1.5 = Tukey, el de pandas y R). */
    readonly whisker?: number;
    /** Fracción de la banda que queda vacía entre cajas, de 0 a 1. */
    readonly padding?: number;
    /** Dibujar los valores fuera de los bigotes como puntos. */
    readonly outliers?: boolean;
    /**
     * Qué se dibuja por grupo: la caja de Tukey (`'box'`), un punto por valor apilado en
     * cubetas (`'dots'`), una franja cuya intensidad es la cantidad de valores por tramo
     * (`'density'`) o bandas de percentiles con la mediana (`'range'`).
     */
    readonly mark?: 'box' | 'dots' | 'density' | 'range';
    /**
     * Cubetas de `'dots'` y `'density'`: un número, una regla de `histogram` o `'auto'`
     * (por defecto: tantas como quepan a 7 px por cubeta en puntos y 8 px en la franja).
     */
    readonly bins?: number | BinRule | 'auto';
    /**
     * `'dots'`: columna numérica que da el tono de cada punto, del claro (valor bajo) al oscuro
     * (alto) con el colormap `cobalto`; por ejemplo la fecha, para leer el tiempo dentro del
     * reparto. `null` usa el color de la serie.
     */
    readonly shade?: string | null;
    /** Percentiles de la banda exterior de `'range'` (`[0.1, 0.9]`); la interior es Q1–Q3. */
    readonly range?: readonly [number, number];
    /**
     * Marcar la última fila de cada grupo (`'last'`) con un punto, su valor y en qué parte del
     * reparto cae ("el 1 % más bajo", "máximo"). `'none'` por defecto.
     */
    readonly now?: 'last' | 'none';
    /**
     * Textos del marcador de `now` (`{p}` es el porcentaje) y de la columna derecha de la ranura
     * (`{d}` la diferencia, `{ref}` el nombre de la referencia, `{n}` el tamaño de muestra,
     * `{p}` el periodo o el porcentaje).
     */
    readonly labels?: Partial<Record<BoxLabelKey, string>>;
    /**
     * `'horizontal'`: la ranura de estado. Cada grupo es una fila de arriba abajo, la banda o la
     * línea es su referencia y el relleno del punto de hoy dice el estado; a la derecha, el valor
     * y el estado en palabras. Responde "¿dónde está hoy cada grupo respecto a su referencia, y
     * qué tan seguros estamos?" para 1 a ~12 grupos. Las demás opciones de la ranura solo
     * actúan en horizontal; `mark` se ignora. `'vertical'` por defecto.
     */
    readonly orientation?: 'vertical' | 'horizontal';
    /**
     * Ranura: qué es el "100 %". `'history'` (defecto): el rango típico propio, una banda de
     * percentiles `range`, cada fila con su propia escala. `'peak'`: el máximo propio, las filas
     * comparten un eje en %. `'previous'`: el periodo anterior como 0 %, eje en % de cambio.
     * `{ group: 'China' }`: otro grupo de la columna `x`, como línea común (ese grupo no es una
     * fila). `{ value: 0 }`: una cifra fija, como una meta.
     */
    readonly reference?: StatusReference;
    /**
     * Ranura: qué se lee en 5 segundos. `'evidence'`: claro / posible / dentro, con el margen de
     * `yLow`/`yHigh` (sin margen avisa una vez y nunca dice "posible"). `'direction'`: subiendo /
     * estable / bajando frente a `statusWindow` periodos atrás. `'side'`: arriba / abajo /
     * dentro. `'auto'` (defecto): evidencia si hay margen, dirección con `'peak'`, lado en los
     * demás casos.
     */
    readonly status?: StatusMode;
    /** `'direction'`: cambio relativo por debajo del cual el grupo está estable (0.05 = ±5 %). */
    readonly statusThreshold?: number;
    /** `'direction'`: cuántos periodos atrás se compara (5). */
    readonly statusWindow?: number;
    /** Ranura: palabra de cada estado en la columna derecha y en el lector de pantalla. */
    readonly statusLabels?: Partial<Record<StatusLevel, string>>;
    /**
     * Ranura: historial tenue detrás de la banda, un punto por valor. `'auto'` (defecto) lo
     * muestra con 5 periodos o más; `'dots'` siempre; `'none'` nunca.
     */
    readonly history?: 'auto' | 'dots' | 'none';
    /** Ranura: orden de las filas, por estado (defecto), por distancia a la referencia o el de los datos. */
    readonly sort?: 'status' | 'distance' | 'input';
    /** Ranura: con más grupos se muestran los 8 más lejos de su referencia y "y N más" (12). */
    readonly maxRows?: number;
    /** Ranura: grupo protagonista, en el color de la serie; el resto en el gris de los ejes. */
    readonly highlight?: string | null;
    /**
     * Ranura: columna del periodo de cada fila (fecha o número). Da el año de cruce con
     * `{ group }`, la fecha de la fila parcial y el periodo del texto.
     */
    readonly period?: string | null;
    /** Ranura: columna con el tamaño de muestra de cada fila ("n = 120" en la columna derecha). */
    readonly count?: string | null;
    /**
     * Ranura: fecha de corte (ISO o ms, o número si `period` es numérico). Un grupo cuyo último
     * periodo es igual o posterior se marca como parcial: punto atenuado y la palabra "parcial".
     */
    readonly partial?: string | number | null;
  };
}

export type BoxLabelKey =
  | 'lowest'
  | 'highest'
  | 'max'
  | 'above'
  | 'aboveRange'
  | 'belowRange'
  | 'aboveRef'
  | 'belowRef'
  | 'ofPeak'
  | 'vsPrevious'
  | 'since'
  | 'count'
  | 'partial'
  | 'more';

export interface HeatmapChartConfig extends BaseChartConfig {
  readonly type: 'heatmap';
  /**
   * Datos en formato largo: `x` e `y` son las columnas categóricas (columna y fila de cada
   * celda) y `value` la numérica. Celdas sin fila en la tabla quedan vacías.
   */
  readonly heatmap?: {
    /** Mapa de color por nombre o paradas hexadecimales propias. `cobalto` por defecto. */
    readonly colormap?: ColormapName | readonly string[];
    /** Rango de valores que cubre el mapa; `'auto'` usa min y max de los datos. */
    readonly domain?: readonly [number, number] | 'auto';
    /**
     * Valor central para escalas divergentes (correlaciones: 0): el dominio se hace simétrico
     * alrededor de él, así el color neutro del mapa cae exactamente en el centro.
     */
    readonly center?: number | null;
    /** Barra de color a la derecha. */
    readonly legend?: boolean;
    /**
     * `'shared'`: una escala para toda la matriz (magnitud). `'row'`: cada fila se colorea
     * contra su propia mediana, con el colormap divergente `cobalto-naranja` salvo que se
     * indique otro: azul por debajo de su mediana, naranja por encima. Responde "¿cuándo
     * cambió cada uno?" y evita que una fila grande deje en blanco a las pequeñas.
     */
    readonly scale?: 'shared' | 'row';
    /**
     * Nota a la derecha de cada fila: `'max'` escribe la columna del máximo y la mediana de la
     * fila ("máx 1973 · mediana 18,6"). `'none'` por defecto.
     */
    readonly rowLabels?: 'none' | 'max';
    /** Cifra en cada celda (tabla con tono). Se ignora con más de 2 000 celdas. */
    readonly values?: boolean;
    /** Hueco del color del fondo entre celdas, en píxeles. Con hueco se dibujan rectángulos. */
    readonly gap?: number;
  };
}

/** Serie de un gráfico de unidades: solo hace falta la columna del valor (`x`). */
export type DotsSeriesSpec = Omit<SeriesSpec, 'y'> & { readonly y?: string };

export interface DotsChartConfig extends Omit<BaseChartConfig, 'series'> {
  readonly type: 'dots';
  /**
   * Un punto por caso. `x` es la columna del valor; `y` no se usa. `mode: 'strip'` dispersa los
   * puntos en una tira; `'binned'` los apila por cubeta como un histograma de unidades. Cambiar
   * el modo con `update` anima cada punto a su nueva posición durante `transition` ms (0 o
   * `prefers-reduced-motion` lo hacen instantáneo).
   */
  readonly series: readonly DotsSeriesSpec[];
  readonly dots?: {
    readonly mode?: 'strip' | 'binned';
    /** Cubetas del modo apilado: número o regla (`'fd'` por defecto). */
    readonly bins?: number | BinRule;
    /** Radio en píxeles, o `'auto'` (hasta 4 en cubetas, 1.5–3 en tira, según el ancho). */
    readonly radius?: number | 'auto';
    readonly transition?: number;
  };
}

export interface ScatterChartConfig extends BaseChartConfig {
  readonly type: 'scatter';
  readonly scatter?: {
    /** Radio en píxeles (3). */
    readonly radius?: number;
    /** Anillo del color del fondo alrededor de cada punto, en píxeles (1.5); 0 lo quita. */
    readonly ring?: number;
    /**
     * Unir los puntos de cada serie en el orden de las filas (dispersión conectada: cada serie
     * es un camino en el plano). El trazo usa `line.width`. `false` por defecto.
     */
    readonly path?: boolean;
  };
}

/**
 * Configuración que escribe el usuario. Es una unión discriminada por `type`, así el
 * editor solo sugiere `line`, `bar` o `scatter` según el gráfico elegido.
 */
export type ChartConfig =
  | LineChartConfig
  | BarChartConfig
  | ScatterChartConfig
  | BoxChartConfig
  | HeatmapChartConfig
  | DotsChartConfig
  | WaffleChartConfig;

/** Lo mismo, con todos los valores por defecto aplicados. Es lo que usa el núcleo. */
export interface ResolvedChartConfig {
  readonly type: ChartType;
  readonly data: DataTable;
  readonly series: readonly SeriesSpec[];
  readonly scales: { readonly x: Required<ScaleConfig>; readonly y: Required<ScaleConfig> };
  readonly axes: { readonly x: ResolvedAxisConfig; readonly y: ResolvedAxisConfig };
  readonly plugins: readonly ChartPlugin[];
  readonly theme: Theme;
  readonly padding: Padding;
  readonly line: Required<NonNullable<LineChartConfig['line']>>;
  readonly bar: Required<NonNullable<BarChartConfig['bar']>>;
  readonly scatter: Required<NonNullable<ScatterChartConfig['scatter']>>;
  readonly box: Required<NonNullable<BoxChartConfig['box']>>;
  readonly heatmap: Required<NonNullable<HeatmapChartConfig['heatmap']>>;
  readonly dots: Required<NonNullable<DotsChartConfig['dots']>>;
  readonly waffle: Required<NonNullable<WaffleChartConfig['waffle']>>;
}

export interface ResolvedAxisConfig {
  readonly title: string;
  readonly show: boolean;
  readonly grid: boolean;
  readonly format: ((value: number) => string) | undefined;
}

export const DEFAULTS = {
  padding: { top: 8, right: 8, bottom: 8, left: 8 } satisfies Padding,
  line: {
    width: 2,
    area: false,
    step: false,
    curve: 'linear',
    spanGaps: false,
    decimate: 'auto',
  },
  bar: { mode: 'grouped', orientation: 'vertical', padding: 0.2, radius: 4, gap: 2, mark: 'bar' },
  scatter: { radius: 3, ring: 1.5, path: false },
  box: {
    whisker: 1.5,
    padding: 0.3,
    outliers: true,
    mark: 'box',
    bins: 'auto',
    shade: null,
    range: [0.1, 0.9],
    now: 'none',
    labels: {
      lowest: 'el {p} % más bajo',
      highest: 'el {p} % más alto',
      max: 'en su máximo',
      above: 'sobre el {p} %',
      aboveRange: '{d} sobre su rango',
      belowRange: '{d} bajo su rango',
      aboveRef: '{d} sobre {ref}',
      belowRef: '{d} bajo {ref}',
      ofPeak: '{p} % de su pico',
      vsPrevious: '{p} % frente al anterior',
      since: 'desde {p}',
      count: 'n = {n}',
      partial: 'parcial',
      more: 'y {n} más',
    },
    orientation: 'vertical',
    reference: 'history',
    status: 'auto',
    statusThreshold: 0.05,
    statusWindow: 5,
    statusLabels: {
      clear: 'claro',
      possible: 'posible',
      inside: 'dentro',
      up: 'subiendo',
      stable: 'estable',
      down: 'bajando',
      above: 'arriba',
      below: 'abajo',
      none: '',
    },
    history: 'auto',
    sort: 'status',
    maxRows: 12,
    highlight: null,
    period: null,
    count: null,
    partial: null,
  },
  heatmap: {
    colormap: 'cobalto',
    domain: 'auto',
    center: null,
    legend: true,
    scale: 'shared',
    rowLabels: 'none',
    values: false,
    gap: 0,
  },
  dots: { mode: 'strip', bins: 'fd', radius: 'auto', transition: 600 },
  waffle: { unit: 'auto', columns: 'auto', gap: 2, labels: true },
} as const;

/** Color de la serie `index`: el `stroke` que declara o, si no, el de su posición en la paleta. */
export function seriesColor(
  config: { readonly series: readonly SeriesSpec[]; readonly theme: Theme },
  index: number,
): string {
  const { palette } = config.theme;
  return config.series[index]?.stroke ?? palette[index % palette.length] ?? '#000';
}

export function resolveConfig(config: ChartConfig): ResolvedChartConfig {
  if (config.series.length === 0) {
    throw new RangeError('La configuración necesita al menos una serie');
  }
  const ids = new Set<string>();
  // Un gráfico de unidades solo necesita el valor: `y` se rellena con `x` para que el resto del
  // núcleo (series resueltas, tooltip) vea la misma forma que en los demás tipos.
  const series: readonly SeriesSpec[] =
    config.type === 'dots' ? config.series.map((s) => ({ ...s, y: s.y ?? s.x })) : config.series;
  for (const s of series) {
    if (ids.has(s.id)) throw new RangeError(`Hay dos series con el id "${s.id}"`);
    ids.add(s.id);
    // Falla aquí, con el nombre de la columna, y no más tarde al dibujar.
    config.data.column(s.x);
    config.data.column(s.y);
    if (s.value !== undefined) config.data.column(s.value);
  }

  // Sin `scales.x.type`, el tipo sale de los datos: barras → banda; columna `time` → tiempo.
  const firstX = series[0]?.x ?? '';
  const defaultX =
    config.type === 'bar' ||
    config.type === 'box' ||
    config.type === 'heatmap' ||
    config.type === 'waffle'
      ? 'band'
      : config.data.column(firstX).kind === 'time'
        ? 'time'
        : 'linear';
  return {
    type: config.type,
    data: config.data,
    series,
    scales: {
      x: resolveScale(config.scales?.x, defaultX),
      y: resolveScale(config.scales?.y, 'linear'),
    },
    // La cuadrícula de unidades no tiene ejes: las categorías se nombran bajo los cuadros.
    axes: {
      x: resolveAxis(config.axes?.x, false, config.type !== 'waffle'),
      y: resolveAxis(config.axes?.y, true, config.type !== 'waffle'),
    },
    plugins: config.plugins ?? [],
    theme: resolveTheme(config.theme),
    padding: { ...DEFAULTS.padding, ...config.padding },
    line: { ...DEFAULTS.line, ...(config.type === 'line' ? config.line : undefined) },
    bar: { ...DEFAULTS.bar, ...(config.type === 'bar' ? config.bar : undefined) },
    scatter: { ...DEFAULTS.scatter, ...(config.type === 'scatter' ? config.scatter : undefined) },
    box: {
      ...DEFAULTS.box,
      ...(config.type === 'box' ? config.box : undefined),
      labels: {
        ...DEFAULTS.box.labels,
        ...(config.type === 'box' ? config.box?.labels : undefined),
      },
      statusLabels: {
        ...DEFAULTS.box.statusLabels,
        ...(config.type === 'box' ? config.box?.statusLabels : undefined),
      },
    },
    heatmap: {
      ...DEFAULTS.heatmap,
      // Por fila la pregunta es "¿hacia qué lado?": el mapa por defecto pasa a ser divergente.
      ...(config.type === 'heatmap' && config.heatmap?.scale === 'row'
        ? { colormap: 'cobalto-naranja' as const }
        : undefined),
      ...(config.type === 'heatmap' ? config.heatmap : undefined),
    },
    dots: { ...DEFAULTS.dots, ...(config.type === 'dots' ? config.dots : undefined) },
    waffle: { ...DEFAULTS.waffle, ...(config.type === 'waffle' ? config.waffle : undefined) },
  };
}

function resolveScale(
  scale: ScaleConfig | undefined,
  defaultType: Required<ScaleConfig>['type'],
): Required<ScaleConfig> {
  return {
    type: scale?.type ?? defaultType,
    domain: scale?.domain ?? 'auto',
    nice: scale?.nice ?? true,
  };
}

/**
 * Por defecto solo el eje Y lleva grid: líneas horizontales finas para leer valores; las
 * verticales se quitan porque el eje X se lee por sus ticks (anatomía editorial).
 */
function resolveAxis(axis: AxisConfig | undefined, grid: boolean, show = true): ResolvedAxisConfig {
  return {
    title: axis?.title ?? '',
    show: axis?.show ?? show,
    grid: axis?.grid ?? grid,
    format: axis?.format,
  };
}

import type { DataTable } from './data/table';
import type { SeriesSpec } from './data/series';
import type { ChartPlugin } from './plugin';
import type { ColormapName } from './colormap';
import type { BinRule } from './data/histogram';
import { resolveTheme, type Theme, type ThemeName } from './theme';

export type ChartType = 'line' | 'bar' | 'scatter' | 'box' | 'heatmap' | 'units';

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
   * puntos o más (también para gráficos de unidades).
   */
  readonly renderer?: 'auto' | 'canvas' | 'webgl';
}

export interface LineChartConfig extends BaseChartConfig {
  readonly type: 'line';
  readonly line?: {
    readonly width?: number;
    readonly area?: boolean;
    readonly step?: boolean;
  };
}

export interface BarChartConfig extends BaseChartConfig {
  readonly type: 'bar';
  readonly bar?: {
    readonly mode?: 'grouped' | 'stacked';
    readonly orientation?: 'vertical' | 'horizontal';
    /** Fracción de la banda que queda vacía entre barras, de 0 a 1. */
    readonly padding?: number;
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
  };
}

export interface HeatmapChartConfig extends BaseChartConfig {
  readonly type: 'heatmap';
  /**
   * Datos en formato largo: `x` e `y` son las columnas categóricas (columna y fila de cada
   * celda) y `value` la numérica. Celdas sin fila en la tabla quedan vacías.
   */
  readonly heatmap?: {
    /** Mapa de color por nombre o paradas hexadecimales propias. `viridis` por defecto. */
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
  };
}

export interface ScatterChartConfig extends BaseChartConfig {
  readonly type: 'scatter';
  readonly scatter?: {
    readonly radius?: number;
  };
}

/**
 * Gráfico de unidades: una marca por fila de la tabla. `x` es la columna del valor (la serie pide
 * `y` como las demás; basta repetir la misma columna). En `loose` cada marca va en x por su
 * valor; en `stacked` se apila en la columna de su cubeta, y cambiar de modo anima cada marca a
 * su nuevo lugar: la barra del histograma se ve como la pila de casos que es.
 */
export interface UnitsChartConfig extends BaseChartConfig {
  readonly type: 'units';
  readonly units?: {
    readonly mode?: 'loose' | 'stacked';
    /** Cubetas del modo apilado: número fijo o regla. `'fd'` (Freedman–Diaconis) por defecto. */
    readonly bins?: number | BinRule;
    /** Radio de las marcas sueltas, en píxeles. */
    readonly radius?: number;
    /** Radio máximo de las marcas apiladas; baja (y luego agrupa casos) para que todo quepa. */
    readonly maxRadius?: number;
    /** Duración de la transición entre modos, en ms. 0 la desactiva. */
    readonly duration?: number;
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
  | UnitsChartConfig;

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
  readonly units: Required<NonNullable<UnitsChartConfig['units']>>;
}

export interface ResolvedAxisConfig {
  readonly title: string;
  readonly show: boolean;
  readonly grid: boolean;
  readonly format: ((value: number) => string) | undefined;
}

export const DEFAULTS = {
  padding: { top: 8, right: 8, bottom: 8, left: 8 } satisfies Padding,
  line: { width: 1.5, area: false, step: false },
  bar: { mode: 'grouped', orientation: 'vertical', padding: 0.2 },
  scatter: { radius: 3 },
  box: { whisker: 1.5, padding: 0.3, outliers: true },
  heatmap: { colormap: 'viridis', domain: 'auto', center: null, legend: true },
  // Duración provisional: pasa a token de movimiento cuando se aprueben los foundations.
  units: { mode: 'loose', bins: 'fd', radius: 2.5, maxRadius: 4, duration: 700 },
} as const;

export function resolveConfig(config: ChartConfig): ResolvedChartConfig {
  if (config.series.length === 0) {
    throw new RangeError('La configuración necesita al menos una serie');
  }
  const ids = new Set<string>();
  for (const s of config.series) {
    if (ids.has(s.id)) throw new RangeError(`Hay dos series con el id "${s.id}"`);
    ids.add(s.id);
    // Falla aquí, con el nombre de la columna, y no más tarde al dibujar.
    config.data.column(s.x);
    config.data.column(s.y);
    if (s.value !== undefined) config.data.column(s.value);
  }

  // Sin `scales.x.type`, el tipo sale de los datos: barras → banda; columna `time` → tiempo.
  const firstX = config.series[0]?.x ?? '';
  const defaultX =
    config.type === 'bar' || config.type === 'box' || config.type === 'heatmap'
      ? 'band'
      : config.data.column(firstX).kind === 'time'
        ? 'time'
        : 'linear';
  return {
    type: config.type,
    data: config.data,
    series: config.series,
    scales: {
      x: resolveScale(config.scales?.x, defaultX),
      y: resolveScale(config.scales?.y, 'linear'),
    },
    axes: { x: resolveAxis(config.axes?.x), y: resolveAxis(config.axes?.y) },
    plugins: config.plugins ?? [],
    theme: resolveTheme(config.theme),
    padding: { ...DEFAULTS.padding, ...config.padding },
    line: { ...DEFAULTS.line, ...(config.type === 'line' ? config.line : undefined) },
    bar: { ...DEFAULTS.bar, ...(config.type === 'bar' ? config.bar : undefined) },
    scatter: { ...DEFAULTS.scatter, ...(config.type === 'scatter' ? config.scatter : undefined) },
    box: { ...DEFAULTS.box, ...(config.type === 'box' ? config.box : undefined) },
    heatmap: { ...DEFAULTS.heatmap, ...(config.type === 'heatmap' ? config.heatmap : undefined) },
    units: { ...DEFAULTS.units, ...(config.type === 'units' ? config.units : undefined) },
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

function resolveAxis(axis: AxisConfig | undefined): ResolvedAxisConfig {
  return {
    title: axis?.title ?? '',
    show: axis?.show ?? true,
    grid: axis?.grid ?? true,
    format: axis?.format,
  };
}

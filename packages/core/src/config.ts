import type { DataTable } from './data/table';
import type { SeriesSpec } from './data/series';
import type { ChartPlugin } from './plugin';
import { resolveTheme, type Theme, type ThemeName } from './theme';

export type ChartType = 'line' | 'bar' | 'scatter';

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

export interface ScatterChartConfig extends BaseChartConfig {
  readonly type: 'scatter';
  readonly scatter?: {
    readonly radius?: number;
  };
}

/**
 * Configuración que escribe el usuario. Es una unión discriminada por `type`, así el
 * editor solo sugiere `line`, `bar` o `scatter` según el gráfico elegido.
 */
export type ChartConfig = LineChartConfig | BarChartConfig | ScatterChartConfig;

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
  }

  // Sin `scales.x.type`, el tipo sale de los datos: barras → banda; columna `time` → tiempo.
  const firstX = config.series[0]?.x ?? '';
  const defaultX =
    config.type === 'bar' ? 'band' : config.data.column(firstX).kind === 'time' ? 'time' : 'linear';
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

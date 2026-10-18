export const version = '0.0.0';

export { Chart } from './chart';
export type { ChartOptions } from './chart';

export { DataTable, numberColumn, timeColumn, categoryColumn, columnLength } from './data/table';
export type { Column, ColumnKind, NumberColumn, TimeColumn, CategoryColumn } from './data/table';
export { resolveSeries, isSorted } from './data/series';
export type { SeriesSpec, ResolvedSeries } from './data/series';
export { minMaxDecimate } from './data/decimate';
export type { DecimatedSeries } from './data/decimate';
export { lowerBound } from './data/search';

export { resolveConfig, DEFAULTS } from './config';
export type {
  ChartConfig,
  ChartType,
  LineChartConfig,
  BarChartConfig,
  ScatterChartConfig,
  ResolvedChartConfig,
  ScaleConfig,
  AxisConfig,
  Padding,
} from './config';

export { themes, resolveTheme } from './theme';
export type { Theme, ThemeName } from './theme';

export { applyMap } from './renderer';
export type {
  Renderer,
  Layer,
  Transform,
  LinearMap,
  LineStyle,
  PointStyle,
  RectStyle,
  TextStyle,
} from './renderer';

export { Emitter } from './events';
export type { ChartEventMap, Listener } from './events';

export { PluginRegistry, PLUGIN_HOOK_ORDER } from './plugin';
export type { ChartPlugin, PluginContext, PluginHook, Layout, Rect } from './plugin';

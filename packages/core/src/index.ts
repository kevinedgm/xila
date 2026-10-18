export const version = '0.0.0';

export { Chart } from './chart';
export type { ChartScales } from './chart';
export { CanvasRenderer } from './renderer-canvas';

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

export { linearScale, niceStep } from './scales/linear';
export type { ContinuousScale, Domain, Range } from './scales/linear';
export {
  timeScale,
  timeTicks,
  timeTickFormatter,
  pickInterval,
  TIME_INTERVALS,
} from './scales/time';
export type { TimeInterval } from './scales/time';
export { bandScale } from './scales/band';
export type { BandScale } from './scales/band';

export {
  formatNumber,
  formatSI,
  formatScientific,
  formatPercent,
  formatCurrency,
  tickFormatter,
  decimalsForStep,
} from './format/number';
export type { NumberFormatter, NumberFormatOptions } from './format/number';

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
export type { ChartEventMap, HoverPayload, Listener } from './events';

export { sortedHitTester, gridHitTester, bandHitTester } from './hit-test';
export type { Hit, HitTester } from './hit-test';

export { tooltipPlugin } from './plugins/tooltip';
export type { TooltipOptions } from './plugins/tooltip';
export { legendPlugin } from './plugins/legend';
export type { LegendOptions } from './plugins/legend';

export { PluginRegistry, PLUGIN_HOOK_ORDER } from './plugin';
export type { ChartPlugin, PluginContext, PluginHook, Layout, Rect, ReservedSpace } from './plugin';

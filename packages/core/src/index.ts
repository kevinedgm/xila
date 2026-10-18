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
export { parseCsv, fetchCsv, parseIsoDate, CsvError } from './data/csv';
export type { CsvOptions, CsvResult } from './data/csv';
export { tableToCsv } from './data/csv-write';
export { chartToPng, chartToCsv, downloadFile, slugify } from './export';
export type { PngOptions } from './export';
export { filterRows, takeRows, groupBy, bucketTime, pivot, splitBy } from './data/transform';
export type { Aggregation, AggregationSpec, Condition } from './data/transform';

export {
  parseDashboard,
  validateDashboard,
  DashboardConfigError,
  suggest,
} from './dashboard/config';
export type {
  DashboardConfig,
  PanelConfig,
  PanelKpi,
  PanelGrafico,
  FiltroConfig,
  FiltroFechas,
  FiltroCategoria,
  FormatoValor,
  ValidationError,
} from './dashboard/config';
export { buildChart, buildKpi, applyFilters, formatter } from './dashboard/build';
export type { KpiResult } from './dashboard/build';
export { loadDashboard } from './dashboard/load';
export type { LoadedDashboard } from './dashboard/load';

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
export { floorTime } from './scales/time';
export type { TimeInterval, TimeUnit } from './scales/time';
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
export { zoomPanPlugin, zoomDomain, panDomain, clampDomain } from './plugins/zoom-pan';
export type { ZoomPanOptions } from './plugins/zoom-pan';
export { annotationsPlugin, annotationPixel } from './plugins/annotations';
export { accessibilityPlugin, chartSummary } from './plugins/accessibility';
export type { AccessibilityOptions } from './plugins/accessibility';
export type {
  Annotation,
  AnnotationValue,
  LineAnnotation,
  BandAnnotation,
  TextAnnotation,
  AnnotationsPlugin,
} from './plugins/annotations';
export type { LegendOptions } from './plugins/legend';

export { PluginRegistry, PLUGIN_HOOK_ORDER } from './plugin';
export type { ChartPlugin, PluginContext, PluginHook, Layout, Rect, ReservedSpace } from './plugin';

export const version = '0.1.0';

export { Chart } from './chart';
export type { ChartScales } from './chart';
export { CanvasRenderer } from './renderer-canvas';
export { SvgRenderer, parseFont } from './renderer-svg';
export type { SvgRendererOptions, ParsedFont } from './renderer-svg';
export { WebGLRenderer, parseColor } from './renderer-webgl';
export type { Backend } from './renderer-webgl';

export { DataTable, numberColumn, timeColumn, categoryColumn, columnLength } from './data/table';
export type { Column, ColumnKind, NumberColumn, TimeColumn, CategoryColumn } from './data/table';
export { resolveSeries, isSorted } from './data/series';
export type { SeriesSpec, ResolvedSeries } from './data/series';
export { minMaxDecimate } from './data/decimate';
export type { DecimatedSeries } from './data/decimate';
export { buildPyramid, pyramidDecimate } from './data/pyramid';
export type { MinMaxPyramid } from './data/pyramid';
export { lttb } from './data/lttb';
export { boxStats, boxGroups } from './data/box';
export {
  statusLayout,
  statusGroups,
  sortStatusRows,
  evidenceStatus,
  directionStatus,
  sideStatus,
} from './status';
export type {
  StatusReference,
  StatusMode,
  StatusLevel,
  StatusGroup,
  StatusOptions,
  StatusRow,
  StatusLayout,
} from './status';
export { colormap, stopsColormap, colormapCss, inkOn, contrastRatio, readableOn } from './colormap';
export type { Colormap, ColormapName } from './colormap';
export type { BoxStats } from './data/box';
export { histogram, histogramTable, binCount } from './data/histogram';
export type { Histogram, HistogramOptions, HistogramTableOptions, BinRule } from './data/histogram';
export { lowerBound } from './data/search';
export { toRelativeFloat32, float32Error, originNeedsReset } from './data/relative';
export { min, max, sum, mean, variance, std, quantile, quantiles, median, summary } from './stats';
export type { NumericArray, Summary } from './stats';
export { parseCsv, fetchCsv, parseIsoDate, CsvError } from './data/csv';
export type { CsvOptions, CsvResult } from './data/csv';
export { tableToCsv } from './data/csv-write';
export { chartToPng, chartToSvg, chartToCsv, downloadFile, slugify } from './export';
export type { PngOptions, SvgOptions } from './export';
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
  MarcaConfig,
  PanelConfig,
  PanelKpi,
  PanelGrafico,
  PanelCajas,
  PanelCalor,
  PanelChart,
  FormaLinea,
  FormaBarras,
  FormaDispersion,
  FormaCajas,
  FormaCalor,
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
  DotsChartConfig,
  WaffleChartConfig,
  BoxChartConfig,
  BoxLabelKey,
  DotsSeriesSpec,
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
export { logScale, logTicks } from './scales/log';
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

export { themes, resolveTheme, monoFont, displayFont } from './theme';
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
  BarStyle,
  TextStyle,
} from './renderer';

export { Emitter } from './events';
export type { ChartEventMap, HoverPayload, Listener } from './events';

export { sortedHitTester, gridHitTester, bandHitTester } from './hit-test';
export type { Hit, HitTester } from './hit-test';

export { tooltipPlugin } from './plugins/tooltip';
export { selectionPlugin } from './plugins/selection';
export { summaryPlugin } from './plugins/summary';
export type { SummaryOptions, SummaryStat } from './plugins/summary';
export { endLabelsPlugin } from './plugins/end-labels';
export { titlePlugin } from './plugins/title';
export { focusPlugin } from './plugins/focus';
export type { FocusOptions } from './plugins/focus';
export { nowPlugin } from './plugins/now';
export { referencePlugin, referenceValue } from './plugins/reference';
export { trajectoryPlugin, trajectoryTimeline, trajectoryHead } from './plugins/trajectory';
export type { TrajectoryOptions } from './plugins/trajectory';
export { trendPlugin, trendFit } from './plugins/trend';
export type { TrendOptions, TrendFit } from './plugins/trend';
export type { ReferenceOptions } from './plugins/reference';
export { waffleLayout, autoUnit } from './waffle';
export type { WaffleLayout, WaffleCell } from './waffle';
export type { NowOptions } from './plugins/now';
export type { TitleOptions } from './plugins/title';
export type { EndLabelsOptions } from './plugins/end-labels';
export type { SelectionOptions, SelectionSummary } from './plugins/selection';
export { dotsLayout, countInRange, snapToEdges, jitter } from './dots';
export type { DotsLayout, DotsMode, DotsOptions } from './dots';
export { pixelHitTester } from './hit-test';
export type { TooltipOptions } from './plugins/tooltip';
export { legendPlugin } from './plugins/legend';
export { zoomPanPlugin, zoomDomain, panDomain, clampDomain } from './plugins/zoom-pan';
export type { ZoomPanOptions } from './plugins/zoom-pan';
export {
  annotationsPlugin,
  annotationPixel,
  annotationBoxes,
  annotationAt,
} from './plugins/annotations';
export { accessibilityPlugin, chartSummary } from './plugins/accessibility';
export { syncPlugin, syncGroupSize } from './plugins/sync';
export type { SyncOptions } from './plugins/sync';
export type { AccessibilityOptions } from './plugins/accessibility';
export type {
  Annotation,
  AnnotationValue,
  LineAnnotation,
  BandAnnotation,
  TextAnnotation,
  AnnotationsPlugin,
  AnnotationsOptions,
  AnnotationBox,
  LabelPosition,
} from './plugins/annotations';
export type { LegendOptions } from './plugins/legend';

export { PluginRegistry, PLUGIN_HOOK_ORDER } from './plugin';
export type { ChartPlugin, PluginContext, PluginHook, Layout, Rect, ReservedSpace } from './plugin';

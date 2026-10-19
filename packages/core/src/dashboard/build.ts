import type { ChartConfig } from '../config';
import type { SeriesSpec } from '../data/series';
import { categoryColumn, DataTable, type Column } from '../data/table';
import { bucketTime, filterRows, groupBy, pivot, type Condition } from '../data/transform';
import { formatCurrency, formatNumber, formatPercent } from '../format/number';
import { focusPlugin } from '../plugins/focus';
import { nowPlugin } from '../plugins/now';
import { referencePlugin } from '../plugins/reference';
import { trajectoryPlugin } from '../plugins/trajectory';
import { trendPlugin } from '../plugins/trend';
import { floorTime } from '../scales/time';
import type {
  FormatoValor,
  PanelCajas,
  PanelCalor,
  PanelChart,
  PanelGrafico,
  PanelKpi,
} from './config';

/**
 * Convierte un panel declarativo más el estado de filtros en lo que el núcleo entiende:
 * un `ChartConfig` para gráficos o un valor formateado para KPI. Cada panel deriva sus
 * series de `tabla + filtros` por su cuenta, así un filtro actualiza todos los paneles sin
 * que se conozcan entre sí.
 */

export interface KpiResult {
  readonly value: number;
  readonly text: string;
  /** Variación relativa contra el periodo anterior, si el panel la pide. `null` si no hay dato. */
  readonly change: number | null;
  readonly changeText: string | null;
}

export function applyFilters(table: DataTable, filters: readonly Condition[]): DataTable {
  return filters.length === 0 ? table : filterRows(table, filters);
}

export function buildKpi(
  panel: PanelKpi,
  table: DataTable,
  filters: readonly Condition[] = [],
): KpiResult {
  const filtered = applyFilters(table, filters);
  const value = aggregateAll(filtered, panel.valor.columna, panel.valor.agregado);
  const format = formatter(panel.valor.formato);
  if (!panel.comparar) return { value, text: format(value), change: null, changeText: null };

  // Periodo actual = el último presente en los datos filtrados; anterior = el inmediato antes.
  const bucketed = bucketTime(filtered, panel.comparar.columna, panel.comparar.periodo, '__p');
  const periods = bucketed.numeric('__p');
  let last = -Infinity;
  for (let i = 0; i < periods.length; i++)
    if ((periods[i] as number) > last) last = periods[i] as number;
  if (!Number.isFinite(last)) return { value, text: format(value), change: null, changeText: null };
  const previous = previousPeriod(last, panel.comparar.periodo);
  const current = aggregateAll(
    filterRows(bucketed, (i) => periods[i] === last),
    panel.valor.columna,
    panel.valor.agregado,
  );
  const before = aggregateAll(
    filterRows(bucketed, (i) => periods[i] === previous),
    panel.valor.columna,
    panel.valor.agregado,
  );
  const change =
    before === 0 || !Number.isFinite(before) || !Number.isFinite(current)
      ? null
      : (current - before) / Math.abs(before);
  return {
    value: current,
    text: format(current),
    change,
    changeText: change === null ? null : `${change >= 0 ? '+' : ''}${formatPercent(change, 1)}`,
  };
}

function previousPeriod(
  start: number,
  unit: PanelKpi['comparar'] extends infer C ? (C extends { periodo: infer P } ? P : never) : never,
): number {
  return floorTime(start - 1, unit);
}

function aggregateAll(
  table: DataTable,
  column: string,
  agg: PanelKpi['valor']['agregado'],
): number {
  const col = table.column(column);
  if (col.kind === 'category') {
    if (agg !== 'count') throw new TypeError(`"${column}" es categórica; el KPI solo admite count`);
    return col.codes.length;
  }
  const v = col.values;
  let sum = 0;
  let n = 0;
  let min = Infinity;
  let max = -Infinity;
  let first = Number.NaN;
  let last = Number.NaN;
  for (let i = 0; i < v.length; i++) {
    const x = v[i] as number;
    if (x !== x) continue;
    if (n === 0) first = x;
    last = x;
    n++;
    sum += x;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  switch (agg) {
    case 'sum':
      return sum;
    case 'mean':
      return n ? sum / n : Number.NaN;
    case 'count':
      return n;
    case 'min':
      return n ? min : Number.NaN;
    case 'max':
      return n ? max : Number.NaN;
    case 'first':
      return first;
    case 'last':
      return last;
  }
}

export function formatter(formato: FormatoValor = 'numero'): (v: number) => string {
  switch (formato) {
    case 'entero':
      return (v) => formatNumber(v, { decimals: 0 });
    case 'moneda':
      return (v) => formatCurrency(v);
    case 'porcentaje':
      return (v) => formatPercent(v, 1);
    case 'numero':
      return (v) => formatNumber(v, { decimals: Math.abs(v) >= 100 ? 0 : 2 });
  }
}

/**
 * Serie por columna `y`, o una por categoría de `color`; agrega por `x` (y `periodo`) si se pide.
 * Con `forma`, devuelve además los plugins de esa forma (`plugins`), que el panel añade a los
 * suyos. Las formas responden las preguntas de "Qué es Xila hoy" sin escribir código.
 */
export function buildChart(
  panel: PanelChart,
  table: DataTable,
  filters: readonly Condition[] = [],
): ChartConfig {
  if (panel.tipo === 'cajas') return buildBoxes(panel, applyFilters(table, filters));
  if (panel.tipo === 'calor') return buildHeatmap(panel, applyFilters(table, filters));
  if (panel.forma === 'trayectorias') return buildTrajectories(panel, applyFilters(table, filters));
  let data = applyFilters(table, filters);
  let x = panel.x;
  const ys = typeof panel.y === 'string' ? [panel.y] : [...panel.y];

  if (panel.periodo) {
    data = bucketTime(data, x, panel.periodo, `${x}_${panel.periodo}`);
    x = `${x}_${panel.periodo}`;
  }

  let series: SeriesSpec[];
  if (panel.color) {
    const y = ys[0] as string;
    if (panel.agregado) {
      data = pivot(data, { index: x, columns: panel.color, values: y, agg: panel.agregado });
    } else {
      data = pivotRaw(data, x, panel.color, y);
    }
    series = data
      .names()
      .filter((n) => n !== x)
      .map((n) => ({ id: n, name: n, x, y: n }));
  } else {
    if (panel.agregado) {
      const agg = panel.agregado;
      data = groupBy(
        data,
        x,
        ys.map((y) => ({ agg, column: y })),
      );
    }
    series = ys.map((y) => ({ id: y, name: y, x, y }));
  }

  const axes = { x: { title: panel.ejes?.x ?? '' }, y: { title: panel.ejes?.y ?? '' } };
  if (panel.tipo === 'barras') {
    // Las barras necesitan una banda por categoría: un eje de tiempo se vuelve etiquetas.
    if (data.column(x).kind !== 'category') data = toCategory(data, x, panel.periodo);
    if (panel.forma === 'unidades') return { type: 'waffle', data, series, axes };
    if (panel.forma === 'puntos')
      return {
        type: 'bar',
        data,
        series,
        axes,
        bar: { mode: 'grouped', mark: 'dot' },
        plugins: [referencePlugin({ value: panel.referencia ?? 'mean' })],
      };
    return {
      type: 'bar',
      data,
      series,
      axes,
      bar: { mode: panel.apilado ? 'stacked' : 'grouped' },
    };
  }
  if (panel.tipo === 'dispersion') {
    if (panel.forma === 'tendencia')
      return { type: 'scatter', data, series, axes, plugins: [trendPlugin()] };
    return { type: 'scatter', data, series, axes };
  }
  if (panel.forma === 'ahora') return { type: 'line', data, series, axes, plugins: [nowPlugin()] };
  if (panel.forma === 'protagonista') {
    const first = series.find((s) => s.id === panel.protagonista) ?? series[0];
    return {
      type: 'line',
      data,
      series,
      axes,
      plugins: [focusPlugin(first ? { series: first.id } : {})],
    };
  }
  return { type: 'line', data, series, axes };
}

/**
 * Trayectorias: cada categoría necesita su propio par de columnas x/y, así que la tabla larga
 * se pivota dos veces (x e y por categoría) sobre el tiempo y se junta en una tabla ancha.
 */
function buildTrajectories(panel: PanelGrafico, data: DataTable): ChartConfig {
  const time = panel.tiempo as string;
  const color = panel.color as string;
  const y = typeof panel.y === 'string' ? panel.y : (panel.y[0] as string);
  const xs = pivotRaw(data, time, color, panel.x);
  const ys = pivotRaw(data, time, color, y);
  const names = xs.names().filter((n) => n !== time);
  const columns: Record<string, Column> = { [time]: xs.column(time) };
  for (const n of names) {
    columns[`x ${n}`] = xs.column(n);
    columns[`y ${n}`] = ys.column(n);
  }
  const series: SeriesSpec[] = names.map((n) => ({ id: n, name: n, x: `x ${n}`, y: `y ${n}` }));
  const first = names.includes(panel.protagonista ?? '') ? (panel.protagonista as string) : null;
  return {
    type: 'scatter',
    data: new DataTable(columns),
    series,
    axes: { x: { title: panel.ejes?.x ?? '' }, y: { title: panel.ejes?.y ?? '' } },
    plugins: [trajectoryPlugin(first === null ? { time } : { time, series: first })],
  };
}

/** Cajas: el formato largo tal cual; la forma elige la marca. */
function buildBoxes(panel: PanelCajas, data: DataTable): ChartConfig {
  const box =
    panel.forma === 'puntos'
      ? {
          mark: 'dots' as const,
          now: 'last' as const,
          ...(panel.sombra ? { shade: panel.sombra } : {}),
        }
      : panel.forma === 'franja'
        ? { mark: 'density' as const }
        : panel.forma === 'hoy'
          ? { mark: 'range' as const, now: 'last' as const }
          : {};
  return {
    type: 'box',
    data,
    series: [{ id: panel.y, name: panel.y, x: panel.x, y: panel.y }],
    axes: { x: { title: panel.ejes?.x ?? '' }, y: { title: panel.ejes?.y ?? '' } },
    box,
  };
}

/**
 * Calor: una celda por `x` × `y` con `valor` agregado. `pivot` deja una fila por `x` y una
 * columna por `y`; de ahí se vuelve al formato largo (x, y, valor) que el heatmap lee.
 */
function buildHeatmap(panel: PanelCalor, data: DataTable): ChartConfig {
  let x = panel.x;
  if (panel.periodo) {
    data = bucketTime(data, x, panel.periodo, `${x}_${panel.periodo}`);
    x = `${x}_${panel.periodo}`;
  }
  if (data.column(x).kind !== 'category') data = toCategory(data, x, panel.periodo);
  const wide = pivot(data, {
    index: x,
    columns: panel.y,
    values: panel.valor,
    agg: panel.agregado ?? 'mean',
  });
  const index = wide.column(x);
  const labels =
    index.kind === 'category' ? Array.from(index.codes, (c) => index.categories[c] ?? '') : [];
  const ys = wide.names().filter((n) => n !== x);
  const xs: string[] = [];
  const yl: string[] = [];
  const values: number[] = [];
  labels.forEach((label, i) => {
    for (const name of ys) {
      xs.push(label);
      yl.push(name);
      values.push(wide.numeric(name)[i] as number);
    }
  });
  const heatmap =
    panel.forma === 'filas'
      ? { scale: 'row' as const, rowLabels: 'max' as const }
      : panel.forma === 'tabla'
        ? { values: true, gap: 2, legend: false }
        : panel.forma === 'nudos'
          ? { mark: 'knot' as const, path: true }
          : {};
  return {
    type: 'heatmap',
    data: new DataTable({
      [x]: categoryColumn(xs),
      [panel.y]: categoryColumn(yl),
      [panel.valor]: { kind: 'number', values: Float64Array.from(values) },
    }),
    series: [{ id: panel.valor, name: panel.valor, x, y: panel.y, value: panel.valor }],
    axes: { x: { title: panel.ejes?.x ?? '' }, y: { title: panel.ejes?.y ?? '' } },
    heatmap,
  };
}

/** Sin agregar: una columna por categoría con NaN donde esa categoría no tiene fila para esa x. */
function pivotRaw(data: DataTable, x: string, color: string, y: string): DataTable {
  const col = data.column(color);
  if (col.kind !== 'category') throw new TypeError(`"${color}" debe ser categórica`);
  const xs = data.numeric(x);
  const ys = data.numeric(y);
  const distinct = Array.from(new Set(Array.from(xs).filter((v) => v === v))).sort((a, b) => a - b);
  const pos = new Map(distinct.map((v, i) => [v, i]));
  const out: Record<string, Column> = {
    [x]: {
      kind: data.column(x).kind === 'time' ? 'time' : 'number',
      values: Float64Array.from(distinct),
    },
  };
  const cols = col.categories.map(() => new Float64Array(distinct.length).fill(Number.NaN));
  for (let i = 0; i < xs.length; i++) {
    const p = pos.get(xs[i] as number);
    if (p !== undefined) (cols[col.codes[i] as number] as Float64Array)[p] = ys[i] as number;
  }
  const present = new Set<number>(col.codes);
  col.categories.forEach((name, c) => {
    if (present.has(c)) out[name] = { kind: 'number', values: cols[c] as Float64Array };
  });
  return new DataTable(out);
}

function toCategory(data: DataTable, x: string, periodo: PanelGrafico['periodo']): DataTable {
  const src = data.column(x);
  if (src.kind === 'category') return data;
  const label =
    src.kind === 'time'
      ? (v: number) => labelForPeriod(v, periodo)
      : (v: number) => formatNumber(v, { decimals: 0 });
  const out: Record<string, Column> = {};
  for (const name of data.names()) out[name] = data.column(name);
  // `categoryColumn` deja un código por etiqueta distinta (sin agregar, varias filas comparten periodo).
  out[x] = categoryColumn(Array.from(src.values, label));
  return new DataTable(out);
}

function labelForPeriod(ms: number, periodo: PanelGrafico['periodo']): string {
  if (periodo === 'decade') return `${new Date(ms).getUTCFullYear()}s`;
  const opts: Intl.DateTimeFormatOptions =
    periodo === 'year'
      ? { year: 'numeric' }
      : periodo === 'month' || periodo === 'quarter'
        ? { month: 'short', year: '2-digit' }
        : periodo === 'hour' || periodo === 'minute' || periodo === 'second'
          ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
          : { day: 'numeric', month: 'short' };
  return new Intl.DateTimeFormat('es-MX', { ...opts, timeZone: 'UTC' }).format(ms);
}

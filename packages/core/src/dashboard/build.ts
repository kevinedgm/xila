import type { ChartConfig } from '../config';
import type { SeriesSpec } from '../data/series';
import { DataTable, type Column } from '../data/table';
import { bucketTime, filterRows, groupBy, pivot, type Condition } from '../data/transform';
import { formatCurrency, formatNumber, formatPercent } from '../format/number';
import { floorTime } from '../scales/time';
import type { FormatoValor, PanelGrafico, PanelKpi } from './config';

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

/** Serie por columna `y`, o una por categoría de `color`; agrega por `x` (y `periodo`) si se pide. */
export function buildChart(
  panel: PanelGrafico,
  table: DataTable,
  filters: readonly Condition[] = [],
): ChartConfig {
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
    return {
      type: 'bar',
      data,
      series,
      axes,
      bar: { mode: panel.apilado ? 'stacked' : 'grouped' },
    };
  }
  if (panel.tipo === 'dispersion') return { type: 'scatter', data, series, axes };
  return { type: 'line', data, series, axes };
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
  const categories = Array.from(src.values, label);
  out[x] = { kind: 'category', codes: Uint32Array.from(categories.keys()), categories };
  return new DataTable(out);
}

function labelForPeriod(ms: number, periodo: PanelGrafico['periodo']): string {
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

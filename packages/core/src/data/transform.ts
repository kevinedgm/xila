import { floorTime, type TimeUnit } from '../scales/time';
import { DataTable, type Column } from './table';

/**
 * Transformaciones mínimas para que un CSV largo se convierta en las series que un gráfico
 * necesita: filtrar filas, agrupar con una agregación, pivotar a formato ancho y partir por
 * categoría. La limpieza pesada se queda en pandas; esto es lo que un filtro interactivo del
 * dashboard necesita recalcular en el navegador.
 *
 * Todas devuelven tablas nuevas y trabajan por columnas: las filas se eligen con un índice
 * (`Uint32Array`) y cada columna se copia de un tirón, sin objetos por fila.
 */

export type Aggregation = 'sum' | 'mean' | 'count' | 'min' | 'max' | 'first' | 'last';

/** Condición declarativa para filtros de dashboard; varias claves se combinan con AND. */
export interface Condition {
  readonly column: string;
  /** Igualdad con una categoría o un número. */
  readonly equals?: string | number;
  /** Pertenencia a un conjunto de categorías o números. */
  readonly in?: readonly (string | number)[];
  /** Rango inclusivo para números o tiempos (ms o ISO 8601). */
  readonly min?: number | string;
  readonly max?: number | string;
  /** Si es `true`, deja pasar nulos (NaN) en los rangos; por defecto los excluye. */
  readonly keepNull?: boolean;
}

/** Toma las filas cuyos índices están en `rows`, en ese orden. */
export function takeRows(table: DataTable, rows: ArrayLike<number>): DataTable {
  const out: Record<string, Column> = {};
  for (const name of table.names()) out[name] = takeColumn(table.column(name), rows);
  return new DataTable(out);
}

function takeColumn(c: Column, rows: ArrayLike<number>): Column {
  const n = rows.length;
  if (c.kind === 'category') {
    const codes = new Uint32Array(n);
    for (let i = 0; i < n; i++) codes[i] = c.codes[rows[i] as number] as number;
    // Se conserva el diccionario completo: los códigos siguen siendo válidos y la leyenda estable.
    return { kind: 'category', codes, categories: c.categories };
  }
  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) values[i] = c.values[rows[i] as number] as number;
  return { kind: c.kind, values };
}

/** Filtra con una función `(fila) => boolean` o con una o varias condiciones declarativas. */
export function filterRows(
  table: DataTable,
  by: ((row: number) => boolean) | Condition | readonly Condition[],
): DataTable {
  const keep = typeof by === 'function' ? by : compile(table, Array.isArray(by) ? by : [by]);
  const idx: number[] = [];
  for (let i = 0; i < table.length; i++) if (keep(i)) idx.push(i);
  return takeRows(table, idx);
}

function compile(table: DataTable, conditions: readonly Condition[]): (row: number) => boolean {
  const tests = conditions.map((cond) => {
    const c = table.column(cond.column);
    if (c.kind === 'category') return categoryTest(c.codes, c.categories, cond);
    return numericTest(c.values, cond, c.kind === 'time');
  });
  return (row) => {
    for (const t of tests) if (!t(row)) return false;
    return true;
  };
}

function categoryTest(
  codes: Uint32Array,
  categories: readonly string[],
  cond: Condition,
): (row: number) => boolean {
  if (cond.min !== undefined || cond.max !== undefined) {
    throw new TypeError(`"${cond.column}" es categórica; min/max solo aplican a números o tiempos`);
  }
  const wanted = new Set<number>();
  const values = cond.in ?? (cond.equals !== undefined ? [cond.equals] : null);
  if (values === null) return () => true;
  for (const v of values) {
    const code = categories.indexOf(String(v));
    if (code >= 0) wanted.add(code);
  }
  return (row) => wanted.has(codes[row] as number);
}

function numericTest(
  values: Float64Array,
  cond: Condition,
  isTime: boolean,
): (row: number) => boolean {
  const toNumber = (v: string | number): number =>
    typeof v === 'number' ? v : isTime ? Date.parse(v) : Number(v);
  const lo = cond.min === undefined ? -Infinity : toNumber(cond.min);
  const hi = cond.max === undefined ? Infinity : toNumber(cond.max);
  const set = cond.in ? new Set(cond.in.map(toNumber)) : null;
  const eq = cond.equals === undefined ? undefined : toNumber(cond.equals);
  const keepNull = cond.keepNull ?? false;
  return (row) => {
    const v = values[row] as number;
    if (v !== v) return keepNull;
    if (eq !== undefined && v !== eq) return false;
    if (set && !set.has(v)) return false;
    return v >= lo && v <= hi;
  };
}

export interface AggregationSpec {
  readonly agg: Aggregation;
  readonly column: string;
  /** Nombre de la columna resultante; por defecto el de `column`. */
  readonly as?: string;
}

/**
 * Agrupa por una columna y agrega otras. Los grupos salen en orden de primera aparición
 * para categorías y ascendente para números y tiempos (igual que `sort=True` en pandas
 * para numéricos; para categorías pandas ordena alfabéticamente, aquí no, para respetar el
 * orden del CSV).
 */
export function groupBy(
  table: DataTable,
  by: string,
  aggregations: AggregationSpec | readonly AggregationSpec[],
): DataTable {
  const specs = Array.isArray(aggregations) ? aggregations : [aggregations as AggregationSpec];
  const key = table.column(by);
  const n = table.length;

  // Código de grupo por fila; para números el "diccionario" son los valores distintos ordenados.
  let groupOf: Uint32Array;
  let keyColumn: Column;
  if (key.kind === 'category') {
    const used = new Set<number>();
    const order: number[] = [];
    for (let i = 0; i < n; i++) {
      const c = key.codes[i] as number;
      if (!used.has(c)) {
        used.add(c);
        order.push(c);
      }
    }
    const remap = new Map(order.map((c, g) => [c, g]));
    groupOf = Uint32Array.from(key.codes, (c) => remap.get(c) as number);
    keyColumn = {
      kind: 'category',
      codes: Uint32Array.from(order.keys()),
      categories: order.map((c) => key.categories[c] as string),
    };
  } else {
    const distinct = Array.from(new Set(Array.from(key.values).filter((v) => v === v))).sort(
      (a, b) => a - b,
    );
    const index = new Map(distinct.map((v, g) => [v, g]));
    groupOf = new Uint32Array(n);
    for (let i = 0; i < n; i++) groupOf[i] = index.get(key.values[i] as number) ?? 0xffffffff;
    keyColumn = { kind: key.kind, values: Float64Array.from(distinct) };
  }
  const groups = keyColumn.kind === 'category' ? keyColumn.codes.length : keyColumn.values.length;

  const out: Record<string, Column> = { [by]: keyColumn };
  for (const spec of specs) {
    const src = table.column(spec.column);
    if (
      src.kind === 'category' &&
      spec.agg !== 'count' &&
      spec.agg !== 'first' &&
      spec.agg !== 'last'
    ) {
      throw new TypeError(`"${spec.column}" es categórica; solo admite count, first o last`);
    }
    const name = spec.as ?? spec.column;
    out[name] =
      src.kind === 'category'
        ? aggregateCategory(src, groupOf, groups, spec.agg)
        : {
            kind: spec.agg === 'count' ? 'number' : src.kind,
            values: aggregateNumeric(src.values, groupOf, groups, spec.agg),
          };
  }
  return new DataTable(out);
}

function aggregateNumeric(
  values: Float64Array,
  groupOf: Uint32Array,
  groups: number,
  agg: Aggregation,
): Float64Array {
  const acc = new Float64Array(groups);
  const count = new Uint32Array(groups);
  const seen = new Uint8Array(groups);
  if (agg === 'min') acc.fill(Infinity);
  if (agg === 'max') acc.fill(-Infinity);
  for (let i = 0; i < values.length; i++) {
    const g = groupOf[i] as number;
    if (g === 0xffffffff) continue; // clave nula
    const v = values[i] as number;
    if (v !== v) continue; // los nulos no cuentan, como en pandas
    count[g] = (count[g] as number) + 1;
    switch (agg) {
      case 'sum':
      case 'mean':
        acc[g] = (acc[g] as number) + v;
        break;
      case 'min':
        if (v < (acc[g] as number)) acc[g] = v;
        break;
      case 'max':
        if (v > (acc[g] as number)) acc[g] = v;
        break;
      case 'first':
        if (!seen[g]) acc[g] = v;
        break;
      case 'last':
        acc[g] = v;
        break;
      case 'count':
        break;
    }
    seen[g] = 1;
  }
  for (let g = 0; g < groups; g++) {
    if (agg === 'count') acc[g] = count[g] as number;
    else if (!seen[g]) acc[g] = Number.NaN;
    else if (agg === 'mean') acc[g] = (acc[g] as number) / (count[g] as number);
  }
  return acc;
}

function aggregateCategory(
  src: { codes: Uint32Array; categories: readonly string[] },
  groupOf: Uint32Array,
  groups: number,
  agg: Aggregation,
): Column {
  if (agg === 'count') {
    const acc = new Float64Array(groups);
    for (let i = 0; i < src.codes.length; i++) {
      const g = groupOf[i] as number;
      if (g !== 0xffffffff) acc[g] = (acc[g] as number) + 1;
    }
    return { kind: 'number', values: acc };
  }
  const codes = new Uint32Array(groups);
  const seen = new Uint8Array(groups);
  for (let i = 0; i < src.codes.length; i++) {
    const g = groupOf[i] as number;
    if (g === 0xffffffff) continue;
    if (agg === 'last' || !seen[g]) codes[g] = src.codes[i] as number;
    seen[g] = 1;
  }
  return { kind: 'category', codes, categories: src.categories };
}

/** Columna de tiempo redondeada al inicio de su unidad de calendario (UTC), para agrupar por mes, día, etc. */
export function bucketTime(
  table: DataTable,
  column: string,
  unit: TimeUnit,
  as = `${column}_${unit}`,
): DataTable {
  const src = table.column(column);
  if (src.kind !== 'time') throw new TypeError(`"${column}" no es una columna de tiempo`);
  const values = new Float64Array(src.values.length);
  for (let i = 0; i < values.length; i++) values[i] = floorTime(src.values[i] as number, unit);
  const out: Record<string, Column> = {};
  for (const name of table.names()) out[name] = table.column(name);
  out[as] = { kind: 'time', values };
  return new DataTable(out);
}

/**
 * De largo a ancho: una fila por valor de `index`, una columna por categoría de `columns`
 * con el valor de `values`. Celdas sin dato quedan en NaN; si hay varias filas para la misma
 * celda se agregan con `agg` (por defecto `sum`, como `pivot_table` en pandas).
 */
export function pivot(
  table: DataTable,
  spec: { index: string; columns: string; values: string; agg?: Aggregation },
): DataTable {
  const col = table.column(spec.columns);
  if (col.kind !== 'category')
    throw new TypeError(`"${spec.columns}" debe ser categórica para pivotar`);
  const vals = table.column(spec.values);
  if (vals.kind === 'category')
    throw new TypeError(`"${spec.values}" debe ser numérica o de tiempo`);
  const agg = spec.agg ?? 'sum';

  const out: Record<string, Column> = {};
  let indexColumn: Column | null = null;
  for (let c = 0; c < col.categories.length; c++) {
    const sub = filterRows(table, (row) => col.codes[row] === c);
    const grouped = groupBy(sub, spec.index, { agg, column: spec.values, as: '__v' });
    if (!indexColumn) {
      // El índice es la unión de los valores de todas las categorías.
      indexColumn = groupBy(table, spec.index, {
        agg: 'count',
        column: spec.values,
        as: '__n',
      }).column(spec.index);
    }
    out[col.categories[c] as string] = align(
      indexColumn,
      grouped.column(spec.index),
      grouped.numeric('__v'),
    );
  }
  if (!indexColumn) indexColumn = table.column(spec.index);
  return new DataTable({ [spec.index]: indexColumn, ...out });
}

/** Reparte `values` (indexadas por `keys`) sobre el índice completo `full`, con NaN donde falte. */
function align(full: Column, keys: Column, values: Float64Array): Column {
  const n = full.kind === 'category' ? full.codes.length : full.values.length;
  const out = new Float64Array(n).fill(Number.NaN);
  const position = new Map<number, number>();
  if (full.kind === 'category') {
    full.codes.forEach((code, i) => position.set(code, i));
    if (keys.kind === 'category')
      keys.codes.forEach((code, j) => (out[position.get(code) as number] = values[j] as number));
  } else {
    full.values.forEach((v, i) => position.set(v, i));
    if (keys.kind !== 'category')
      keys.values.forEach((v, j) => (out[position.get(v) as number] = values[j] as number));
  }
  return { kind: 'number', values: out };
}

/** Una tabla por categoría, en orden de primera aparición. Útil para una serie por región. */
export function splitBy(table: DataTable, column: string): Map<string, DataTable> {
  const col = table.column(column);
  if (col.kind !== 'category') throw new TypeError(`"${column}" debe ser categórica para partir`);
  const rowsOf = new Map<number, number[]>();
  for (let i = 0; i < col.codes.length; i++) {
    const c = col.codes[i] as number;
    let list = rowsOf.get(c);
    if (!list) rowsOf.set(c, (list = []));
    list.push(i);
  }
  const out = new Map<string, DataTable>();
  for (const [c, rows] of rowsOf) out.set(col.categories[c] as string, takeRows(table, rows));
  return out;
}

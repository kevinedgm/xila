/**
 * Representación interna de los datos: columnas tipadas de la misma longitud.
 *
 * Los valores numéricos y de tiempo van en `Float64Array` (contiguos, fuera del heap,
 * listos para WebGL). Las categorías se guardan como índices `Uint32Array` más un
 * diccionario: comparar enteros es más rápido que comparar strings y cada texto se
 * guarda una sola vez. Ver docs/adr/0001-modelo-de-datos-columnar.md.
 */

export interface NumberColumn {
  readonly kind: 'number';
  readonly values: Float64Array;
}

/** Milisegundos desde la época Unix, como `Date.getTime()`. */
export interface TimeColumn {
  readonly kind: 'time';
  readonly values: Float64Array;
}

export interface CategoryColumn {
  readonly kind: 'category';
  /** Índice en `categories` para cada fila. */
  readonly codes: Uint32Array;
  readonly categories: readonly string[];
}

export type Column = NumberColumn | TimeColumn | CategoryColumn;
export type ColumnKind = Column['kind'];

export function columnLength(column: Column): number {
  return column.kind === 'category' ? column.codes.length : column.values.length;
}

export function numberColumn(values: ArrayLike<number>): NumberColumn {
  return { kind: 'number', values: Float64Array.from(values) };
}

/** Acepta milisegundos, `Date` o texto ISO 8601. Lo que no se pueda interpretar queda como NaN. */
export function timeColumn(values: ArrayLike<number | Date | string>): TimeColumn {
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out[i] = typeof v === 'number' ? v : v instanceof Date ? v.getTime() : Date.parse(v ?? '');
  }
  return { kind: 'time', values: out };
}

/** Las categorías se numeran en orden de primera aparición. */
export function categoryColumn(values: ArrayLike<string>): CategoryColumn {
  const index = new Map<string, number>();
  const categories: string[] = [];
  const codes = new Uint32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? '';
    let code = index.get(v);
    if (code === undefined) {
      code = categories.length;
      categories.push(v);
      index.set(v, code);
    }
    codes[i] = code;
  }
  return { kind: 'category', codes, categories };
}

export class DataTable {
  readonly length: number;
  private readonly columns: ReadonlyMap<string, Column>;

  constructor(columns: Readonly<Record<string, Column>>) {
    const entries = Object.entries(columns);
    const first = entries[0];
    this.length = first ? columnLength(first[1]) : 0;
    const wrong = entries.filter(([, c]) => columnLength(c) !== this.length);
    if (wrong.length > 0) {
      const detail = wrong.map(([n, c]) => `"${n}" (${columnLength(c)})`).join(', ');
      throw new RangeError(
        `Todas las columnas deben tener ${this.length} filas, como "${first?.[0]}"; difieren: ${detail}`,
      );
    }
    this.columns = new Map(entries);
  }

  names(): string[] {
    return [...this.columns.keys()];
  }

  has(name: string): boolean {
    return this.columns.has(name);
  }

  column(name: string): Column {
    const c = this.columns.get(name);
    if (!c) {
      throw new RangeError(
        `La columna "${name}" no existe. Disponibles: ${this.names().join(', ')}`,
      );
    }
    return c;
  }

  /** Columna numérica o de tiempo, que son las que se pueden poner en un eje continuo. */
  numeric(name: string): Float64Array {
    const c = this.column(name);
    if (c.kind === 'category') {
      throw new TypeError(`La columna "${name}" es categórica; se esperaba número o tiempo`);
    }
    return c.values;
  }

  /** Construye una tabla desde filas `{ columna: valor }`, infiriendo el tipo de cada columna. */
  static fromRows(rows: readonly Record<string, unknown>[]): DataTable {
    const first = rows[0];
    if (!first) return new DataTable({});
    const columns: Record<string, Column> = {};
    for (const name of Object.keys(first)) {
      const raw = rows.map((r) => r[name]);
      columns[name] = inferColumn(raw);
    }
    return new DataTable(columns);
  }
}

function inferColumn(raw: unknown[]): Column {
  if (raw.every((v) => typeof v === 'number' || v == null)) {
    return numberColumn(raw.map((v) => (typeof v === 'number' ? v : Number.NaN)));
  }
  if (raw.every((v) => v instanceof Date || v == null)) {
    return timeColumn(raw.map((v) => (v instanceof Date ? v : Number.NaN)));
  }
  const strings = raw.map((v) => (v == null ? '' : String(v)));
  if (
    strings.every((s) => s === '' || !Number.isNaN(Date.parse(s))) &&
    strings.some(looksLikeIsoDate)
  ) {
    return timeColumn(strings.map((s) => (s === '' ? Number.NaN : s)));
  }
  return categoryColumn(strings);
}

function looksLikeIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

import {
  DataTable,
  type CategoryColumn,
  type Column,
  type ColumnKind,
  type NumberColumn,
  type TimeColumn,
} from './table';

/**
 * Lector de CSV según docs/contrato-csv.md: coma, comillas RFC 4180, fechas ISO 8601,
 * nulos como celda vacía.
 *
 * Dos pasadas. La primera recorre el texto una sola vez y anota dónde empieza y termina
 * cada celda (dos enteros por celda en un `Uint32Array`), sin crear strings ni objetos por
 * fila. La segunda convierte cada columna a `Float64Array` o a códigos de categoría,
 * cortando solo las celdas que de verdad hacen falta. Así 100 000 filas no producen 100 000
 * objetos intermedios.
 */

export interface CsvOptions {
  /** Tipo fijo por columna; el resto se infiere. */
  readonly types?: Readonly<Record<string, ColumnKind>>;
  /** Celdas no vacías que se revisan para inferir el tipo. */
  readonly sample?: number;
}

export interface CsvResult {
  readonly table: DataTable;
  /** Filas de datos (sin contar el encabezado). */
  readonly rows: number;
  readonly kinds: Readonly<Record<string, ColumnKind>>;
}

export class CsvError extends Error {
  constructor(
    message: string,
    /** Número de fila en el archivo, contando el encabezado como fila 1. */
    readonly row: number,
    readonly column?: string,
  ) {
    super(row > 0 ? `fila ${row}${column ? `, columna "${column}"` : ''}: ${message}` : message);
    this.name = 'CsvError';
  }
}

const QUOTE = 34; // "
const COMMA = 44; // ,
const CR = 13;
const LF = 10;

interface Scan {
  readonly header: string[];
  /** Pares `[inicio, fin)` por celda, en orden fila a fila; fin excluye las comillas. */
  readonly bounds: Uint32Array;
  /** Celdas que llevaban comillas, para des-escapar `""` solo cuando hace falta. */
  readonly quoted: Uint8Array;
  readonly rows: number;
}

function scan(text: string): Scan {
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; // BOM
  const header: string[] = [];
  let cols = 0;

  // Encabezado: se lee con la misma rutina de celdas y se convierte a strings de inmediato.
  let headerDone = false;
  let bounds = new Uint32Array(1024);
  let quoted = new Uint8Array(512);
  let cells = 0;
  let rowCells = 0;
  let row = 1;

  const push = (start: number, end: number, wasQuoted: boolean): void => {
    if (!headerDone) {
      const raw = text.slice(start, end);
      header.push(wasQuoted ? raw.replace(/""/g, '"') : raw);
      return;
    }
    if (cells * 2 + 2 > bounds.length) {
      const nb = new Uint32Array(bounds.length * 2);
      nb.set(bounds);
      bounds = nb;
      const nq = new Uint8Array(quoted.length * 2);
      nq.set(quoted);
      quoted = nq;
    }
    bounds[cells * 2] = start;
    bounds[cells * 2 + 1] = end;
    quoted[cells] = wasQuoted ? 1 : 0;
    cells++;
  };

  const endRow = (): void => {
    if (!headerDone) {
      headerDone = true;
      cols = header.length;
    } else if (rowCells !== cols) {
      throw new CsvError(`tiene ${rowCells} columnas y el encabezado ${cols}`, row);
    }
    rowCells = 0;
    row++;
  };

  while (i < n) {
    let c = text.charCodeAt(i);
    let start: number;
    let end: number;
    let wasQuoted = false;
    if (c === QUOTE) {
      wasQuoted = true;
      start = i + 1;
      i++;
      for (;;) {
        if (i >= n) throw new CsvError('comillas sin cerrar', row);
        c = text.charCodeAt(i);
        if (c === QUOTE) {
          if (text.charCodeAt(i + 1) === QUOTE) {
            i += 2;
            continue;
          }
          break;
        }
        i++;
      }
      end = i;
      i++; // comilla de cierre
      c = i < n ? text.charCodeAt(i) : LF;
      if (c !== COMMA && c !== CR && c !== LF) {
        throw new CsvError('texto después de la comilla de cierre', row);
      }
    } else {
      start = i;
      while (i < n && c !== COMMA && c !== CR && c !== LF) c = text.charCodeAt(++i);
      end = i;
      c = i < n ? c : LF;
    }
    push(start, end, wasQuoted);
    rowCells++;
    if (c === COMMA) {
      i++;
      // Una coma al final de la línea deja una última celda vacía; sigue el fin de línea.
      const next = i < n ? text.charCodeAt(i) : LF;
      if (next !== LF && next !== CR) continue;
      push(i, i, false);
      rowCells++;
      c = next;
    }
    // Fin de línea (CRLF, LF o fin de archivo).
    if (c === CR) i++;
    if (i < n && text.charCodeAt(i) === LF) i++;
    endRow();
  }
  if (!headerDone) throw new CsvError('el archivo está vacío', 0);
  if (rowCells > 0) endRow(); // última línea sin salto final

  return { header, bounds, quoted, rows: row - 2 };
}

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Fecha ISO 8601 a ms UTC; sin zona se asume UTC, no la hora local del navegador. */
export function parseIsoDate(s: string): number {
  if (!ISO_DATE.test(s)) return Number.NaN;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s);
  const normalized = s.length > 10 && !hasZone ? `${s.replace(' ', 'T')}Z` : s.replace(' ', 'T');
  return Date.parse(normalized);
}

function isNumeric(s: string): boolean {
  // `Number('')` es 0 y `Number(' 1 ')` es 1; el contrato no permite ninguno de los dos.
  return s !== '' && s.trim() === s && !Number.isNaN(Number(s));
}

export function parseCsv(text: string, options: CsvOptions = {}): CsvResult {
  const { header, bounds, quoted, rows } = scan(text);
  const sample = options.sample ?? 200;
  const cols = header.length;

  const seen = new Set<string>();
  for (const name of header) {
    if (name === '') throw new CsvError('hay una columna sin nombre en el encabezado', 1);
    if (seen.has(name)) throw new CsvError(`la columna "${name}" está repetida`, 1);
    seen.add(name);
  }

  const cell = (r: number, c: number): string => {
    const k = r * cols + c;
    const raw = text.slice(bounds[k * 2] as number, bounds[k * 2 + 1] as number);
    return quoted[k] ? raw.replace(/""/g, '"') : raw;
  };

  const columns: Record<string, Column> = {};
  const kinds: Record<string, ColumnKind> = {};
  for (let c = 0; c < cols; c++) {
    const name = header[c] as string;
    const kind = options.types?.[name] ?? inferKind(c);
    kinds[name] = kind;
    columns[name] =
      kind === 'number'
        ? readNumbers(c, name)
        : kind === 'time'
          ? readTimes(c, name)
          : readCategories(c);
  }
  return { table: new DataTable(columns), rows, kinds };

  function inferKind(c: number): ColumnKind {
    let seenCells = 0;
    let allNumber = true;
    let allTime = true;
    for (let r = 0; r < rows && seenCells < sample; r++) {
      const s = cell(r, c);
      if (s === '') continue;
      seenCells++;
      if (allNumber && !isNumeric(s)) allNumber = false;
      if (allTime && Number.isNaN(parseIsoDate(s))) allTime = false;
      if (!allNumber && !allTime) return 'category';
    }
    // Columna completamente vacía: numérica (todo NaN) es lo menos sorprendente para un eje.
    if (seenCells === 0) return 'number';
    return allNumber ? 'number' : allTime ? 'time' : 'category';
  }

  function readNumbers(c: number, name: string): NumberColumn {
    const values = new Float64Array(rows);
    for (let r = 0; r < rows; r++) {
      const s = cell(r, c);
      if (s === '') {
        values[r] = Number.NaN;
        continue;
      }
      if (!isNumeric(s)) throw new CsvError(`"${s}" no es un número`, r + 2, name);
      values[r] = Number(s);
    }
    return { kind: 'number', values };
  }

  function readTimes(c: number, name: string): TimeColumn {
    const values = new Float64Array(rows);
    for (let r = 0; r < rows; r++) {
      const s = cell(r, c);
      if (s === '') {
        values[r] = Number.NaN;
        continue;
      }
      const t = parseIsoDate(s);
      if (Number.isNaN(t)) throw new CsvError(`"${s}" no es una fecha ISO 8601`, r + 2, name);
      values[r] = t;
    }
    return { kind: 'time', values };
  }

  function readCategories(c: number): CategoryColumn {
    const index = new Map<string, number>();
    const categories: string[] = [];
    const codes = new Uint32Array(rows);
    for (let r = 0; r < rows; r++) {
      const s = cell(r, c);
      let code = index.get(s);
      if (code === undefined) {
        code = categories.length;
        categories.push(s);
        index.set(s, code);
      }
      codes[r] = code;
    }
    return { kind: 'category', codes, categories };
  }
}

/** Descarga y lee un CSV. Falla con el estado HTTP si el archivo no está. */
export async function fetchCsv(url: string, options: CsvOptions = {}): Promise<CsvResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer ${url}: HTTP ${res.status}`);
  return parseCsv(await res.text(), options);
}

import type { DataTable } from './table';

/** Cómo se lee una serie de la tabla: qué columnas van a `x`, `y` y, opcionalmente, color y tamaño. */
export interface SeriesSpec {
  readonly id: string;
  /** Texto para leyenda y tooltip. Por defecto, el `id`. */
  readonly name?: string;
  readonly x: string;
  readonly y: string;
  /** Columna categórica que separa la serie en una por categoría (Etapa 4). */
  readonly color?: string;
  /** Columna numérica que controla el tamaño de los puntos (solo scatter). */
  readonly size?: string;
}

/** Serie ya resuelta contra la tabla: buffers listos para el renderer. */
export interface ResolvedSeries {
  readonly id: string;
  readonly name: string;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly size: Float64Array | undefined;
  readonly length: number;
}

export function resolveSeries(table: DataTable, spec: SeriesSpec): ResolvedSeries {
  // En X se admite una columna categórica (barras): se usan sus códigos como posición.
  const xc = table.column(spec.x);
  const x = xc.kind === 'category' ? Float64Array.from(xc.codes) : xc.values;
  const y = table.numeric(spec.y);
  const size = spec.size === undefined ? undefined : table.numeric(spec.size);
  return { id: spec.id, name: spec.name ?? spec.id, x, y, size, length: table.length };
}

/** `true` si `x` no decrece, requisito de la decimación y la búsqueda binaria. */
export function isSorted(xs: Float64Array): boolean {
  for (let i = 1; i < xs.length; i++) {
    if ((xs[i] as number) < (xs[i - 1] as number)) return false;
  }
  return true;
}

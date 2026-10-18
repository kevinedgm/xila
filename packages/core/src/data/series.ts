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
  /** Incertidumbre simétrica: la columna con el error (`y ± error`). */
  readonly yError?: string;
  /** Incertidumbre asimétrica: columnas con los límites inferior y superior (por ejemplo, IC 95 %). */
  readonly yLow?: string;
  readonly yHigh?: string;
}

/** Serie ya resuelta contra la tabla: buffers listos para el renderer. */
export interface ResolvedSeries {
  readonly id: string;
  readonly name: string;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly size: Float64Array | undefined;
  /** Límites de la incertidumbre, si la serie los declara (`yError` o `yLow`/`yHigh`). */
  readonly yLow: Float64Array | undefined;
  readonly yHigh: Float64Array | undefined;
  readonly length: number;
}

export function resolveSeries(table: DataTable, spec: SeriesSpec): ResolvedSeries {
  // En X se admite una columna categórica (barras): se usan sus códigos como posición.
  const xc = table.column(spec.x);
  const x = xc.kind === 'category' ? Float64Array.from(xc.codes) : xc.values;
  const y = table.numeric(spec.y);
  const size = spec.size === undefined ? undefined : table.numeric(spec.size);
  let yLow: Float64Array | undefined;
  let yHigh: Float64Array | undefined;
  if (spec.yError !== undefined) {
    const err = table.numeric(spec.yError);
    yLow = new Float64Array(y.length);
    yHigh = new Float64Array(y.length);
    for (let i = 0; i < y.length; i++) {
      const e = Math.abs(err[i] as number);
      yLow[i] = (y[i] as number) - e;
      yHigh[i] = (y[i] as number) + e;
    }
  } else if (spec.yLow !== undefined || spec.yHigh !== undefined) {
    if (spec.yLow === undefined || spec.yHigh === undefined) {
      throw new TypeError(`La serie "${spec.id}" necesita yLow y yHigh juntos`);
    }
    yLow = table.numeric(spec.yLow);
    yHigh = table.numeric(spec.yHigh);
  }
  return { id: spec.id, name: spec.name ?? spec.id, x, y, size, yLow, yHigh, length: table.length };
}

/** `true` si `x` no decrece, requisito de la decimación y la búsqueda binaria. */
export function isSorted(xs: Float64Array): boolean {
  for (let i = 1; i < xs.length; i++) {
    if ((xs[i] as number) < (xs[i - 1] as number)) return false;
  }
  return true;
}

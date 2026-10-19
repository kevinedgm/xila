import { binCount, type BinRule } from './histogram';

/**
 * Gráfico de unidades: una marca por fila. En modo `loose` cada marca se coloca en x por su
 * valor; en `stacked` se apila en la columna de su cubeta, así la barra del histograma se lee
 * como la pila de casos que es. Aquí solo hay geometría pura (testeable sin DOM); el dibujo y la
 * transición entre modos los hace `Chart`.
 */

export interface UnitBins {
  /** Bordes de las cubetas en unidades de datos: `bins + 1` valores crecientes. */
  readonly edges: Float64Array;
  readonly counts: Int32Array;
  /** Cubeta de cada fila; −1 si el valor no se dibuja (NaN, o ≤ 0 en escala log). */
  readonly bin: Int32Array;
  /** Lugar de cada fila dentro de su cubeta, en el orden de la tabla. */
  readonly slot: Int32Array;
  readonly max: number;
  readonly total: number;
}

/**
 * Cubetas de igual ancho. Con `log` el ancho es igual en log10, para que en un eje logarítmico
 * las columnas midan lo mismo; por defecto la regla es Freedman–Diaconis, que no se deja
 * arrastrar por unos pocos atípicos.
 */
export function unitBins(
  values: Float64Array,
  bins: number | BinRule = 'fd',
  log = false,
): UnitBins {
  const n = values.length;
  const t = new Float64Array(n);
  let lo = Infinity;
  let hi = -Infinity;
  let finite = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i] as number;
    const tv = log ? (v > 0 ? Math.log10(v) : NaN) : v;
    t[i] = Number.isFinite(tv) ? tv : NaN;
    if (t[i] !== t[i]) continue;
    finite++;
    if (tv < lo) lo = tv;
    if (tv > hi) hi = tv;
  }
  if (finite === 0) {
    lo = 0;
    hi = 1;
  } else if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const k =
    typeof bins === 'number'
      ? Math.max(1, Math.floor(bins))
      : finite === 0
        ? 1
        : binCount(
            t.filter((v) => v === v),
            bins,
          );
  const width = (hi - lo) / k;
  const edges = new Float64Array(k + 1);
  for (let i = 0; i <= k; i++) {
    const e = i === k ? hi : lo + i * width;
    edges[i] = log ? 10 ** e : e;
  }

  // Una sola pasada, O(n): sin ordenar, un millón de filas cuesta milisegundos. (El brush en modo
  // apilado selecciona columnas enteras, así que el orden dentro de una cubeta no cambia el conteo.)
  const bin = new Int32Array(n).fill(-1);
  const slot = new Int32Array(n).fill(-1);
  const counts = new Int32Array(k);
  for (let i = 0; i < n; i++) {
    const v = t[i] as number;
    if (v !== v) continue;
    let b = Math.floor((v - lo) / width);
    if (b >= k) b = k - 1;
    if (b < 0) b = 0;
    bin[i] = b;
    slot[i] = counts[b] as number;
    counts[b] = (counts[b] as number) + 1;
  }
  let max = 0;
  for (let b = 0; b < k; b++) if ((counts[b] as number) > max) max = counts[b] as number;
  return { edges, counts, bin, slot, max, total: finite };
}

export interface StackOptions {
  readonly maxRadius?: number;
  readonly minRadius?: number;
  /** Separación entre marcas, en píxeles. */
  readonly gap?: number;
}

export interface StackGeometry {
  readonly radius: number;
  /** Paso entre centros de marcas (diámetro + separación). */
  readonly unit: number;
  readonly cols: number;
  readonly rows: number;
  /** Casos que representa cada marca: 1 salvo que la columna más alta no quepa. */
  readonly perMark: number;
  /** Casos que caben en una columna de alto completo: el máximo del eje Y. */
  readonly capacity: number;
}

/**
 * El radio más grande con el que la columna más alta cabe en `height`. Si no cabe ni con el
 * radio mínimo, cada marca pasa a valer `perMark` casos: la columna más alta siempre cabe.
 */
export function stackGeometry(
  maxCount: number,
  columnWidth: number,
  height: number,
  options: StackOptions = {},
): StackGeometry {
  const maxR = options.maxRadius ?? 4;
  const minR = Math.min(maxR, options.minRadius ?? 1);
  const gap = options.gap ?? 1;
  const fit = (r: number): { unit: number; cols: number; rows: number } => {
    const unit = 2 * r + gap;
    return {
      unit,
      cols: Math.max(1, Math.floor(columnWidth / unit)),
      rows: Math.max(1, Math.floor(height / unit)),
    };
  };
  for (let r = maxR; r >= minR - 1e-9; r -= 0.25) {
    const g = fit(r);
    if (Math.ceil(maxCount / g.cols) <= g.rows) {
      return { radius: r, ...g, perMark: 1, capacity: g.rows * g.cols };
    }
  }
  const g = fit(minR);
  const perMark = Math.max(1, Math.ceil(maxCount / (g.cols * g.rows)));
  return { radius: minR, ...g, perMark, capacity: g.rows * g.cols * perMark };
}

/**
 * Posición (píxeles CSS) de cada marca apilada. `edgePx` son los bordes de las cubetas ya en
 * píxeles; las marcas se centran en su columna y crecen hacia arriba desde `bottom`.
 */
export function stackedPositions(
  bins: UnitBins,
  edgePx: Float64Array,
  bottom: number,
  geometry: StackGeometry,
): { x: Float64Array; y: Float64Array } {
  const n = bins.bin.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const { unit, cols, perMark } = geometry;
  for (let i = 0; i < n; i++) {
    const b = bins.bin[i] as number;
    if (b < 0) {
      x[i] = NaN;
      y[i] = NaN;
      continue;
    }
    const left = edgePx[b] as number;
    const width = (edgePx[b + 1] as number) - left;
    const offset = left + Math.max(0, (width - cols * unit) / 2);
    const m = Math.floor((bins.slot[i] as number) / perMark);
    x[i] = offset + unit / 2 + (m % cols) * unit;
    y[i] = bottom - unit / 2 - Math.floor(m / cols) * unit;
  }
  return { x, y };
}

/**
 * Marcas sueltas: x por valor, y repartida en el alto con la secuencia de la razón áurea, que
 * llena el espacio sin grumos y es igual en cada dibujo (no hay azar).
 */
export function loosePositions(
  values: Float64Array,
  toPx: (v: number) => number,
  top: number,
  height: number,
  radius: number,
  drawable?: Int32Array,
): { x: Float64Array; y: Float64Array } {
  const n = values.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const band = Math.max(0, height - 2 * radius);
  for (let i = 0; i < n; i++) {
    const v = values[i] as number;
    if (v !== v || (drawable && (drawable[i] as number) < 0)) {
      x[i] = NaN;
      y[i] = NaN;
      continue;
    }
    x[i] = toPx(v);
    const g = (i * 0.6180339887498949) % 1;
    y[i] = top + radius + g * band;
  }
  return { x, y };
}

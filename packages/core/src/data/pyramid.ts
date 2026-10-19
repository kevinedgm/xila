import {
  emitColumn,
  ensureCapacity,
  estimateCapacity,
  push,
  type DecimatedSeries,
} from './decimate';

/**
 * Pirámide de mínimos y máximos sobre `y`: para cada bloque de 2^k puntos consecutivos
 * (k desde `BASE` hasta cubrir la serie) guarda el índice de su mínimo y de su máximo.
 *
 * Con ella, el mínimo y el máximo de cualquier rango de índices se obtienen uniendo O(log n)
 * bloques alineados en vez de recorrer el rango. Así la decimación de una columna de píxel
 * cuesta O(log n) y la de un fotograma O(px · log n), independiente de cuántos puntos hay en
 * vista. Construirla cuesta O(n) una sola vez; ocupa alrededor de 1 byte por punto.
 *
 * Un bloque que contiene algún `NaN` se marca con `GAP` y la consulta lo baja al siguiente
 * nivel hasta recorrer sus puntos uno a uno, igual que `minMaxDecimate`; por eso el resultado
 * es idéntico, cortes incluidos.
 */
export interface MinMaxPyramid {
  readonly length: number;
  /** `levels[k - BASE]` describe los bloques de 2^k puntos. */
  readonly levels: readonly PyramidLevel[];
}

interface PyramidLevel {
  readonly min: Uint32Array;
  readonly max: Uint32Array;
}

/** Tamaño del bloque más fino: 2^4 = 16 puntos. Por debajo se recorre directamente. */
export const BASE = 4;
const GAP = 0xffffffff;

export function buildPyramid(ys: Float64Array): MinMaxPyramid {
  const n = ys.length;
  const levels: PyramidLevel[] = [];
  if (n === 0) return { length: 0, levels };

  // Nivel base: un recorrido de los datos.
  let count = Math.ceil(n / (1 << BASE));
  let min = new Uint32Array(count);
  let max = new Uint32Array(count);
  for (let b = 0; b < count; b++) {
    const start = b << BASE;
    const end = Math.min(n, start + (1 << BASE));
    let mi = start;
    let ma = start;
    let gap = false;
    for (let i = start; i < end; i++) {
      const v = ys[i] as number;
      if (v !== v) {
        gap = true;
        break;
      }
      if (v < (ys[mi] as number)) mi = i;
      if (v > (ys[ma] as number)) ma = i;
    }
    min[b] = gap ? GAP : mi;
    max[b] = gap ? GAP : ma;
  }
  levels.push({ min, max });

  // Niveles superiores: cada bloque une dos del nivel anterior (el que gana en caso de empate
  // es el de menor índice, como en el recorrido punto a punto).
  while (count > 1) {
    const prevMin = min;
    const prevMax = max;
    count = Math.ceil(count / 2);
    min = new Uint32Array(count);
    max = new Uint32Array(count);
    for (let b = 0; b < count; b++) {
      const l = 2 * b;
      const r = l + 1;
      const lMin = prevMin[l] as number;
      if (lMin === GAP || (r < prevMin.length && prevMin[r] === GAP)) {
        min[b] = GAP;
        max[b] = GAP;
        continue;
      }
      if (r >= prevMin.length) {
        min[b] = lMin;
        max[b] = prevMax[l] as number;
        continue;
      }
      const rMin = prevMin[r] as number;
      const lMax = prevMax[l] as number;
      const rMax = prevMax[r] as number;
      min[b] = (ys[rMin] as number) < (ys[lMin] as number) ? rMin : lMin;
      max[b] = (ys[rMax] as number) > (ys[lMax] as number) ? rMax : lMax;
    }
    levels.push({ min, max });
  }
  return { length: n, levels };
}

/**
 * Misma salida que `minMaxDecimate(xs, ys, from, to, xOrigin, pxPerUnit)`, pero resolviendo
 * cada columna de píxel con la pirámide. Requiere `xs` ordenado de forma ascendente (la
 * columna de un punto no decrece con el índice, así los límites de cada columna se encuentran
 * por búsqueda binaria).
 */
export function pyramidDecimate(
  xs: Float64Array,
  ys: Float64Array,
  pyramid: MinMaxPyramid,
  from: number,
  to: number,
  xOrigin: number,
  pxPerUnit: number,
  out?: DecimatedSeries,
): DecimatedSeries {
  if (pyramid.length !== ys.length) {
    throw new RangeError('La pirámide no corresponde a esta serie');
  }
  from = Math.max(0, from);
  to = Math.min(ys.length, to);
  const count = Math.max(0, to - from);
  const result = ensureCapacity(
    out,
    Math.min(count, estimateCapacity(xs, from, to, xOrigin, pxPerUnit)),
  );
  result.length = 0;
  const q = new Query(xs, ys, pyramid, result);

  let i = from;
  while (i < to) {
    const c = Math.floor(((xs[i] as number) - xOrigin) * pxPerUnit);
    const end = columnEnd(xs, i, to, xOrigin, pxPerUnit, c);
    q.range(i, end);
    q.close();
    i = end;
  }
  return result;
}

/** Primer índice en `(i, to]` cuya columna es distinta de `c` (búsqueda binaria). */
function columnEnd(
  xs: Float64Array,
  i: number,
  to: number,
  xOrigin: number,
  pxPerUnit: number,
  c: number,
): number {
  let lo = i + 1;
  let hi = to;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (Math.floor(((xs[mid] as number) - xOrigin) * pxPerUnit) === c) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Estado del recorrido de una columna; reproduce punto a punto la lógica de `minMaxDecimate`. */
class Query {
  private first = -1;
  private last = -1;
  private minI = -1;
  private maxI = -1;
  private gap = false;

  constructor(
    private readonly xs: Float64Array,
    private readonly ys: Float64Array,
    private readonly pyramid: MinMaxPyramid,
    private readonly out: DecimatedSeries,
  ) {}

  /** Consume `[a, b)` con los bloques alineados más grandes que quepan. */
  range(a: number, b: number): void {
    const levels = this.pyramid.levels;
    let i = a;
    while (i < b) {
      let k = BASE;
      let size = 1 << BASE;
      if (i % size !== 0 || i + size > b) {
        this.point(i);
        i++;
        continue;
      }
      // Subir mientras el bloque siga alineado y quepa.
      while (k - BASE + 1 < levels.length && i % (size << 1) === 0 && i + (size << 1) <= b) {
        k++;
        size <<= 1;
      }
      this.block(i, k);
      i += size;
    }
  }

  private block(i: number, k: number): void {
    const level = this.pyramid.levels[k - BASE] as PyramidLevel;
    const b = i >>> k;
    const mi = level.min[b] as number;
    if (mi === GAP) {
      if (k === BASE) {
        const end = i + (1 << BASE);
        for (let p = i; p < end; p++) this.point(p);
      } else {
        const half = 1 << (k - 1);
        this.block(i, k - 1);
        this.block(i + half, k - 1);
      }
      return;
    }
    const ma = level.max[b] as number;
    const ys = this.ys;
    this.gap = false;
    if (this.first < 0) {
      this.first = i;
      this.minI = mi;
      this.maxI = ma;
    } else {
      if ((ys[mi] as number) < (ys[this.minI] as number)) this.minI = mi;
      if ((ys[ma] as number) > (ys[this.maxI] as number)) this.maxI = ma;
    }
    this.last = i + (1 << k) - 1;
  }

  private point(i: number): void {
    const y = this.ys[i] as number;
    if (y !== y) {
      this.close();
      if (!this.gap && this.out.length > 0) {
        push(this.xs, this.ys, this.out, i);
        this.gap = true;
      }
      return;
    }
    this.gap = false;
    if (this.first < 0) {
      this.first = this.last = this.minI = this.maxI = i;
      return;
    }
    this.last = i;
    if (y < (this.ys[this.minI] as number)) this.minI = i;
    if (y > (this.ys[this.maxI] as number)) this.maxI = i;
  }

  /** Cierra la columna en curso (si hay) emitiendo sus hasta 4 puntos. */
  close(): void {
    if (this.first >= 0) {
      emitColumn(this.xs, this.ys, this.out, this.first, this.minI, this.maxI, this.last);
    }
    this.first = -1;
  }
}

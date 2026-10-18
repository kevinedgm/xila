/**
 * Primer índice `i` en `[from, to)` tal que `xs[i] >= value`.
 * Requiere `xs` ordenado de forma ascendente. Devuelve `to` si ninguno cumple.
 */
export function lowerBound(xs: Float64Array, value: number, from = 0, to = xs.length): number {
  let lo = from;
  let hi = to;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((xs[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

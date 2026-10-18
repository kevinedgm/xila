/**
 * Coordenadas relativas para la GPU.
 *
 * WebGL trabaja en float32 (24 bits de mantisa). Un timestamp de hoy en milisegundos
 * (≈1.7×10¹²) solo se representa en saltos de 131 072 ms: 5 000 lecturas a 1 kHz colapsan en
 * un mismo valor y la línea se ve como escalones. En la CPU, con float64, se resta un origen y
 * a la GPU solo va la diferencia, que cabe en float32 con precisión de sobra mientras la
 * ventana visible no sea enorme en proporción a su resolución.
 */

/** Diferencias `values[i] − origin` en float32, listas para subir a un buffer. */
export function toRelativeFloat32(
  values: Float64Array,
  origin: number,
  from = 0,
  to = values.length,
  out?: Float32Array,
): Float32Array {
  const n = Math.max(0, to - from);
  const result = out && out.length >= n ? out : new Float32Array(n);
  for (let i = 0; i < n; i++) result[i] = (values[from + i] as number) - origin;
  return result;
}

/**
 * Error máximo que introduce float32 al representar un valor de magnitud `magnitude`: medio
 * ULP. Con `relativeSpan` (el rango visible menos el origen) se decide si el origen sigue
 * sirviendo: por ejemplo, para timestamps en ms, un error mayor a 0.5 ms ya se notaría a 1 kHz.
 */
export function float32Error(magnitude: number): number {
  if (magnitude === 0) return 0;
  const exponent = Math.floor(Math.log2(Math.abs(magnitude)));
  return 2 ** (exponent - 24);
}

/**
 * Decide si hay que mover el origen: el error de float32 para los extremos de la ventana
 * relativa al origen actual supera la `tolerance` (en unidades de datos). Se llama al cambiar
 * mucho la vista (pan largo), no en cada fotograma.
 */
export function originNeedsReset(
  origin: number,
  domain: readonly [number, number],
  tolerance: number,
): boolean {
  const far = Math.max(Math.abs(domain[0] - origin), Math.abs(domain[1] - origin));
  return float32Error(far) > tolerance;
}

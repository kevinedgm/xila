import type { LinearMap } from '../renderer';

export type Domain = readonly [number, number];
export type Range = readonly [number, number];

/** Escala continua: lleva valores del dominio (datos) al rango (píxeles) y de vuelta. */
export interface ContinuousScale {
  readonly kind: 'linear' | 'time';
  readonly domain: Domain;
  readonly range: Range;
  toPixel(value: number): number;
  toValue(pixel: number): number;
  /** Ticks "bonitos" dentro del dominio, aproximadamente `count`. */
  ticks(count: number): number[];
  /** Paso entre ticks, útil para decidir cuántos decimales mostrar. */
  tickStep(count: number): number;
  /** Nueva escala con el dominio extendido hasta el tick más cercano por fuera. */
  nice(count: number): ContinuousScale;
  /** Misma escala con otro rango (al recalcular el layout). */
  withRange(range: Range): ContinuousScale;
  /** Transformación lineal para el renderer. */
  map(): LinearMap;
}

/**
 * Paso "bonito": el múltiplo de 1, 2 o 5 por una potencia de 10 más cercano al paso crudo.
 * Para [0, 100] y 5 ticks: paso crudo 20, potencia 10, candidatos 10, 20, 50 → 20.
 */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  // Se compara en escala logarítmica: 33 está "más cerca" de 50 que de 20 en proporción.
  let best = power;
  for (const m of [1, 2, 5, 10]) {
    const candidate = m * power;
    if (Math.abs(Math.log(candidate / raw)) < Math.abs(Math.log(best / raw))) best = candidate;
  }
  return best;
}

/** Si el dominio está vacío (mín = máx) lo abre un poco para que algo se vea. */
export function widenDegenerate(domain: Domain): Domain {
  const [a, b] = domain;
  if (a !== b) return domain;
  const delta = a === 0 ? 1 : Math.abs(a) * 0.1;
  return [a - delta, a + delta];
}

export function linearScale(domain: Domain, range: Range): ContinuousScale {
  const [d0, d1] = widenDegenerate(domain);
  const [r0, r1] = range;
  const k = (r1 - r0) / (d1 - d0);

  const scale: ContinuousScale = {
    kind: 'linear',
    domain: [d0, d1],
    range,
    toPixel: (v) => r0 + (v - d0) * k,
    toValue: (px) => d0 + (px - r0) / k,
    tickStep: (count) => niceStep(Math.abs(d1 - d0), count),
    ticks(count) {
      const step = scale.tickStep(count);
      const lo = Math.min(d0, d1);
      const hi = Math.max(d0, d1);
      const out: number[] = [];
      const first = Math.ceil(lo / step - 1e-9);
      const last = Math.floor(hi / step + 1e-9);
      for (let i = first; i <= last; i++) {
        // Multiplicar el índice evita acumular error al sumar `step` muchas veces.
        out.push(roundToStep(i * step, step));
      }
      return out;
    },
    nice(count) {
      const step = scale.tickStep(count);
      const lo = roundToStep(Math.floor(Math.min(d0, d1) / step + 1e-9) * step, step);
      const hi = roundToStep(Math.ceil(Math.max(d0, d1) / step - 1e-9) * step, step);
      return linearScale(d0 <= d1 ? [lo, hi] : [hi, lo], range);
    },
    withRange: (next) => linearScale([d0, d1], next),
    map: () => ({ offset: d0, scale: k, base: r0 }),
  };
  return scale;
}

// Elimina ruido binario como 0.30000000000000004 usando los decimales que pide el paso.
function roundToStep(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(value.toFixed(Math.min(decimals, 15)));
}

import type { ContinuousScale, Domain, Range } from './linear';

/**
 * Escala logarítmica (base 10): la escala lineal aplicada a `log10(valor)`. Sirve para datos
 * que abarcan varios órdenes de magnitud. El logaritmo de cero o de un negativo no existe:
 * el dominio debe ser positivo (si no, `RangeError`) y esos valores se dibujan como huecos.
 */
export function logScale(domain: Domain, range: Range): ContinuousScale {
  let [d0, d1] = domain;
  if (!(d0 > 0) || !(d1 > 0)) {
    throw new RangeError(
      `La escala logarítmica necesita un dominio positivo; se recibió [${d0}, ${d1}]`,
    );
  }
  if (d0 === d1) {
    d0 /= 10;
    d1 *= 10;
  }
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  const [r0, r1] = range;
  const k = (r1 - r0) / (l1 - l0);

  const scale: ContinuousScale = {
    kind: 'log',
    domain: [d0, d1],
    range,
    transform: Math.log10,
    toPixel: (v) => r0 + (Math.log10(v) - l0) * k,
    toValue: (px) => 10 ** (l0 + (px - r0) / k),
    // Sin paso fijo: los ticks van por décadas; se usa para decidir decimales y vale 0.
    tickStep: () => 0,
    ticks: (count) => logTicks([d0, d1], count),
    nice: () =>
      logScale(
        d0 <= d1
          ? [10 ** Math.floor(Math.log10(d0)), 10 ** Math.ceil(Math.log10(d1))]
          : [10 ** Math.ceil(Math.log10(d0)), 10 ** Math.floor(Math.log10(d1))],
        range,
      ),
    withRange: (next) => logScale([d0, d1], next),
    // El renderer recibe valores ya transformados con `transform`; el mapa es lineal en ese espacio.
    map: () => ({ offset: l0, scale: k, base: r0 }),
  };
  return scale;
}

/**
 * Ticks de una escala log: potencias de 10 dentro del dominio. Si caben (pocas décadas para el
 * `count` pedido) se añaden los subticks 2 y 5 de cada década; si hay demasiadas décadas se
 * saltan algunas (cada 2, 3, …).
 */
export function logTicks(domain: Domain, count: number): number[] {
  const lo = Math.min(domain[0], domain[1]);
  const hi = Math.max(domain[0], domain[1]);
  if (!(lo > 0) || !(hi > 0)) return [];
  const e0 = Math.floor(Math.log10(lo) + 1e-9);
  const e1 = Math.ceil(Math.log10(hi) - 1e-9);
  const decades = e1 - e0;
  const out: number[] = [];
  const inside = (v: number): boolean => v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9);

  if (decades * 3 <= count) {
    // Pocas décadas: 1, 2, 5 por cada una.
    for (let e = e0; e <= e1; e++) {
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** e;
        if (inside(v)) out.push(v);
      }
    }
    return out;
  }
  const stride = Math.max(1, Math.ceil(decades / Math.max(1, count)));
  for (let e = e0; e <= e1; e += stride) {
    const v = 10 ** e;
    if (inside(v)) out.push(v);
  }
  return out;
}

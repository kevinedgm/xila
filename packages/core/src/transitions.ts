/**
 * Transiciones de marcas: interpola la posición (en píxeles CSS) y el radio de cada marca entre
 * dos layouts. Vive en el motor y no en nodos del DOM, así mover un millón de puntos cuesta lo
 * mismo que dibujarlos (el renderer recibe arreglos, igual que en un dibujo normal).
 *
 * Una transición nueva arranca desde donde va la anterior: interrumpir nunca da un salto.
 */

export type Easing = (t: number) => number;

/** Entrada y salida suaves; el movimiento empieza y termina sin tirón. */
export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** `true` si el sistema pide reducir el movimiento: entonces el cambio es instantáneo. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface TransitionOptions {
  /** Duración en milisegundos. */
  readonly duration?: number;
  readonly easing?: Easing;
  /**
   * Fracción de la duración que se reparte como retraso según la x de destino (0 = todas a la
   * vez). Un poco de escalonado hace legible que cada marca va a su lugar.
   */
  readonly stagger?: number;
}

const LUT_SIZE = 1024;

export class MarkTransition {
  /** Posición y radio actuales: lo que hay que dibujar en este fotograma. */
  x: Float64Array = new Float64Array(0);
  y: Float64Array = new Float64Array(0);
  radius = 0;

  private fromX: Float64Array = new Float64Array(0);
  private fromY: Float64Array = new Float64Array(0);
  private toX: Float64Array = new Float64Array(0);
  private toY: Float64Array = new Float64Array(0);
  private dx: Float64Array = new Float64Array(0);
  private dy: Float64Array = new Float64Array(0);
  /** Easing tabulado: con un millón de marcas, una llamada por marca y fotograma pesa. */
  private readonly lut: Float64Array;
  private delay: Float64Array = new Float64Array(0);
  private fromR = 0;
  private toR = 0;
  private start = 0;
  private active = false;
  private readonly duration: number;
  private readonly easing: Easing;
  private readonly stagger: number;

  constructor(options: TransitionOptions = {}) {
    this.duration = Math.max(0, options.duration ?? 700);
    this.easing = options.easing ?? easeInOutCubic;
    this.stagger = Math.min(0.9, Math.max(0, options.stagger ?? 0.25));
    this.lut = new Float64Array(LUT_SIZE + 1);
    for (let i = 0; i <= LUT_SIZE; i++) this.lut[i] = this.easing(i / LUT_SIZE);
  }

  get running(): boolean {
    return this.active;
  }

  /** Coloca las marcas en su destino sin animar (primer dibujo, resize, reduced-motion). */
  jump(x: Float64Array, y: Float64Array, radius: number): void {
    this.x = Float64Array.from(x);
    this.y = Float64Array.from(y);
    this.radius = radius;
    this.toX = this.x;
    this.toY = this.y;
    this.toR = radius;
    this.active = false;
  }

  /**
   * Anima desde la posición actual hasta `(x, y, radius)`. Si cambió el número de marcas no hay
   * correspondencia posible y se salta al destino.
   */
  animateTo(x: Float64Array, y: Float64Array, radius: number, now: number): void {
    if (x.length !== this.x.length || this.duration === 0 || prefersReducedMotion()) {
      this.jump(x, y, radius);
      return;
    }
    this.fromX = Float64Array.from(this.x);
    this.fromY = Float64Array.from(this.y);
    this.fromR = this.radius;
    this.toX = Float64Array.from(x);
    this.toY = Float64Array.from(y);
    this.toR = radius;
    const n = x.length;
    this.dx = new Float64Array(n);
    this.dy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.dx[i] = (this.toX[i] as number) - (this.fromX[i] as number);
      this.dy[i] = (this.toY[i] as number) - (this.fromY[i] as number);
    }
    this.delay = staggerDelays(this.toX, this.stagger);
    this.start = now;
    this.active = true;
  }

  /** Avanza al instante `now`. Devuelve `true` mientras la transición siga en curso. */
  sample(now: number): boolean {
    if (!this.active) return false;
    const t = Math.min(1, Math.max(0, (now - this.start) / this.duration));
    const scale = LUT_SIZE / (1 - this.stagger);
    const { x, y, fromX, fromY, dx, dy, delay, lut } = this;
    const n = x.length;
    for (let i = 0; i < n; i++) {
      let k = (t - (delay[i] as number)) * scale;
      k = k < 0 ? 0 : k > LUT_SIZE ? LUT_SIZE : k;
      const e = lut[k | 0] as number;
      x[i] = (fromX[i] as number) + (dx[i] as number) * e;
      y[i] = (fromY[i] as number) + (dy[i] as number) * e;
    }
    this.radius = this.fromR + (this.toR - this.fromR) * this.easing(t);
    if (t >= 1) {
      this.x = this.toX;
      this.y = this.toY;
      this.radius = this.toR;
      this.active = false;
    }
    return this.active;
  }
}

/** Retraso de cada marca en `[0, stagger]`, proporcional a su x de destino. */
export function staggerDelays(x: Float64Array, stagger: number): Float64Array {
  const out = new Float64Array(x.length);
  if (stagger <= 0 || x.length === 0) return out;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < x.length; i++) {
    const v = x[i] as number;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo;
  if (!(span > 0)) return out;
  for (let i = 0; i < x.length; i++) out[i] = (((x[i] as number) - lo) / span) * stagger;
  return out;
}

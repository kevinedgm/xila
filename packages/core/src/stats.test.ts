import { describe, expect, it } from 'vitest';
import { max, mean, median, min, quantile, quantiles, std, summary, sum, variance } from './stats';

// Valores de referencia calculados con numpy 2.x:
// a = np.array([2.5, 3.1, -1.2, 7.8, 0.0, 4.4, 3.3, 9.9, -5.5, 1.1])
const a = Float64Array.of(2.5, 3.1, -1.2, 7.8, 0.0, 4.4, 3.3, 9.9, -5.5, 1.1);

describe('estadísticas básicas (igual que numpy)', () => {
  it('mean, median, min, max', () => {
    expect(mean(a)).toBeCloseTo(2.54, 12);
    expect(median(a)).toBeCloseTo(2.8, 12);
    expect(min(a)).toBe(-5.5);
    expect(max(a)).toBe(9.9);
  });

  it('std con ddof 0 (numpy) y 1 (pandas)', () => {
    expect(std(a)).toBeCloseTo(4.163460099484562, 12);
    expect(std(a, 1)).toBeCloseTo(4.388672287200817, 12);
  });

  it('quantile con interpolación lineal', () => {
    const qs = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    const esperado = [-5.5, -1.63, 0.275, 2.8, 4.125, 8.01, 9.9];
    quantiles(a, qs).forEach((v, i) => expect(v).toBeCloseTo(esperado[i] as number, 12));
    expect(quantile(a, 0.9)).toBeCloseTo(8.01, 12);
  });

  it('Welford no pierde precisión con valores grandes y parecidos', () => {
    const b = Float64Array.of(1e9 + 1, 1e9 + 2, 1e9 + 3, 1e9 + 4);
    expect(std(b)).toBeCloseTo(1.118033988749895, 12);
    expect(mean(b)).toBe(1000000002.5);
    // La fórmula ingenua en float64 ya se desvía aquí.
    const naive = Math.sqrt(sum(b.map((v) => v * v)) / 4 - mean(b) ** 2);
    expect(Math.abs(naive - 1.118033988749895)).toBeGreaterThan(1e-7);
  });

  it('ignora NaN y devuelve NaN con vacío', () => {
    expect(mean(Float64Array.of(1, NaN, 3))).toBe(2);
    expect(quantile(Float64Array.of(NaN, 5, NaN), 0.5)).toBe(5);
    expect(mean(new Float64Array(0))).toBeNaN();
    expect(variance(Float64Array.of(1), 1)).toBeNaN();
    expect(min([])).toBeNaN();
  });

  it('summary se parece a describe() de pandas', () => {
    const s = summary(a);
    expect(s.count).toBe(10);
    expect(s.q1).toBeCloseTo(0.275, 12);
    expect(s.q3).toBeCloseTo(4.125, 12);
    expect(s.std).toBeCloseTo(4.388672287200817, 12);
  });
});

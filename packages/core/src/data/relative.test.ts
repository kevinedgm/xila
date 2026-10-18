import { describe, expect, it } from 'vitest';
import { float32Error, originNeedsReset, toRelativeFloat32 } from './relative';

describe('coordenadas relativas', () => {
  it('timestamps a 1 kHz colapsan en float32 y se recuperan restando el origen', () => {
    const n = 5000;
    const t0 = 1.7e12;
    const t = new Float64Array(n);
    for (let i = 0; i < n; i++) t[i] = t0 + i;

    // Sin origen: todos los valores caen en el mismo float32 (un solo escalón).
    const naive = new Float32Array(t);
    expect(new Set(naive).size).toBe(1);
    expect(Math.abs((naive[n - 1] as number) - (t[n - 1] as number))).toBeGreaterThan(1000);

    // Con origen: las diferencias son exactas.
    const rel = toRelativeFloat32(t, t0);
    for (let i = 0; i < n; i += 997) expect(rel[i]).toBe(i);
    expect(rel[n - 1]).toBe(n - 1);
  });

  it('acepta un rango y reutiliza el buffer', () => {
    const v = Float64Array.of(10, 11, 12, 13);
    const out = new Float32Array(8);
    const r = toRelativeFloat32(v, 10, 1, 3, out);
    expect(r).toBe(out);
    expect(Array.from(r.subarray(0, 2))).toEqual([1, 2]);
  });

  it('float32Error da medio ULP y originNeedsReset avisa al alejarse', () => {
    expect(float32Error(1.7e12)).toBe(65536);
    expect(float32Error(1000)).toBeLessThan(1e-3);
    // Ventana de 1 s cerca del origen: bien. Un día después: el error pasa de 0.5 ms.
    expect(originNeedsReset(0, [0, 1000], 0.5)).toBe(false);
    expect(originNeedsReset(0, [86_400_000, 86_401_000], 0.5)).toBe(true);
  });
});

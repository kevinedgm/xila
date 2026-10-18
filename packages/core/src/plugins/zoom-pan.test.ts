import { describe, expect, it } from 'vitest';
import { clampDomain, panDomain, zoomDomain } from './zoom-pan';

describe('zoomDomain', () => {
  it('el valor bajo el cursor se queda quieto', () => {
    const d = zoomDomain([0, 100], 25, 2);
    expect(d).toEqual([12.5, 62.5]);
    // 25 está al 25 % del dominio antes y después.
    expect((25 - d[0]) / (d[1] - d[0])).toBeCloseTo(0.25);
  });

  it('k < 1 aleja', () => {
    expect(zoomDomain([10, 20], 15, 0.5)).toEqual([5, 25]);
  });
});

describe('clampDomain', () => {
  it('no sale de los datos y conserva el tamaño', () => {
    expect(clampDomain([-10, 40], [0, 100], 1)).toEqual([0, 50]);
    expect(clampDomain([80, 130], [0, 100], 1)).toEqual([50, 100]);
  });

  it('más grande que los datos → los datos', () => {
    expect(clampDomain([-100, 300], [0, 100], 1)).toEqual([0, 100]);
  });

  it('respeta el tamaño mínimo alrededor del centro', () => {
    expect(clampDomain([49.9, 50.1], [0, 100], 1)).toEqual([49.5, 50.5]);
  });
});

describe('panDomain', () => {
  it('desplaza sin cambiar el tamaño', () => {
    expect(panDomain([0, 10], 3)).toEqual([3, 13]);
  });
});

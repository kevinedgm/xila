import { describe, expect, it } from 'vitest';
import { pickInterval, timeScale, timeTickFormatter, timeTicks } from './time';

const iso = (ms: number) => new Date(ms).toISOString();

describe('timeTicks', () => {
  it('un año de datos diarios da ticks en el día 1 de cada mes', () => {
    const lo = Date.UTC(2025, 0, 1);
    const hi = Date.UTC(2025, 11, 31);
    const { values, interval } = timeTicks([lo, hi], 12);
    expect(interval.name).toBe('1M');
    expect(values.map(iso)).toEqual(
      Array.from({ length: 12 }, (_, m) => new Date(Date.UTC(2025, m, 1)).toISOString()),
    );
  });

  it('con pocos ticks pedidos pasa a trimestres alineados a enero/abril/julio/octubre', () => {
    const { values, interval } = timeTicks([Date.UTC(2025, 1, 15), Date.UTC(2026, 0, 10)], 4);
    expect(interval.name).toBe('3M');
    expect(values.map(iso)).toEqual([
      '2025-04-01T00:00:00.000Z',
      '2025-07-01T00:00:00.000Z',
      '2025-10-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  it('un rango de 100 segundos usa pasos de 30 s en segundos "redondos"', () => {
    const lo = Date.UTC(2025, 5, 1, 12, 0, 7);
    const { values, interval } = timeTicks([lo, lo + 100_000], 6);
    expect(interval.name).toBe('30s');
    expect(values.map((v) => new Date(v).getUTCSeconds())).toEqual([30, 0, 30]);
  });

  it('un rango de dos días con 6 ticks usa pasos de 12 h en punto', () => {
    const lo = Date.UTC(2025, 2, 10, 5);
    const { values, interval } = timeTicks([lo, lo + 2 * 86_400_000], 6);
    expect(interval.name).toBe('12h');
    expect(values.map((v) => new Date(v).getUTCHours())).toEqual([12, 0, 12, 0]);
  });

  it('el primer tick nunca queda antes del dominio', () => {
    const lo = Date.UTC(2025, 0, 15);
    const { values } = timeTicks([lo, Date.UTC(2025, 6, 1)], 6);
    expect(values[0]).toBeGreaterThanOrEqual(lo);
  });

  it('décadas para rangos de siglos', () => {
    expect(pickInterval(300 * 365.25 * 86_400_000, 6).name).toBe('50Y');
  });
});

describe('timeTickFormatter', () => {
  it('etiqueta horas con hh:mm y añade la fecha al cambiar de día', () => {
    const lo = Date.UTC(2025, 2, 10, 18);
    const { values, interval } = timeTicks([lo, lo + 12 * 3_600_000], 6);
    const fmt = timeTickFormatter(interval);
    const labels = values.map((v, i) => fmt(v, i, values));
    expect(labels[0]).toMatch(/^10 mar\.? 18:00$/);
    const midnight = values.findIndex((v) => new Date(v).getUTCHours() === 0);
    expect(labels[midnight]).toMatch(/^11 mar\.? 00:00$/);
    expect(labels[1]).toBe('21:00');
  });

  it('meses en es-MX con año de dos dígitos', () => {
    const { values, interval } = timeTicks([Date.UTC(2025, 0, 1), Date.UTC(2025, 5, 1)], 6);
    const fmt = timeTickFormatter(interval);
    expect(fmt(values[0] as number, 0, values)).toMatch(/^ene\.? 25$/);
  });
});

describe('timeScale', () => {
  it('nice extiende el dominio a límites de calendario finos (semanas para medio año)', () => {
    const s = timeScale([Date.UTC(2025, 0, 15), Date.UTC(2025, 5, 20)], [0, 600]).nice(6);
    expect(iso(s.domain[0])).toBe('2025-01-13T00:00:00.000Z'); // lunes anterior
    expect(iso(s.domain[1])).toBe('2025-06-23T00:00:00.000Z'); // lunes siguiente
    expect(s.kind).toBe('time');
  });

  it('convierte píxeles igual que la escala lineal', () => {
    const d: readonly [number, number] = [Date.UTC(2025, 0, 1), Date.UTC(2025, 0, 11)];
    const s = timeScale(d, [0, 1000]);
    expect(s.toPixel(Date.UTC(2025, 0, 6))).toBe(500);
    expect(s.withRange([0, 100]).toPixel(Date.UTC(2025, 0, 6))).toBe(50);
  });
});

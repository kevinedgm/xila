import { describe, expect, it } from 'vitest';
import {
  directionStatus,
  evidenceStatus,
  sideStatus,
  sortStatusRows,
  statusGroups,
  statusLayout,
  type StatusOptions,
} from './status';

const base: StatusOptions = {
  reference: 'history',
  status: 'auto',
  threshold: 0.05,
  window: 5,
  range: [0.125, 0.875],
  sort: 'status',
  maxRows: 12,
};

describe('estado de una fila', () => {
  it('evidencia: dentro, claro cuando el margen no toca la banda, posible cuando la toca', () => {
    expect(evidenceStatus(5, 4, 6, 0, 10)).toBe('inside');
    expect(evidenceStatus(15, 12, 18, 0, 10)).toBe('clear');
    expect(evidenceStatus(12, 9, 15, 0, 10)).toBe('possible');
    expect(evidenceStatus(-3, -5, -1, 0, 10)).toBe('clear');
    // Contra una línea (banda sin ancho) el margen que la cruza es "posible".
    expect(evidenceStatus(2, -1, 5, 0, 0)).toBe('possible');
  });
  it('sin margen la evidencia solo distingue dentro y claro', () => {
    expect(evidenceStatus(12, NaN, NaN, 0, 10)).toBe('clear');
    expect(evidenceStatus(NaN, NaN, NaN, 0, 10)).toBe('none');
  });
  it('dirección: estable dentro del umbral', () => {
    expect(directionStatus(104, 100, 0.05)).toBe('stable');
    expect(directionStatus(106, 100, 0.05)).toBe('up');
    expect(directionStatus(90, 100, 0.05)).toBe('down');
    expect(directionStatus(90, NaN, 0.05)).toBe('none');
  });
  it('lado: arriba, abajo o dentro', () => {
    expect(sideStatus(12, 0, 10)).toBe('above');
    expect(sideStatus(-1, 0, 10)).toBe('below');
    expect(sideStatus(5, 0, 10)).toBe('inside');
    expect(sideStatus(5, 5, 5)).toBe('inside');
  });
});

describe('statusLayout', () => {
  const codes = [0, 0, 0, 0, 1, 1, 1, 1];
  const values = [10, 11, 12, 20, 10, 11, 12, 11];
  const names = ['Fuera', 'Dentro'];

  it('agrupa por código y lee margen y n de la última fila de cada grupo', () => {
    const groups = statusGroups(codes, values, names, {
      low: [NaN, NaN, NaN, 19, NaN, NaN, NaN, 10],
      high: [NaN, NaN, NaN, 21, NaN, NaN, NaN, 12],
      counts: [0, 0, 0, 40, 0, 0, 0, 8],
      periods: [1, 2, 3, 4, 1, 2, 3, 4],
    });
    expect(groups[0]?.low).toBe(19);
    expect(groups[0]?.count).toBe(40);
    expect(groups[1]?.high).toBe(12);
    expect(Array.from(groups[1]?.values ?? [])).toEqual([10, 11, 12, 11]);
  });

  it('referencia history: banda propia, evidencia con margen y orden por estado', () => {
    const groups = statusGroups(codes, values, names, {
      low: [NaN, NaN, NaN, 19, NaN, NaN, NaN, 10],
      high: [NaN, NaN, NaN, 21, NaN, NaN, NaN, 12],
    });
    const layout = statusLayout(groups, base);
    expect(layout.mode).toBe('evidence');
    expect(layout.ownScale).toBe(true);
    expect(layout.rows.map((r) => r.name)).toEqual(['Fuera', 'Dentro']);
    const fuera = layout.rows[0];
    expect(fuera?.status).toBe('clear');
    expect(fuera?.band?.lo).toBeCloseTo(10.375);
    expect(fuera?.distance).toBeGreaterThan(0);
    expect(layout.rows[1]?.status).toBe('inside');
    expect(layout.warnings).toEqual([]);
  });

  it('sin yLow/yHigh, auto elige lado y evidence avisa', () => {
    const groups = statusGroups(codes, values, names);
    expect(statusLayout(groups, base).mode).toBe('side');
    const forced = statusLayout(groups, { ...base, status: 'evidence' });
    expect(forced.mode).toBe('evidence');
    expect(forced.warnings).toHaveLength(1);
    expect(forced.rows[0]?.status).toBe('clear');
  });

  it('referencia peak: unidad en % del pico y dirección contra window periodos atrás', () => {
    const groups = statusGroups([0, 0, 0, 0, 0, 0], [50, 60, 100, 90, 80, 70], ['A']);
    const layout = statusLayout(groups, { ...base, reference: 'peak', window: 3 });
    expect(layout.unit).toBe('percent');
    expect(layout.reference).toBe(100);
    expect(layout.mode).toBe('direction');
    const a = layout.rows[0];
    expect(a?.value).toBe(70);
    expect(a?.previous).toBe(100);
    expect(a?.status).toBe('down');
    expect(Array.from(a?.history ?? [])).toEqual([50, 60, 100, 90, 80]);
  });

  it('referencia previous: 0 % es el periodo anterior y el margen cruza 0 → posible', () => {
    const groups = statusGroups([0, 0, 1, 1], [100, 110, 100, 101], ['Sube', 'Duda'], {
      low: [NaN, 105, NaN, 97],
      high: [NaN, 115, NaN, 105],
    });
    const layout = statusLayout(groups, { ...base, reference: 'previous' });
    expect(layout.reference).toBe(0);
    const sube = layout.rows.find((r) => r.name === 'Sube');
    const duda = layout.rows.find((r) => r.name === 'Duda');
    expect(sube?.value).toBeCloseTo(10);
    expect(sube?.status).toBe('clear');
    expect(duda?.status).toBe('possible');
    expect(duda?.low).toBeLessThan(0);
  });

  it('referencia group: el grupo es la línea, no una fila, y da el periodo de cruce', () => {
    const groups = statusGroups(
      [0, 0, 0, 0, 1, 1, 1, 1],
      [1, 2, 3, 4, 5, 3, 2, 1],
      ['China', 'México'],
      { periods: [2000, 2001, 2002, 2003, 2000, 2001, 2002, 2003] },
    );
    const layout = statusLayout(groups, { ...base, reference: { group: 'China' } });
    expect(layout.referenceName).toBe('China');
    expect(layout.reference).toBe(4);
    expect(layout.rows).toHaveLength(1);
    const mx = layout.rows[0];
    expect(mx?.status).toBe('below');
    // Por debajo de China desde 2002 (en 2001 aún estaba arriba).
    expect(mx?.crossing).toBe(2002);
    expect(statusLayout(groups, { ...base, reference: { group: 'Nadie' } }).warnings).toHaveLength(
      1,
    );
  });

  it('referencia value y orden por distancia; con más de maxRows quedan las 8 más lejos', () => {
    const n = 15;
    const codes = Array.from({ length: n }, (_, i) => i);
    const vals = codes.map((i) => i);
    const names = codes.map((i) => `g${i}`);
    const layout = statusLayout(statusGroups(codes, vals, names), {
      ...base,
      reference: { value: 5 },
      sort: 'distance',
    });
    expect(layout.rows).toHaveLength(8);
    expect(layout.remaining).toBe(7);
    expect(layout.rows[0]?.name).toBe('g14');
    expect(layout.rows.map((r) => r.status)).toContain('above');
    const input = sortStatusRows(layout.rows, 'input');
    expect(input.map((r) => r.name)).toEqual(layout.rows.map((r) => r.name));
  });
});

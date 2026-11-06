import { describe, expect, it } from 'vitest';
import { DEFAULTS, resolveConfig, seriesColor } from './config';
import { DataTable, numberColumn } from './data/table';
import { themes } from './theme';

const data = new DataTable({ x: numberColumn([0, 1]), y: numberColumn([1, 2]) });

describe('resolveConfig', () => {
  it('aplica valores por defecto', () => {
    const r = resolveConfig({ type: 'line', data, series: [{ id: 's', x: 'x', y: 'y' }] });
    expect(r.scales.x).toEqual({ type: 'linear', domain: 'auto', nice: true });
    expect(r.axes.y.show).toBe(true);
    expect(r.theme).toBe(themes.light);
    expect(r.padding).toEqual(DEFAULTS.padding);
    expect(r.line).toEqual(DEFAULTS.line);
    expect(r.plugins).toEqual([]);
  });

  it('las barras usan escala de banda en x por defecto', () => {
    const r = resolveConfig({ type: 'bar', data, series: [{ id: 's', x: 'x', y: 'y' }] });
    expect(r.scales.x.type).toBe('band');
    expect(r.bar.mode).toBe('grouped');
  });

  it('respeta lo que el usuario especifica', () => {
    const r = resolveConfig({
      type: 'scatter',
      data,
      series: [{ id: 's', x: 'x', y: 'y' }],
      scatter: { radius: 7 },
      theme: 'dark',
      padding: { left: 20 },
      scales: { y: { type: 'log' } },
    });
    expect(r.scatter.radius).toBe(7);
    expect(r.theme).toBe(themes.dark);
    expect(r.padding).toEqual({ ...DEFAULTS.padding, left: 20 });
    expect(r.scales.y.type).toBe('log');
  });

  it('falla temprano si una serie apunta a una columna inexistente', () => {
    expect(() =>
      resolveConfig({ type: 'line', data, series: [{ id: 's', x: 'x', y: 'monto' }] }),
    ).toThrow(/"monto" no existe/);
  });

  it('rechaza ids de serie repetidos y configuraciones sin series', () => {
    expect(() =>
      resolveConfig({
        type: 'line',
        data,
        series: [
          { id: 's', x: 'x', y: 'y' },
          { id: 's', x: 'x', y: 'y' },
        ],
      }),
    ).toThrow(/dos series/);
    expect(() => resolveConfig({ type: 'line', data, series: [] })).toThrow(/al menos una/);
  });
});

describe('seriesColor', () => {
  const data = new DataTable({
    x: numberColumn([1, 2]),
    a: numberColumn([1, 2]),
    b: numberColumn([2, 1]),
  });
  const series = [
    { id: 'a', x: 'x', y: 'a' },
    { id: 'b', x: 'x', y: 'b' },
  ];
  it('sin colors usa la posición en la paleta', () => {
    const r = resolveConfig({ type: 'line', data, series });
    expect(seriesColor(r, 1)).toBe(r.theme.palette[1]);
  });
  it('colors fija el color por id y stroke gana sobre colors', () => {
    const r = resolveConfig({ type: 'line', data, series, colors: { b: '#123456', a: '#654321' } });
    expect(seriesColor(r, 1)).toBe('#123456');
    const s = resolveConfig({
      type: 'line',
      data,
      series: [{ ...series[0]!, stroke: '#000001' }, series[1]!],
      colors: { a: '#654321' },
    });
    expect(seriesColor(s, 0)).toBe('#000001');
  });
  it('ignora nombres heredados del prototipo', () => {
    const r = resolveConfig({
      type: 'line',
      data,
      series: [{ id: 'constructor', x: 'x', y: 'a' }],
      colors: {},
    });
    expect(seriesColor(r, 0)).toBe(r.theme.palette[0]);
  });
});

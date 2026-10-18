import { describe, expect, it, vi } from 'vitest';
import { resolveConfig, type ChartConfig } from '../config';
import { resolveSeries } from '../data/series';
import { DataTable, categoryColumn, numberColumn, timeColumn } from '../data/table';
import { Emitter } from '../events';
import type { PluginContext } from '../plugin';
import type { Renderer } from '../renderer';
import { chartSummary } from './accessibility';

function context(raw: ChartConfig): PluginContext {
  const config = resolveConfig(raw);
  const series = config.series.map((s) => resolveSeries(config.data, s));
  const domain = (axis: 'x' | 'y'): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) {
      for (const v of axis === 'x' ? s.x : s.y) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    return [lo, hi];
  };
  return {
    config,
    renderer: {} as Renderer,
    layout: { width: 100, height: 50, plotArea: { x: 10, y: 5, width: 80, height: 40 } },
    events: new Emitter(),
    requestDraw: vi.fn(),
    hiddenSeries: new Set(),
    toggleSeries: vi.fn(),
    getScales: () => null,
    getSeries: () => series,
    hoverAt: vi.fn(),
    clearHover: vi.fn(),
    getDataDomain: domain,
    getViewDomain: () => null,
    setViewDomain: vi.fn(),
    update: vi.fn(),
    getSelection: () => null,
    setSelection: vi.fn(),
    countSelection: () => ({ count: 0, total: 0 }),
    getBinEdges: () => null,
  };
}

describe('chartSummary', () => {
  it('describe una serie temporal con fechas y rango de valores', () => {
    const ctx = context({
      type: 'line',
      data: new DataTable({
        fecha: timeColumn([new Date('2025-01-01T00:00:00Z'), new Date('2025-12-31T00:00:00Z')]),
        ventas: numberColumn([420, 1450]),
      }),
      series: [{ id: 'v', name: 'Ventas', x: 'fecha', y: 'ventas' }],
      axes: { y: { title: 'MXN' } },
    });
    expect(chartSummary(ctx)).toBe(
      'Gráfico de líneas. Serie Ventas. 2 datos de 1 ene 2025 a 31 dic 2025. Valores entre 420 y 1,450 (MXN).',
    );
  });

  it('en barras nombra las categorías y lista varias series', () => {
    const ctx = context({
      type: 'bar',
      data: new DataTable({
        region: categoryColumn(['Norte', 'Centro', 'Sur']),
        a: numberColumn([1, 2, 3]),
        b: numberColumn([4, 5, 6]),
      }),
      series: [
        { id: 'a', name: 'A', x: 'region', y: 'a' },
        { id: 'b', name: 'B', x: 'region', y: 'b' },
      ],
    });
    expect(chartSummary(ctx)).toBe(
      'Gráfico de barras. 2 series: A y B. 3 categorías de Norte a Sur. Valores entre 1 y 6.',
    );
  });
});

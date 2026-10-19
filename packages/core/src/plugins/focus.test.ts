import { describe, expect, it, vi } from 'vitest';
import { resolveConfig, type ChartConfig } from '../config';
import { DataTable, numberColumn } from '../data/table';
import { Emitter } from '../events';
import type { PluginContext } from '../plugin';
import type { Renderer } from '../renderer';
import { focusPlugin } from './focus';

function context() {
  const data = new DataTable({ a: numberColumn([0, 1]), b: numberColumn([1, 2]) });
  const raw: ChartConfig = {
    type: 'line',
    data,
    series: [
      { id: 'mx', name: 'México', x: 'a', y: 'b' },
      { id: 'de', name: 'Alemania', x: 'a', y: 'b' },
    ],
  };
  const ctx: PluginContext = {
    config: resolveConfig(raw),
    renderer: { measureText: vi.fn(() => 40) } as unknown as Renderer,
    layout: { width: 120, height: 70, plotArea: { x: 10, y: 10, width: 100, height: 50 } },
    events: new Emitter(),
    requestDraw: vi.fn(),
    hiddenSeries: new Set(),
    toggleSeries: vi.fn(),
    getScales: () => null,
    getSeries: () => [],
    hoverAt: vi.fn(),
    clearHover: vi.fn(),
    getDataDomain: () => [0, 1],
    getViewDomain: () => null,
    setViewDomain: vi.fn(),
    update: vi.fn(),
    requestLayout: vi.fn(),
    getSelection: () => null,
    setSelection: vi.fn(),
    countSelection: () => ({ count: 0, total: 0 }),
    getBinEdges: () => null,
  };
  return { ctx, raw };
}

describe('focusPlugin', () => {
  it('deja a la protagonista con su color de paleta y apaga a las demás', () => {
    const { ctx, raw } = context();
    const plugin = focusPlugin({ series: 'de', selector: false });
    plugin.install?.(ctx);
    const out = plugin.beforeUpdate?.(raw, ctx) as ChartConfig;
    expect(out.series[0]?.stroke).toBe(ctx.config.theme.muted);
    expect(out.series[1]?.stroke).toBe(ctx.config.theme.palette[1]);
  });

  it('sin serie indicada toma la primera; si desaparece, vuelve a la primera', () => {
    const { ctx, raw } = context();
    const plugin = focusPlugin({ selector: false });
    plugin.install?.(ctx);
    expect((plugin.beforeUpdate?.(raw, ctx) as ChartConfig).series[0]?.stroke).toBe(
      ctx.config.theme.palette[0],
    );
    const solo = { ...raw, series: [raw.series[1] as (typeof raw.series)[number]] };
    expect((plugin.beforeUpdate?.(solo, ctx) as ChartConfig).series[0]?.stroke).toBe(
      ctx.config.theme.palette[0],
    );
  });
});

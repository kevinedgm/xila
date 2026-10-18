import { describe, expect, it, vi } from 'vitest';
import { resolveConfig } from './config';
import { DataTable, numberColumn } from './data/table';
import { Emitter } from './events';
import { PLUGIN_HOOK_ORDER, PluginRegistry, type ChartPlugin, type PluginContext } from './plugin';
import { applyMap, type Renderer } from './renderer';

const data = new DataTable({ x: numberColumn([0, 1]), y: numberColumn([1, 2]) });
const baseConfig = { type: 'line' as const, data, series: [{ id: 's', x: 'x', y: 'y' }] };

function fakeContext(): PluginContext {
  const renderer = {
    drawRect: vi.fn(),
  } as unknown as Renderer;
  return {
    config: resolveConfig(baseConfig),
    renderer,
    layout: { width: 100, height: 50, plotArea: { x: 10, y: 5, width: 80, height: 40 } },
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
    getSelection: () => null,
    setSelection: vi.fn(),
    countSelection: () => ({ count: 0, total: 0 }),
    getBinEdges: () => null,
  };
}

/** Plugin de prueba: registra cada hook y dibuja un rectángulo en afterDraw. */
function recorder(id: string, log: string[]): ChartPlugin {
  return {
    id,
    install: () => log.push(`${id}:install`),
    beforeUpdate: (config) => {
      log.push(`${id}:beforeUpdate`);
      return { ...config, padding: { top: 42 } };
    },
    reserveSpace: () => {
      log.push(`${id}:reserveSpace`);
      return { top: 10 };
    },
    afterLayout: () => log.push(`${id}:afterLayout`),
    beforeDraw: () => log.push(`${id}:beforeDraw`),
    afterDraw: (ctx) => {
      log.push(`${id}:afterDraw`);
      const { x, y, width, height } = ctx.layout.plotArea;
      ctx.renderer.drawRect('overlay', x, y, width, height, { fill: 'red' });
    },
    onEvent: (name) => log.push(`${id}:onEvent:${name}`),
    uninstall: () => log.push(`${id}:uninstall`),
  };
}

describe('PluginRegistry', () => {
  it('ejecuta los hooks en el orden documentado y en orden de registro', () => {
    const log: string[] = [];
    const ctx = fakeContext();
    const registry = new PluginRegistry([recorder('a', log), recorder('b', log)]);

    registry.install(ctx);
    const updated = registry.beforeUpdate(baseConfig, ctx);
    const space = registry.reserveSpace(ctx);
    registry.afterLayout(ctx.layout, ctx);
    registry.beforeDraw(ctx);
    registry.afterDraw(ctx);
    registry.onEvent('resize', { width: 1, height: 1 }, ctx);
    registry.uninstall(ctx);

    const hooksSeen = log.map((l) => l.split(':')[1]);
    const unique = [...new Set(hooksSeen)];
    expect(unique).toEqual([...PLUGIN_HOOK_ORDER]);
    expect(log.slice(0, 2)).toEqual(['a:install', 'b:install']);
    // La desinstalación va en orden inverso.
    expect(log.slice(-2)).toEqual(['b:uninstall', 'a:uninstall']);
    expect(updated.padding).toEqual({ top: 42 });
    expect(space).toEqual({ top: 20, right: 0, bottom: 0, left: 0 });
    expect(ctx.renderer.drawRect).toHaveBeenCalledWith('overlay', 10, 5, 80, 40, { fill: 'red' });
    expect(registry.list()).toHaveLength(0);
  });

  it('rechaza ids repetidos', () => {
    const registry = new PluginRegistry([{ id: 'x' }]);
    expect(() => registry.add({ id: 'x' })).toThrow(/"x"/);
  });

  it('un plugin cabe en pocas líneas: solo necesita id', () => {
    const minimal: ChartPlugin = { id: 'nada' };
    const registry = new PluginRegistry([minimal]);
    expect(() => registry.beforeDraw(fakeContext())).not.toThrow();
  });
});

describe('Emitter', () => {
  it('entrega eventos tipados y permite darse de baja', () => {
    const e = new Emitter();
    const seen: unknown[] = [];
    const off = e.on('zoom', (p) => seen.push(p.x[0]));
    e.emit('zoom', { x: [1, 2], y: [0, 1] });
    off();
    e.emit('zoom', { x: [3, 4], y: [0, 1] });
    expect(seen).toEqual([1]);
  });
});

describe('applyMap', () => {
  it('convierte valores a píxeles con el eje Y invertido', () => {
    const y = { offset: 0, scale: -2, base: 100 };
    expect(applyMap(y, 0)).toBe(100);
    expect(applyMap(y, 50)).toBe(0);
  });
});

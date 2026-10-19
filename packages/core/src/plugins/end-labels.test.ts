import { describe, expect, it, vi } from 'vitest';
import { resolveConfig } from '../config';
import type { ResolvedSeries } from '../data/series';
import { DataTable, numberColumn } from '../data/table';
import { Emitter } from '../events';
import type { PluginContext } from '../plugin';
import type { Renderer } from '../renderer';
import { bandScale } from '../scales/band';
import { linearScale } from '../scales/linear';
import { endLabelsPlugin } from './end-labels';

const x = linearScale([0, 100], [10, 110]);
const y = linearScale([0, 10], [60, 10]);

function serie(id: string, xs: number[], ys: number[]): ResolvedSeries {
  return {
    id,
    name: id,
    x: Float64Array.from(xs),
    y: Float64Array.from(ys),
    size: undefined,
    yLow: undefined,
    yHigh: undefined,
    value: undefined,
    length: xs.length,
  };
}

function context(series: ResolvedSeries[], scales: PluginContext['getScales'] = () => ({ x, y })) {
  const renderer = {
    drawText: vi.fn(),
    drawPointSeries: vi.fn(),
    measureText: vi.fn((t: string) => t.length * 6),
  } as unknown as Renderer;
  const data = new DataTable({ a: numberColumn([0, 1]), b: numberColumn([1, 2]) });
  const ctx: PluginContext = {
    config: resolveConfig({
      type: 'line',
      data,
      series: series.map((s) => ({ id: s.id, name: s.id, x: 'a', y: 'b' })),
    }),
    renderer,
    layout: { width: 120, height: 70, plotArea: { x: 10, y: 10, width: 100, height: 50 } },
    events: new Emitter(),
    requestDraw: vi.fn(),
    hiddenSeries: new Set(),
    toggleSeries: vi.fn(),
    getScales: scales,
    getSeries: () => series,
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
  return { ctx, renderer };
}

describe('endLabelsPlugin', () => {
  it('reserva a la derecha el ancho de la etiqueta más larga más el punto', () => {
    const { ctx } = context([
      serie('Alemania', [0, 100], [1, 8]),
      serie('México', [0, 100], [1, 3]),
    ]);
    const space = endLabelsPlugin().reserveSpace?.(ctx);
    // "Alemania" (8 × 6 px) + hueco 0,6 em + "8" (6 px) + marcador 4 + 10, redondeado arriba.
    const fontSize = ctx.config.theme.fontSize;
    expect(space).toEqual({ right: Math.ceil(8 * 6 + fontSize * 0.6 + 6) + 4 + 10 });
  });

  it('escribe nombre y último valor junto al último punto, en color de texto', () => {
    const { ctx, renderer } = context([serie('a', [0, 100], [1, 5])]);
    endLabelsPlugin().afterDraw?.(ctx);
    expect(renderer.drawPointSeries).toHaveBeenCalledTimes(1);
    // Nombre y cifra son dos textos: el nombre en la fuente de interfaz y la cifra en la de cifras.
    const calls = (renderer.drawText as ReturnType<typeof vi.fn>).mock.calls as [
      string,
      string,
      number,
      number,
      { fill: string; font: string },
    ][];
    expect(calls.map((c) => c[1])).toEqual(['a', '5']);
    expect(calls[0]?.[2]).toBe(110 + 4 + 6);
    expect(calls[1]?.[2]).toBe(110 + 4 + 6 + 6 + ctx.config.theme.fontSize * 0.6);
    expect(calls[0]?.[3]).toBe(y.toPixel(5));
    expect(calls[0]?.[4].fill).toBe(ctx.config.theme.text);
    expect(calls[1]?.[4].font).not.toBe(calls[0]?.[4].font);
  });

  it('ignora los NaN finales y las series ocultas', () => {
    const { ctx, renderer } = context([
      serie('a', [0, 50, 100], [1, 5, NaN]),
      serie('b', [0], [2]),
    ]);
    (ctx.hiddenSeries as Set<string>).add('b');
    endLabelsPlugin({ name: false }).afterDraw?.(ctx);
    expect(renderer.drawText).toHaveBeenCalledTimes(1);
    const [, text, px] = (renderer.drawText as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      number,
    ];
    expect(text).toBe('5');
    expect(px).toBe(x.toPixel(50) + 10);
  });

  it('separa dos etiquetas que chocan sin salirse del área', () => {
    const { ctx, renderer } = context([
      serie('a', [0, 100], [1, 9.9]),
      serie('b', [0, 100], [1, 10]),
    ]);
    endLabelsPlugin({ minGap: 14 }).afterDraw?.(ctx);
    const ys = [
      ...new Set(
        (renderer.drawText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[3] as number),
      ),
    ].sort((p, q) => p - q);
    expect(ys[0]).toBe(10);
    expect(ys[1]).toBe(24);
  });

  it('no dibuja nada con un eje X de bandas', () => {
    const { ctx, renderer } = context([serie('a', [0], [1])], () => ({
      x: bandScale(2, [0, 100], 0),
      y,
    }));
    const plugin = endLabelsPlugin();
    plugin.afterDraw?.(ctx);
    expect(renderer.drawText).not.toHaveBeenCalled();
  });
});

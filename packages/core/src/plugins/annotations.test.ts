import { describe, expect, it, vi } from 'vitest';
import { resolveConfig } from '../config';
import { DataTable, categoryColumn, numberColumn } from '../data/table';
import { Emitter } from '../events';
import type { PluginContext } from '../plugin';
import type { Renderer } from '../renderer';
import { bandScale } from '../scales/band';
import { linearScale } from '../scales/linear';
import { annotationAt, annotationBoxes, annotationPixel, annotationsPlugin } from './annotations';

const x = linearScale([0, 100], [10, 110]);
const y = linearScale([0, 10], [60, 10]);

function context(scales: { x: typeof x | ReturnType<typeof bandScale>; y: typeof y }) {
  const renderer = {
    drawRule: vi.fn(),
    drawRect: vi.fn(),
    drawText: vi.fn(),
    measureText: vi.fn(() => 30),
  } as unknown as Renderer;
  const data = new DataTable({ a: numberColumn([0, 1]), b: numberColumn([1, 2]) });
  const ctx: PluginContext = {
    config: resolveConfig({ type: 'line', data, series: [{ id: 's', x: 'a', y: 'b' }] }),
    renderer,
    layout: { width: 120, height: 70, plotArea: { x: 10, y: 10, width: 100, height: 50 } },
    events: new Emitter(),
    requestDraw: vi.fn(),
    hiddenSeries: new Set(),
    toggleSeries: vi.fn(),
    getScales: () => scales,
    getSeries: () => [],
    hoverAt: vi.fn(),
    clearHover: vi.fn(),
    getDataDomain: () => [0, 1],
    getViewDomain: () => null,
    setViewDomain: vi.fn(),
  };
  return { ctx, renderer };
}

describe('annotationPixel', () => {
  it('convierte números y fechas con la escala continua', () => {
    expect(annotationPixel(50, 'x', { x, y }, [])).toBe(60);
    const t = linearScale([0, 1000], [0, 100]);
    expect(annotationPixel(new Date(500), 'x', { x: t, y }, [])).toBe(50);
  });

  it('en un eje de barras busca la categoría y devuelve el centro de su banda', () => {
    const band = bandScale(3, [0, 30], 0);
    expect(annotationPixel('b', 'x', { x: band, y }, ['a', 'b', 'c'])).toBe(band.center(1));
    expect(annotationPixel('zzz', 'x', { x: band, y }, ['a', 'b', 'c'])).toBeNull();
    expect(annotationPixel(2, 'x', { x: band, y }, ['a', 'b', 'c'])).toBe(band.center(2));
  });

  it('ignora valores inválidos', () => {
    expect(annotationPixel('texto', 'x', { x, y }, [])).toBeNull();
    expect(annotationPixel(NaN, 'y', { x, y }, [])).toBeNull();
  });
});

describe('annotationsPlugin', () => {
  it('dibuja la línea y la banda con la escala del momento (siguen al zoom)', () => {
    const { ctx, renderer } = context({ x, y });
    const plugin = annotationsPlugin([
      { type: 'line', axis: 'x', value: 50, label: 'evento' },
      { type: 'band', axis: 'x', from: 20, to: 40 },
      { type: 'line', axis: 'y', value: 5 },
    ]);
    plugin.afterDraw?.(ctx);
    expect(renderer.drawRule).toHaveBeenNthCalledWith(1, 'data', 60, 10, 60, 60, expect.anything());
    expect(renderer.drawRect).toHaveBeenCalledWith('data', 30, 10, 20, 50, expect.anything());
    expect(renderer.drawRule).toHaveBeenNthCalledWith(
      2,
      'data',
      10,
      35,
      110,
      35,
      expect.anything(),
    );
    expect(renderer.drawText).toHaveBeenCalledWith('data', 'evento', 64, 14, expect.anything());

    // Con "zoom" (otra escala) las mismas anotaciones caen en otros píxeles.
    const zoomed = context({ x: linearScale([40, 60], [10, 110]), y });
    plugin.afterDraw?.(zoomed.ctx);
    expect(zoomed.renderer.drawRule).toHaveBeenNthCalledWith(
      1,
      'data',
      60,
      10,
      60,
      60,
      expect.anything(),
    );
    expect(zoomed.renderer.drawRect).toHaveBeenCalledWith(
      'data',
      -90,
      10,
      100,
      50,
      expect.anything(),
    );
  });

  it('una banda abierta llega al borde del área', () => {
    const { ctx, renderer } = context({ x, y });
    annotationsPlugin([{ type: 'band', axis: 'y', to: 2 }]).afterDraw?.(ctx);
    // y=2 → píxel 50; hasta el borde inferior (60).
    expect(renderer.drawRect).toHaveBeenCalledWith('data', 10, 50, 100, 10, expect.anything());
  });

  it('set() reemplaza y pide redibujo', () => {
    const { ctx } = context({ x, y });
    // Sin `hover` no hace falta DOM (vitest corre en Node).
    const plugin = annotationsPlugin([], { hover: false });
    plugin.install?.(ctx);
    plugin.set([{ type: 'text', x: 1, y: 1, text: 'hola' }]);
    expect(plugin.get()).toHaveLength(1);
    expect(ctx.requestDraw).toHaveBeenCalled();
  });

  it('usa las categorías del eje de barras', () => {
    const band = bandScale(2, [10, 110], 0);
    const { ctx, renderer } = context({ x: band, y });
    const data = new DataTable({ a: categoryColumn(['norte', 'sur']), b: numberColumn([1, 2]) });
    const c = {
      ...ctx,
      config: resolveConfig({ type: 'bar', data, series: [{ id: 's', x: 'a', y: 'b' }] }),
    };
    annotationsPlugin([{ type: 'line', axis: 'x', value: 'sur' }]).afterDraw?.(c);
    expect(renderer.drawRule).toHaveBeenCalledWith(
      'data',
      band.center(1),
      10,
      band.center(1),
      60,
      expect.anything(),
    );
  });
});

describe('etiquetas y detalle', () => {
  it('una línea cerca del borde derecho pone su etiqueta a la izquierda', () => {
    const { ctx, renderer } = context({ x, y });
    // x=95 → píxel 105; el área termina en 110 y el texto mide 30: no cabe a la derecha.
    annotationsPlugin([{ type: 'line', axis: 'x', value: 95, label: 'fin' }]).afterDraw?.(ctx);
    expect(renderer.drawText).toHaveBeenCalledWith(
      'data',
      'fin',
      101,
      14,
      expect.objectContaining({ align: 'right' }),
    );
  });

  it('labelPosition: end baja la etiqueta al pie de la línea', () => {
    const { ctx, renderer } = context({ x, y });
    annotationsPlugin([
      { type: 'line', axis: 'x', value: 10, label: 'a', labelPosition: 'end' },
    ]).afterDraw?.(ctx);
    expect(renderer.drawText).toHaveBeenCalledWith(
      'data',
      'a',
      24,
      56,
      expect.objectContaining({ baseline: 'bottom' }),
    );
  });

  it('annotationAt encuentra la anotación bajo el cursor, la última encima', () => {
    const area = { x: 10, y: 10, width: 100, height: 50 };
    const boxes = annotationBoxes(
      [
        { type: 'band', axis: 'x', from: 20, to: 60, id: 'banda' },
        { type: 'line', axis: 'x', value: 50, id: 'linea' },
      ],
      { x, y },
      area,
      [],
    );
    expect(annotationAt(boxes, 60, 30)?.id).toBe('linea');
    expect(annotationAt(boxes, 40, 30)?.id).toBe('banda');
    expect(annotationAt(boxes, 100, 30)).toBeNull();
  });
});

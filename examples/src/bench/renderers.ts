import { lowerBound, minMaxDecimate, type DecimatedSeries } from '@xila/core';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { ColumnarSeries } from './synthetic';

export interface BenchRenderer {
  /** Dibuja el rango visible `[x0, x1]` y devuelve cuántos vértices se trazaron. */
  draw(x0: number, x1: number): number;
  /** Fuerza a que el navegador termine de rasterizar, para medir el costo real. */
  flush(): void;
}

const WIDTH = 1000;
const HEIGHT = 400;

function createCanvas(host: HTMLElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  canvas.style.width = `${WIDTH}px`;
  canvas.style.height = `${HEIGHT}px`;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.scale(dpr, dpr);
  return ctx;
}

function yRange(series: ColumnarSeries): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of series.y) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Línea base: todos los puntos visibles en un solo path, sin decimación. */
export function naiveCanvas(host: HTMLElement, series: ColumnarSeries): BenchRenderer {
  const ctx = createCanvas(host);
  const [yMin, yMax] = yRange(series);
  const ky = HEIGHT / (yMax - yMin);
  return {
    draw(x0, x1) {
      const kx = WIDTH / (x1 - x0);
      const from = Math.max(0, lowerBound(series.x, x0) - 1);
      const to = Math.min(series.x.length, lowerBound(series.x, x1) + 1);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.beginPath();
      for (let i = from; i < to; i++) {
        const px = ((series.x[i] as number) - x0) * kx;
        const py = HEIGHT - ((series.y[i] as number) - yMin) * ky;
        if (i === from) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#1f6f8b';
      ctx.lineWidth = 1;
      ctx.stroke();
      return to - from;
    },
    flush() {
      ctx.getImageData(0, 0, 1, 1);
    },
  };
}

/** Culling por búsqueda binaria + decimación min/max por columna de píxel físico. */
export function decimatedCanvas(host: HTMLElement, series: ColumnarSeries): BenchRenderer {
  const ctx = createCanvas(host);
  const dpr = window.devicePixelRatio || 1;
  const [yMin, yMax] = yRange(series);
  const ky = HEIGHT / (yMax - yMin);
  let buffer: DecimatedSeries | undefined;
  return {
    draw(x0, x1) {
      const kx = WIDTH / (x1 - x0);
      const from = Math.max(0, lowerBound(series.x, x0) - 1);
      const to = Math.min(series.x.length, lowerBound(series.x, x1) + 1);
      buffer = minMaxDecimate(series.x, series.y, from, to, x0, kx * dpr, buffer);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.beginPath();
      for (let k = 0; k < buffer.length; k++) {
        const px = ((buffer.x[k] as number) - x0) * kx;
        const py = HEIGHT - ((buffer.y[k] as number) - yMin) * ky;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#1f6f8b';
      ctx.lineWidth = 1;
      ctx.stroke();
      return buffer.length;
    },
    flush() {
      ctx.getImageData(0, 0, 1, 1);
    },
  };
}

/** uPlot como referencia externa. Su path lineal ya agrupa puntos por píxel. */
export function uplotRenderer(host: HTMLElement, series: ColumnarSeries): BenchRenderer {
  const [yMin, yMax] = yRange(series);
  const plot = new uPlot(
    {
      width: WIDTH,
      height: HEIGHT,
      legend: { show: false },
      cursor: { show: false },
      axes: [{ show: false }, { show: false }],
      scales: { x: { time: false }, y: { auto: false, range: [yMin, yMax] } },
      series: [{}, { stroke: '#1f6f8b', width: 1 }],
    },
    [series.x as unknown as number[], series.y as unknown as number[]],
    host,
  );
  const canvas = host.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  return {
    draw(x0, x1) {
      // setScale difiere el dibujo a una microtarea; batch() lo hace síncrono para medirlo.
      plot.batch(() => plot.setScale('x', { min: x0, max: x1 }));
      return Math.min(series.x.length, lowerBound(series.x, x1)) - lowerBound(series.x, x0);
    },
    flush() {
      ctx?.getImageData(0, 0, 1, 1);
    },
  };
}

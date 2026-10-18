import {
  Chart,
  DataTable,
  lowerBound,
  minMaxDecimate,
  numberColumn,
  type DecimatedSeries,
} from 'xilaplot';
import { Chart as ChartJS } from 'chart.js/auto';
import * as echarts from 'echarts';
import Plotly from 'plotly.js-dist-min';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { ColumnarSeries } from './synthetic';

export interface BenchRenderer {
  /** Dibuja el rango visible `[x0, x1]` y devuelve cuántos vértices se trazaron (o cuántos puntos caen en el rango). */
  draw(x0: number, x1: number): number | Promise<number>;
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

/** Xila completa (`Chart` con ejes y grid), no solo el canvas decimado: es lo que paga el usuario. */
export function xilaRenderer(host: HTMLElement, series: ColumnarSeries): BenchRenderer {
  host.style.width = `${WIDTH}px`;
  host.style.height = `${HEIGHT}px`;
  const chart = new Chart(host, {
    type: 'line',
    lazy: false,
    data: new DataTable({ x: numberColumn(series.x), y: numberColumn(series.y) }),
    series: [{ id: 's', name: 'serie', x: 'x', y: 'y' }],
    scales: { x: { type: 'linear' } },
  });
  return {
    draw(x0, x1) {
      chart.setViewDomain('x', [x0, x1]);
      chart.drawNow();
      return Math.min(series.x.length, lowerBound(series.x, x1)) - lowerBound(series.x, x0);
    },
    flush() {
      host.querySelector('canvas')?.getContext('2d')?.getImageData(0, 0, 1, 1);
    },
  };
}

/**
 * Chart.js con su plugin de decimación min-max (requiere `parsing: false`, datos `{x, y}` y eje
 * lineal) y sin animación: la configuración que su documentación recomienda para series grandes.
 */
export function chartjsRenderer(host: HTMLElement, series: ColumnarSeries): BenchRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  host.appendChild(canvas);
  const [yMin, yMax] = yRange(series);
  const data = new Array<{ x: number; y: number }>(series.x.length);
  for (let i = 0; i < data.length; i++)
    data[i] = { x: series.x[i] as number, y: series.y[i] as number };
  const chart = new ChartJS(canvas, {
    type: 'line',
    data: { datasets: [{ data, borderColor: '#1f6f8b', borderWidth: 1, pointRadius: 0 }] },
    options: {
      animation: false,
      parsing: false,
      normalized: true,
      responsive: false,
      spanGaps: true,
      scales: { x: { type: 'linear' }, y: { min: yMin, max: yMax } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        decimation: { enabled: true, algorithm: 'min-max' },
      },
    },
  });
  const ctx = canvas.getContext('2d');
  return {
    draw(x0, x1) {
      const x = chart.options.scales?.['x'];
      if (x) {
        x.min = x0;
        x.max = x1;
      }
      chart.update('none');
      return Math.min(series.x.length, lowerBound(series.x, x1)) - lowerBound(series.x, x0);
    },
    flush() {
      ctx?.getImageData(0, 0, 1, 1);
    },
  };
}

/** ECharts con `sampling: 'lttb'`, `large: true` y las columnas tipadas en un `dataset`. */
export function echartsRenderer(host: HTMLElement, series: ColumnarSeries): BenchRenderer {
  const chart = echarts.init(host, undefined, { renderer: 'canvas', width: WIDTH, height: HEIGHT });
  const [yMin, yMax] = yRange(series);
  chart.setOption({
    animation: false,
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    dataset: { source: { x: series.x, y: series.y } },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'value', min: yMin, max: yMax, show: false },
    series: [
      {
        type: 'line',
        encode: { x: 'x', y: 'y' },
        showSymbol: false,
        sampling: 'lttb',
        large: true,
        lineStyle: { width: 1, color: '#1f6f8b' },
      },
    ],
  });
  const canvas = host.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  return {
    draw(x0, x1) {
      chart.setOption({ xAxis: { min: x0, max: x1 } });
      // ECharts dibuja en el siguiente fotograma; flush() de zrender lo hace síncrono para medirlo.
      chart.getZr().flush();
      return Math.min(series.x.length, lowerBound(series.x, x1)) - lowerBound(series.x, x0);
    },
    flush() {
      ctx?.getImageData(0, 0, 1, 1);
    },
  };
}

/** Plotly con `scattergl` (WebGL) y `staticPlot`, que es su camino para series grandes. */
export function plotlyRenderer(host: HTMLElement, series: ColumnarSeries): BenchRenderer {
  const ready = Plotly.newPlot(
    host,
    [
      {
        type: 'scattergl',
        mode: 'lines',
        x: series.x,
        y: series.y,
        line: { width: 1, color: '#1f6f8b' },
      },
    ],
    {
      width: WIDTH,
      height: HEIGHT,
      margin: { l: 0, r: 0, t: 0, b: 0 },
      xaxis: { visible: false },
      yaxis: { visible: false, range: yRange(series) },
      showlegend: false,
    },
    { staticPlot: true, displayModeBar: false },
  );
  return {
    async draw(x0, x1) {
      await ready;
      await Plotly.relayout(host, { 'xaxis.range': [x0, x1] });
      return Math.min(series.x.length, lowerBound(series.x, x1)) - lowerBound(series.x, x0);
    },
    flush() {
      const gl = host.querySelector('canvas')?.getContext('webgl');
      if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    },
  };
}

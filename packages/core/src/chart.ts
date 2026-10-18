import {
  axisMargins,
  bandTicks,
  continuousTicks,
  drawAxes,
  thinLabels,
  type AxisTicks,
} from './axes';
import { resolveConfig, type ChartConfig, type ResolvedChartConfig } from './config';
import { minMaxDecimate, type DecimatedSeries } from './data/decimate';
import { lowerBound } from './data/search';
import { resolveSeries, type ResolvedSeries } from './data/series';
import { Emitter } from './events';
import { PluginRegistry, type Layout, type PluginContext, type Rect } from './plugin';
import type { Renderer, Transform } from './renderer';
import { CanvasRenderer } from './renderer-canvas';
import { bandScale, type BandScale } from './scales/band';
import { linearScale, type ContinuousScale, type Domain } from './scales/linear';

const IDENTITY = { offset: 0, scale: 1, base: 0 } as const;
const FALLBACK_WIDTH = 600;
const FALLBACK_HEIGHT = 400;

export interface ChartScales {
  readonly x: ContinuousScale | BandScale;
  readonly y: ContinuousScale;
}

/**
 * Orquesta configuración, escalas, renderer y plugins.
 *
 * Ciclo: `new Chart(contenedor, config)` → resuelve config → calcula layout → crea
 * escalas → dibuja. `update()` repite solo lo necesario; los redibujos se agrupan en un
 * `requestAnimationFrame`. `destroy()` deja el contenedor como estaba.
 */
export class Chart {
  readonly events = new Emitter();
  readonly renderer: CanvasRenderer;

  private raw: ChartConfig;
  private config: ResolvedChartConfig;
  private series: ResolvedSeries[] = [];
  private readonly plugins: PluginRegistry;
  private readonly container: HTMLElement;
  private readonly observer: ResizeObserver | null;
  private layout: Layout;
  private scales: ChartScales | null = null;
  private frame = 0;
  private dirty = { data: true, layout: true };
  private destroyed = false;
  private decimation: DecimatedSeries[] = [];

  constructor(container: HTMLElement, config: ChartConfig) {
    this.container = container;
    this.raw = config;
    this.renderer = new CanvasRenderer(container);
    this.plugins = new PluginRegistry(config.plugins);
    this.config = resolveConfig(this.plugins.beforeUpdate(config, this.context()));
    this.layout = emptyLayout();
    this.plugins.install(this.context());
    this.observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            this.dirty.layout = true;
            this.requestDraw();
          });
    this.observer?.observe(container);
    this.requestDraw();
  }

  /** Mezcla cambios sobre la configuración actual y redibuja. */
  update(patch: Partial<ChartConfig>): void {
    this.assertAlive();
    const next = { ...this.raw, ...patch } as ChartConfig;
    this.raw = next;
    this.config = resolveConfig(this.plugins.beforeUpdate(next, this.context()));
    this.dirty.data = true;
    this.dirty.layout = true;
    this.events.emit('dataChanged', { reason: 'update' });
    this.requestDraw();
  }

  /** Fuerza recalcular el tamaño; normalmente lo hace solo el `ResizeObserver`. */
  resize(): void {
    this.assertAlive();
    this.dirty.layout = true;
    this.requestDraw();
  }

  getConfig(): ResolvedChartConfig {
    return this.config;
  }

  getSeries(): readonly ResolvedSeries[] {
    if (this.dirty.data) this.resolveData();
    return this.series;
  }

  getLayout(): Layout {
    return this.layout;
  }

  /** Escalas del último dibujo; `null` antes del primero. */
  getScales(): ChartScales | null {
    return this.scales;
  }

  toDataURL(type?: string): string {
    return this.renderer.toDataURL(type);
  }

  /** Dibuja ahora, sin esperar al siguiente fotograma. Útil en tests y exportaciones. */
  drawNow(): void {
    this.assertAlive();
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    this.draw();
  }

  requestDraw(): void {
    if (this.destroyed || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.plugins.uninstall(this.context());
    this.events.clear();
    this.renderer.destroy();
  }

  private context(): PluginContext {
    return {
      config: this.config,
      renderer: this.renderer,
      layout: this.layout,
      events: this.events,
      requestDraw: () => this.requestDraw(),
    };
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error('El gráfico ya fue destruido');
  }

  private resolveData(): void {
    this.series = this.config.series.map((spec) => resolveSeries(this.config.data, spec));
    this.decimation = [];
    this.dirty.data = false;
  }

  private draw(): void {
    if (this.destroyed) return;
    const { renderer, config } = this;
    if (this.dirty.data) this.resolveData();

    const width = this.container.clientWidth || FALLBACK_WIDTH;
    const height = this.container.clientHeight || FALLBACK_HEIGHT;
    if (this.dirty.layout || width !== this.layout.width || height !== this.layout.height) {
      renderer.resize(width, height, window.devicePixelRatio || 1);
      this.events.emit('resize', { width, height });
      this.dirty.layout = false;
    }
    renderer.setBackground(config.theme.background);

    // 1. Escalas con un rango provisional, solo para saber qué etiquetas habrá.
    const { padding, theme } = config;
    const provisional: Rect = {
      x: padding.left,
      y: padding.top,
      width: width - padding.left - padding.right,
      height: height - padding.top - padding.bottom,
    };
    let scales = this.buildScales(provisional);
    let ticks = this.buildTicks(scales);

    // 2. Medir etiquetas, fijar el área de dibujo y recalcular con el rango definitivo.
    const margins = axisMargins(renderer, theme, ticks.x, ticks.y, config.axes.x, config.axes.y);
    const plotArea: Rect = {
      x: provisional.x + margins.left,
      y: provisional.y + theme.fontSize / 2,
      width: Math.max(1, provisional.width - margins.left - theme.fontSize),
      height: Math.max(1, provisional.height - margins.bottom - theme.fontSize / 2),
    };
    scales = this.buildScales(plotArea, scales);
    ticks = this.buildTicks(scales);
    ticks = { x: thinLabels(renderer, theme, ticks.x), y: ticks.y };
    this.scales = scales;
    this.layout = { width, height, plotArea };
    const ctx = this.context();
    this.plugins.afterLayout(this.layout, ctx);

    // 3. Dibujar.
    renderer.clear('background');
    renderer.clear('data');
    renderer.clear('overlay');
    drawAxes(renderer, theme, this.layout, ticks.x, ticks.y, config.axes.x, config.axes.y);
    this.plugins.beforeDraw(ctx);
    renderer.clip('data', plotArea.x - 1, plotArea.y - 1, plotArea.width + 2, plotArea.height + 2);
    this.drawSeries(scales, plotArea);
    this.plugins.afterDraw(ctx);
  }

  private buildScales(area: Rect, previous?: ChartScales): ChartScales {
    const { config } = this;
    const xRange = [area.x, area.x + area.width] as const;
    const yRange = [area.y + area.height, area.y] as const;
    if (previous) {
      return { x: previous.x.withRange(xRange), y: previous.y.withRange(yRange) };
    }

    const yDomain = this.domain('y');
    let y = linearScale(yDomain, yRange);
    if (config.scales.y.nice && config.scales.y.domain === 'auto') y = y.nice(5);

    if (config.scales.x.type === 'band') {
      const count = this.categories().length;
      return { x: bandScale(count, xRange, config.bar.padding), y };
    }
    let x = linearScale(this.domain('x'), xRange);
    if (config.scales.x.nice && config.scales.x.domain === 'auto') x = x.nice(6);
    return { x, y };
  }

  private buildTicks(scales: ChartScales): { x: AxisTicks; y: AxisTicks } {
    const { config } = this;
    const firstX = config.series[0]?.x ?? '';
    const isTime = config.data.has(firstX) && config.data.column(firstX).kind === 'time';
    const x =
      scales.x.kind === 'band'
        ? bandTicks(scales.x, this.categories())
        : continuousTicks(scales.x, 6, config.axes.x, isTime || config.scales.x.type === 'time');
    const y = continuousTicks(scales.y, 5, config.axes.y, false);
    return { x, y };
  }

  private domain(axis: 'x' | 'y'): Domain {
    const configured = this.config.scales[axis].domain;
    if (configured !== 'auto') return configured;
    let min = Infinity;
    let max = -Infinity;
    for (const s of this.series) {
      const values = axis === 'x' ? s.x : s.y;
      for (let i = 0; i < values.length; i++) {
        const v = values[i] as number;
        if (v !== v) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min)) return [0, 1];
    // Una barra codifica cantidad por su longitud: su eje siempre incluye el cero.
    if (axis === 'y' && this.config.type === 'bar') {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    return [min, max];
  }

  /** Categorías del eje X para barras: las del diccionario, o los valores de x como texto. */
  private categories(): readonly string[] {
    const spec = this.config.series[0];
    if (!spec) return [];
    const column = this.config.data.column(spec.x);
    if (column.kind === 'category') return column.categories;
    const first = this.series[0];
    return first ? Array.from(first.x, (v) => String(v)) : [];
  }

  private drawSeries(scales: ChartScales, area: Rect): void {
    const { config, renderer } = this;
    const { palette } = config.theme;
    const yMap = scales.y.map();

    if (scales.x.kind === 'band') {
      this.drawBars(scales.x, { x: IDENTITY, y: yMap }, renderer);
      return;
    }
    const transform: Transform = { x: scales.x.map(), y: yMap };
    const [x0, x1] = scales.x.domain;
    const dpr = window.devicePixelRatio || 1;

    this.series.forEach((s, i) => {
      const color = palette[i % palette.length] ?? '#000';
      const from = Math.max(0, lowerBound(s.x, x0) - 1);
      const to = Math.min(s.length, lowerBound(s.x, x1) + 1);
      if (config.type === 'scatter') {
        renderer.drawPointSeries(
          'data',
          s.x,
          s.y,
          from,
          to,
          { fill: color, radius: config.scatter.radius, opacity: 0.85 },
          transform,
        );
        return;
      }
      // Líneas: decimación min/max por columna de píxel físico (ADR 0002).
      const pxPerUnit = (area.width / (x1 - x0)) * dpr;
      const buffer = minMaxDecimate(s.x, s.y, from, to, x0, pxPerUnit, this.decimation[i]);
      this.decimation[i] = buffer;
      renderer.drawLineSeries(
        'data',
        buffer.x,
        buffer.y,
        0,
        buffer.length,
        { stroke: color, width: config.line.width },
        transform,
      );
    });
  }

  private drawBars(x: BandScale, transform: Transform, renderer: Renderer): void {
    const { config } = this;
    const { palette } = config.theme;
    const n = this.series.length;
    const stacked = config.bar.mode === 'stacked';
    const slot = stacked ? x.bandwidth : x.bandwidth / Math.max(1, n);
    const positive = new Float64Array(x.count);
    const negative = new Float64Array(x.count);

    this.series.forEach((s, si) => {
      const count = Math.min(s.length, x.count);
      const px0 = new Float64Array(count);
      const px1 = new Float64Array(count);
      const y0 = new Float64Array(count);
      const y1 = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        const v = s.y[i] as number;
        const start = x.start(i) + (stacked ? 0 : si * slot);
        px0[i] = start;
        px1[i] = start + slot;
        if (stacked) {
          // Positivos se apilan hacia arriba y negativos hacia abajo, por separado.
          const acc = v >= 0 ? positive : negative;
          y0[i] = acc[i] as number;
          y1[i] = (acc[i] as number) + v;
          acc[i] = y1[i] as number;
        } else {
          y0[i] = 0;
          y1[i] = v;
        }
      }
      const color = palette[si % palette.length] ?? '#000';
      renderer.drawBars('data', px0, px1, y0, y1, 0, count, { fill: color }, transform);
    });
  }
}

function emptyLayout(): Layout {
  return { width: 0, height: 0, plotArea: { x: 0, y: 0, width: 0, height: 0 } };
}

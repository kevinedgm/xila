import {
  axisMargins,
  bandTicks,
  continuousTicks,
  drawAxes,
  textStyle,
  thinLabels,
  type AxisTicks,
} from './axes';
import { formatNumber } from './format/number';
import { resolveConfig, seriesColor, type ChartConfig, type ResolvedChartConfig } from './config';
import { waffleLayout, type WaffleLayout } from './waffle';
import { colormap, colormapCss, inkOn, type Colormap } from './colormap';
import { rowPosition, rowStats, type RowStats } from './heatmap';
import { monoFont } from './theme';
import { countInRange, dotsLayout, easeOutCubic, type DotsLayout } from './dots';
import { boxGroups, type BoxStats } from './data/box';
import {
  beeswarm,
  binCounts,
  groupValues,
  percentileOf,
  rangeBands,
  sharedEdges,
  smooth3,
} from './distribution';
import { minMaxDecimate, type DecimatedSeries } from './data/decimate';
import { lowerBound } from './data/search';
import { isSorted, resolveSeries, type ResolvedSeries, type SeriesSpec } from './data/series';
import { Emitter, type HoverPayload } from './events';
import {
  bandHitTester,
  waffleHitTester,
  gridHitTester,
  heatmapHitTester,
  sortedHitTester,
  type Hit,
  type HitTester,
  pixelHitTester,
} from './hit-test';
import { PluginRegistry, type Layout, type PluginContext, type Rect } from './plugin';
import { applyMap, type Renderer, type Transform } from './renderer';
import { CanvasRenderer } from './renderer-canvas';
import { SvgRenderer, type SvgRendererOptions } from './renderer-svg';
import { WebGLRenderer, type Backend } from './renderer-webgl';
import { bandScale, type BandScale } from './scales/band';
import { linearScale, type ContinuousScale, type Domain } from './scales/linear';
import { logScale } from './scales/log';
import { timeScale } from './scales/time';

const IDENTITY = { offset: 0, scale: 1, base: 0 } as const;
const FALLBACK_WIDTH = 600;
const FALLBACK_HEIGHT = 400;
/** Distancia máxima, en píxeles, para que el cursor "toque" un dato. */
const HOVER_DISTANCE = 24;
/** Barra de color del heatmap: ancho y separación en píxeles CSS. */
const LEGEND_BAR = 12;
const LEGEND_GAP = 10;

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
  /** Destino del dibujo: el renderer de pantalla, o uno temporal durante `toSvg()`. */
  private target: Renderer;
  private exporting = false;

  private raw: ChartConfig;
  private config: ResolvedChartConfig;
  private series: ResolvedSeries[] = [];
  private plugins: PluginRegistry;
  private readonly container: HTMLElement;
  private readonly observer: ResizeObserver | null;
  private readonly visibility: IntersectionObserver | null;
  /** Con render diferido, `false` hasta que el contenedor entra en pantalla. */
  private visible = true;
  private pendingDraw = false;
  private drawn = false;
  private readonly warnedLog = new Set<'x' | 'y'>();
  private layout: Layout;
  private scales: ChartScales | null = null;
  private frame = 0;
  private dirty = { data: true, layout: true };
  private destroyed = false;
  private decimation: DecimatedSeries[] = [];
  /** Por serie, si su X no decrece: solo entonces vale recortar por búsqueda binaria. */
  private sortedX: boolean[] = [];
  /** Box plot: estadísticos por serie y por categoría, calculados al resolver los datos. */
  private boxes: BoxStats[][] = [];
  /** Box plot: valores de cada grupo por serie, en el orden de las filas (para `box.mark`). */
  private groups: Float64Array[][] = [];
  /** Box plot con `box.shade`: el valor de la columna de tono por grupo, alineado con `groups`. */
  private shades: Float64Array[][] = [];
  /** Heatmap: rejilla `ny × nx` con la fila de la tabla de cada celda (−1 = vacía). */
  private cells: Int32Array = new Int32Array(0);
  /** Estadísticas por fila del heatmap (mediana, extremos, columna del máximo). */
  private rows: RowStats[] = [];
  private readonly hidden = new Set<string>();
  /** Gráfico de unidades: posiciones objetivo del último layout y las que se muestran. */
  private dots: DotsLayout | null = null;
  private dotsShown: { x: Float64Array; y: Float64Array; mode: string } | null = null;
  private waffle: WaffleLayout | null = null;
  private dotsAnim: { fromX: Float64Array; fromY: Float64Array; start: number } | null = null;
  /** Rango seleccionado en X (plugin de selección); los datos fuera se atenúan. */
  private selection: Domain | null = null;
  private hitTester: HitTester | null = null;
  private lastHover: HoverPayload | null = null;
  /** Rangos fijados por zoom o pan; `null` = automático desde los datos. */
  private readonly view: { x: Domain | null; y: Domain | null } = { x: null, y: null };
  private readonly onPointerMove = (e: PointerEvent): void => this.handlePointer(e, 'move');
  private readonly onPointerLeave = (): void => this.handleLeave();
  private readonly onClick = (e: MouseEvent): void => this.handlePointer(e, 'click');

  constructor(container: HTMLElement, config: ChartConfig) {
    this.container = container;
    this.raw = config;
    this.renderer = useWebGL(config) ? new WebGLRenderer(container) : new CanvasRenderer(container);
    this.target = this.renderer;
    if (this.renderer instanceof WebGLRenderer) {
      this.renderer.onFallback = () => this.requestDraw();
    }
    this.plugins = new PluginRegistry(config.plugins);
    this.layout = emptyLayout();
    // Primero una configuración válida, para que los plugins ya tengan contexto en beforeUpdate.
    this.config = resolveConfig(config);
    const adjusted = this.plugins.beforeUpdate(config, this.context());
    if (adjusted !== config) this.config = resolveConfig(adjusted);
    this.plugins.install(this.context());
    const el = this.renderer.element;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('click', this.onClick);
    this.observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            this.dirty.layout = true;
            this.requestDraw();
          });
    this.observer?.observe(container);
    // Render diferido: el primer dibujo (y los siguientes) esperan a que el contenedor se vea.
    // `rootMargin` adelanta el dibujo a lo que está a punto de entrar al hacer scroll.
    this.visibility =
      config.lazy === false || typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              const visible = entries.some((e) => e.isIntersecting);
              if (visible === this.visible) return;
              this.visible = visible;
              if (visible && this.pendingDraw) this.requestDraw();
            },
            { rootMargin: '200px' },
          );
    if (this.visibility) {
      this.visible = false;
      this.visibility.observe(container);
    }
    this.requestDraw();
  }

  /** `true` si el gráfico está (casi) en pantalla o no usa render diferido. */
  isVisible(): boolean {
    return this.visible;
  }

  /** Mezcla cambios sobre la configuración actual y redibuja. */
  update(patch: Partial<ChartConfig>): void {
    this.assertAlive();
    const next = { ...this.raw, ...patch } as ChartConfig;
    this.raw = next;
    // Una lista de plugins nueva sustituye a la anterior: se desinstalan los viejos (quitan sus
    // elementos del DOM) y se instalan los nuevos antes de resolver la configuración.
    if (patch.plugins !== undefined && patch.plugins !== this.plugins.source) {
      this.plugins.uninstall(this.context());
      this.plugins = new PluginRegistry(patch.plugins);
      this.plugins.install(this.context());
    }
    this.config = resolveConfig(this.plugins.beforeUpdate(next, this.context()));
    this.dirty.data = true;
    this.dirty.layout = true;
    this.events.emit('dataChanged', { reason: 'update' });
    this.plugins.onEvent('dataChanged', { reason: 'update' }, this.context());
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

  /** Ids de las series ocultas (por la leyenda, por ejemplo). */
  getHiddenSeries(): ReadonlySet<string> {
    return this.hidden;
  }

  /** Muestra u oculta una serie; el dominio Y se recalcula con las visibles. */
  toggleSeries(seriesId: string, hidden = !this.hidden.has(seriesId)): void {
    this.assertAlive();
    if (!this.config.series.some((s) => s.id === seriesId)) {
      throw new RangeError(`No hay una serie con el id "${seriesId}"`);
    }
    if (hidden === this.hidden.has(seriesId)) return;
    if (hidden) this.hidden.add(seriesId);
    else this.hidden.delete(seriesId);
    this.events.emit('visibility', { seriesId, hidden });
    this.plugins.onEvent('visibility', { seriesId, hidden }, this.context());
    this.requestDraw();
  }

  getLayout(): Layout {
    return this.layout;
  }

  /** Escalas del último dibujo; `null` antes del primero. */
  getScales(): ChartScales | null {
    return this.scales;
  }

  /**
   * Imagen del gráfico. Con `pixelRatio` se redibuja a esa densidad (2 para diapositivas)
   * y se vuelve a la de la pantalla; sin él, se toma lo que hay en pantalla.
   */
  toDataURL(type?: string, pixelRatio?: number): string {
    this.assertAlive();
    if (pixelRatio === undefined) {
      if (this.pendingDraw) this.drawNow();
      return this.renderer.toDataURL(type);
    }
    const { width, height } = this.layout;
    this.renderer.resize(width, height, pixelRatio);
    this.draw();
    const url = this.renderer.toDataURL(type);
    this.renderer.resize(width, height, window.devicePixelRatio || 1);
    this.draw();
    return url;
  }

  /**
   * El gráfico como documento SVG (texto): mismo dibujo, mismos plugins, pero vectorial. Se
   * dibuja una vez sobre un `SvgRenderer` temporal y luego se restaura la pantalla. Las partes
   * en HTML (tooltip, leyenda, controles) no forman parte del canvas y tampoco del SVG;
   * `chartToSvg` añade título y leyenda encima.
   */
  toSvg(options: SvgRendererOptions = {}): string {
    this.assertAlive();
    const svg = new SvgRenderer(options);
    const width = this.container.clientWidth || FALLBACK_WIDTH;
    const height = this.container.clientHeight || FALLBACK_HEIGHT;
    svg.resize(width, height);
    this.target = svg;
    this.exporting = true;
    try {
      this.draw();
    } finally {
      this.target = this.renderer;
      this.exporting = false;
    }
    // La pantalla vuelve a dibujarse (el layout pudo cambiar si aún no se había dibujado).
    this.dirty.layout = true;
    this.draw();
    return svg.toString();
  }

  /** Dibuja ahora, sin esperar al siguiente fotograma. Útil en tests y exportaciones. */
  drawNow(): void {
    this.assertAlive();
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    this.pendingDraw = false;
    this.draw();
  }

  requestDraw(): void {
    if (this.destroyed || this.frame) return;
    if (!this.visible) {
      // Fuera de pantalla no se dibuja; queda pendiente para cuando entre.
      this.pendingDraw = true;
      return;
    }
    this.pendingDraw = false;
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
    this.visibility?.disconnect();
    const el = this.renderer.element;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('click', this.onClick);
    this.plugins.uninstall(this.context());
    this.events.clear();
    this.renderer.destroy();
  }

  private context(): PluginContext {
    return {
      config: this.config,
      renderer: this.target,
      layout: this.layout,
      events: this.events,
      requestDraw: () => this.requestDraw(),
      hiddenSeries: this.hidden,
      toggleSeries: (id, hidden) => this.toggleSeries(id, hidden),
      getScales: () => this.scales,
      getSeries: () => this.getSeries(),
      getBoxStats: () => this.boxes,
      hoverAt: (px, py) => this.hoverAt(px, py),
      clearHover: () => this.clearHover(),
      getDataDomain: (axis) => this.domain(axis),
      getViewDomain: (axis) => this.view[axis],
      setViewDomain: (axis, domain) => this.setViewDomain(axis, domain),
      update: (patch) => this.update(patch as Partial<ChartConfig>),
      requestLayout: () => this.resize(),
      getSelection: () => this.selection,
      setSelection: (range) => this.setSelection(range),
      countSelection: (range) => this.countSelection(range),
      getBinEdges: () => this.dots?.edges ?? null,
    };
  }

  /** Rango seleccionado en X; `null` lo quita. Emite `selection` con el conteo de datos dentro. */
  setSelection(range: Domain | null): void {
    this.assertAlive();
    const current = this.selection;
    if (
      current === range ||
      (current && range && current[0] === range[0] && current[1] === range[1])
    ) {
      return;
    }
    this.selection = range;
    const payload = { x: range, ...this.countSelection(range) };
    this.events.emit('selection', payload);
    this.plugins.onEvent('selection', payload, this.context());
    this.requestDraw();
  }

  getSelection(): Domain | null {
    return this.selection;
  }

  /** Datos visibles cuya `x` cae en el rango, y el total de datos visibles. */
  countSelection(range: Domain | null): { count: number; total: number } {
    let count = 0;
    let total = 0;
    for (const { series: s } of this.visibleSeries()) {
      for (let i = 0; i < s.length; i++) if ((s.x[i] as number) === (s.x[i] as number)) total++;
      if (range) count += countInRange(s.x, range[0], range[1]);
    }
    return { count: range ? count : total, total };
  }

  /** Rango mostrado en un eje; `null` vuelve al automático. Emite `zoom`. */
  setViewDomain(axis: 'x' | 'y', domain: Domain | null): void {
    this.assertAlive();
    const current = this.view[axis];
    if (
      current === domain ||
      (current && domain && current[0] === domain[0] && current[1] === domain[1])
    ) {
      return;
    }
    this.view[axis] = domain;
    this.dirty.layout = true;
    this.events.emit('zoom', {
      x: this.view.x ?? this.domain('x'),
      y: this.view.y ?? this.domain('y'),
    });
    this.requestDraw();
  }

  getViewDomain(axis: 'x' | 'y'): Domain | null {
    return this.view[axis];
  }

  /** Series que se dibujan y cuentan para el dominio, con su índice original (para el color). */
  private visibleSeries(): { series: ResolvedSeries; index: number }[] {
    return this.series
      .map((series, index) => ({ series, index }))
      .filter(({ series }) => !this.hidden.has(series.id));
  }

  private handlePointer(e: MouseEvent, kind: 'move' | 'click'): void {
    const rect = this.renderer.element.getBoundingClientRect();
    this.hoverAt(e.clientX - rect.left, e.clientY - rect.top, kind);
  }

  /**
   * Simula el cursor en `(px, py)` (píxeles CSS relativos al gráfico): marca y publica el
   * dato más cercano como si el ratón estuviera ahí. Lo usa la navegación por teclado.
   */
  hoverAt(px: number, py: number, kind: 'move' | 'click' = 'move'): void {
    if (this.destroyed || !this.hitTester) return;
    const { plotArea } = this.layout;
    const inside =
      px >= plotArea.x &&
      px <= plotArea.x + plotArea.width &&
      py >= plotArea.y &&
      py <= plotArea.y + plotArea.height;
    if (!inside) return this.handleLeave();

    const nearest = this.hitTester.nearest(px, py, HOVER_DISTANCE);
    if (kind === 'click') {
      if (nearest) {
        this.events.emit('click', nearest);
        this.plugins.onEvent('click', nearest, this.context());
      }
      return;
    }
    const hits =
      this.config.type === 'scatter' ||
      this.config.type === 'heatmap' ||
      this.config.type === 'dots' ||
      this.config.type === 'waffle'
        ? nearest
          ? [nearest]
          : []
        : this.hitTester.nearestX(px, HOVER_DISTANCE);
    const payload: HoverPayload = { px, py, nearest, hits };
    this.lastHover = payload;
    this.drawHoverOverlay(payload);
    this.events.emit('hover', payload);
    this.plugins.onEvent('hover', payload, this.context());
  }

  /** Quita la marca del cursor y publica `hover` con `null`. */
  clearHover(): void {
    this.handleLeave();
  }

  private handleLeave(): void {
    if (this.destroyed || !this.lastHover) return;
    this.lastHover = null;
    this.renderer.clear('overlay');
    this.events.emit('hover', null);
    this.plugins.onEvent('hover', null, this.context());
  }

  /** Marca en la capa `overlay` los datos bajo el cursor; nunca toca la capa de datos. */
  private drawHoverOverlay(hover: HoverPayload): void {
    const { config } = this;
    const renderer = this.target;
    const { plotArea } = this.layout;
    renderer.clear('overlay');
    if (hover.hits.length === 0) return;
    const first = hover.hits[0] as Hit;
    if (config.type === 'heatmap') {
      const scales = this.scales;
      if (!scales || scales.x.kind !== 'band') return;
      const h = Math.abs(scales.y.toPixel(1) - scales.y.toPixel(0));
      renderer.drawRect(
        'overlay',
        scales.x.start(first.x),
        first.py - h / 2,
        scales.x.bandwidth,
        h,
        { fill: 'transparent', stroke: config.theme.text, strokeWidth: 2 },
      );
      return;
    }
    if (config.type === 'waffle') {
      const cell = this.waffle?.cells[first.index];
      if (cell)
        renderer.drawRect('overlay', cell.x, cell.y, cell.size, cell.size, {
          fill: 'transparent',
          stroke: config.theme.text,
          strokeWidth: 2,
        });
      return;
    }
    if (config.type !== 'scatter' && config.type !== 'dots') {
      renderer.drawRule('overlay', first.px, plotArea.y, first.px, plotArea.y + plotArea.height, {
        stroke: config.theme.axis,
        width: 1,
        dash: [4, 3],
        opacity: 0.6,
      });
    }
    if (config.type === 'bar' || config.type === 'box') return;
    for (const h of hover.hits) {
      const color = seriesColor(config, h.seriesIndex);
      renderer.drawPointSeries(
        'overlay',
        Float64Array.of(h.px),
        Float64Array.of(h.py),
        0,
        1,
        { fill: color, radius: 4, stroke: config.theme.background, strokeWidth: 2 },
        { x: IDENTITY, y: IDENTITY },
      );
    }
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error('El gráfico ya fue destruido');
  }

  private resolveData(): void {
    this.series = this.config.series.map((spec) => resolveSeries(this.config.data, spec));
    this.decimation = [];
    this.sortedX = this.series.map((s) => isSorted(s.x));
    this.boxes =
      this.config.type === 'box'
        ? this.series.map((s) =>
            boxGroups(s.x, s.y, this.categories().length, this.config.box.whisker),
          )
        : [];
    this.groups =
      this.config.type === 'box'
        ? this.series.map((s) => groupValues(s.x, s.y, this.categories().length))
        : [];
    const shade = this.config.type === 'box' ? this.config.box.shade : null;
    this.shades =
      shade !== null && this.config.type === 'box'
        ? this.series.map((s) => {
            const col = this.config.data.numeric(shade);
            // Mismo recorrido que groupValues, pero con la columna de tono: se descartan las
            // filas cuyo valor Y no es finito, igual que allí.
            const y = s.y;
            const picked = Float64Array.from(col, (v, i) =>
              (y[i] as number) === (y[i] as number) ? v : NaN,
            );
            return groupValues(s.x, picked, this.categories().length).map((g) => g);
          })
        : [];
    if (this.config.type === 'heatmap') {
      const nx = this.categories().length;
      const ny = this.categoriesY().length;
      const cells = new Int32Array(nx * ny).fill(-1);
      const s = this.series[0];
      if (s) {
        for (let i = 0; i < s.length; i++) {
          const xi = s.x[i] as number;
          const yi = s.y[i] as number;
          if (xi >= 0 && xi < nx && yi >= 0 && yi < ny) cells[yi * nx + xi] = i;
        }
      }
      this.cells = cells;
      this.rows = s?.value ? rowStats(s.value, cells, nx, ny) : [];
    }
    this.dirty.data = false;
  }

  private draw(): void {
    if (this.destroyed) return;
    const { config } = this;
    const renderer = this.target;
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
    const reserved = this.plugins.reserveSpace(this.context());
    const provisional: Rect = {
      x: padding.left + reserved.left,
      y: padding.top + reserved.top,
      width: width - padding.left - padding.right - reserved.left - reserved.right,
      height: height - padding.top - padding.bottom - reserved.top - reserved.bottom,
    };
    let scales = this.buildScales(provisional);
    let ticks = this.buildTicks(scales);

    // 2. Medir etiquetas, fijar el área de dibujo y recalcular con el rango definitivo.
    const margins = axisMargins(renderer, theme, ticks.x, ticks.y, config.axes.x, config.axes.y);
    // Heatmap con barra de color a la derecha: su ancho más la etiqueta más ancha.
    const legendWidth =
      config.type === 'heatmap' && config.heatmap.legend
        ? LEGEND_BAR +
          LEGEND_GAP * 2 +
          Math.max(
            ...this.heatmapLegendLabels().map((l) => renderer.measureText(l, textStyle(theme))),
          )
        : 0;
    // Notas por fila ("máx 1973 · mediana 18,6"): su ancho máximo más un hueco.
    const notesWidth =
      config.type === 'heatmap' && config.heatmap.rowLabels !== 'none'
        ? LEGEND_GAP +
          Math.max(0, ...this.rowNotes().map((n) => renderer.measureText(n, textStyle(theme))))
        : 0;
    const plotArea: Rect = {
      x: provisional.x + margins.left,
      y: provisional.y + theme.fontSize / 2,
      width: Math.max(
        1,
        provisional.width - margins.left - theme.fontSize - legendWidth - notesWidth,
      ),
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

    // 4. Índice espacial para hover y click, sobre las series visibles.
    const visible = this.visibleSeries().map((v) => v.series);
    const firstVisible = visible[0];
    this.hitTester =
      config.type === 'heatmap' && firstVisible
        ? heatmapHitTester(
            firstVisible,
            this.cells,
            this.categories().length,
            this.categoriesY().length,
            scales,
          )
        : config.type === 'waffle' && firstVisible && this.waffle
          ? waffleHitTester(firstVisible, this.waffle)
          : scales.x.kind === 'band'
            ? bandHitTester(
                config.type === 'box' ? this.boxSeries() : visible,
                scales,
                config.type === 'bar' && config.bar.mode === 'stacked',
              )
            : config.type === 'dots' && firstVisible && this.dotsShown
              ? pixelHitTester(firstVisible, 0, this.dotsShown.x, this.dotsShown.y, plotArea)
              : config.type === 'scatter'
                ? gridHitTester(visible, scales, plotArea)
                : sortedHitTester(visible, scales);
    if (this.lastHover && !this.exporting) this.drawHoverOverlay(this.lastHover);
    this.events.emit('draw', { first: !this.drawn });
    this.plugins.onEvent('draw', { first: !this.drawn }, this.context());
    this.drawn = true;
  }

  /** Backend que dibuja los puntos: `'webgl'` solo si se pidió y la GPU respondió. */
  getBackend(): Backend {
    return this.renderer instanceof WebGLRenderer ? this.renderer.backend : 'canvas';
  }

  /** `true` después del primer dibujo completo. */
  hasDrawn(): boolean {
    return this.drawn;
  }

  private buildScales(area: Rect, previous?: ChartScales): ChartScales {
    const { config } = this;
    const xRange = [area.x, area.x + area.width] as const;
    const yRange = [area.y + area.height, area.y] as const;
    if (previous) {
      const x = previous.x.withRange(xRange);
      if (config.type === 'dots' && x.kind !== 'band') {
        return { x, y: this.dotsScale(area, x, yRange) };
      }
      return { x, y: previous.y.withRange(yRange) };
    }

    // Con zoom (view) el rango es exacto: redondearlo a ticks "bonitos" lo haría saltar.
    const makeY = config.scales.y.type === 'log' ? logScale : linearScale;
    let y = makeY(this.view.y ?? this.domain('y'), yRange);
    if (!this.view.y && config.scales.y.nice && config.scales.y.domain === 'auto') y = y.nice(5);

    if (config.scales.x.type === 'band') {
      const count = this.categories().length;
      if (config.type === 'heatmap') {
        // Filas como unidades enteras: la fila `i` ocupa `[i, i + 1)`; su centro es `i + 0.5`.
        return {
          x: bandScale(count, xRange, 0),
          y: linearScale([0, Math.max(1, this.categoriesY().length)], yRange),
        };
      }
      const padding = config.type === 'box' ? config.box.padding : config.bar.padding;
      return { x: bandScale(count, xRange, padding), y };
    }
    const make =
      config.scales.x.type === 'time'
        ? timeScale
        : config.scales.x.type === 'log'
          ? logScale
          : linearScale;
    let x = make(this.view.x ?? this.domain('x'), xRange);
    if (!this.view.x && config.scales.x.nice && config.scales.x.domain === 'auto') x = x.nice(6);
    if (config.type === 'dots') return { x, y: this.dotsScale(area, x, yRange) };
    return { x, y };
  }

  /**
   * Gráfico de unidades: calcula el layout de los puntos para esta área y devuelve un eje Y en
   * unidades (`[0, capacidad]`), lineal con los píxeles para que los ticks sean "bonitos". En
   * modo tira el eje es `[0, 1]` y no se rotula.
   */
  private dotsScale(
    area: Rect,
    x: ContinuousScale,
    yRange: readonly [number, number],
  ): ContinuousScale {
    const { config } = this;
    const first = this.visibleSeries()[0]?.series;
    const values = first ? first.x : new Float64Array(0);
    this.dots = dotsLayout(values, area, x, {
      mode: config.dots.mode,
      bins: config.dots.bins,
      radius: config.dots.radius,
    });
    return linearScale([0, this.dots.capacity], yRange);
  }

  private buildTicks(scales: ChartScales): { x: AxisTicks; y: AxisTicks } {
    const { config } = this;
    const x =
      scales.x.kind === 'band'
        ? bandTicks(scales.x, this.categories())
        : continuousTicks(scales.x, 6, config.axes.x);
    if (config.type === 'heatmap') {
      const rows = this.categoriesY();
      const values = rows.map((_, i) => i + 0.5);
      return {
        x,
        y: { values, labels: [...rows], positions: values.map((v) => scales.y.toPixel(v)) },
      };
    }
    if (config.type === 'dots' && config.dots.mode === 'strip') {
      return { x, y: { values: [], labels: [], positions: [] } };
    }
    const y = continuousTicks(scales.y, 5, config.axes.y);
    return { x, y };
  }

  private domain(axis: 'x' | 'y'): Domain {
    const configured = this.config.scales[axis].domain;
    if (configured !== 'auto') return configured;
    let min = Infinity;
    let max = -Infinity;
    const log = this.config.scales[axis].type === 'log';
    let skipped = 0;
    for (const { series: s } of this.visibleSeries()) {
      // En Y cuentan también los límites de la incertidumbre, para que la banda quepa.
      const arrays = axis === 'x' ? [s.x] : [s.y, ...(s.yLow && s.yHigh ? [s.yLow, s.yHigh] : [])];
      for (const values of arrays) {
        for (let i = 0; i < values.length; i++) {
          const v = values[i] as number;
          if (v !== v) continue;
          // En escala log, cero y negativos no tienen logaritmo: no cuentan y se avisa una vez.
          if (log && v <= 0) {
            skipped++;
            continue;
          }
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (log && skipped > 0 && !this.warnedLog.has(axis)) {
      this.warnedLog.add(axis);
      console.warn(
        `Xila: ${skipped} valor(es) ≤ 0 en el eje ${axis} no se dibujan con escala logarítmica.`,
      );
    }
    if (!Number.isFinite(min)) return log ? [1, 10] : [0, 1];
    // Una barra codifica cantidad por su longitud: su eje siempre incluye el cero.
    if (axis === 'y' && this.config.type === 'bar') {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
      // Apiladas: lo que importa es la suma por índice (positivos arriba, negativos abajo).
      if (this.config.bar.mode === 'stacked') {
        const visible = this.visibleSeries();
        const n = Math.max(0, ...visible.map(({ series: s }) => s.length));
        for (let i = 0; i < n; i++) {
          let up = 0;
          let down = 0;
          for (const { series: s } of visible) {
            const v = s.y[i] as number;
            if (v !== v) continue;
            if (v >= 0) up += v;
            else down += v;
          }
          if (up > max) max = up;
          if (down < min) min = down;
        }
      }
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

  /** Categorías del eje Y de un heatmap (las de la columna `y` de la primera serie). */
  private categoriesY(): readonly string[] {
    const spec = this.config.series[0];
    if (!spec) return [];
    const column = this.config.data.column(spec.y);
    return column.kind === 'category' ? column.categories : [];
  }

  /** Textos de la barra de color: [mínimo, máximo, centro?]. Por fila hablan de la fila. */
  private heatmapLegendLabels(): string[] {
    const { heatmap } = this.config;
    if (heatmap.scale === 'row') return ['mínimo de su fila', 'máximo de su fila', 'mediana'];
    return legendLabels(this.heatmapDomain(), heatmap.center);
  }

  /** Nota de cada fila (índice = fila del eje Y); cadena vacía si no hay notas. */
  private rowNotes(): string[] {
    const { heatmap } = this.config;
    if (heatmap.rowLabels === 'none') return [];
    const cols = this.categories();
    const [lo, hi] = this.heatmapDomain();
    const step = (hi - lo) / 100;
    return this.rows.map((r) =>
      r.argmax < 0
        ? ''
        : `máx ${cols[r.argmax] ?? ''} · mediana ${formatNumber(r.median, { step })}`,
    );
  }

  /** Rango de valores que cubre el mapa de color del heatmap. */
  private heatmapDomain(): [number, number] {
    const { heatmap } = this.config;
    let [lo, hi] = heatmap.domain === 'auto' ? this.valueRange() : heatmap.domain;
    if (heatmap.center !== null) {
      const half = Math.max(Math.abs(hi - heatmap.center), Math.abs(lo - heatmap.center));
      lo = heatmap.center - half;
      hi = heatmap.center + half;
    }
    if (!(hi > lo)) hi = lo + 1;
    return [lo, hi];
  }

  private valueRange(): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of this.series) {
      if (!s.value) continue;
      for (let i = 0; i < s.value.length; i++) {
        const v = s.value[i] as number;
        if (v !== v) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    return Number.isFinite(lo) ? [lo, hi] : [0, 1];
  }

  /**
   * Heatmap: una imagen de `nx × ny` píxeles (un píxel por celda) escalada al área de dibujo sin
   * suavizar. Pintar 250 000 celdas así cuesta lo que llenar un arreglo, no 250 000 rectángulos.
   */
  private drawHeatmap(scales: ChartScales, area: Rect): void {
    const { config } = this;
    const renderer = this.target;
    const s = this.series[0];
    if (!s || !s.value || scales.x.kind !== 'band') return;
    const nx = this.categories().length;
    const ny = this.categoriesY().length;
    if (nx === 0 || ny === 0) return;
    const map = colormap(config.heatmap.colormap);
    const [lo, hi] = this.heatmapDomain();
    const span = hi - lo;
    const byRow = config.heatmap.scale === 'row';
    // Posición en el mapa de la celda (yi, xi), o NaN si está vacía.
    const position = (yi: number, xi: number): number => {
      const row = this.cells[yi * nx + xi] as number;
      if (row < 0) return NaN;
      const v = s.value?.[row] as number;
      if (v !== v) return NaN;
      const t = byRow ? rowPosition(v, this.rows[yi] as RowStats) : (v - lo) / span;
      return t < 0 ? 0 : t > 1 ? 1 : t;
    };
    const x0 = scales.x.start(0);
    const x1 = scales.x.start(nx - 1) + scales.x.bandwidth;
    // Tabla con tono: rectángulos con hueco y cifra. Solo tiene sentido con pocas celdas.
    const asTable = (config.heatmap.gap > 0 || config.heatmap.values) && nx * ny <= 2000;
    if (asTable) {
      const gap = config.heatmap.gap;
      const rowH = area.height / ny;
      const colW = (x1 - x0) / nx;
      const font = `500 ${config.theme.fontSize}px ${monoFont(config.theme)}`;
      const [lo2, hi2] = this.heatmapDomain();
      const step = (hi2 - lo2) / 100;
      for (let yi = 0; yi < ny; yi++) {
        // La fila 0 va abajo (el eje Y crece hacia arriba).
        const top = area.y + (ny - 1 - yi) * rowH;
        for (let xi = 0; xi < nx; xi++) {
          const t = position(yi, xi);
          if (t !== t) continue;
          const rgb = map(t);
          const cx = x0 + xi * colW;
          renderer.drawRect('data', cx + gap / 2, top + gap / 2, colW - gap, rowH - gap, {
            fill: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
          });
          if (config.heatmap.values) {
            const v = s.value[this.cells[yi * nx + xi] as number] as number;
            renderer.drawText('data', formatNumber(v, { step }), cx + colW / 2, top + rowH / 2, {
              font,
              fill: inkOn(rgb, config.theme.text),
              align: 'center',
              baseline: 'middle',
            });
          }
        }
      }
    } else {
      const pixels = new Uint8ClampedArray(nx * ny * 4);
      // Caché de 256 niveles: evaluar el polinomio por celda sería la parte cara.
      const lut = new Uint8ClampedArray(256 * 3);
      for (let k = 0; k < 256; k++) {
        const [r, g, b] = map(k / 255);
        lut[k * 3] = r;
        lut[k * 3 + 1] = g;
        lut[k * 3 + 2] = b;
      }
      for (let yi = 0; yi < ny; yi++) {
        // La fila 0 va abajo (el eje Y crece hacia arriba); la imagen se llena de arriba a abajo.
        const imageRow = ny - 1 - yi;
        for (let xi = 0; xi < nx; xi++) {
          const t = position(yi, xi);
          if (t !== t) continue;
          const k = Math.round(t * 255) * 3;
          const o = (imageRow * nx + xi) * 4;
          pixels[o] = lut[k] as number;
          pixels[o + 1] = lut[k + 1] as number;
          pixels[o + 2] = lut[k + 2] as number;
          pixels[o + 3] = 255;
        }
      }
      renderer.drawImage('data', pixels, nx, ny, x0, area.y, x1 - x0, area.height);
    }
    if (config.heatmap.rowLabels !== 'none') this.drawRowNotes(area, ny);
    if (config.heatmap.legend) this.drawColorLegend(map, area);
  }

  /** Notas a la derecha de cada fila, en la capa de fondo (fuera del recorte de datos). */
  private drawRowNotes(area: Rect, ny: number): void {
    const { config } = this;
    const renderer = this.target;
    const notes = this.rowNotes();
    const rowH = area.height / ny;
    const style = { ...textStyle(config.theme, config.theme.axis), baseline: 'middle' as const };
    for (let yi = 0; yi < ny; yi++) {
      const text = notes[yi];
      if (!text) continue;
      const cy = area.y + (ny - 1 - yi) * rowH + rowH / 2;
      renderer.drawText('background', text, area.x + area.width + LEGEND_GAP, cy, style);
    }
  }

  /** Barra de color vertical a la derecha del área, con el máximo arriba y el mínimo abajo. */
  private drawColorLegend(map: Colormap, area: Rect): void {
    const { config } = this;
    const renderer = this.target;
    const notes = config.heatmap.rowLabels !== 'none' ? this.rowNotes() : [];
    const notesWidth =
      notes.length > 0
        ? LEGEND_GAP +
          Math.max(0, ...notes.map((n) => renderer.measureText(n, textStyle(config.theme))))
        : 0;
    const steps = 128;
    const pixels = new Uint8ClampedArray(steps * 4);
    for (let i = 0; i < steps; i++) {
      const [r, g, b] = map(1 - i / (steps - 1));
      pixels[i * 4] = r;
      pixels[i * 4 + 1] = g;
      pixels[i * 4 + 2] = b;
      pixels[i * 4 + 3] = 255;
    }
    const x = area.x + area.width + notesWidth + LEGEND_GAP;
    renderer.drawImage('background', pixels, 1, steps, x, area.y, LEGEND_BAR, area.height);
    const label = { ...textStyle(config.theme), align: 'left' as const };
    const tx = x + LEGEND_BAR + LEGEND_GAP / 2;
    const [loLabel, hiLabel, centerLabel] = this.heatmapLegendLabels();
    renderer.drawText('background', hiLabel ?? '', tx, area.y, { ...label, baseline: 'top' });
    renderer.drawText('background', loLabel ?? '', tx, area.y + area.height, {
      ...label,
      baseline: 'bottom',
    });
    if (centerLabel !== undefined) {
      renderer.drawText('background', centerLabel, tx, area.y + area.height / 2, {
        ...label,
        baseline: 'middle',
      });
    }
  }

  private drawSeries(scales: ChartScales, area: Rect): void {
    const { config } = this;
    const renderer = this.target;

    const yMap = scales.y.map();

    if (config.type === 'heatmap') {
      this.drawHeatmap(scales, area);
      return;
    }
    if (config.type === 'dots') {
      this.drawDots(scales);
      return;
    }
    if (config.type === 'waffle') {
      this.drawWaffle(area);
      return;
    }
    if (scales.x.kind === 'band') {
      if (config.type === 'box') this.drawBoxes(scales.x, { x: IDENTITY, y: yMap }, renderer);
      else this.drawBars(scales.x, { x: IDENTITY, y: yMap }, renderer);
      return;
    }
    const transform: Transform = { x: scales.x.map(), y: yMap };
    const [x0, x1] = scales.x.domain;
    const dpr = window.devicePixelRatio || 1;

    const tx = scales.x.transform;
    const ty = scales.y.transform;

    for (const { series: s, index: i } of this.visibleSeries()) {
      const color = seriesColor(config, i);
      // Con X sin ordenar (una dispersión que es un camino) no se puede recortar por rango.
      const sorted = this.sortedX[i] ?? true;
      const from = sorted ? Math.max(0, lowerBound(s.x, x0) - 1) : 0;
      const to = sorted ? Math.min(s.length, lowerBound(s.x, x1) + 1) : s.length;
      const sx = tx ? mapValues(s.x, from, to, tx) : s.x;
      const low = s.yLow && ty ? mapValues(s.yLow, from, to, ty) : s.yLow;
      const high = s.yHigh && ty ? mapValues(s.yHigh, from, to, ty) : s.yHigh;
      if (config.type === 'scatter') {
        // Incertidumbre como barras de error, debajo de los puntos.
        if (low && high) {
          renderer.drawErrorBars(
            'data',
            sx,
            low,
            high,
            from,
            to,
            { stroke: color, width: 1, opacity: 0.7 },
            transform,
          );
        }
        // Anillo del color del fondo para distinguir puntos que se encima; se omite en nubes
        // grandes, donde el trazo por punto cuesta y la densidad es lo que se lee.
        const ring = to - from <= RING_MAX_POINTS ? config.scatter.ring : 0;
        const sy = ty ? mapValues(s.y, from, to, ty) : s.y;
        // Dispersión conectada: el camino va debajo de los puntos, en el orden de las filas.
        if (config.scatter.path) {
          renderer.drawLineSeries(
            'data',
            sx,
            sy,
            from,
            to,
            { stroke: color, width: config.line.width },
            transform,
          );
        }
        if (config.scatter.radius <= 0) continue;
        renderer.drawPointSeries(
          'data',
          sx,
          sy,
          from,
          to,
          {
            fill: color,
            radius: config.scatter.radius,
            opacity: 0.85,
            ...(ring > 0 ? { stroke: config.theme.background, strokeWidth: ring } : {}),
          },
          transform,
        );
        continue;
      }
      // Líneas: decimación min/max por columna de píxel físico (ADR 0002). Se decima sobre los
      // valores crudos (min y max se conservan bajo una transformación monótona) y después se
      // transforma el buffer, que ya es pequeño.
      // Incertidumbre como banda sombreada, debajo de la línea (sin decimar: su tamaño es el de
      // series con intervalos, que son pequeñas).
      if (low && high) {
        renderer.drawBand(
          'data',
          sx,
          low,
          high,
          from,
          to,
          { fill: color, opacity: 0.15 },
          transform,
        );
      }
      const pxPerUnit = (area.width / (x1 - x0)) * dpr;
      const buffer = minMaxDecimate(s.x, s.y, from, to, x0, pxPerUnit, this.decimation[i]);
      this.decimation[i] = buffer;
      renderer.drawLineSeries(
        'data',
        tx ? mapValues(buffer.x, 0, buffer.length, tx) : buffer.x,
        ty ? mapValues(buffer.y, 0, buffer.length, ty) : buffer.y,
        0,
        buffer.length,
        { stroke: color, width: config.line.width },
        transform,
      );
    }
  }

  /** Estadísticos del box plot por serie visible y categoría (vacío si no es un box plot). */
  getBoxStats(): readonly (readonly BoxStats[])[] {
    return this.boxes;
  }

  /**
   * Para el hover de un box plot, cada serie se reduce a una "barra" por categoría cuyo valor
   * es la mediana; así el índice espacial de barras sirve tal cual.
   */
  private boxSeries(): ResolvedSeries[] {
    return this.visibleSeries().map(({ series: s, index }) => {
      const stats = this.boxes[index] ?? [];
      const y = Float64Array.from(stats, (b) => (b.count > 0 ? b.median : NaN));
      return {
        id: s.id,
        name: s.name,
        x: Float64Array.from(stats, (_, i) => i),
        y,
        size: undefined,
        yLow: undefined,
        yHigh: undefined,
        value: undefined,
        length: stats.length,
      };
    });
  }

  /**
   * Box plot de Tukey: caja de Q1 a Q3, raya en la mediana, bigotes hasta el último dato dentro
   * de 1.5·IQR y atípicos como puntos. Varias series se colocan lado a lado en cada categoría.
   */
  /**
   * Gráfico de unidades. Las posiciones objetivo vienen del layout; si el modo cambió desde el
   * último dibujo, cada punto viaja de su posición anterior a la nueva durante
   * `dots.transition` ms (un fotograma por `requestDraw`), salvo con `prefers-reduced-motion`.
   * Con una selección activa, los puntos fuera del rango se pintan con el color del grid.
   */
  private drawDots(scales: ChartScales): void {
    const { config } = this;
    const renderer = this.target;
    const layout = this.dots;
    const first = this.visibleSeries()[0];
    if (!layout || !first || scales.x.kind === 'band') return;
    const n = layout.px.length;
    const shown = this.dotsShown;
    const sameSize = shown !== null && shown.x.length === n;
    const now = performance.now();

    // Arranque de la transición: el modo cambió y hay posiciones anteriores que interpolar.
    if (sameSize && shown.mode !== layout.mode && !this.dotsAnim) {
      const reduced =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (config.dots.transition > 0 && !reduced) {
        this.dotsAnim = { fromX: shown.x.slice(), fromY: shown.y.slice(), start: now };
      }
    }
    let x = layout.px;
    let y = layout.py;
    if (this.dotsAnim && sameSize) {
      const t = (now - this.dotsAnim.start) / config.dots.transition;
      if (t >= 1) {
        this.dotsAnim = null;
      } else {
        const k = easeOutCubic(t);
        x = new Float64Array(n);
        y = new Float64Array(n);
        const { fromX, fromY } = this.dotsAnim;
        for (let i = 0; i < n; i++) {
          x[i] = (fromX[i] as number) + ((layout.px[i] as number) - (fromX[i] as number)) * k;
          y[i] = (fromY[i] as number) + ((layout.py[i] as number) - (fromY[i] as number)) * k;
        }
        this.requestDraw();
      }
    } else {
      this.dotsAnim = null;
    }
    this.dotsShown = { x, y, mode: layout.mode };

    const color = seriesColor(config, first.index);
    const identity: Transform = { x: IDENTITY, y: IDENTITY };
    const sel = this.selection;
    if (!sel) {
      renderer.drawPointSeries(
        'data',
        x,
        y,
        0,
        n,
        { fill: color, radius: layout.radius },
        identity,
      );
      return;
    }
    // Dos pasadas: primero los atenuados y encima los seleccionados, para que no los tapen.
    const lo = Math.min(sel[0], sel[1]);
    const hi = Math.max(sel[0], sel[1]);
    const inX = new Float64Array(n);
    const inY = new Float64Array(n);
    const outX = new Float64Array(n);
    const outY = new Float64Array(n);
    let ni = 0;
    let no = 0;
    const values = first.series.x;
    for (let i = 0; i < n; i++) {
      const v = values[i] as number;
      if (v >= lo && v <= hi) {
        inX[ni] = x[i] as number;
        inY[ni++] = y[i] as number;
      } else {
        outX[no] = x[i] as number;
        outY[no++] = y[i] as number;
      }
    }
    renderer.drawPointSeries(
      'data',
      outX,
      outY,
      0,
      no,
      { fill: config.theme.muted ?? config.theme.grid, radius: layout.radius },
      identity,
    );
    renderer.drawPointSeries(
      'data',
      inX,
      inY,
      0,
      ni,
      { fill: color, radius: layout.radius },
      identity,
    );
  }

  /**
   * Unidades del total: la primera serie visible da un valor por categoría; cada categoría ocupa
   * `valor / unit` cuadros en una cuadrícula continua. Debajo, nombre y porcentaje de cada una.
   */
  private drawWaffle(area: Rect): void {
    const { config } = this;
    const renderer = this.target;
    const { theme } = config;
    const first = this.visibleSeries()[0];
    this.waffle = null;
    if (!first) return;
    const categories = this.categories();
    // `x` son los códigos de categoría: el valor de cada categoría va por su código, no por fila.
    const values = new Array<number>(categories.length).fill(0);
    for (let i = 0; i < first.series.length; i++) {
      const c = first.series.x[i] as number;
      const v = first.series.y[i] as number;
      if (c >= 0 && c < values.length && v === v) values[c] = (values[c] as number) + v;
    }
    const line = theme.fontSize * 1.5;
    const labelRows = config.waffle.labels ? 2 : 0;
    const grid: Rect = {
      x: area.x,
      y: area.y,
      width: area.width,
      height: Math.max(1, area.height - labelRows * line - (labelRows ? 6 : 0)),
    };
    const layout = waffleLayout(values, grid, config.waffle);
    this.waffle = layout;
    for (const cell of layout.cells) {
      renderer.drawRect('data', cell.x, cell.y, cell.size, cell.size, {
        fill: seriesColor({ series: this.waffleSpecs(categories), theme }, cell.category),
      });
    }
    if (!config.waffle.labels) return;
    const total = values.reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const style = { font: `${theme.fontSize}px ${theme.fontFamily}`, fill: theme.text };
    let lx = area.x;
    let ly = area.y + layout.rows * layout.size + 6 + line / 2;
    const bottom = area.y + area.height;
    categories.forEach((name, i) => {
      if (!((values[i] as number) > 0)) return;
      const text = `${name} ${Math.round(((values[i] as number) / total) * 100)} %`;
      const w = renderer.measureText(text, style) + 16;
      if (lx + w > area.x + area.width && lx > area.x) {
        lx = area.x;
        ly += line;
      }
      if (ly + line / 2 > bottom + 1) return;
      renderer.drawRect('data', lx, ly - 5, 10, 10, {
        fill: seriesColor({ series: this.waffleSpecs(categories), theme }, i),
      });
      renderer.drawText('data', text, lx + 14, ly, { ...style, baseline: 'middle' });
      lx += w + 14;
    });
    const unitText = `Cada cuadro = ${formatNumber(layout.unit)}`;
    const unitStyle = {
      font: `${Math.round(theme.fontSize * 0.92)}px ${theme.fontFamily}`,
      fill: theme.axis,
    };
    const unitWidth = renderer.measureText(unitText, unitStyle);
    const uy = lx + unitWidth + 8 <= area.x + area.width ? ly : ly + line;
    if (uy + line / 2 <= bottom + 1) {
      renderer.drawText('data', unitText, area.x + area.width, uy, {
        ...unitStyle,
        align: 'right',
        baseline: 'middle',
      });
    }
  }

  /** Una "serie" por categoría, solo para que `seriesColor` reparta la paleta por categoría. */
  private waffleSpecs(categories: readonly string[]): readonly SeriesSpec[] {
    const spec = this.config.series[0];
    return categories.map((c) => ({ id: c, name: c, x: spec?.x ?? '', y: spec?.y ?? '' }));
  }

  private drawBoxes(x: BandScale, transform: Transform, renderer: Renderer): void {
    const { config } = this;
    const { background } = config.theme;
    const visible = this.visibleSeries();
    const slot = x.bandwidth / Math.max(1, visible.length);
    const boxWidth = slot * 0.8;
    if (config.box.mark !== 'box') {
      this.drawDistribution(x, transform, renderer);
      if (config.box.now !== 'none') this.drawNowMarks(x, transform, renderer);
      return;
    }
    if (config.box.now !== 'none') this.drawNowMarks(x, transform, renderer);

    visible.forEach(({ index: colorIndex }, si) => {
      const stats = this.boxes[colorIndex] ?? [];
      const n = Math.min(stats.length, x.count);
      const color = seriesColor(config, colorIndex);
      const cx = new Float64Array(n);
      const px0 = new Float64Array(n);
      const px1 = new Float64Array(n);
      const q1 = new Float64Array(n);
      const q3 = new Float64Array(n);
      const low = new Float64Array(n);
      const high = new Float64Array(n);
      const median = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const b = stats[i] as BoxStats;
        const start = x.start(i) + si * slot + (slot - boxWidth) / 2;
        cx[i] = start + boxWidth / 2;
        px0[i] = start;
        px1[i] = start + boxWidth;
        const empty = b.count === 0;
        q1[i] = empty ? NaN : b.q1;
        q3[i] = empty ? NaN : b.q3;
        low[i] = empty ? NaN : b.low;
        high[i] = empty ? NaN : b.high;
        median[i] = empty ? NaN : b.median;
      }
      // Bigotes debajo, la caja encima (tapa el tramo del bigote que cruza la caja).
      renderer.drawErrorBars(
        'data',
        cx,
        low,
        high,
        0,
        n,
        { stroke: color, width: 1 },
        transform,
        boxWidth / 2,
      );
      renderer.drawBars(
        'data',
        px0,
        px1,
        q1,
        q3,
        0,
        n,
        { fill: background, stroke: color, strokeWidth: 1.5 },
        transform,
      );
      renderer.drawBars('data', px0, px1, q1, q3, 0, n, { fill: color, opacity: 0.25 }, transform);
      for (let i = 0; i < n; i++) {
        const m = median[i] as number;
        if (m !== m) continue;
        const py = applyMap(transform.y, m);
        renderer.drawRule('data', px0[i] as number, py, px1[i] as number, py, {
          stroke: color,
          width: 2,
        });
      }
      if (config.box.outliers) {
        for (let i = 0; i < n; i++) {
          const b = stats[i] as BoxStats;
          if (b.outliers.length === 0) continue;
          const ox = new Float64Array(b.outliers.length).fill(cx[i] as number);
          renderer.drawPointSeries(
            'data',
            ox,
            b.outliers,
            0,
            b.outliers.length,
            { fill: color, radius: 2.5, opacity: 0.7 },
            transform,
          );
        }
      }
    });
  }

  /**
   * `box.mark` distinto de `'box'`: el reparto de cada grupo como puntos apilados en cubetas
   * (`'dots'`), franja de densidad (`'density'`) o bandas de percentiles (`'range'`). Las
   * cubetas son las mismas para todos los grupos de una serie, así las filas se alinean.
   */
  private drawDistribution(x: BandScale, transform: Transform, renderer: Renderer): void {
    const { config } = this;
    const { theme, box } = config;
    const visible = this.visibleSeries();
    const slot = x.bandwidth / Math.max(1, visible.length);
    const cobalto = colormap('cobalto');
    const py = (v: number): number => applyMap(transform.y, v);
    visible.forEach(({ index: si }, vi) => {
      const groups = this.groups[si] ?? [];
      const n = Math.min(groups.length, x.count);
      const color = seriesColor(config, si);
      const medianRule = (i: number, values: Float64Array, width: number): void => {
        if (values.length === 0) return;
        const m = rangeBands(values, box.range).median;
        const cx = x.start(i) + vi * slot + slot / 2;
        renderer.drawRule('data', cx - width / 2, py(m), cx + width / 2, py(m), {
          stroke: box.mark === 'range' ? theme.background : theme.text,
          width: 2,
        });
      };
      if (box.mark === 'range') {
        const w = slot * 0.5;
        for (let i = 0; i < n; i++) {
          const values = groups[i] as Float64Array;
          if (values.length === 0) continue;
          const b = rangeBands(values, box.range);
          const x0 = x.start(i) + vi * slot + (slot - w) / 2;
          renderer.drawRect('data', x0, py(b.hi), w, py(b.lo) - py(b.hi), {
            fill: colormapCss(cobalto, 0.2),
          });
          renderer.drawRect('data', x0, py(b.q3), w, py(b.q1) - py(b.q3), {
            fill: colormapCss(cobalto, 0.55),
          });
          medianRule(i, values, w);
        }
        return;
      }
      if (box.mark === 'density') {
        const bins0 =
          box.bins === 'auto'
            ? Math.max(10, Math.floor(this.layout.plotArea.height / 6))
            : box.bins;
        const edges = sharedEdges(groups.slice(0, n), bins0);
        const bins = edges.length - 1;
        const binPx = Math.abs(py(edges[1] as number) - py(edges[0] as number));
        const w = slot * 0.7;
        for (let i = 0; i < n; i++) {
          const c = smooth3(binCounts(groups[i] as Float64Array, edges));
          let top = 0;
          for (let k = 0; k < bins; k++) top = Math.max(top, c[k] as number);
          if (top === 0) continue;
          const x0 = x.start(i) + vi * slot + (slot - w) / 2;
          for (let k = 0; k < bins; k++) {
            const v = c[k] as number;
            if (v === 0) continue;
            const y1 = py(edges[k + 1] as number);
            renderer.drawRect('data', x0, y1, w, binPx + 0.5, {
              fill: colormapCss(cobalto, 0.1 + 0.9 * (v / top)),
            });
          }
          medianRule(i, groups[i] as Float64Array, w + 8);
        }
        return;
      }
      // 'dots': un enjambre por grupo, cada punto en su altura exacta y desplazado a los lados
      // lo justo para no encimarse; el radio baja hasta que el enjambre cabe en la banda.
      const half = slot * 0.45;
      let sLo = Infinity;
      let sHi = -Infinity;
      const shades = this.shades[si];
      if (shades) {
        for (const g of shades)
          for (let k = 0; k < g.length; k++) {
            const v = g[k] as number;
            if (v === v) {
              if (v < sLo) sLo = v;
              if (v > sHi) sHi = v;
            }
          }
      }
      const pys = groups.slice(0, n).map((g) => Float64Array.from(g, (v) => py(v)));
      let r = 3;
      let offsets: (Float64Array | null)[] = [];
      for (; r >= 2; r -= 0.5) {
        offsets = pys.map((ys) => beeswarm(ys, r, half));
        if (offsets.every((o) => o !== null)) break;
      }
      if (r < 2) r = 2;
      for (let i = 0; i < n; i++) {
        const values = groups[i] as Float64Array;
        const tone = shades?.[i];
        const ys = pys[i] as Float64Array;
        const off = offsets[i] ?? beeswarm(ys, r, Infinity) ?? new Float64Array(ys.length);
        const cx0 = x.start(i) + vi * slot + slot / 2;
        for (let k = 0; k < values.length; k++) {
          let fill = color;
          if (tone && sHi > sLo) {
            const t = ((tone[k] as number) - sLo) / (sHi - sLo);
            fill = colormapCss(cobalto, t === t ? 0.25 + 0.75 * t : 0.5);
          }
          renderer.drawPointSeries(
            'data',
            Float64Array.of(cx0 + (off[k] as number)),
            Float64Array.of(ys[k] as number),
            0,
            1,
            { fill, radius: r },
            { x: IDENTITY, y: IDENTITY },
          );
        }
        medianRule(i, values, slot * 0.9);
      }
    });
  }

  /**
   * `box.now: 'last'`: la última fila de cada grupo como punto del color de la serie, con su
   * valor y en qué parte del reparto cae. El texto va encima del punto, o debajo si no cabe.
   */
  private drawNowMarks(x: BandScale, transform: Transform, renderer: Renderer): void {
    const { config } = this;
    const { theme, box } = config;
    const visible = this.visibleSeries();
    const slot = x.bandwidth / Math.max(1, visible.length);
    const area = this.layout.plotArea;
    const format = (v: number): string => {
      const f = config.axes.y.format;
      if (f) return f(v);
      const s = this.scales?.y;
      const step = s ? s.tickStep(6) : undefined;
      // Un decimal más que los ticks: la cifra del marcador es un dato, no una marca de eje.
      return formatNumber(v, step !== undefined && step > 0 ? { step: step / 10 } : {});
    };
    const chip = (
      lines: readonly { text: string; font: string }[],
      cx: number,
      top: number,
    ): void => {
      let w = 0;
      for (const l of lines)
        w = Math.max(w, renderer.measureText(l.text, { font: l.font, fill: theme.text }));
      const h = lines.length * theme.fontSize * 1.15 + 4;
      renderer.drawRect('overlay', cx - w / 2 - 4, top - 2, w + 8, h, {
        fill: theme.background,
        opacity: 0.85,
      });
    };
    visible.forEach(({ index: si }, vi) => {
      const groups = this.groups[si] ?? [];
      const n = Math.min(groups.length, x.count);
      const color = seriesColor(config, si);
      for (let i = 0; i < n; i++) {
        const values = groups[i] as Float64Array;
        if (values.length === 0) continue;
        const v = values[values.length - 1] as number;
        const cx = x.start(i) + vi * slot + slot / 2;
        const cy = applyMap(transform.y, v);
        renderer.drawPointSeries(
          'overlay',
          Float64Array.of(cx),
          Float64Array.of(cy),
          0,
          1,
          { fill: color, radius: 6, stroke: theme.background, strokeWidth: 2 },
          { x: IDENTITY, y: IDENTITY },
        );
        const p = percentileOf(values, v);
        const pct = Math.round(p * 100);
        const L = box.labels;
        const context =
          p >= 1
            ? (L.max ?? '')
            : p <= 0.05
              ? (L.lowest ?? '').replace('{p}', String(Math.max(1, pct)))
              : p >= 0.95
                ? (L.highest ?? '').replace('{p}', String(Math.max(1, 100 - pct)))
                : (L.above ?? '').replace('{p}', String(pct));
        const above = cy - 34 >= area.y;
        const lh = theme.fontSize * 1.15;
        const fontValue = `600 ${theme.fontSize}px ${monoFont(theme)}`;
        const fontContext = `${Math.round(theme.fontSize * 0.85)}px ${theme.fontFamily}`;
        const top = above ? cy - 10 - 2 * lh : cy + 10;
        chip(
          [
            { text: context, font: fontContext },
            { text: format(v), font: fontValue },
          ],
          cx,
          top,
        );
        const [first, second] = above
          ? [
              { text: context, font: fontContext, fill: theme.axis },
              { text: format(v), font: fontValue, fill: theme.text },
            ]
          : [
              { text: format(v), font: fontValue, fill: theme.text },
              { text: context, font: fontContext, fill: theme.axis },
            ];
        renderer.drawText('overlay', first.text, cx, top, {
          font: first.font,
          fill: first.fill,
          align: 'center',
          baseline: 'top',
        });
        renderer.drawText('overlay', second.text, cx, top + lh, {
          font: second.font,
          fill: second.fill,
          align: 'center',
          baseline: 'top',
        });
      }
    });
  }

  /** `bar.mark: 'dot'`: un punto donde terminaría cada barra, con anillo del fondo. */
  private drawDotMarks(x: BandScale, transform: Transform, renderer: Renderer): void {
    const { config } = this;
    const visible = this.visibleSeries();
    const slot = x.bandwidth / Math.max(1, visible.length);
    const radius = Math.max(4, Math.min(7, slot * 0.3));
    visible.forEach(({ series: s, index: colorIndex }, si) => {
      const count = Math.min(s.length, x.count);
      const px = new Float64Array(count);
      for (let i = 0; i < count; i++) px[i] = x.start(i) + slot * (si + 0.5);
      renderer.drawPointSeries(
        'data',
        px,
        s.y,
        0,
        count,
        {
          fill: seriesColor(config, colorIndex),
          radius,
          stroke: config.theme.background,
          strokeWidth: 2,
        },
        { x: IDENTITY, y: transform.y },
      );
    });
  }

  private drawBars(x: BandScale, transform: Transform, renderer: Renderer): void {
    const { config } = this;
    if (config.bar.mark === 'dot') {
      this.drawDotMarks(x, transform, renderer);
      return;
    }
    const visible = this.visibleSeries();
    const stacked = config.bar.mode === 'stacked';
    const slot = stacked ? x.bandwidth : x.bandwidth / Math.max(1, visible.length);
    const positive = new Float64Array(x.count);
    const negative = new Float64Array(x.count);
    // Apiladas: solo el segmento exterior de cada pila lleva el extremo redondeado.
    const topPositive = new Int32Array(x.count).fill(-1);
    const topNegative = new Int32Array(x.count).fill(-1);
    if (stacked) {
      visible.forEach(({ series: s }, si) => {
        const count = Math.min(s.length, x.count);
        for (let i = 0; i < count; i++) {
          const v = s.y[i] as number;
          if (v > 0) topPositive[i] = si;
          else if (v < 0) topNegative[i] = si;
        }
      });
    }

    visible.forEach(({ series: s, index: colorIndex }, si) => {
      const count = Math.min(s.length, x.count);
      const px0 = new Float64Array(count);
      const px1 = new Float64Array(count);
      const y0 = new Float64Array(count);
      const y1 = new Float64Array(count);
      const inner = stacked ? new Float64Array(count).fill(NaN) : null;
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
          const top = v >= 0 ? topPositive[i] : topNegative[i];
          if (top !== si && inner) {
            inner[i] = y1[i] as number;
            y1[i] = NaN;
          }
        } else {
          y0[i] = 0;
          y1[i] = v;
        }
      }
      const color = seriesColor(config, colorIndex);
      // Hueco del color del fondo entre barras vecinas o, apiladas, entre segmentos.
      const style = {
        fill: color,
        gap: stacked ? 0 : config.bar.gap,
        gapStart: stacked && si > 0 ? config.bar.gap : 0,
      };
      renderer.drawBars(
        'data',
        px0,
        px1,
        y0,
        y1,
        0,
        count,
        { ...style, radius: config.bar.radius },
        transform,
      );
      if (inner) renderer.drawBars('data', px0, px1, y0, inner, 0, count, style, transform);
    });
  }
}

function emptyLayout(): Layout {
  return { width: 0, height: 0, plotArea: { x: 0, y: 0, width: 0, height: 0 } };
}

/** Copia de `values` con `fn` aplicada en `[from, to)`; fuera del rango queda NaN (no se dibuja). */
function mapValues(
  values: Float64Array,
  from: number,
  to: number,
  fn: (v: number) => number,
): Float64Array {
  const out = new Float64Array(values.length);
  if (from > 0) out.fill(NaN, 0, from);
  for (let i = from; i < to; i++) {
    // log10(0) = −∞ y log10(−1) = NaN: ambos se vuelven hueco en la línea.
    const r = fn(values[i] as number);
    out[i] = Number.isFinite(r) ? r : NaN;
  }
  if (to < values.length) out.fill(NaN, to);
  return out;
}

/** Etiquetas de la barra de color: mínimo, máximo y centro, con decimales según el rango. */
function legendLabels(domain: readonly [number, number], center: number | null): string[] {
  const [lo, hi] = domain;
  const step = (hi - lo) / 10;
  const out = [formatNumber(lo, { step }), formatNumber(hi, { step })];
  if (center !== null) out.push(formatNumber(center, { step }));
  return out;
}

/** Puntos de dispersión hasta los que se dibuja el anillo de fondo alrededor de cada punto. */
const RING_MAX_POINTS = 5_000;

/** Umbral de puntos a partir del cual `renderer: 'auto'` elige WebGL para dispersiones. */
export const WEBGL_AUTO_THRESHOLD = 50_000;

function useWebGL(config: ChartConfig): boolean {
  const mode = config.renderer ?? 'canvas';
  if (mode === 'webgl') return true;
  if (mode === 'auto')
    return config.type === 'scatter' && config.data.length >= WEBGL_AUTO_THRESHOLD;
  return false;
}

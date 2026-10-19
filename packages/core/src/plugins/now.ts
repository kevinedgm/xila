import { seriesColor } from '../config';
import { monoFont } from '../theme';
import type { ChartPlugin, PluginContext } from '../plugin';
import { formatNumber } from '../format/number';
import { timeTickFormatter, timeTicks } from '../scales/time';

export interface NowOptions {
  /** Dónde va el panel de cifras: `'top'` (defecto) o `'bottom'`. */
  readonly position?: 'top' | 'bottom';
  /** Cuántos puntos atrás se compara la cifra ("+1,5 en 10 años"): 10. */
  readonly lookback?: number;
  /** Texto de la cifra; por defecto el formato del eje Y. */
  readonly format?: (value: number) => string;
  /** Texto del instante; por defecto el del eje X (fechas con el calendario). */
  readonly formatX?: (value: number) => string;
  /** Botón de reproducción y deslizador de tiempo (`true`). */
  readonly controls?: boolean;
  /** Milisegundos entre pasos al reproducir (120). */
  readonly interval?: number;
  /** Atenuar en el gráfico lo posterior al instante (`true`). */
  readonly dim?: boolean;
  /** Etiquetas de la interfaz. */
  readonly labels?: Partial<Record<'play' | 'pause' | 'ago' | 'time', string>>;
}

const LABELS = { play: 'Reproducir', pause: 'Pausa', ago: 'en {n} puntos', time: 'Instante' };

/** Unión ordenada de las X finitas de las series no ocultas: la línea de tiempo del panel. */
export function nowTimeline(
  series: readonly { readonly id: string; readonly x: Float64Array; readonly length: number }[],
  hidden: ReadonlySet<string>,
): Float64Array {
  const set = new Set<number>();
  for (const s of series) {
    if (hidden.has(s.id)) continue;
    for (let i = 0; i < s.length; i++) {
      const x = s.x[i] as number;
      if (Number.isFinite(x)) set.add(x);
    }
  }
  return Float64Array.from(set).sort();
}

/** Índice del último punto de `s` con x ≤ t, o -1 si ninguno. */
export function indexAt(
  s: { readonly x: Float64Array; readonly length: number },
  t: number,
): number {
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((s.x[mid] as number) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/**
 * Cifra de una serie en el instante `times[cur]` y su cambio contra `lookback` instantes atrás
 * (`NaN` cuando no hay dato). `steps` es cuántos instantes separan ambas cifras.
 */
export function nowValue(
  s: { readonly x: Float64Array; readonly y: Float64Array; readonly length: number },
  times: Float64Array,
  cur: number,
  lookback: number,
): { value: number; delta: number; steps: number } {
  const t = times[cur] as number;
  const back = Math.max(0, cur - lookback);
  const i = indexAt(s, t);
  const value = i >= 0 ? (s.y[i] as number) : NaN;
  const j = indexAt(s, times[back] as number);
  const prev = j >= 0 ? (s.y[j] as number) : NaN;
  const steps = cur - back;
  return { value, delta: steps > 0 ? value - prev : NaN, steps };
}

interface Tile {
  readonly id: string;
  readonly value: HTMLElement;
  readonly delta: HTMLElement;
  readonly trail: HTMLCanvasElement;
}

/**
 * "Ahora con estela": un panel con la cifra actual de cada serie, su cambio contra `lookback`
 * puntos atrás y la historia como estela que se desvanece hacia atrás. Un deslizador y un botón
 * mueven el instante; el gráfico atenúa lo posterior y marca el instante con una regla.
 * La cifra responde la pregunta principal (¿dónde está hoy?); la trayectoria acompaña.
 * La línea de tiempo es la unión de las X finitas de las series visibles.
 */
export function nowPlugin(options: NowOptions = {}): ChartPlugin {
  const position = options.position ?? 'bottom';
  const lookback = options.lookback ?? 10;
  const L = { ...LABELS, ...options.labels };
  let el: HTMLDivElement | null = null;
  let tiles: Tile[] = [];
  let range: HTMLInputElement | null = null;
  let playBtn: HTMLButtonElement | null = null;
  let timeEl: HTMLElement | null = null;
  let ctx: PluginContext | null = null;
  let times: Float64Array = new Float64Array(0);
  let cur = -1;
  let timer: ReturnType<typeof setInterval> | null = null;
  let reserved = 0;
  let observer: ResizeObserver | null = null;
  let seriesKey = '';

  const formatY = (v: number): string => {
    if (options.format) return options.format(v);
    const axis = ctx?.config.axes.y.format;
    if (axis) return axis(v);
    const s = ctx?.getScales()?.y;
    const step = s ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };
  const formatX = (v: number): string => {
    if (options.formatX) return options.formatX(v);
    const axis = ctx?.config.axes.x.format;
    if (axis) return axis(v);
    const s = ctx?.getScales()?.x;
    if (s && s.kind === 'time' && times.length > 1) {
      const t = timeTicks([times[0] as number, times[times.length - 1] as number], 6);
      return timeTickFormatter(t.interval)(v, 0, [v]);
    }
    const step = s && s.kind !== 'band' ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };

  const rebuildTimeline = (c: PluginContext): void => {
    times = nowTimeline(c.getSeries(), c.hiddenSeries);
    if (cur < 0 || cur >= times.length) cur = times.length - 1;
    if (range) {
      range.max = String(Math.max(0, times.length - 1));
      range.value = String(cur);
    }
  };

  const drawTrail = (c: PluginContext, tile: Tile, si: number): void => {
    const s = c.getSeries()[si];
    if (!s) return;
    const canvas = tile.trail;
    const W = canvas.clientWidth || 120;
    const H = 34;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    const t = times[cur] as number;
    const t0 = times[0] as number;
    const span = Math.max(1e-9, (times[times.length - 1] as number) - t0);
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < s.length; i++) {
      const v = s.y[i] as number;
      if (v === v) {
        if (v > max) max = v;
        if (v < min) min = v;
      }
    }
    if (!(max > min)) {
      max = min + 1;
    }
    const px = (x: number): number => 4 + ((x - t0) / span) * (W - 8);
    const py = (v: number): number => H - 4 - ((v - min) / (max - min)) * (H - 8);
    const end = indexAt(s, t);
    const color = seriesColor(c.config, si);
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.strokeStyle = color;
    for (let i = 1; i <= end; i++) {
      const a = s.y[i - 1] as number;
      const b = s.y[i] as number;
      if (a !== a || b !== b) continue;
      const age = (t - (s.x[i] as number)) / span;
      g.globalAlpha = Math.max(0.06, 1 - age * 1.6);
      g.beginPath();
      g.moveTo(px(s.x[i - 1] as number), py(a));
      g.lineTo(px(s.x[i] as number), py(b));
      g.stroke();
    }
    g.globalAlpha = 1;
    if (end >= 0 && (s.y[end] as number) === (s.y[end] as number)) {
      g.fillStyle = color;
      g.beginPath();
      g.arc(px(s.x[end] as number), py(s.y[end] as number), 3.5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = c.config.theme.background;
      g.lineWidth = 1.5;
      g.stroke();
    }
  };

  const render = (c: PluginContext): void => {
    if (!el || times.length === 0) return;
    const t = times[cur] as number;
    if (timeEl) timeEl.textContent = formatX(t);
    tiles.forEach((tile) => {
      const si = c.getSeries().findIndex((s) => s.id === tile.id);
      const s = c.getSeries()[si];
      if (!s) return;
      const { value, delta, steps } = nowValue(s, times, cur, lookback);
      tile.value.textContent = value === value ? formatY(value) : '–';
      tile.delta.textContent =
        delta === delta
          ? `${delta >= 0 ? '+' : '−'}${formatY(Math.abs(delta))} ${L.ago.replace('{n}', String(steps))}`
          : '';
      drawTrail(c, tile, si);
    });
  };

  const build = (c: PluginContext): void => {
    if (!el) return;
    const { theme } = c.config;
    el.innerHTML = '';
    tiles = [];
    const grid = document.createElement('div');
    grid.className = 'xila-now-tiles';
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: '10px',
    });
    c.config.series.forEach((spec, i) => {
      if (c.hiddenSeries.has(spec.id)) return;
      const tile = document.createElement('div');
      tile.className = 'xila-now-tile';
      tile.setAttribute('data-series', spec.id);
      Object.assign(tile.style, {
        border: `1px solid ${theme.grid}`,
        borderRadius: '8px',
        padding: '8px 10px',
        minWidth: '0',
      });
      const name = document.createElement('div');
      name.className = 'xila-now-name';
      Object.assign(name.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        font: `${theme.fontSize}px ${theme.fontFamily}`,
        color: theme.axis,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      });
      const dot = document.createElement('i');
      Object.assign(dot.style, {
        width: '9px',
        height: '9px',
        borderRadius: '50%',
        background: seriesColor(c.config, i),
        flex: 'none',
      });
      name.append(dot, document.createTextNode(spec.name ?? spec.id));
      const value = document.createElement('div');
      value.className = 'xila-now-value';
      Object.assign(value.style, {
        font: `600 ${Math.round(theme.fontSize * 2)}px/1.15 ${monoFont(theme)}`,
        color: theme.text,
        fontVariantNumeric: 'tabular-nums',
        margin: '2px 0',
      });
      const delta = document.createElement('div');
      delta.className = 'xila-now-delta';
      Object.assign(delta.style, {
        font: `${Math.round(theme.fontSize * 0.92)}px ${theme.fontFamily}`,
        color: theme.axis,
        minHeight: '1.3em',
      });
      const trail = document.createElement('canvas');
      trail.className = 'xila-now-trail';
      trail.setAttribute('aria-hidden', 'true');
      Object.assign(trail.style, {
        display: 'block',
        width: '100%',
        height: '34px',
        marginTop: '4px',
      });
      tile.append(name, value, delta, trail);
      grid.appendChild(tile);
      tiles.push({ id: spec.id, value, delta, trail });
    });
    el.appendChild(grid);

    if (options.controls !== false) {
      const bar = document.createElement('div');
      bar.className = 'xila-now-controls';
      Object.assign(bar.style, {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: '8px',
        font: `${theme.fontSize}px ${theme.fontFamily}`,
        color: theme.axis,
      });
      playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'xila-now-play';
      playBtn.textContent = L.play;
      Object.assign(playBtn.style, {
        font: `500 ${theme.fontSize}px ${theme.fontFamily}`,
        color: theme.text,
        background: 'transparent',
        border: `1px solid ${theme.grid}`,
        borderRadius: '6px',
        padding: '3px 10px',
        cursor: 'pointer',
      });
      playBtn.addEventListener('click', () => (timer ? stop() : play(c)));
      range = document.createElement('input');
      range.type = 'range';
      range.className = 'xila-now-range';
      range.min = '0';
      range.max = String(Math.max(0, times.length - 1));
      range.value = String(cur);
      range.setAttribute('aria-label', L.time);
      Object.assign(range.style, { flex: '1 1 160px', maxWidth: '320px', accentColor: theme.text });
      range.addEventListener('input', () => {
        stop();
        setCursor(c, Number(range?.value ?? 0));
      });
      timeEl = document.createElement('span');
      timeEl.className = 'xila-now-time';
      timeEl.style.fontVariantNumeric = 'tabular-nums';
      bar.append(playBtn, range, timeEl);
      el.appendChild(bar);
    }
  };

  const setCursor = (c: PluginContext, i: number): void => {
    cur = Math.max(0, Math.min(times.length - 1, i));
    if (range) range.value = String(cur);
    render(c);
    c.requestDraw();
  };

  const stop = (): void => {
    if (timer) clearInterval(timer);
    timer = null;
    if (playBtn) playBtn.textContent = L.play;
  };

  const play = (c: PluginContext): void => {
    if (times.length < 2) return;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setCursor(c, times.length - 1);
      return;
    }
    const start = cur >= times.length - 1 ? 0 : cur;
    setCursor(c, start);
    if (playBtn) playBtn.textContent = L.pause;
    timer = setInterval(() => {
      if (cur >= times.length - 1) {
        stop();
        return;
      }
      setCursor(c, cur + 1);
    }, options.interval ?? 120);
  };

  const key = (c: PluginContext): string =>
    c.config.series.map((s) => `${s.id}:${s.name ?? ''}:${c.hiddenSeries.has(s.id)}`).join('|');

  return {
    id: 'now',
    install(c) {
      ctx = c;
      el = document.createElement('div');
      el.className = 'xila-now';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-live', 'polite');
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        [position]: '0',
        padding: '6px 8px 8px',
        pointerEvents: 'auto',
        boxSizing: 'border-box',
      });
      c.renderer.element.appendChild(el);
      rebuildTimeline(c);
      seriesKey = key(c);
      build(c);
      render(c);
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(() => {
          if (el && el.offsetHeight !== reserved) c.requestLayout();
          render(c);
        });
        observer.observe(el);
      }
    },
    reserveSpace() {
      reserved = el?.offsetHeight ?? 0;
      return position === 'top' ? { top: reserved } : { bottom: reserved };
    },
    afterLayout(_layout, c) {
      ctx = c;
      const k = key(c);
      if (k !== seriesKey) {
        seriesKey = k;
        rebuildTimeline(c);
        build(c);
      }
      render(c);
    },
    afterDraw(c) {
      const scales = c.getScales();
      if (options.dim === false || !scales || scales.x.kind === 'band' || times.length === 0)
        return;
      if (cur >= times.length - 1) return;
      const area = c.layout.plotArea;
      const px = scales.x.toPixel(times[cur] as number);
      const right = area.x + area.width;
      if (px < right) {
        c.renderer.drawRect('data', px, area.y, right - px, area.height, {
          fill: c.config.theme.background,
          opacity: 0.78,
        });
      }
      c.renderer.drawRule('data', px, area.y, px, area.y + area.height, {
        stroke: c.config.theme.axis,
        width: 1,
        dash: [4, 3],
      });
    },
    onEvent(name, _payload, c) {
      if (name === 'dataChanged') {
        rebuildTimeline(c);
        seriesKey = key(c);
        build(c);
        render(c);
      }
      if (name === 'visibility') {
        rebuildTimeline(c);
        seriesKey = key(c);
        build(c);
        render(c);
        c.requestLayout();
      }
    },
    uninstall() {
      stop();
      observer?.disconnect();
      observer = null;
      el?.remove();
      el = null;
      tiles = [];
      ctx = null;
    },
  };
}

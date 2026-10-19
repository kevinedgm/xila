import type { ChartConfig } from '../config';
import { seriesColor } from '../config';
import { DataTable } from '../data/table';
import { filterRows } from '../data/transform';
import { formatNumber } from '../format/number';
import type { ChartPlugin, PluginContext } from '../plugin';
import { timeTickFormatter, timeTicks } from '../scales/time';

export interface TrajectoryOptions {
  /**
   * Columna de la tabla con el instante de cada fila (tiempo o número). Define la línea de
   * tiempo del deslizador y qué filas se muestran hasta el instante elegido. Sin ella, la
   * línea de tiempo es el orden de las filas.
   */
  readonly time?: string;
  /** `id` de la serie protagonista al inicio; por defecto la primera. `null` muestra todas en color. */
  readonly series?: string | null;
  /** Botones para cambiar de protagonista, con una opción "Todas" (`true`). */
  readonly selector?: boolean;
  /** Botón Reproducir y deslizador de tiempo (`true`). */
  readonly controls?: boolean;
  /** Milisegundos entre pasos al reproducir (120). */
  readonly interval?: number;
  /** Texto del valor Y de la cabeza; por defecto el formato del eje Y. */
  readonly format?: (value: number) => string;
  /** Texto del valor X de la cabeza; por defecto el formato del eje X. */
  readonly formatX?: (value: number) => string;
  /** Texto del instante; por defecto el del eje de tiempo (fechas con el calendario). */
  readonly formatTime?: (value: number) => string;
  /** Etiquetas de la interfaz. */
  readonly labels?: Partial<Record<'play' | 'pause' | 'time' | 'group' | 'all', string>>;
}

const LABELS = {
  play: 'Reproducir',
  pause: 'Pausa',
  time: 'Instante',
  group: 'Serie protagonista',
  all: 'Todas',
};

/** Instantes distintos y finitos de la columna, ordenados: la línea de tiempo. */
export function trajectoryTimeline(values: ArrayLike<number>): Float64Array {
  const set = new Set<number>();
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (Number.isFinite(v)) set.add(v);
  }
  return Float64Array.from(set).sort();
}

/** Índice de la última fila de la serie con X e Y finitas, o -1. */
export function trajectoryHead(s: {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly length: number;
}): number {
  for (let i = s.length - 1; i >= 0; i--) {
    const x = s.x[i] as number;
    const y = s.y[i] as number;
    if (x === x && y === y) return i;
  }
  return -1;
}

/**
 * Trayectorias, la forma A de _Más allá de la dispersión_: cada serie es un camino en el plano
 * (los puntos se unen en el orden de las filas) con una cabeza en su último punto. La
 * protagonista va en su color con nombre y valores; las demás en el color apagado del tema con
 * solo su nombre. Un deslizador y un botón mueven el instante: el plugin filtra las filas hasta
 * ese instante y el camino se dibuja detrás de la cabeza. Los dominios de los ejes se fijan con
 * todos los datos, así el plano no salta al mover el tiempo.
 */
export function trajectoryPlugin(options: TrajectoryOptions = {}): ChartPlugin {
  const L = { ...LABELS, ...options.labels };
  let focus: string | null | undefined = options.series;
  let el: HTMLDivElement | null = null;
  let selectorEl: HTMLDivElement | null = null;
  let range: HTMLInputElement | null = null;
  let playBtn: HTMLButtonElement | null = null;
  let timeEl: HTMLElement | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let times: Float64Array = new Float64Array(0);
  let cur = -1;
  let source: DataTable | null = null;
  let domains: { x: readonly [number, number]; y: readonly [number, number] } | null = null;
  let ctx: PluginContext | null = null;

  const formatY = (v: number, c: PluginContext): string => {
    if (options.format) return options.format(v);
    const axis = c.config.axes.y.format;
    if (axis) return axis(v);
    const s = c.getScales()?.y;
    const step = s ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined ? { step } : {});
  };
  const formatX = (v: number, c: PluginContext): string => {
    if (options.formatX) return options.formatX(v);
    const axis = c.config.axes.x.format;
    if (axis) return axis(v);
    const s = c.getScales()?.x;
    const step = s && s.kind !== 'band' ? s.tickStep(6) : undefined;
    return formatNumber(v, step !== undefined && step > 0 ? { step } : {});
  };
  const formatTime = (v: number): string => {
    if (options.formatTime) return options.formatTime(v);
    const name = options.time;
    if (!name) return String(v);
    const col = source?.column(name);
    if (col?.kind === 'time' && times.length > 1) {
      const t = timeTicks([times[0] as number, times[times.length - 1] as number], 6);
      return timeTickFormatter(t.interval)(v, 0, [v]);
    }
    return formatNumber(v);
  };

  /** Dominios con todos los datos, calculados una vez por tabla. */
  const fullDomains = (config: ChartConfig): typeof domains => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const spec of config.series) {
      if (!spec.y) continue;
      const xs = config.data.numeric(spec.x);
      const ys = config.data.numeric(spec.y);
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i] as number;
        const y = ys[i] as number;
        if (x !== x || y !== y) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (!(x0 <= x1) || !(y0 <= y1)) return null;
    // Margen para que las cabezas no toquen el borde: décadas enteras en log, 5 % en lineal,
    // y el cero se incluye si todo es positivo.
    const pad = (lo: number, hi: number, log: boolean): readonly [number, number] => {
      if (log && lo > 0) return [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi))];
      const m = (hi - lo || 1) * 0.05;
      return [lo >= 0 ? 0 : lo - m, hi + m];
    };
    return {
      x: pad(x0, x1, config.scales?.x?.type === 'log'),
      y: pad(y0, y1, config.scales?.y?.type === 'log'),
    };
  };

  const rebuildTimeline = (config: ChartConfig): void => {
    times = options.time
      ? trajectoryTimeline(config.data.numeric(options.time))
      : Float64Array.from({ length: config.data.length }, (_, i) => i);
    if (cur < 0 || cur >= times.length) cur = times.length - 1;
    if (range) {
      range.max = String(Math.max(0, times.length - 1));
      range.value = String(cur);
    }
  };

  const renderSelector = (c: PluginContext): void => {
    if (!selectorEl) return;
    selectorEl.innerHTML = '';
    const { theme } = c.config;
    const items: { id: string | null; text: string }[] = c.config.series.map((s) => ({
      id: s.id,
      text: s.name ?? s.id,
    }));
    items.push({ id: null, text: L.all });
    items.forEach(({ id, text }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'xila-trajectory-item';
      b.setAttribute('data-series', id ?? '');
      const on = id === focus;
      b.setAttribute('aria-pressed', String(on));
      b.textContent = text;
      Object.assign(b.style, {
        font: `500 ${theme.fontSize}px ${theme.fontFamily}`,
        color: on ? theme.background : theme.text,
        background: on ? theme.text : 'transparent',
        border: `1px solid ${on ? theme.text : theme.grid}`,
        borderRadius: '6px',
        padding: '3px 10px',
        marginRight: '6px',
        marginBottom: '4px',
        cursor: 'pointer',
      });
      b.addEventListener('click', () => {
        focus = id;
        renderSelector(c);
        c.update({});
      });
      selectorEl?.appendChild(b);
    });
  };

  const setCursor = (c: PluginContext, i: number): void => {
    cur = Math.max(0, Math.min(times.length - 1, i));
    if (range) range.value = String(cur);
    if (timeEl) timeEl.textContent = times.length ? formatTime(times[cur] as number) : '';
    c.update({});
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
    setCursor(c, cur >= times.length - 1 ? 0 : cur);
    if (playBtn) playBtn.textContent = L.pause;
    timer = setInterval(() => {
      if (cur >= times.length - 1) stop();
      else setCursor(c, cur + 1);
    }, options.interval ?? 120);
  };

  const build = (c: PluginContext): void => {
    if (!el) return;
    const { theme } = c.config;
    el.innerHTML = '';
    if (options.selector !== false) {
      selectorEl = document.createElement('div');
      selectorEl.className = 'xila-trajectory-selector';
      selectorEl.setAttribute('role', 'group');
      selectorEl.setAttribute('aria-label', L.group);
      el.appendChild(selectorEl);
      renderSelector(c);
    }
    if (options.controls !== false) {
      const bar = document.createElement('div');
      bar.className = 'xila-trajectory-controls';
      Object.assign(bar.style, {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: '4px',
        font: `${theme.fontSize}px ${theme.fontFamily}`,
        color: theme.axis,
      });
      playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'xila-trajectory-play';
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
      range.className = 'xila-trajectory-range';
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
      timeEl.className = 'xila-trajectory-time';
      timeEl.style.fontVariantNumeric = 'tabular-nums';
      timeEl.textContent = times.length ? formatTime(times[cur] as number) : '';
      bar.append(playBtn, range, timeEl);
      el.appendChild(bar);
    }
  };

  return {
    id: 'trajectory',
    install(c) {
      ctx = c;
      if (options.selector === false && options.controls === false) return;
      el = document.createElement('div');
      el.className = 'xila-trajectory';
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        bottom: '0',
        padding: '6px 8px 4px',
        pointerEvents: 'auto',
      });
      c.renderer.element.appendChild(el);
      build(c);
    },
    beforeUpdate(config: ChartConfig, c) {
      if (config.data !== source) {
        source = config.data;
        domains = fullDomains(config);
        rebuildTimeline(config);
        if (focus === undefined) focus = config.series[0]?.id ?? null;
        if (timeEl) timeEl.textContent = times.length ? formatTime(times[cur] as number) : '';
      }
      if (focus && !config.series.some((s) => s.id === focus)) focus = config.series[0]?.id ?? null;
      const muted = c.config.theme.muted ?? c.config.theme.grid;
      const palette = c.config.theme.palette;
      const t = times[cur] as number;
      let data = config.data;
      if (times.length && cur < times.length - 1) {
        data = options.time
          ? (() => {
              const col = config.data.numeric(options.time);
              return filterRows(config.data, (i) => (col[i] as number) <= t);
            })()
          : filterRows(config.data, (i) => i <= t);
      }
      const scales = config.scales ?? {};
      return {
        ...config,
        data,
        series: config.series.map((s, i) => ({
          ...s,
          stroke:
            focus === null || s.id === focus ? (palette[i % palette.length] ?? s.stroke) : muted,
        })),
        scatter: {
          ...(config.type === 'scatter' ? config.scatter : undefined),
          path: true,
          radius: 0,
        },
        scales: {
          ...scales,
          x: { ...scales.x, domain: scales.x?.domain ?? domains?.x ?? 'auto' },
          y: { ...scales.y, domain: scales.y?.domain ?? domains?.y ?? 'auto' },
        },
      } as ChartConfig;
    },
    reserveSpace() {
      return { bottom: el?.offsetHeight ?? 0, right: 110, top: 10 };
    },
    afterDraw(c) {
      const scales = c.getScales();
      if (!scales || scales.x.kind === 'band') return;
      const { theme } = c.config;
      const sx = scales.x;
      const sy = scales.y;
      const identity = { x: { base: 0, offset: 0, scale: 1 }, y: { base: 0, offset: 0, scale: 1 } };
      const series = c.getSeries();
      // Estela de la protagonista: se vuelve a trazar por segmentos cada vez más opacos.
      const fi = focus ? c.config.series.findIndex((s) => s.id === focus) : -1;
      const fs = series[fi];
      if (fs && !c.hiddenSeries.has(fs.id)) {
        const color = seriesColor(c.config, fi);
        const head = trajectoryHead(fs);
        let prev = -1;
        for (let i = 0; i <= head; i++) {
          const x = fs.x[i] as number;
          const y = fs.y[i] as number;
          if (x !== x || y !== y) continue;
          if (prev >= 0) {
            c.renderer.drawLineSeries(
              'data',
              Float64Array.of(sx.toPixel(fs.x[prev] as number), sx.toPixel(x)),
              Float64Array.of(sy.toPixel(fs.y[prev] as number), sy.toPixel(y)),
              0,
              2,
              {
                stroke: color,
                width: c.config.line.width + 0.5,
                opacity: 0.2 + 0.8 * (i / Math.max(1, head)),
              },
              identity,
            );
          }
          prev = i;
        }
      }
      series.forEach((s, i) => {
        if (c.hiddenSeries.has(s.id)) return;
        const head = trajectoryHead(s);
        if (head < 0) return;
        const isFocus = focus === null || s.id === focus;
        const px = sx.toPixel(s.x[head] as number);
        const py = sy.toPixel(s.y[head] as number);
        const color = seriesColor(c.config, i);
        c.renderer.drawPointSeries(
          'overlay',
          Float64Array.of(px),
          Float64Array.of(py),
          0,
          1,
          { fill: color, radius: isFocus ? 6 : 3, stroke: theme.background, strokeWidth: 2 },
          identity,
        );
        const name = c.config.series[i]?.name ?? s.id;
        if (isFocus && s.id === focus) {
          const t = times.length ? ` ${formatTime(times[cur] as number)}` : '';
          c.renderer.drawText('overlay', `${name}${t}`, px + 10, py - 8, {
            font: `600 ${theme.fontSize}px ${theme.fontFamily}`,
            fill: theme.text,
            baseline: 'middle',
          });
          c.renderer.drawText(
            'overlay',
            `${formatY(s.y[head] as number, c)} · ${formatX(s.x[head] as number, c)}`,
            px + 10,
            py + 8,
            {
              font: `${theme.fontSize}px ${theme.fontFamily}`,
              fill: theme.axis,
              baseline: 'middle',
            },
          );
        } else {
          c.renderer.drawText('overlay', name, px + 7, py, {
            font: `${theme.fontSize}px ${theme.fontFamily}`,
            fill: isFocus ? theme.text : theme.axis,
            baseline: 'middle',
          });
        }
      });
    },
    onEvent(name) {
      if (name === 'dataChanged' && ctx && el && times.length && range) {
        range.max = String(Math.max(0, times.length - 1));
      }
    },
    uninstall() {
      stop();
      el?.remove();
      el = null;
      selectorEl = null;
      range = null;
      playBtn = null;
      timeEl = null;
    },
  };
}

import type { ChartPlugin, PluginContext } from '../plugin';
import type { ResolvedSeries } from '../data/series';
import { formatNumber } from '../format/number';
import { median } from '../stats';

export interface AccessibilityOptions {
  /** Descripción fija; si falta se genera un resumen (tipo, series, rangos). */
  readonly label?: string;
  /** Locale para fechas y números en el resumen y la tabla. */
  readonly locale?: string;
  readonly timeZone?: string;
  /** Filas máximas de la tabla alternativa; con más datos se muestrea de forma uniforme. */
  readonly tableRows?: number;
  /** Teclado: flechas para recorrer los datos. */
  readonly keyboard?: boolean;
  /** Tabla de datos oculta visualmente para lectores de pantalla. */
  readonly table?: boolean;
}

const TYPE_NAMES: Record<string, string> = {
  line: 'Gráfico de líneas',
  bar: 'Gráfico de barras',
  scatter: 'Gráfico de dispersión',
  units: 'Gráfico de unidades (una marca por caso)',
};

function dateFormatter(locale: string, timeZone: string, spanMs: number): (ms: number) => string {
  const opts: Intl.DateTimeFormatOptions =
    spanMs < 2 * 86_400_000
      ? { dateStyle: 'medium', timeStyle: 'medium', timeZone }
      : { dateStyle: 'medium', timeZone };
  const f = new Intl.DateTimeFormat(locale, opts);
  return (ms) => f.format(ms);
}

/** Formateador del eje X según su tipo: fecha, categoría o número. */
function xFormatter(ctx: PluginContext, locale: string, timeZone: string): (v: number) => string {
  const { config } = ctx;
  const spec = config.series[0];
  const column = spec ? config.data.column(spec.x) : null;
  if (column?.kind === 'category') return (v) => column.categories[v] ?? String(v);
  if (config.scales.x.type === 'time') {
    const [a, b] = ctx.getDataDomain('x');
    return dateFormatter(locale, timeZone, Math.abs(b - a));
  }
  return (v) => formatNumber(v, { locale });
}

/**
 * Resumen textual del gráfico para `aria-label`: tipo, series, cuántos datos y rangos.
 * Ejemplo: "Gráfico de líneas con 2 series: Norte y Sur. 365 datos del 1 ene 2025 al
 * 31 dic 2025. Valores entre 420 y 1,450."
 */
export function chartSummary(ctx: PluginContext, locale = 'es-MX', timeZone = 'UTC'): string {
  const { config } = ctx;
  const series = ctx.getSeries();
  const names = config.series.map((s) => s.name ?? s.id);
  const type = TYPE_NAMES[config.type] ?? 'Gráfico';
  const count = series.reduce((m, s) => Math.max(m, s.length), 0);
  const fx = xFormatter(ctx, locale, timeZone);
  const [x0, x1] = ctx.getDataDomain('x');
  const [y0, y1] = ctx.getDataDomain('y');
  const list = new Intl.ListFormat(locale, { type: 'conjunction' }).format(names);
  const seriesText = names.length === 1 ? `Serie ${list}` : `${names.length} series: ${list}`;
  const xText =
    config.scales.x.type === 'band'
      ? `${count} categorías de ${fx(0)} a ${fx(Math.max(0, count - 1))}`
      : `${formatNumber(count, { locale })} datos de ${fx(x0)} a ${fx(x1)}`;
  // Unidades: Y no es un valor de los datos (es posición o conteo); lo útil es la mediana.
  if (config.type === 'units') {
    const first = series[0];
    const m = first ? median(first.x) : NaN;
    return `${type}. ${seriesText}. ${xText}. Mediana ${Number.isFinite(m) ? fx(m) : '—'}.`;
  }
  const yText = `Valores entre ${formatNumber(y0, { locale })} y ${formatNumber(y1, { locale })}`;
  const yTitle = config.axes.y.title ? ` (${config.axes.y.title})` : '';
  return `${type}. ${seriesText}. ${xText}. ${yText}${yTitle}.`;
}

const HIDDEN_STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: '0',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: '0',
};

/**
 * Hace el gráfico usable sin ratón y sin vista. Un canvas es una imagen para un lector de
 * pantalla, así que el plugin añade tres cosas: un resumen en `aria-label`, navegación con
 * flechas (que mueve el mismo cursor que el ratón, con su tooltip) y una tabla de datos
 * oculta visualmente.
 */
export function accessibilityPlugin(options: AccessibilityOptions = {}): ChartPlugin {
  const locale = options.locale ?? 'es-MX';
  const timeZone = options.timeZone ?? 'UTC';
  const tableRows = options.tableRows ?? 200;
  let el: HTMLElement | null = null;
  let ctx: PluginContext | null = null;
  let live: HTMLElement | null = null;
  let table: HTMLElement | null = null;
  let index = -1;
  let seriesIndex = 0;
  let tableKey = '';
  let off: (() => void) | null = null;

  const visibleSeries = (): { s: ResolvedSeries; i: number }[] => {
    if (!ctx) return [];
    return ctx
      .getSeries()
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !ctx?.hiddenSeries.has(s.id));
  };

  /** Mueve el cursor al dato `index` de la serie activa, con la escala actual. */
  const focusPoint = (): void => {
    const scales = ctx?.getScales();
    const current = visibleSeries()[seriesIndex];
    if (!ctx || !scales || !current) return;
    const { s } = current;
    index = Math.max(0, Math.min(s.length - 1, index));
    const xv = s.x[index] as number;
    const yv = s.y[index] as number;
    const px = scales.x.kind === 'band' ? scales.x.center(xv) : scales.x.toPixel(xv);
    const py = Number.isFinite(yv) ? scales.y.toPixel(yv) : ctx.layout.plotArea.y;
    ctx.hoverAt(px, py);
    if (live) {
      const fx = xFormatter(ctx, locale, timeZone);
      const y = Number.isFinite(yv) ? formatNumber(yv, { locale }) : 'sin dato';
      live.textContent = `${s.name}, ${fx(xv)}: ${y}`;
    }
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!ctx) return;
    const series = visibleSeries();
    const current = series[seriesIndex];
    if (!current) return;
    const step = e.shiftKey ? Math.max(1, Math.round(current.s.length / 20)) : 1;
    switch (e.key) {
      case 'ArrowRight':
        index = index < 0 ? 0 : index + step;
        break;
      case 'ArrowLeft':
        index = index < 0 ? current.s.length - 1 : index - step;
        break;
      case 'Home':
        index = 0;
        break;
      case 'End':
        index = current.s.length - 1;
        break;
      case 'ArrowUp':
      case 'ArrowDown': {
        seriesIndex =
          (seriesIndex + (e.key === 'ArrowDown' ? 1 : -1) + series.length) % series.length;
        if (index < 0) index = 0;
        break;
      }
      case 'Escape':
        index = -1;
        ctx.clearHover();
        if (live) live.textContent = '';
        return;
      default:
        return;
    }
    e.preventDefault();
    focusPoint();
  };

  const onBlur = (): void => {
    index = -1;
    ctx?.clearHover();
  };

  /** Tabla oculta: una fila por dato (muestreada si hay más de `tableRows`), una columna por serie. */
  const renderTable = (): void => {
    if (!ctx || !table) return;
    const series = ctx.getSeries();
    const n = series.reduce((m, s) => Math.max(m, s.length), 0);
    const key = `${ctx.config.data.length}:${series.map((s) => s.id).join(',')}`;
    if (key === tableKey) return;
    tableKey = key;
    const fx = xFormatter(ctx, locale, timeZone);
    const xTitle = ctx.config.axes.x.title || 'X';
    const stride = Math.max(1, Math.ceil(n / tableRows));
    // Unidades: cada fila es un caso con un solo valor; no hay columna por serie.
    const units = ctx.config.type === 'units';
    const rows: string[] = [];
    for (let i = 0; i < n; i += stride) {
      const first = series[0];
      const xv = first && i < first.length ? (first.x[i] as number) : NaN;
      const cells = (units ? [] : series).map((s) => {
        const v = i < s.length ? (s.y[i] as number) : NaN;
        return `<td>${Number.isFinite(v) ? formatNumber(v, { locale }) : ''}</td>`;
      });
      rows.push(
        `<tr><th scope="row">${Number.isFinite(xv) ? fx(xv) : ''}</th>${cells.join('')}</tr>`,
      );
    }
    const caption =
      stride > 1
        ? `Datos del gráfico (1 de cada ${stride} filas, ${rows.length} de ${n})`
        : 'Datos del gráfico';
    const head = `<tr><th scope="col">${xTitle}</th>${(units ? [] : series)
      .map((s) => `<th scope="col">${s.name}</th>`)
      .join('')}</tr>`;
    table.innerHTML = `<caption>${caption}</caption><thead>${head}</thead><tbody>${rows.join('')}</tbody>`;
  };

  return {
    id: 'accessibility',
    install(context) {
      ctx = context;
      el = context.renderer.element;
      el.setAttribute('role', 'img');
      el.setAttribute('tabindex', '0');
      if (options.label) el.setAttribute('aria-label', options.label);
      live = document.createElement('div');
      live.className = 'xila-a11y-live';
      live.setAttribute('aria-live', 'polite');
      Object.assign(live.style, HIDDEN_STYLE);
      el.appendChild(live);
      if (options.table !== false) {
        table = document.createElement('table');
        table.className = 'xila-a11y-table';
        Object.assign(table.style, HIDDEN_STYLE);
        // Fuera del elemento `role="img"`, que para el lector es una sola imagen.
        el.insertAdjacentElement('afterend', table);
      }
      if (options.keyboard !== false) {
        el.addEventListener('keydown', onKeyDown);
        el.addEventListener('blur', onBlur);
      }
      off = context.events.on('dataChanged', () => {
        tableKey = '';
      });
    },
    afterDraw(context) {
      ctx = context;
      if (!options.label) el?.setAttribute('aria-label', chartSummary(context, locale, timeZone));
      renderTable();
    },
    uninstall() {
      off?.();
      el?.removeEventListener('keydown', onKeyDown);
      el?.removeEventListener('blur', onBlur);
      el?.removeAttribute('role');
      el?.removeAttribute('tabindex');
      el?.removeAttribute('aria-label');
      live?.remove();
      table?.remove();
      el = ctx = live = table = null;
    },
  };
}

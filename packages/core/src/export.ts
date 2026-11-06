import type { Chart } from './chart';
import { tableToCsv } from './data/csv-write';
import { seriesColor, type ChartType } from './config';
import type { SeriesSpec } from './data/series';
import { SvgRenderer } from './renderer-svg';

export interface PngOptions {
  /** Densidad de píxeles; 2 da una imagen nítida en diapositivas. */
  readonly scale?: number;
  /** Título encima del gráfico. */
  readonly title?: string;
  /**
   * Leyenda (series visibles) en la imagen; la leyenda HTML no sale en el lienzo. Por defecto
   * solo con dos o más series y nunca en unidades ni mapas de calor; `true` la fuerza.
   */
  readonly legend?: boolean;
}

/**
 * Series que la leyenda de la imagen nombra. Ninguna si solo hay una visible (su nombre ya va en
 * el título; mostrar "ticket_promedio" junto a un cuadro no dice nada) ni en unidades y mapas de
 * calor, que rotulan sus propias categorías y escala.
 */
function legendItems(chart: Chart, legend: boolean | undefined): readonly SeriesSpec[] {
  if (legend === false) return [];
  const config = chart.getConfig();
  if (config.type === 'waffle' || config.type === 'heatmap') return [];
  const hidden = chart.getHiddenSeries();
  const visible = config.series.filter((s) => !hidden.has(s.id));
  return legend === true || visible.length > 1 ? visible : [];
}

/** Marca de la leyenda con la forma de la serie: trazo en líneas, punto en dispersión. */
function legendMark(type: ChartType): 'line' | 'dot' | 'square' {
  if (type === 'line') return 'line';
  if (type === 'scatter' || type === 'dots') return 'dot';
  return 'square';
}

/** Recorte del lienzo sin las franjas que ocupa el HTML de los plugins. */
function cropOf(chart: Chart): { x: number; y: number; width: number; height: number } {
  const { width, height } = chart.getLayout();
  const dom = chart.getDomSpace();
  return {
    x: dom.left,
    y: dom.top,
    width: Math.max(1, width - dom.left - dom.right),
    height: Math.max(1, height - dom.top - dom.bottom),
  };
}

/**
 * PNG del gráfico con fondo sólido, título y leyenda incluidos: un PNG transparente se ve
 * mal en diapositivas oscuras y la leyenda HTML del plugin no forma parte del canvas. Las
 * franjas del lienzo que ocupan nodos HTML (leyenda, tarjetas, controles) se recortan.
 */
export async function chartToPng(chart: Chart, options: PngOptions = {}): Promise<Blob> {
  const scale = options.scale ?? 2;
  const config = chart.getConfig();
  const { theme } = config;
  const image = await loadImage(chart.toDataURL('image/png', scale));
  const crop = cropOf(chart);
  const width = crop.width;
  const items = legendItems(chart, options.legend);
  const mark = legendMark(config.type);
  const line = theme.fontSize * 1.6;
  const headerHeight = (options.title ? line * 1.4 : 0) + (items.length > 0 ? line : 0);
  const pad = headerHeight > 0 ? 8 : 0;

  const out = document.createElement('canvas');
  out.width = Math.round(width * scale);
  out.height = Math.round((crop.height + headerHeight + pad) * scale);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Sin contexto 2D para exportar');
  ctx.scale(scale, scale);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, out.height / scale);

  let y = pad;
  if (options.title) {
    ctx.font = `600 ${theme.fontSize * 1.2}px ${theme.fontFamily}`;
    ctx.fillStyle = theme.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(options.title, 12, y + (line * 1.4) / 2);
    y += line * 1.4;
  }
  if (items.length > 0) {
    ctx.font = `${theme.fontSize}px ${theme.fontFamily}`;
    ctx.textBaseline = 'middle';
    let x = 12;
    const cy = y + line / 2;
    items.forEach((spec) => {
      const color = seriesColor(config, config.series.indexOf(spec));
      ctx.fillStyle = color;
      if (mark === 'line') ctx.fillRect(x - 2, cy - 1.25, 14, 2.5);
      else if (mark === 'dot') {
        ctx.beginPath();
        ctx.arc(x + 5, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(x, cy - 5, 10, 10);
      ctx.fillStyle = theme.text;
      const label = spec.name ?? spec.id;
      ctx.fillText(label, x + 16, cy);
      x += 16 + ctx.measureText(label).width + 18;
    });
    y += line;
  }
  ctx.drawImage(
    image,
    crop.x * scale,
    crop.y * scale,
    crop.width * scale,
    crop.height * scale,
    0,
    y + pad,
    crop.width,
    crop.height,
  );
  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG'))),
      'image/png',
    );
  });
}

export interface SvgOptions {
  /** Título encima del gráfico. */
  readonly title?: string;
  /**
   * Leyenda (series visibles) en el documento; la leyenda HTML no sale en el lienzo. Por
   * defecto solo con dos o más series y nunca en unidades ni mapas de calor; `true` la fuerza.
   */
  readonly legend?: boolean;
  /**
   * `'name'` (por defecto) nombra las fuentes y el lector las usa si las tiene; `'embed'`
   * incrusta las fuentes de la marca (`@font-face` de la página, en base64) y el archivo se ve
   * igual en cualquier sitio, a cambio de unos 240 KB más.
   */
  readonly fonts?: 'name' | 'embed';
  /** A partir de cuántos puntos una serie se incrusta como imagen en vez de vectores. */
  readonly rasterPoints?: number;
}

/**
 * SVG del gráfico, con fondo sólido, título y leyenda como `chartToPng`. Vectorial: se escala
 * sin perder nitidez y se edita en Illustrator o Inkscape. Un heatmap de imagen y las series de
 * más de `rasterPoints` puntos van incrustados como imagen. Recorta las franjas HTML igual que
 * el PNG.
 */
export async function chartToSvg(chart: Chart, options: SvgOptions = {}): Promise<string> {
  const config = chart.getConfig();
  const { theme } = config;
  const inner = chart.toSvg(
    options.rasterPoints === undefined ? {} : { rasterPoints: options.rasterPoints },
  );
  const crop = cropOf(chart);
  const width = crop.width;
  const items = legendItems(chart, options.legend);
  const mark = legendMark(config.type);
  const line = theme.fontSize * 1.6;
  const headerHeight = (options.title ? line * 1.4 : 0) + (items.length > 0 ? line : 0);
  const pad = headerHeight > 0 ? 8 : 0;
  const top = headerHeight + pad * 2;

  const header = new SvgRenderer();
  let dots = '';
  header.resize(width, top);
  header.setBackground(theme.background);
  let y = pad;
  if (options.title) {
    header.drawText('overlay', options.title, 12, y + (line * 1.4) / 2, {
      font: `600 ${theme.fontSize * 1.2}px ${theme.fontFamily}`,
      fill: theme.text,
      baseline: 'middle',
    });
    y += line * 1.4;
  }
  if (items.length > 0) {
    const font = { font: `${theme.fontSize}px ${theme.fontFamily}`, fill: theme.text };
    let x = 12;
    const cy = y + line / 2;
    items.forEach((spec) => {
      const fill = seriesColor(config, config.series.indexOf(spec));
      if (mark === 'line') header.drawRect('overlay', x - 2, cy - 1.25, 14, 2.5, { fill });
      else if (mark === 'dot') dots += `<circle cx="${x + 5}" cy="${cy}" r="5" fill="${fill}"/>`;
      else header.drawRect('overlay', x, cy - 5, 10, 10, { fill });
      const label = spec.name ?? spec.id;
      header.drawText('overlay', label, x + 16, cy, { ...font, baseline: 'middle' });
      x += 16 + header.measureText(label, font) + 18;
    });
  }
  const style = options.fonts === 'embed' ? await fontFaceCss(usedFamilies(theme)) : '';
  const defs = style ? `<defs><style>${style}</style></defs>` : '';
  // El SVG del gráfico se anida con un viewBox que deja fuera las franjas HTML.
  const chartSvg = `<svg x="0" y="${top}" width="${crop.width}" height="${crop.height}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}">${inner}</svg>`;
  const height = crop.height + top;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}<rect width="${width}" height="${height}" fill="${theme.background}"/>${top > 0 ? header.body() + dots : ''}${chartSvg}</svg>`;
}

/** Familias de fuentes que el tema declara (la primera de cada lista, sin comillas). */
function usedFamilies(theme: {
  fontFamily: string;
  fontMono?: string;
  fontDisplay?: string;
}): string[] {
  return [theme.fontFamily, theme.fontMono, theme.fontDisplay]
    .filter((f): f is string => Boolean(f))
    .map((f) => (f.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/**
 * Reglas `@font-face` de la página para esas familias, con la fuente en base64. Las hojas de
 * otro origen no se pueden leer (el navegador lo impide) y se saltan sin error.
 */
async function fontFaceCss(families: string[]): Promise<string> {
  if (typeof document === 'undefined') return '';
  const wanted = new Set(families.map((f) => f.toLowerCase()));
  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(list)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style
        .getPropertyValue('font-family')
        .trim()
        .replace(/^["']|["']$/g, '');
      if (wanted.has(family.toLowerCase())) rules.push(rule);
    }
  }
  const out: string[] = [];
  for (const rule of rules) {
    const src = rule.style.getPropertyValue('src');
    const url = /url\((['"]?)([^'")]+)\1\)/.exec(src)?.[2];
    if (!url) continue;
    try {
      const base = rule.parentStyleSheet?.href ?? document.baseURI;
      const response = await fetch(new URL(url, base).href);
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const data = `data:font/woff2;base64,${btoa(binary)}`;
      const family = rule.style.getPropertyValue('font-family');
      const weight = rule.style.getPropertyValue('font-weight') || '400';
      const fontStyle = rule.style.getPropertyValue('font-style') || 'normal';
      out.push(
        `@font-face{font-family:${family};font-weight:${weight};font-style:${fontStyle};src:url(${data}) format('woff2')}`,
      );
    } catch {
      // Sin red o sin permiso: el SVG sigue valiendo con las fuentes por nombre.
    }
  }
  return out.join('');
}

/** CSV de los datos que el gráfico está mostrando (ya filtrados y agregados). */
export function chartToCsv(chart: Chart): string {
  return tableToCsv(chart.getConfig().data);
}

/** Dispara la descarga de un archivo en el navegador. */
export function downloadFile(name: string, content: Blob | string, type = 'text/plain'): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nombre de archivo seguro a partir de un título: "Ventas por mes" → "ventas-por-mes". */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'grafico'
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen del gráfico'));
    img.src = src;
  });
}

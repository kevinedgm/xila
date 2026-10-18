import type { Chart } from './chart';
import { tableToCsv } from './data/csv-write';

export interface PngOptions {
  /** Densidad de píxeles; 2 da una imagen nítida en diapositivas. */
  readonly scale?: number;
  /** Título encima del gráfico. */
  readonly title?: string;
  /** Dibuja la leyenda (series visibles) en la imagen; la leyenda HTML no sale en el canvas. */
  readonly legend?: boolean;
}

/**
 * PNG del gráfico con fondo sólido, título y leyenda incluidos: un PNG transparente se ve
 * mal en diapositivas oscuras y la leyenda HTML del plugin no forma parte del canvas.
 */
export async function chartToPng(chart: Chart, options: PngOptions = {}): Promise<Blob> {
  const scale = options.scale ?? 2;
  const config = chart.getConfig();
  const { theme } = config;
  const image = await loadImage(chart.toDataURL('image/png', scale));
  const width = image.width / scale;
  const hidden = chart.getHiddenSeries();
  const items = options.legend === false ? [] : config.series.filter((s) => !hidden.has(s.id));
  const line = theme.fontSize * 1.6;
  const headerHeight = (options.title ? line * 1.4 : 0) + (items.length > 0 ? line : 0);
  const pad = headerHeight > 0 ? 8 : 0;

  const out = document.createElement('canvas');
  out.width = Math.round(width * scale);
  out.height = Math.round((image.height / scale + headerHeight + pad) * scale);
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
    items.forEach((spec) => {
      const i = config.series.indexOf(spec);
      ctx.fillStyle = theme.palette[i % theme.palette.length] ?? '#000';
      ctx.fillRect(x, y + line / 2 - 5, 10, 10);
      ctx.fillStyle = theme.text;
      const label = spec.name ?? spec.id;
      ctx.fillText(label, x + 14, y + line / 2);
      x += 14 + ctx.measureText(label).width + 16;
    });
    y += line;
  }
  ctx.drawImage(image, 0, y + pad, width, image.height / scale);
  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG'))),
      'image/png',
    );
  });
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

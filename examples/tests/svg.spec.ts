import { expect, test } from '@playwright/test';

/**
 * Exportación SVG: el mismo dibujo que el canvas, pero vectorial. Se comprueba rasterizando el
 * SVG en el navegador y contando píxeles distintos frente a `toDataURL()`; lo que difiere es el
 * antialias del texto, por eso la tolerancia.
 */

declare global {
  interface Window {
    charts: Record<string, import('xilaplot').Chart>;
    xila: typeof import('xilaplot');
  }
}

const GRAFICOS = [
  'linea',
  'multi',
  'barras',
  'apiladas',
  'horizontal',
  'horizontal-apiladas',
  'curva',
  'escalones',
  'dispersion',
  'banda',
  'errores',
  'cajas',
  'calor',
];

async function listo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 51);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
    await new Promise(requestAnimationFrame);
  });
}

test('el SVG rasterizado coincide con el canvas en cada tipo', async ({ page }) => {
  await listo(page);
  for (const id of GRAFICOS) {
    const r = await page.evaluate(async (id) => {
      const chart = window.charts[id];
      if (!chart) throw new Error(`sin gráfico ${id}`);
      chart.drawNow();
      const svg = chart.toSvg();
      const load = (src: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => rej(new Error('no carga'));
          img.src = src;
        });
      const [a, b] = await Promise.all([
        load(chart.toDataURL('image/png', 1)),
        load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`),
      ]);
      const c = document.createElement('canvas');
      c.width = a.width;
      c.height = a.height;
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      ctx.drawImage(a, 0, 0);
      const da = ctx.getImageData(0, 0, c.width, c.height).data;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(b, 0, 0);
      const db = ctx.getImageData(0, 0, c.width, c.height).data;
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d =
          Math.abs((da[i] as number) - (db[i] as number)) +
          Math.abs((da[i + 1] as number) - (db[i + 1] as number)) +
          Math.abs((da[i + 2] as number) - (db[i + 2] as number));
        if (d > 60) diff++;
      }
      return { ratio: diff / (c.width * c.height), svg, w: b.width, h: b.height };
    }, id);
    expect(r.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), id).toBe(true);
    expect(r.w, id).toBeGreaterThan(100);
    // Menos del 3 % de los píxeles cambian (bordes del texto).
    expect(r.ratio, `${id}: ${(r.ratio * 100).toFixed(2)} % distinto`).toBeLessThan(0.03);
  }
});

test('el SVG lleva texto como texto, el heatmap como imagen y muchos puntos rasterizados', async ({
  page,
}) => {
  await listo(page);
  const r = await page.evaluate(() => {
    const calor = window.charts['calor'] as import('xilaplot').Chart;
    const dispersion = window.charts['dispersion'] as import('xilaplot').Chart;
    return {
      calor: calor.toSvg(),
      // 20 000 puntos: imagen por defecto (umbral 5 000), vectores si se sube el umbral.
      vector: dispersion.toSvg({ rasterPoints: 100_000 }),
      raster: dispersion.toSvg(),
    };
  });
  expect(r.calor).toContain('<text');
  expect(r.calor).toContain('<image');
  expect(r.calor).toContain('image-rendering="pixelated"');
  // Los puntos son vectores por defecto, y una imagen con descripción por encima del umbral.
  expect(r.vector).not.toContain('puntos rasterizados');
  expect(r.vector).toMatch(/<path d="M[^"]+A/);
  expect(r.raster).toContain('<desc>');
  expect(r.raster).toContain('puntos rasterizados');
  expect(r.raster.length).toBeLessThan(r.vector.length);
});

test('chartToSvg añade título, leyenda y, si se pide, las fuentes', async ({ page }) => {
  await listo(page);
  const r = await page.evaluate(async () => {
    const chart = window.charts['multi'] as import('xilaplot').Chart;
    const { chartToSvg } = window.xila;
    const sin = await chartToSvg(chart, { legend: false });
    const con = await chartToSvg(chart, { title: 'Ventas por región' });
    const fuentes = await chartToSvg(chart, { title: 'Ventas', fonts: 'embed' });
    const alto = (svg: string) => Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1]);
    return { sin, con, fuentes, altoSin: alto(sin), altoCon: alto(con) };
  });
  expect(r.con).toContain('Ventas por región');
  expect(r.altoCon).toBeGreaterThan(r.altoSin);
  // Leyenda: una muestra de color por serie visible.
  expect(
    (r.con.match(/<rect x="\d+(?:\.\d+)?" y="[^"]+" width="10" height="10"/g) ?? []).length,
  ).toBe(3);
  expect(r.sin).not.toContain('width="10" height="10"');
  expect(r.fuentes).toContain('@font-face');
  expect(r.fuentes).toContain('data:font/woff2;base64,');
  expect(r.fuentes).toContain('Instrument Sans');
  expect(r.fuentes.length).toBeGreaterThan(r.con.length + 100_000);
});

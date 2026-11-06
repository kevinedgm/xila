import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

/**
 * Sin filtros el panel lleva leyenda HTML (cuatro regiones). Su franja en el lienzo estaba vacía
 * y salía en la imagen como un hueco; ahora se recorta. Se mide la racha más larga de filas
 * completamente del color de fondo: antes ~100 px, ahora solo márgenes.
 */
test('el PNG no trae la franja vacía de la leyenda HTML', async ({ page }) => {
  await page.goto('/dashboard.html');
  await page.locator('.xila-grid canvas').first().waitFor();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const panel = page.locator('[data-panel="4"]');
  await expect(panel.locator('.xila-legend')).toBeAttached();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    panel.locator('[data-export="png"]').click(),
  ]);
  const imagen = PNG.sync.read(await streamToBuffer(await png.createReadStream()));
  const { width, height, data } = imagen;
  const fondo = [data[4], data[5], data[6]];
  let racha = 0;
  let maxima = 0;
  for (let y = 0; y < height; y++) {
    let vacia = true;
    for (let x = 0; x < width && vacia; x += 2) {
      const k = (y * width + x) * 4;
      vacia = data[k] === fondo[0] && data[k + 1] === fondo[1] && data[k + 2] === fondo[2];
    }
    racha = vacia ? racha + 1 : 0;
    maxima = Math.max(maxima, racha);
  }
  expect(maxima).toBeLessThan(60);
});

/** Botones de descarga de cada panel: PNG a 2x con título y leyenda, y CSV de lo mostrado. */
test('descarga PNG a 2x y CSV de los datos filtrados', async ({ page }) => {
  await page.goto('/dashboard.html');
  await page.locator('.xila-grid canvas').first().waitFor();
  await page.locator('[data-filter="1"] select').selectOption('Sur');
  await page.evaluate(() => new Promise(requestAnimationFrame));

  const panel = page.locator('[data-panel="4"]');
  const ancho = (await panel.locator('.xila-panel-chart').boundingBox())?.width ?? 0;

  const [png] = await Promise.all([
    page.waitForEvent('download'),
    panel.locator('[data-export="png"]').click(),
  ]);
  expect(png.suggestedFilename()).toBe('ventas-semanales-por-region.png');
  const imagen = PNG.sync.read(await streamToBuffer(await png.createReadStream()));
  // 2x: el ancho en píxeles es el doble del ancho CSS del gráfico.
  expect(imagen.width).toBe(Math.round(ancho * 2));
  // Más alto que el canvas porque lleva título y leyenda encima.
  expect(imagen.height).toBeGreaterThan(320 * 2);

  const [svg] = await Promise.all([
    page.waitForEvent('download'),
    panel.locator('[data-export="svg"]').click(),
  ]);
  expect(svg.suggestedFilename()).toBe('ventas-semanales-por-region.svg');
  const vectorial = (await streamToBuffer(await svg.createReadStream())).toString('utf8');
  expect(vectorial.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  // Título encima y la serie como un path vectorial; mismo ancho CSS que el gráfico.
  expect(vectorial).toContain('Ventas semanales por región');
  expect(vectorial).toContain('<path d="M');
  expect(vectorial).toContain(`width="${Math.round(ancho)}"`);

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    panel.locator('[data-export="csv"]').click(),
  ]);
  expect(csv.suggestedFilename()).toBe('ventas-semanales-por-region.csv');
  const texto = (await streamToBuffer(await csv.createReadStream())).toString('utf8');
  const lineas = texto.trim().split('\n');
  // Solo la región filtrada, agregada por semana: encabezado x + Sur, ~53 semanas.
  expect(lineas[0]).toBe('fecha_week,Sur');
  expect(lineas.length).toBeGreaterThan(50);
  expect(lineas.length).toBeLessThan(56);
  expect(lineas[1]).toMatch(/^\d{4}-\d{2}-\d{2},\d/);
});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

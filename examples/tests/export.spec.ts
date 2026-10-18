import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

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

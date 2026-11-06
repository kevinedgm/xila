import { expect, test } from '@playwright/test';

/**
 * El dueño del negocio abre el dashboard en el teléfono. A 390 px (iPhone 13) no debe haber
 * desplazamiento horizontal, los botones de descarga se ven sin pasar el cursor (no hay cursor)
 * y el panel «ahora» crece para que sus tarjetas no aplasten la línea.
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const config of ['cafeteria/dashboard.json', 'co2/muestra.json', 'dashboard.json']) {
  test(`${config} cabe a 390 px sin desplazamiento horizontal`, async ({ page }) => {
    await page.goto(`/dashboard.html?config=${config}`);
    await page.locator('.xila-grid canvas').first().waitFor();
    const { scroll, ancho } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      ancho: window.innerWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(ancho);
  });
}

test('en pantalla táctil los botones de descarga se ven y no tapan el título', async ({ page }) => {
  await page.goto('/dashboard.html?config=cafeteria/dashboard.json');
  const panel = page.locator('[data-panel="4"]');
  await panel.locator('canvas').first().waitFor();
  const tools = panel.locator('.xila-panel-tools');
  expect(await tools.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  const titulo = await panel.locator('h2').boundingBox();
  const botones = await tools.boundingBox();
  expect(botones && titulo && botones.y >= titulo.y + titulo.height - 1).toBe(true);
});

test('el panel «ahora» crece para dejar sitio a la línea bajo las tarjetas', async ({ page }) => {
  await page.goto('/dashboard.html?config=cafeteria/dashboard.json');
  const panel = page.locator('[data-panel="4"]');
  await panel.scrollIntoViewIfNeeded();
  await panel.locator('canvas').first().waitFor();
  // Las tarjetas se apilan en dos filas; el contenedor pasa de 320 px a lo que haga falta.
  await expect
    .poll(async () => (await panel.locator('.xila-panel-chart').boundingBox())?.height ?? 0)
    .toBeGreaterThan(400);
});

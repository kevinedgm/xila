import { expect, test, type Page } from '@playwright/test';

/** Dashboard declarativo de `public/dashboard.json`: carga, filtros compartidos y grid móvil. */
async function abrir(page: Page): Promise<void> {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto('/dashboard.html');
  await page.locator('.xila-grid canvas').first().waitFor();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(errores).toEqual([]);
}

test('carga el dashboard completo sin errores de configuración', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('.xila-errors')).toHaveCount(0);
  await expect(page.locator('.xila-panel')).toHaveCount(7);
  await expect(page.locator('.xila-dashboard')).toHaveScreenshot('dashboard.png');
});

test('elegir una región cambia el KPI y todos los gráficos a la vez', async ({ page }) => {
  await abrir(page);
  const kpi = page.locator('[data-panel="0"] .xila-kpi-value');
  const antes = await kpi.textContent();
  await page.locator('[data-filter="1"] select').selectOption('Sur');
  await expect(kpi).not.toHaveText(antes ?? '');
  // La leyenda de la línea solo muestra la región elegida y las barras por región, una barra.
  await expect(page.locator('[data-panel="4"] .xila-legend-item')).toHaveText(['Sur']);
  await expect(page.locator('[data-panel="6"]')).toHaveScreenshot('dashboard-barras-sur.png');
});

test('un rango de fechas acota las series', async ({ page }) => {
  await abrir(page);
  await page.locator('[data-filter="0"] input[aria-label="desde"]').fill('2025-07-01');
  await page.locator('[data-filter="0"] input[aria-label="desde"]').dispatchEvent('change');
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const registros = await page.locator('[data-panel="3"] .xila-kpi-value').textContent();
  // 184 días × 4 regiones × 2 canales = 1472 filas, menos ~1 % de nulos.
  expect(Number(registros?.replace(/,/g, ''))).toBeLessThan(1500);
  expect(Number(registros?.replace(/,/g, ''))).toBeGreaterThan(1400);
});

test('en móvil el grid pasa a una columna', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrir(page);
  const cajas = await page
    .locator('.xila-panel')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  const anchoUnico = new Set(cajas.map((w) => Math.round(w)));
  expect(anchoUnico.size).toBe(1);
});

import { expect, test } from '@playwright/test';

/** Ejemplo de punta a punta con datos públicos (OWID): notebook → CSV → dashboard.json. */
test('el dashboard de CO₂ carga desde otro JSON y filtra por varios países', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto('/dashboard.html?config=co2/dashboard.json');
  await page.locator('.xila-grid canvas').first().waitFor();
  await expect(page.locator('.xila-errors')).toHaveCount(0);
  await expect(page.locator('.xila-panel')).toHaveCount(8);
  await expect(page.locator('h1')).toContainText('CO₂');

  await page.locator('[data-filter="1"] select').selectOption(['México', 'Brasil']);
  await expect(page.locator('[data-panel="4"] .xila-legend-item')).toHaveText(['Brasil', 'México']);
  // 74 años × 2 países = 148 filas con dato, más o menos nulos.
  const n = await page.locator('[data-panel="3"] .xila-kpi-value').textContent();
  expect(Number(n?.replace(/,/g, ''))).toBeGreaterThan(140);
  expect(Number(n?.replace(/,/g, ''))).toBeLessThan(160);
  expect(errores).toEqual([]);
});

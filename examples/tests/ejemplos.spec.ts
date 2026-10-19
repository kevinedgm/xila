import { expect, test } from '@playwright/test';

/**
 * Dashboards de ejemplo con datos públicos (`public/clima`, `public/pinguinos`) y el demo simulado
 * `public/cafeteria`: cargan sin
 * errores y sus filtros recalculan los paneles.
 */
for (const { config, paneles, filtro, valores } of [
  { config: 'clima/dashboard.json', paneles: 12, filtro: 1, valores: ['Seattle'] },
  { config: 'pinguinos/dashboard.json', paneles: 11, filtro: 0, valores: ['Barbijo'] },
  { config: 'cafeteria/dashboard.json', paneles: 12, filtro: 1, valores: ['Jalatlaco'] },
]) {
  test(`${config} carga todos sus paneles y responde al filtro`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(`/dashboard.html?config=${config}`);
    await page.locator('.xila-grid canvas').first().waitFor();
    await expect(page.locator('.xila-errors')).toHaveCount(0);
    const lista = page.locator('.xila-panel');
    await expect(lista).toHaveCount(paneles);
    for (let i = 0; i < paneles; i++) {
      await lista.nth(i).scrollIntoViewIfNeeded();
      await expect(lista.nth(i).locator('.xila-skeleton')).toHaveCount(0);
    }
    await page.locator(`[data-filter="${filtro}"] select`).selectOption(valores);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(page.locator('.xila-errors')).toHaveCount(0);
    expect(errores).toEqual([]);
  });
}

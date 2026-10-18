import { expect, test } from '@playwright/test';

/** Render diferido: con 30 gráficos solo se dibujan los visibles; el resto al hacer scroll. */

const dibujados = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { dibujados(): number }).dibujados());

test('al cargar solo se dibujan los gráficos en pantalla', async ({ page }) => {
  await page.goto('/muchos.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 90);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const inicial = await dibujados(page);
  // Ventana de 800 px: caben ~3 gráficos de 260 px, más el margen de 200 px.
  expect(inicial).toBeGreaterThan(0);
  expect(inicial).toBeLessThan(8);

  await page.locator('#g29').scrollIntoViewIfNeeded();
  await expect.poll(() => dibujados(page)).toBeGreaterThan(inicial);
  await expect(page.locator('#g29')).toHaveScreenshot('muchos-ultimo.png');
});

test('con lazy=0 se dibujan todos de inmediato', async ({ page }) => {
  await page.goto('/muchos.html?lazy=0');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 90);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  expect(await dibujados(page)).toBe(30);
});

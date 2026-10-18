import { expect, test } from '@playwright/test';

/** Accesibilidad: resumen en aria-label, flechas para recorrer datos y tabla oculta. */

test('el gráfico tiene resumen, responde a las flechas y expone una tabla', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 21);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const img = page.locator('#multi [role="img"]');
  await expect(img).toHaveAttribute('tabindex', '0');
  await expect(img).toHaveAttribute(
    'aria-label',
    /^Gráfico de líneas\. \d+ series: .+\. \d+ datos de .+ a .+\. Valores entre .+ y .+\.$/,
  );

  // Teclado: la flecha derecha mueve el cursor al primer dato y muestra el tooltip.
  await img.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const tooltip = page.locator('#multi .xila-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(page.locator('#multi .xila-a11y-live')).not.toHaveText('');
  // Flecha abajo cambia de serie; Escape quita el cursor.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  // Tabla oculta visualmente con una fila por dato (hasta 200) y una columna por serie.
  const table = page.locator('#multi table.xila-a11y-table');
  await expect(table.locator('thead th')).toHaveCount(4);
  expect(await table.locator('tbody tr').count()).toBeGreaterThan(100);
  await expect(table).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
});

test('en barras el resumen habla de categorías', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 21);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  // Está bajo el pliegue: con render diferido se dibuja (y describe) al entrar en pantalla.
  const img = page.locator('#barras [role="img"]');
  await img.scrollIntoViewIfNeeded();
  await expect(img).toHaveAttribute(
    'aria-label',
    /^Gráfico de barras\. .+ categorías de .+ a .+\./,
  );
});

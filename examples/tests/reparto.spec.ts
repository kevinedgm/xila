import { expect, test } from '@playwright/test';

/** Más allá del box plot: `box.mark` 'dots' (con `shade` y `now`), 'density' y 'range' (con `now`). */

test('las tres marcas del box plot se dibujan sobre el formato largo', async ({ page }) => {
  await page.goto('/reparto.html');
  // Tres gráficos de 400 px no caben en la ventana de prueba y el render es diferido: se
  // hace visible cada uno para que se dibuje.
  for (const id of ['#puntos', '#franja', '#hoy']) await page.locator(id).scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#puntos')).toHaveScreenshot('reparto-puntos.png');
  await expect(page.locator('#franja')).toHaveScreenshot('reparto-franja.png');
  await expect(page.locator('#hoy')).toHaveScreenshot('reparto-hoy.png');
});

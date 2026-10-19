import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Nudos con camino: `heatmap.mark: 'knot'` + `heatmap.path` sobre pedidos por día y hora. */

test('los nudos se dibujan y el camino descansa en el máximo y sigue al cursor', async ({
  page,
}) => {
  await page.goto('/nudos.html');
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
  const lectura = page.locator('#lectura');
  await expect(lectura).toContainText('Domingo · 9 h');
  await expect(lectura).toContainText('el máximo');
  await expect(page.locator('#nudos')).toHaveScreenshot('nudos-reposo.png', {
    maxDiffPixelRatio: 0.05,
  });

  // Miércoles (tercera fila desde arriba) a las 16 h (décima columna).
  const caja = await page.locator('#nudos').boundingBox();
  if (!caja) throw new Error('sin gráfico');
  await page.mouse.move(caja.x + caja.width * 0.62, caja.y + caja.height * 0.45);
  await expect(lectura).toContainText('Miércoles · 16 h');
  await expect(page.locator('#nudos')).toHaveScreenshot('nudos-camino.png', {
    maxDiffPixelRatio: 0.05,
  });

  // Al salir, el camino vuelve al máximo.
  await page.mouse.move(2, 2);
  await expect(lectura).toContainText('Domingo · 9 h');

  // El SVG lleva los nudos como círculos y el camino en reposo.
  const svg = await page.evaluate(() =>
    (window as unknown as { graficos: { toSvg(): string }[] }).graficos[0]?.toSvg(),
  );
  expect(svg).toContain('stroke-dasharray');
  // Dos medios arcos por nudo: 98 celdas con dato.
  expect((svg?.match(/ 0 1 0 /g) ?? []).length).toBeGreaterThanOrEqual(2 * 98);
});

test('axe-core no encuentra fallos en la página de nudos', async ({ page }) => {
  await page.goto('/nudos.html');
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

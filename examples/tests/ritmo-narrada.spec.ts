import { expect, test } from '@playwright/test';

/** Más allá de la línea, B y D: tira de ritmo (RhythmStrip) y línea narrada (narratePlugin). */

async function listo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/ahora.html');
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
}

test('tira de ritmo: describe la caída y la subida más rápidas de cada país', async ({ page }) => {
  await listo(page);
  await expect(page.locator('#ritmo .xila-rhythm-strip canvas')).toHaveAttribute(
    'aria-label',
    /^Ritmo de cambio al año\. Estados Unidos: mayor caída −[\d.]+ % en \d{4}, mayor subida \+[\d.]+ % en \d{4}\./,
  );
});

test('línea narrada: anota máximo, mínimo y caídas, y el título dice el hallazgo', async ({
  page,
}) => {
  await listo(page);
  const momentos = page.locator('#narrada-momentos');
  await expect(momentos).toContainText('Máximo: 14.3 en 1979');
  await expect(momentos).toContainText('Mínimo: 6.8 en 2024');
  await expect(momentos.locator('li')).toHaveCount(5);
  await expect(page.locator('#narrada')).toContainText(
    /Alemania emite hoy \d+ % menos por persona/,
  );
});

test('teléfono: sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await listo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

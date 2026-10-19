import { expect, test } from '@playwright/test';

/** Más allá de la línea: nowPlugin (ahora con estela) y focusPlugin (protagonista y contexto). */

async function listo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/ahora.html');
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
}

test('el panel de ahora muestra la cifra de 2024 y al mover el instante atenúa el futuro', async ({
  page,
}) => {
  await listo(page);
  const ahora = page.locator('#ahora');
  await expect(ahora.locator('.xila-now-tile[data-series="China"] .xila-now-value')).toHaveText(
    '8.7',
  );
  await expect(ahora.locator('.xila-now-time')).toHaveText('2024');
  await expect(ahora).toHaveScreenshot('ahora-2024.png');
  await ahora.locator('.xila-now-range').fill('30');
  await expect(ahora.locator('.xila-now-time')).toHaveText('2000');
  await expect(ahora.locator('.xila-now-tile[data-series="China"] .xila-now-value')).toHaveText(
    '2.9',
  );
  await expect(ahora).toHaveScreenshot('ahora-2000.png');
});

test('la protagonista cambia con los botones', async ({ page }) => {
  await listo(page);
  const chart = page.locator('#protagonista');
  await expect(chart.locator('.xila-focus-item[data-series="México"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(chart).toHaveScreenshot('protagonista-mexico.png');
  await chart.locator('.xila-focus-item[data-series="China"]').click();
  await page.waitForTimeout(150);
  await expect(chart.locator('.xila-focus-item[data-series="China"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(chart).toHaveScreenshot('protagonista-china.png');
});

import { expect, test } from '@playwright/test';

/** Más allá de la dispersión: trayectorias (`scatter.path` + `trajectoryPlugin`) y contra lo esperado (`trendPlugin`). */

async function listo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/relacion.html');
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
}

test('las trayectorias muestran a China en 2022 y el deslizador recorta el camino', async ({
  page,
}) => {
  await listo(page);
  const chart = page.locator('#trayectorias');
  await expect(chart.locator('.xila-trajectory-item[data-series="China"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(chart.locator('.xila-trajectory-time')).toHaveText('2022');
  await expect(chart).toHaveScreenshot('trayectorias-china-2022.png');
  await chart.locator('.xila-trajectory-range').fill('25');
  await page.waitForTimeout(150);
  await expect(chart.locator('.xila-trajectory-time')).toHaveText('1995');
  await expect(chart).toHaveScreenshot('trayectorias-china-1995.png');
  await chart.locator('.xila-trajectory-item[data-series=""]').click();
  await page.waitForTimeout(150);
  await expect(chart).toHaveScreenshot('trayectorias-todas-1995.png');
});

test('la tendencia ordena los países por su diferencia', async ({ page }) => {
  await listo(page);
  await expect(page.locator('#tendencia')).toHaveScreenshot('tendencia.png');
});

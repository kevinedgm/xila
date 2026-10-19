import { expect, test } from '@playwright/test';

/** Más allá de la barra: puntos con referencia (`bar.mark: 'dot'` + `referencePlugin`) y unidades del total (`waffle`). */

async function listo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/comparar.html');
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
}

test('los puntos se miden contra el promedio y la referencia cambia con los botones', async ({
  page,
}) => {
  await listo(page);
  const puntos = page.locator('#puntos');
  await expect(puntos).toHaveScreenshot('puntos-promedio.png');
  await page.locator('[data-ref="2"]').click();
  await page.waitForTimeout(150);
  await expect(page.locator('[data-ref="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(puntos).toHaveScreenshot('puntos-meta.png');
});

test('las unidades del total reparten los cuadros por país', async ({ page }) => {
  await listo(page);
  await expect(page.locator('#total')).toHaveScreenshot('total.png');
});

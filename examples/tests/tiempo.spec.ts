import { expect, test } from '@playwright/test';

/** Ahora con estela (TrailPanel) y Protagonista y contexto (focusPlugin). */

type Pagina = {
  panel: { getIndex(): number; length: number; setIndex(i: number): void };
  focus: { getFocus(): string | null };
};

test('ahora con estela: una cifra por país, con flecha y descripción accesible', async ({
  page,
}) => {
  await page.goto('/tiempo.html');
  await page.waitForFunction(() => 'panel' in window);
  const tiles = page.locator('.xila-trail-panel [role="group"]');
  await expect(tiles).toHaveCount(7);
  await expect(tiles.first()).toHaveAttribute(
    'aria-label',
    /^Estados Unidos: [\d.]+ t por persona en 2024, [+−][\d.]+ en 10 años$/,
  );
  await expect(tiles.first()).toContainText(/▼|▲/);
  await expect(page.locator('#anio-label')).toHaveText('2024');
});

test('ahora con estela: el control de año mueve el "ahora"', async ({ page }) => {
  await page.goto('/tiempo.html');
  await page.waitForFunction(() => 'panel' in window);
  await page.locator('#anio').fill('20');
  await expect(page.locator('#anio-label')).toHaveText('1970');
  await expect(page.locator('.xila-trail-panel [role="group"]').first()).toHaveAttribute(
    'aria-label',
    /en 1970/,
  );
});

test('protagonista: cambia con los botones y la leyenda sobra', async ({ page }) => {
  await page.goto('/tiempo.html');
  await page.waitForFunction(() => 'focus' in window);
  expect(await page.evaluate(() => (window as unknown as Pagina).focus.getFocus())).toBe('México');
  await page.getByRole('button', { name: 'China' }).click();
  await expect(page.getByRole('button', { name: 'China' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as unknown as Pagina).focus.getFocus())).toBe('China');
  await expect(page.locator('.xila-legend')).toHaveCount(0);
});

test('teléfono: sin scroll horizontal y botones de 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/tiempo.html');
  await page.waitForFunction(() => 'panel' in window);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(
    await page.locator('#play').evaluate((el) => (el as HTMLElement).offsetHeight),
  ).toBeGreaterThanOrEqual(44);
});

test('tira de ritmo: describe la caída y la subida más rápidas de cada país', async ({ page }) => {
  await page.goto('/tiempo.html');
  await page.waitForFunction(() => 'ritmo' in window);
  await expect(page.locator('.xila-rhythm-strip canvas')).toHaveAttribute(
    'aria-label',
    /^Ritmo de cambio al año\. Estados Unidos: mayor caída −[\d.]+ % en \d{4}, mayor subida \+[\d.]+ % en \d{4}\./,
  );
});

test('línea narrada: encuentra sus momentos y el título dice el hallazgo', async ({ page }) => {
  await page.goto('/tiempo.html');
  await page.waitForFunction(() => 'narra' in window);
  // Render diferido: se dibuja (y narra) al entrar en pantalla.
  await page.locator('#narrada').scrollIntoViewIfNeeded();
  await expect(page.locator('#narrada-titulo')).toHaveText(
    /^Alemania emite hoy \d+ % menos por persona que en su máximo$/,
  );
  const items = page.locator('#narrada-momentos li');
  await expect(items.first()).toBeVisible();
  await expect(page.locator('#narrada-momentos')).toContainText('Máximo:');
  await expect(page.locator('#narrada-momentos')).toContainText('Mínimo:');
});

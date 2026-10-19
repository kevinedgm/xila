import { expect, test } from '@playwright/test';

/** Puntos y promedio (DotRank) y Cien cuadros (Waffle). */

type Pagina = {
  puntos: { getReference(): number };
  cuadros: { getParts(): { label: string; cells: number; share: number }[] };
};

test('puntos y promedio: describe a cada país contra el promedio', async ({ page }) => {
  await page.goto('/comparar.html');
  await page.waitForFunction(() => 'puntos' in window);
  const img = page.locator('.xila-dot-rank canvas');
  await expect(img).toHaveAttribute(
    'aria-label',
    /^Comparación contra promedio del grupo \([\d.]+ t por persona\)\. Estados Unidos: [\d.]+ t por persona, [\d.]+ por encima/,
  );
  await expect(img).toHaveAttribute('aria-label', /India: [\d.]+ t por persona, [\d.]+ por debajo/);
});

test('cien cuadros: suma 100 y China es más de la mitad', async ({ page }) => {
  await page.goto('/comparar.html');
  await page.waitForFunction(() => 'cuadros' in window);
  const parts = await page.evaluate(() => (window as unknown as Pagina).cuadros.getParts());
  expect(parts.reduce((s, p) => s + p.cells, 0)).toBe(100);
  expect(parts[0]!.label).toBe('China');
  expect(parts[0]!.share).toBeGreaterThan(50);
  await expect(page.locator('.xila-waffle canvas')).toHaveAttribute(
    'aria-label',
    /cada cuadro es 1 %\. China: \d+ %/,
  );
});

test('teléfono: sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/comparar.html');
  await page.waitForFunction(() => 'cuadros' in window);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

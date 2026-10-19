import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Ranura de estado (`box.orientation: 'horizontal'`): los cuatro casos del brief, cada uno con
 * otra referencia y otro estado, y la revisión de accesibilidad.
 */

async function cargar(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/ranura.html');
  for (const id of ['#canciones', '#total', '#persona', '#panaderia', '#ventaja']) {
    await page.locator(id).scrollIntoViewIfNeeded();
  }
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
}

test('los cuatro casos de la ranura se dibujan con su referencia y su estado', async ({ page }) => {
  await cargar(page);
  await expect(page.locator('#canciones')).toHaveScreenshot('ranura-canciones.png');
  await expect(page.locator('#total')).toHaveScreenshot('ranura-co2-total.png');
  await expect(page.locator('#persona')).toHaveScreenshot('ranura-co2-persona.png');
  await expect(page.locator('#panaderia')).toHaveScreenshot('ranura-panaderia.png');
});

test('el tooltip de una fila da valor, referencia, margen y n; la fila parcial lo dice', async ({
  page,
}) => {
  await cargar(page);
  const chart = page.locator('#canciones');
  // La carga deja la página abajo del todo: la fila tiene que estar en pantalla para el ratón.
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  if (!box) throw new Error('sin caja');
  // Primera fila (la que salió con más claridad): el tooltip la describe.
  await page.mouse.move(box.x + box.width * 0.5, box.y + 90);
  const tooltip = chart.locator('.xila-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(/rango .+ – .+ · margen .+ – .+ · n = \d+/);
  await expect(tooltip).toContainText('claro');
  // La tabla accesible lista cada género con su estado y marca 2026 como parcial.
  const table = chart.locator('table.xila-a11y-table');
  await expect(table.locator('tbody tr')).toHaveCount(8);
  await expect(table).toContainText('parcial');
  await expect(table.locator('tbody tr', { hasText: 'parcial' })).toHaveCount(5);
});

test('teclado: las flechas verticales recorren las filas y el lector oye grupo, valor y estado', async ({
  page,
}) => {
  await cargar(page);
  const fig = page.locator('#persona [role="figure"]');
  await expect(fig).toHaveAttribute(
    'aria-label',
    /^Ranura de estado con 6 filas\. .+, .+, (arriba|abajo)/,
  );
  await fig.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#persona .xila-a11y-live')).toHaveText(/, (arriba|abajo)$/);
  await expect(page.locator('#persona .xila-tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#persona .xila-tooltip')).toBeHidden();
});

test('axe-core no encuentra fallos en la página de la ranura', async ({ page }) => {
  await cargar(page);
  const results = await new AxeBuilder({ page })
    .include('.chart')
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

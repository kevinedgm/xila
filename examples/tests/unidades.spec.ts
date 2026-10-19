import { expect, test } from '@playwright/test';

/**
 * Casos como unidades (histograma-unidades r03): gráfico `units`, transición entre modos y
 * plugin brush. Los ids K-0x son las enmiendas de Kiwi en design-hub/lab/histograma-unidades/r03.
 */

/** Lo que la página expone en `window` para las pruebas. */
type Pagina = {
  grafico: {
    getSeries(): { x: Float64Array }[];
    getBinEdges(): Float64Array | null;
    getBackend(): string;
  };
  brush: { getRange(): [number, number] | null; setRange(r: [number, number] | null): void };
};

const ready = async (page: import('@playwright/test').Page, url = '/unidades.html') => {
  await page.goto(url);
  await page.waitForFunction(() => 'grafico' in window);
  await page.evaluate(() => new Promise(requestAnimationFrame));
};

test('arranca en sueltos y la lectura dice el total', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#read')).toHaveText(/1,240 casos en total/);
  await expect(page.locator('#m-loose')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[role="img"]')).toHaveAttribute(
    'aria-label',
    /^Gráfico de unidades .*1,240 datos .* Mediana .+\.$/,
  );
});

test('el control de rango queda fuera de la imagen (K-03)', async ({ page }) => {
  await ready(page);
  const slider = page.getByRole('slider', { name: 'Rango de minutos a contar' });
  await expect(slider).toBeVisible();
  expect(await slider.evaluate((el) => el.closest('[role="img"]') === null)).toBe(true);
});

test('teclado: mueve, ajusta bordes, no sale de los datos y Esc limpia (K-01, K-02)', async ({
  page,
}) => {
  await ready(page);
  const slider = page.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  const range = () =>
    page.evaluate(() => (window as unknown as Pagina).brush.getRange() as [number, number]);
  const first = await range();
  expect(first[1]).toBeGreaterThan(first[0]);

  await page.keyboard.press('Shift+ArrowRight');
  const wider = await range();
  expect(wider[0]).toBeCloseTo(first[0]);
  expect(wider[1]).toBeGreaterThan(first[1]);

  await page.keyboard.press('ArrowRight');
  const moved = await range();
  await page.keyboard.press('Alt+ArrowLeft');
  const startMoved = await range();
  expect(startMoved[0]).toBeLessThan(moved[0]);
  expect(startMoved[1]).toBeCloseTo(moved[1]);

  await page.keyboard.press('End');
  for (let i = 0; i < 10; i++) await page.keyboard.press('Shift+ArrowRight');
  const max = await page.evaluate(() =>
    Math.max(...(window as unknown as Pagina).grafico.getSeries()[0]!.x),
  );
  expect((await range())[1]).toBeLessThanOrEqual(max + 1e-9);

  await expect(slider).toHaveAttribute('aria-valuetext', /casos \(/);
  await page.keyboard.press('Escape');
  expect(await range()).toBeNull();
  await expect(page.locator('#read')).toHaveText(/1,240 casos en total/);
});

test('agrupados: la selección se ajusta a columnas enteras (K-05)', async ({ page }) => {
  await ready(page);
  await page.click('#m-stacked');
  await page.waitForTimeout(900);
  const { edges, range } = await page.evaluate(() => {
    const w = window as unknown as Pagina;
    w.brush.setRange([12.3, 17.9]);
    return {
      edges: Array.from(w.grafico.getBinEdges() ?? []) as number[],
      range: w.brush.getRange() ?? ([NaN, NaN] as [number, number]),
    };
  });
  const [a, b] = range;
  expect(edges.some((e) => Math.abs(e - a) < 1e-9)).toBe(true);
  expect(edges.some((e) => Math.abs(e - b) < 1e-9)).toBe(true);
  await expect(page.locator('#read')).toHaveText(/casos \(\d+\.\d %\)/);
});

test('arrastrar cuenta y un clic sin arrastre limpia', async ({ page }) => {
  await ready(page);
  const box = (await page.getByRole('slider').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.1, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#read')).toHaveText(/^\d[\d,]* casos \(/);
  await page.mouse.click(box.x + box.width * 0.5, y);
  await expect(page.locator('#read')).toHaveText(/casos en total/);
});

test('teléfono: encabezado apilado, sin scroll horizontal y todo cabe (K-04)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await ready(page);
  await page.click('#m-stacked');
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(
    await page.locator('#m-stacked').evaluate((el) => (el as HTMLElement).offsetHeight),
  ).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.hint')).toBeHidden();
});

test('muchos casos: WebGL y aviso cuando cada punto vale varios casos (K-04)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await ready(page, '/unidades.html?n=200000');
  expect(await page.evaluate(() => (window as unknown as Pagina).grafico.getBackend())).toMatch(
    /webgl|canvas/,
  );
  await page.click('#m-stacked');
  await page.waitForTimeout(900);
  await expect(page.locator('#sub')).toHaveText(/cada punto = [\d,]+ casos/);
});

test('sin casos: estado vacío y sin controles (K-06)', async ({ page }) => {
  await page.goto('/unidades.html?n=0');
  await expect(page.getByText('Sin casos para mostrar.')).toBeVisible();
  await expect(page.locator('#m-stacked')).toBeDisabled();
  await expect(page.getByRole('slider')).toHaveCount(0);
});

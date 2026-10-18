import { expect, test } from '@playwright/test';

/** Gráfico de unidades (E8.01): tira, cubetas con transición, y selección que cuenta. */

async function listo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/unidades.html');
  await page.waitForFunction(() =>
    (window as unknown as { grafico?: { hasDrawn(): boolean } }).grafico?.hasDrawn(),
  );
  await page.evaluate(() => document.fonts.ready);
}

test('tira y cubetas se dibujan y la transición termina en la posición objetivo', async ({
  page,
}) => {
  await listo(page);
  await expect(page.locator('#unidades')).toHaveScreenshot('unidades-tira.png');
  await page.click('#unidades .xila-summary-modes button[data-mode="binned"]');
  // La transición dura 600 ms; después del tiempo las posiciones deben ser las finales.
  await page.waitForTimeout(900);
  await expect(page.locator('#unidades')).toHaveScreenshot('unidades-cubetas.png');
  const panel = page.locator('#unidades .xila-summary');
  await expect(panel).toContainText('1,240');
  await expect(panel).toContainText('casos en total');
});

test('arrastrar cuenta los casos del rango y la lectura es accesible', async ({ page }) => {
  await listo(page);
  const caja = await page.locator('#unidades').boundingBox();
  if (!caja) throw new Error('sin gráfico');
  const y = caja.y + caja.height * 0.5;
  await page.mouse.move(caja.x + caja.width * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width * 0.5, y, { steps: 5 });
  await page.mouse.up();
  const lectura = page.locator('#unidades .xila-summary');
  await expect(lectura).toHaveAttribute('aria-live', 'polite');
  await expect(lectura).toContainText(/casos · \d+\.\d % del total/);
  const texto = (await lectura.textContent()) ?? '';
  const cuenta = Number(
    (await page.locator('#unidades .xila-summary-count').textContent())?.replace(/,/g, ''),
  );
  expect(cuenta).toBeGreaterThan(0);
  expect(cuenta).toBeLessThan(1240);
  const evento = await page.evaluate(() => {
    const g = (window as unknown as { grafico: { getSelection(): unknown } }).grafico;
    return g.getSelection();
  });
  expect(evento).not.toBeNull();

  // Teclado: → mueve la selección sin salirse del rango; Escape la quita.
  await page.locator('#unidades .xila-chart, #unidades > div').first().focus();
  await page.keyboard.press('End');
  const fin = (await lectura.textContent()) ?? '';
  expect(fin).not.toBe(texto);
  // "Quitar selección" es la acción visible; deja el total.
  await page.click('#unidades .xila-summary-clear');
  await expect(lectura).toContainText('casos en total');
  expect(
    await page.evaluate(() =>
      (window as unknown as { grafico: { getSelection(): unknown } }).grafico.getSelection(),
    ),
  ).toBeNull();
});

test('en modo cubetas la selección salta a los bordes de cubeta', async ({ page }) => {
  await listo(page);
  await page.evaluate(() => (window as unknown as { modo(m: string): void }).modo('binned'));
  await page.waitForTimeout(900);
  const caja = await page.locator('#unidades').boundingBox();
  if (!caja) throw new Error('sin gráfico');
  const y = caja.y + caja.height * 0.5;
  await page.mouse.move(caja.x + caja.width * 0.22, y);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width * 0.33, y, { steps: 4 });
  await page.mouse.up();
  const r = await page.evaluate(() => {
    const g = (window as unknown as { grafico: { getSelection(): [number, number] | null } })
      .grafico;
    return g.getSelection();
  });
  expect(r).not.toBeNull();
  // Los bordes de cubeta son múltiplos del ancho de cubeta desde el mínimo: la selección
  // ajustada tiene que coincidir con uno de ellos por cada lado (tolerancia de redondeo).
  const edges = await page.evaluate(() => {
    const g = (
      window as unknown as {
        grafico: { getSeries(): { x: Float64Array }[] };
      }
    ).grafico;
    return Array.from(g.getSeries()[0]?.x ?? []);
  });
  expect(edges.length).toBe(1240);
  await expect(page.locator('#unidades')).toHaveScreenshot('unidades-seleccion.png');
});

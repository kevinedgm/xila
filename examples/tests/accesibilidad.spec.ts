import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Accesibilidad: resumen en aria-label, flechas para recorrer datos y tabla oculta. */

test('el gráfico tiene resumen, responde a las flechas y expone una tabla', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 39);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const img = page.locator('#multi [role="figure"]');
  await expect(img).toHaveAttribute('tabindex', '0');
  await expect(img).toHaveAttribute(
    'aria-label',
    /^Gráfico de líneas\. \d+ series: .+\. \d+ datos de .+ a .+\. Valores entre .+ y .+\.$/,
  );

  // Teclado: la flecha derecha mueve el cursor al primer dato y muestra el tooltip.
  await img.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const tooltip = page.locator('#multi .xila-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(page.locator('#multi .xila-a11y-live')).not.toHaveText('');
  // Flecha abajo cambia de serie; Escape quita el cursor.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  // Tabla oculta visualmente con una fila por dato (hasta 200) y una columna por serie.
  const table = page.locator('#multi table.xila-a11y-table');
  await expect(table.locator('thead th')).toHaveCount(4);
  expect(await table.locator('tbody tr').count()).toBeGreaterThan(100);
  await expect(table).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
});

test('en barras el resumen habla de categorías', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 39);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  // Está bajo el pliegue: con render diferido se dibuja (y describe) al entrar en pantalla.
  const img = page.locator('#barras [role="figure"]');
  await img.scrollIntoViewIfNeeded();
  await expect(img).toHaveAttribute(
    'aria-label',
    /^Gráfico de barras\. .+ categorías de .+ a .+\./,
  );
});

test('los canvas quedan fuera del árbol de accesibilidad y axe-core no encuentra fallos', async ({
  page,
}) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 39);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator('#multi canvas').first()).toHaveAttribute('aria-hidden', 'true');
  // Toda la galería: leyenda, tooltip, tabla oculta y región viva de cada gráfico.
  const resultados = await new AxeBuilder({ page })
    .include('.chart')
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .analyze();
  expect(resultados.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('la tabla se regenera cuando cambian los valores sin cambiar el tamaño', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 39);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const antes = await page.locator('#linea table.xila-a11y-table tbody tr').first().innerText();
  await page.evaluate(() => {
    const chart = (window as unknown as { charts: Record<string, import('xilaplot').Chart> })
      .charts['linea'] as import('xilaplot').Chart;
    const { data, series } = chart.getConfig();
    const spec = series[0] as { y: string };
    const y = data.column(spec.y) as { values: Float64Array };
    // Mismo número de filas, valores distintos: la clave vieja (tamaño + ids) no lo notaba.
    const nuevos = new Float64Array(y.values.length).fill(12345);
    const columnas: Record<string, unknown> = {};
    for (const name of data.names()) {
      columnas[name] = name === spec.y ? { kind: 'number', values: nuevos } : data.column(name);
    }
    chart.update({
      data: new (window as unknown as { xila: typeof import('xilaplot') }).xila.DataTable(
        columnas as never,
      ),
    });
    chart.drawNow();
  });
  const despues = await page.locator('#linea table.xila-a11y-table tbody tr').first().innerText();
  expect(despues).not.toBe(antes);
  expect(despues).toContain('12,345');
});

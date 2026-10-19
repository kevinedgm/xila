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

test('Enter fija el tooltip, el anillo de foco se dibuja y Escape lo suelta', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 39);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const img = page.locator('#multi [role="figure"]');
  const tooltip = page.locator('#multi .xila-tooltip');
  await img.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(tooltip).toBeVisible();

  // Anillo de foco: con el teclado la capa overlay lleva más píxeles pintados que con el
  // mismo cursor puesto por el ratón (cursor y punto iguales; el anillo es la diferencia).
  const opacos = () =>
    page.evaluate(() => {
      const canvas = document.querySelector(
        '#multi canvas[data-layer="overlay"]',
      ) as HTMLCanvasElement;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if ((data[i] as number) > 0) n++;
      return n;
    });
  await page.evaluate(() => {
    const chart = (window as unknown as { charts: Record<string, import('xilaplot').Chart> })
      .charts['multi'] as import('xilaplot').Chart;
    (window as unknown as { ultimo: unknown }).ultimo = null;
    chart.events.on('hover', (p) => {
      if (p) (window as unknown as { ultimo: unknown }).ultimo = { px: p.px, py: p.py };
    });
  });
  await page.keyboard.press('ArrowRight');
  const conAnillo = await opacos();
  await page.evaluate(() => {
    const chart = (window as unknown as { charts: Record<string, import('xilaplot').Chart> })
      .charts['multi'] as import('xilaplot').Chart;
    const p = (window as unknown as { ultimo: { px: number; py: number } }).ultimo;
    chart.hoverAt(p.px, p.py);
  });
  const sinAnillo = await opacos();
  expect(conAnillo).toBeGreaterThan(sinAnillo);
  await expect(page.locator('#multi .xila-a11y-live')).not.toContainText('fijado');
  await img.focus();
  await page.keyboard.press('ArrowRight');

  // Enter fija: perder el foco no lo quita; Escape sí.
  await page.keyboard.press('Enter');
  await expect(page.locator('#multi .xila-a11y-live')).toContainText('fijado');
  await page.locator('h1').click();
  await expect(tooltip).toBeVisible();
  await img.focus();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
});

test('con keyboard:false no hay tabindex, y el zoom responde a + - 0', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 39);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  // El gráfico de dispersión lleva zoomPanPlugin sin accessibilityPlugin: el zoom lo hace
  // enfocable por sí mismo.
  const dispersion = page.locator('#dispersion .xila-canvas');
  await dispersion.scrollIntoViewIfNeeded();
  // Render diferido: sin escalas (antes del primer dibujo) las teclas no tienen sobre qué actuar.
  await page.waitForFunction(() =>
    (window as unknown as { charts: Record<string, import('xilaplot').Chart> }).charts[
      'dispersion'
    ]?.hasDrawn(),
  );
  await expect(dispersion).toHaveAttribute('tabindex', '0');
  await dispersion.focus();
  const dominio = () =>
    page.evaluate(() => {
      const chart = (window as unknown as { charts: Record<string, import('xilaplot').Chart> })
        .charts['dispersion'] as import('xilaplot').Chart;
      return chart.getViewDomain('x');
    });
  expect(await dominio()).toBeNull();
  await page.keyboard.press('+');
  const acercado = await dominio();
  expect(acercado).not.toBeNull();
  await page.keyboard.press('-');
  await page.keyboard.press('0');
  expect(await dominio()).toBeNull();

  // Un gráfico sin teclado no es parada de Tab.
  const sinTeclado = await page.evaluate(async () => {
    const xila = (window as unknown as { xila: typeof import('xilaplot') }).xila;
    const el = document.createElement('div');
    el.style.cssText = 'width:300px;height:200px';
    document.body.appendChild(el);
    const chart = new xila.Chart(el, {
      type: 'line',
      lazy: false,
      data: new xila.DataTable({
        x: xila.numberColumn([0, 1, 2]),
        y: xila.numberColumn([1, 3, 2]),
      }),
      series: [{ id: 'a', x: 'x', y: 'y' }],
      plugins: [xila.accessibilityPlugin({ keyboard: false })],
    });
    chart.drawNow();
    const figure = el.querySelector('[role="figure"]') as HTMLElement;
    const r = {
      tabindex: figure.getAttribute('tabindex'),
      label: figure.getAttribute('aria-label'),
    };
    chart.destroy();
    el.remove();
    return r;
  });
  expect(sinTeclado.tabindex).toBeNull();
  expect(sinTeclado.label).toMatch(/^Gráfico de líneas/);
});

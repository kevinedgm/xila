import { expect, test, type Page } from '@playwright/test';

/**
 * Cada ejemplo de `index.html` es un caso. Si una captura cambia, Playwright guarda la actual
 * junto a la referencia y un diff; para aceptar el cambio: `pnpm test:visual --update-snapshots`.
 */
const CASOS = [
  'linea',
  'multi',
  'barras',
  'apiladas',
  'dispersion',
  'fechas',
  'log',
  'banda',
  'errores',
  'histograma',
  'cajas',
] as const;

async function abrir(page: Page): Promise<void> {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto('/index.html');
  // Los gráficos dibujan en el siguiente frame; esperar a que todos tengan sus tres capas.
  await page.waitForFunction(
    (n) => document.querySelectorAll('canvas').length === n * 3,
    CASOS.length,
  );
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(errores).toEqual([]);
}

for (const id of CASOS) {
  test(`ejemplo "${id}"`, async ({ page }) => {
    await abrir(page);
    await expect(page.locator(`#${id}`)).toHaveScreenshot(`${id}.png`);
  });
}

test('tooltip y marcador al pasar el cursor', async ({ page }) => {
  await abrir(page);
  const chart = page.locator('#multi');
  const box = (await chart.boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const tooltip = chart.locator('.xila-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Serie A');
  await expect(chart).toHaveScreenshot('multi-hover.png');
  // Al salir del gráfico el tooltip desaparece y el overlay se limpia.
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
});

test('la leyenda oculta una serie y el eje Y se reescala', async ({ page }) => {
  await abrir(page);
  const chart = page.locator('#multi');
  await chart.locator('.xila-legend-item[data-series="a"]').click();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(chart.locator('.xila-legend-item[data-series="a"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(chart).toHaveScreenshot('multi-sin-a.png');
});

test('redimensionar el contenedor redibuja con el nuevo tamaño', async ({ page }) => {
  await abrir(page);
  const chart = page.locator('#barras');
  await chart.evaluate((el) => {
    el.style.width = '500px';
    el.style.height = '220px';
  });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
  const sizes = await chart
    .locator('canvas')
    .evaluateAll((cs) =>
      cs.map((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height]),
    );
  for (const [w, h] of sizes) expect([w, h]).toEqual([500, 220]);
  await expect(chart).toHaveScreenshot('barras-500x220.png');
});

test('pasar el cursor por una anotación muestra su detalle', async ({ page }) => {
  await abrir(page);
  const chart = page.locator('#fechas');
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // La línea "Buen Fin" está el 17 de noviembre: ~87.6 % del año; el área de dibujo
  // empieza tras el eje Y, así que se busca el píxel con un pequeño barrido.
  const tip = chart.locator('.xila-annotation-tip');
  for (let f = 0.85; f <= 0.93; f += 0.002) {
    await page.mouse.move(box.x + box.width * f, box.y + box.height * 0.5);
    if (await tip.isVisible()) break;
  }
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Buen Fin');
  await expect(tip).toContainText('14 al 17 de noviembre');
});

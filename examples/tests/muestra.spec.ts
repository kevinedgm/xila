import { expect, test } from '@playwright/test';

/**
 * Dashboard de muestra: las formas de "Qué es Xila hoy" declaradas en JSON
 * (`public/co2/muestra.json`), sin código de gráficos.
 */
test('el dashboard de muestra carga las once formas sin errores y responde al filtro', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/dashboard.html?config=co2/muestra.json');
  await page.locator('.xila-grid canvas').first().waitFor();
  await expect(page.locator('.xila-errors')).toHaveCount(0);
  await expect(page.locator('.xila-panel')).toHaveCount(12);
  // Render diferido: cada panel se dibuja al entrar en pantalla.
  const paneles = page.locator('.xila-panel');
  for (let i = 0; i < 12; i++) {
    await paneles.nth(i).scrollIntoViewIfNeeded();
    await expect(paneles.nth(i).locator('.xila-skeleton')).toHaveCount(0);
  }
  await page.evaluate(() => document.fonts.ready);
  expect(errores).toEqual([]);
  for (const [i, nombre] of [
    [3, 'ahora'],
    [4, 'protagonista'],
    [5, 'puntos'],
    [6, 'unidades'],
    [7, 'trayectorias'],
    [8, 'tendencia'],
    [9, 'hoy'],
    [10, 'filas'],
    [11, 'tabla'],
  ] as const) {
    await paneles.nth(i).scrollIntoViewIfNeeded();
    // El panel de tendencia lleva un ranking de cifras pequeñas en mono: en CI el hinting
    // difiere del local y supera el 2 % de píxeles (ver matriz.spec.ts).
    await expect(paneles.nth(i)).toHaveScreenshot(`muestra-${nombre}.png`, {
      maxDiffPixelRatio: nombre === 'tendencia' ? 0.05 : 0.02,
    });
  }
  // Filtrar a dos países recalcula todos los paneles sin romper ninguno.
  await page.locator('[data-filter="1"] select').selectOption(['China', 'India']);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator('.xila-errors')).toHaveCount(0);
  expect(errores).toEqual([]);
  await paneles.nth(5).scrollIntoViewIfNeeded();
  await expect(paneles.nth(5)).toHaveScreenshot('muestra-puntos-dos-paises.png');
});

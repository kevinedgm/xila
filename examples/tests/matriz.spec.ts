import { expect, test } from '@playwright/test';

/** Más allá del mapa de calor: `heatmap.scale: 'row'` con `rowLabels` y la tabla con `values` y `gap`. */

test('la escala por fila y la tabla con tono se dibujan sobre el formato largo', async ({
  page,
}) => {
  await page.goto('/matriz.html');
  for (const id of ['#propia', '#tabla']) await page.locator(id).scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    (window as unknown as { graficos?: { hasDrawn(): boolean }[] }).graficos?.every((g) =>
      g.hasDrawn(),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
  // Muchas cifras pequeñas en JetBrains Mono: el hinting del runner de CI difiere del local
  // (la captura se generó con las mismas TTF) y pasa del 2 % de píxeles; 5 % sigue detectando
  // cualquier cambio de dibujo.
  await expect(page.locator('#propia')).toHaveScreenshot('matriz-propia.png', {
    maxDiffPixelRatio: 0.05,
  });
  await expect(page.locator('#tabla')).toHaveScreenshot('matriz-tabla.png');

  // El tooltip sigue leyendo la celda bajo el cursor en la tabla con rectángulos.
  const caja = await page.locator('#tabla').boundingBox();
  if (!caja) throw new Error('sin gráfico');
  await page.mouse.move(caja.x + caja.width * 0.5, caja.y + caja.height * 0.5);
  await expect(page.locator('#tabla .xila-tooltip')).toContainText('t por persona');
});

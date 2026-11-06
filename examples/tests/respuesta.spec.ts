import { expect, test } from '@playwright/test';

/**
 * El panel «ahora» de la cafetería abre con una frase que responde "¿cómo vamos?". La frase
 * sigue a los filtros: el periodo elegido es el rango que se compara, y la sucursal recorta.
 */
test('la frase responde y sigue a los filtros', async ({ page }) => {
  await page.goto('/dashboard.html?config=cafeteria/dashboard.json');
  const frase = page.locator('[data-panel="4"] .xila-answer');
  await expect(frase).toHaveAttribute('aria-live', 'polite');
  await expect(frase).toContainText('Del 4 al 31 de agosto de 2025, las ventas suman');
  await expect(frase).toContainText('más que en las mismas fechas del año pasado');
  await expect(frase).toContainText('Guelaguetza');

  const periodo = page.locator('[data-filter="0"]');
  await periodo.getByLabel('desde').fill('2025-07-01');
  await periodo.getByLabel('desde').dispatchEvent('change');
  await periodo.getByLabel('hasta').fill('2025-07-31');
  await periodo.getByLabel('hasta').dispatchEvent('change');
  await expect(frase).toContainText('Del 1 al 31 de julio de 2025');
  await expect(frase).toContainText('estas fechas son de Guelaguetza');
});

test('los paneles sin «respuesta» no tienen frase', async ({ page }) => {
  await page.goto('/dashboard.html?config=cafeteria/dashboard.json');
  await page.locator('[data-panel="4"] .xila-answer').waitFor();
  await expect(page.locator('.xila-answer')).toHaveCount(1);
});

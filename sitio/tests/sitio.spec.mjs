// Pruebas de navegador del sitio construido (`pnpm --filter sitio build` y luego `pnpm --filter sitio test:e2e`,
// vitepress preview en el puerto 4300). Chromium. Marco (banda, índice, «En esta página», búsqueda), ejemplos vivos
// de la galería, ficha interactiva, tema y teléfono.
import { test, expect } from '@playwright/test';

/** Recoge errores y avisos de consola y errores de página. */
function watchConsole(page) {
  const problems = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    problems.push(`${m.type()}: ${page.url()} ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}
const hScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('portada: la muestra se dibuja, las preguntas llevan a la galería y no hay errores', async ({
  page,
}) => {
  const problems = watchConsole(page);
  const res = await page.goto('');
  expect(res.status()).toBe(200);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.x-hero__title')).toHaveText('Xila');
  expect(await page.locator('.x-preguntas__list a.x-q').count()).toBeGreaterThanOrEqual(14);
  await page.locator('.x-demo').scrollIntoViewIfNeeded();
  await expect(page.locator('.x-demo canvas').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.x-preguntas__list a.x-q').first().click();
  await expect(page).toHaveURL(/galeria#ahora-con-estela/);
  await expect(page.locator('h1')).toHaveText('Galería');
  expect(await hScroll(page)).toBe(0);
  expect(problems).toEqual([]);
});

test('galería: los 26 ejemplos vivos se dibujan con el tema del sitio y las secciones llevan su número', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = watchConsole(page);
  await page.goto('galeria');
  await page.waitForLoadState('networkidle');
  const demos = page.locator('.x-demo');
  const n = await demos.count();
  expect(n).toBeGreaterThanOrEqual(26);
  // render diferido: recorrer la página para que cada gráfico entre en pantalla
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
  });
  await expect
    .poll(() => page.locator('.x-demo canvas').count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(n);
  expect(await page.locator('.x-demo__error').count()).toBe(0);
  expect(await page.locator('h2[data-n]').count()).toBe(await page.locator('.vp-doc h2').count());
  await expect(page.locator('.x-aside .x-toc__text').first()).toHaveText(/^01 /);
  // el código de cada ejemplo está debajo, plegado
  expect(await page.locator('details.x-code').count()).toBe(n);
  expect(problems).toEqual([]);
});

test('ficha interactiva: el código es el control (línea)', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('guia/tipos');
  const live = page.locator('.x-live').first();
  await live.scrollIntoViewIfNeeded();
  await expect(live.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
  const curve = live.locator('.x-live__val').first();
  await expect(curve).toHaveText("'linear'");
  await curve.click();
  await expect(curve).toHaveText("'monotone'");
  await curve.click({ modifiers: ['Shift'] });
  await expect(curve).toHaveText("'linear'");
  const area = live.locator('.x-live__bool', { hasText: 'area' });
  await area.click();
  await expect(area).toHaveText('[x] area');
  await live.getByRole('button', { name: 'Oscuro' }).click();
  await expect(live.locator('.x-live__stage')).toHaveAttribute('data-theme', 'dark');
  await live.getByRole('button', { name: 'Teléfono' }).click();
  await expect(live.locator('.x-live__stage')).toHaveClass(/is-phone/);
  expect(problems).toEqual([]);
});

test('marco: tema, índice con filtro y «/», «En esta página» activa y páginas vecinas', async ({
  page,
}) => {
  const problems = watchConsole(page);
  await page.goto('guia/tipos');
  await page.waitForLoadState('networkidle');
  // tema de dos estados escrito en data-theme
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.locator('.x-band .x-theme').click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .not.toBe(before);
  // «/» enfoca el filtro; filtrar deja solo lo que coincide
  await page.keyboard.press('/');
  await expect(page.locator('.x-index__input')).toBeFocused();
  await page.keyboard.type('contrato de csv');
  await expect(page.locator('.x-index__link')).toHaveCount(1);
  await expect(page.locator('.x-index__link')).toHaveText(/Contrato de CSV/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.x-index__link.is-current')).toHaveText(/Tipos de gráfico/);
  // la sección activa sigue al desplazamiento
  await page.evaluate(() => document.getElementById('heatmap').scrollIntoView());
  await expect
    .poll(() => page.locator('.x-aside .x-toc__link.is-active').textContent())
    .toMatch(/Heatmap/);
  // vecinas por el orden del índice
  await expect(page.locator('.x-pager__card.is-next .x-pager__title')).toHaveText(
    'Crear un plugin',
  );
  await page.locator('.x-pager__card.is-next').click();
  await expect(page).toHaveURL(/guia\/plugin$/);
  await expect(page.locator('main h1')).toBeFocused();
  expect(problems).toEqual([]);
});

test('búsqueda modal: ⌘K abre, encuentra una sección y navega', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = watchConsole(page);
  await page.goto('guia/empezar');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.locator('dialog.x-search');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input')).toBeFocused();
  await dialog.locator('input').fill('ranura de estado');
  await expect(dialog.locator('.x-search__opt').first()).toBeVisible({ timeout: 30_000 });
  await expect(dialog.locator('.x-search__opt').first()).toContainText(/Ranura de estado/i);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/galeria#ranura-de-estado/);
  await expect(dialog).toBeHidden();
  expect(problems).toEqual([]);
});

test('teléfono (375): sin desplazamiento horizontal, cajón del índice y menú de secciones', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 740 });
  const problems = watchConsole(page);
  for (const p of ['', 'galeria', 'guia/tipos', 'referencia/documentacion-tecnica']) {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    expect(await hScroll(page), p).toBe(0);
  }
  await page.goto('guia/tipos');
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  const drawer = page.locator('dialog.x-drawer');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name: /Crear un plugin/ }).click();
  await expect(page).toHaveURL(/guia\/plugin$/);
  await expect(drawer).toBeHidden();
  // esperar al contenido nuevo: al llegar la ruta, el marco cierra menú y cajón
  await expect(page.locator('main h1')).toHaveText(/Crear un plugin/);
  const burger = page.getByRole('button', { name: 'Menú de secciones' });
  await burger.click();
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#x-menu')).toBeVisible();
  await page.locator('#x-menu').getByRole('link', { name: 'Galería' }).click();
  await expect(page).toHaveURL(/galeria$/);
  expect(problems).toEqual([]);
});

test('API de TypeDoc y decisiones: las páginas existen', async ({ page }) => {
  const api = await page.goto('api/');
  expect(api.status()).toBe(200);
  const adr = await page.goto('referencia/decisiones/');
  expect(adr.status()).toBe(200);
  expect(await page.locator('.vp-doc table tbody tr').count()).toBeGreaterThanOrEqual(6);
  await page.locator('.vp-doc table a').first().click();
  await expect(page.locator('main h1')).toContainText(/ADR 0001/);
});

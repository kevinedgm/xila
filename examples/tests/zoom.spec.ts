import { expect, test, type Page } from '@playwright/test';

/** Zoom con rueda centrado en el cursor, pan con arrastre y reinicio con doble clic. */

interface Dom {
  x: [number, number];
  y: [number, number];
}

async function dominio(page: Page, id: string): Promise<Dom> {
  return page.evaluate((id) => {
    const s = (
      window as unknown as {
        charts: Record<
          string,
          {
            getScales(): {
              x: { domain: [number, number] };
              y: { domain: [number, number] };
            } | null;
          }
        >;
      }
    ).charts[id]?.getScales();
    if (!s) throw new Error('sin escalas');
    return { x: s.x.domain, y: s.y.domain };
  }, id);
}

async function valorEn(page: Page, id: string, px: number): Promise<number> {
  return page.evaluate(
    ([id, px]) => {
      const c = (
        window as unknown as {
          charts: Record<
            string,
            {
              getScales(): { x: { toValue(p: number): number } } | null;
              renderer: { element: HTMLElement };
            }
          >;
        }
      ).charts[id as string];
      const r = c?.renderer.element.getBoundingClientRect();
      return c!.getScales()!.x.toValue((px as number) - (r?.left ?? 0));
    },
    [id, px] as const,
  );
}

async function abrir(page: Page): Promise<{ x: number; y: number; w: number }> {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 33);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const box = (await page.locator('#linea').boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Coordenadas enteras: el navegador redondea `clientX` del evento de rueda, y medir el
  // ancla en una fracción de píxel distinta a la del evento aparenta una deriva que no existe.
  return {
    x: Math.round(box.x + box.width * 0.6),
    y: Math.round(box.y + box.height * 0.5),
    w: box.width,
  };
}

test('la rueda acerca y el valor bajo el cursor se queda quieto', async ({ page }) => {
  const p = await abrir(page);
  const inicial = await dominio(page, 'linea');
  await page.mouse.move(p.x, p.y);
  // Primer paso: el rango automático sobresale de los datos y el límite lo recorta; a partir
  // de ahí el ancla debe quedarse fija.
  await page.mouse.wheel(0, -100);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const antes = await dominio(page, 'linea');
  const anchorAntes = await valorEn(page, 'linea', p.x);
  await page.mouse.wheel(0, -300);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const despues = await dominio(page, 'linea');
  const anchorDespues = await valorEn(page, 'linea', p.x);
  const spanAntes = antes.x[1] - antes.x[0];
  const spanDespues = despues.x[1] - despues.x[0];
  expect(spanAntes).toBeLessThan(inicial.x[1] - inicial.x[0]);
  expect(spanDespues).toBeLessThan(spanAntes / 4);
  // El valor bajo el cursor no se mueve más de un píxel.
  expect(Math.abs(anchorDespues - anchorAntes)).toBeLessThan(spanDespues / p.w);
  // Y no cambia (zoom solo en X por defecto).
  expect(despues.y).toEqual(inicial.y);
});

test('arrastrar desplaza el rango y no dispara clic; doble clic reinicia', async ({ page }) => {
  const p = await abrir(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, -300);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const antes = await dominio(page, 'linea');
  const clics = await page.evaluate(() => {
    const w = window as unknown as {
      clics: number;
      charts: Record<string, { events: { on(n: string, f: () => void): void } }>;
    };
    w.clics = 0;
    w.charts['linea']!.events.on('click', () => w.clics++);
    return w.clics;
  });
  expect(clics).toBe(0);
  await page.mouse.down();
  await page.mouse.move(p.x - 100, p.y, { steps: 5 });
  await page.mouse.up();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const despues = await dominio(page, 'linea');
  expect(despues.x[0]).toBeGreaterThan(antes.x[0]);
  expect(despues.x[1] - despues.x[0]).toBeCloseTo(antes.x[1] - antes.x[0], 3);
  expect(await page.evaluate(() => (window as unknown as { clics: number }).clics)).toBe(0);

  await page.mouse.dblclick(p.x, p.y);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const reset = await dominio(page, 'linea');
  expect(reset.x[1] - reset.x[0]).toBeGreaterThan((despues.x[1] - despues.x[0]) * 4);
});

test('no se puede salir de los datos', async ({ page }) => {
  const p = await abrir(page);
  const datos = await dominio(page, 'linea');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 400, p.y, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const despues = await dominio(page, 'linea');
  expect(despues.x[0]).toBeGreaterThanOrEqual(datos.x[0] - 1);
});

test('arrastrar con Shift selecciona un rango; doble clic restaura el dominio inicial', async ({
  page,
}) => {
  const p = await abrir(page);
  const inicial = await dominio(page, 'linea');
  const desde = p.x - 150;
  const hasta = p.x + 50;
  const vDesde = await valorEn(page, 'linea', desde);
  const vHasta = await valorEn(page, 'linea', hasta);
  await page.keyboard.down('Shift');
  await page.mouse.move(desde, p.y);
  await page.mouse.down();
  await page.mouse.move(hasta, p.y, { steps: 4 });
  await expect(page.locator('#linea .xila-zoom-selection')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator('#linea .xila-zoom-selection')).toHaveCount(0);
  const despues = await dominio(page, 'linea');
  // El rango queda en los valores de los dos píxeles (±1 px del rango inicial).
  const porPx = (inicial.x[1] - inicial.x[0]) / p.w;
  expect(Math.abs(despues.x[0] - vDesde)).toBeLessThan(porPx);
  expect(Math.abs(despues.x[1] - vHasta)).toBeLessThan(porPx);
  expect(despues.y).toEqual(inicial.y);

  await page.mouse.dblclick(p.x, p.y);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(await dominio(page, 'linea')).toEqual(inicial);
});

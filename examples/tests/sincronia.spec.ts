import { expect, test, type Page } from '@playwright/test';

/** Sincronía: el cursor y el zoom de un gráfico se reflejan en los demás del grupo. */

interface Vista {
  x: [number, number];
  hover: number | null;
}

async function estado(page: Page, id: string): Promise<Vista> {
  return page.evaluate((id) => {
    const c = (
      window as unknown as {
        charts: Record<
          string,
          {
            getScales(): { x: { domain: [number, number] } } | null;
            getLastHover?: unknown;
          }
        >;
      }
    ).charts[id];
    const s = c?.getScales();
    if (!s) throw new Error('sin escalas');
    const marcador = (window as unknown as { hovers: Record<string, number | null> }).hovers;
    return { x: s.x.domain, hover: marcador?.[id] ?? null };
  }, id);
}

async function abrir(page: Page): Promise<void> {
  await page.goto('/sincronia.html');
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 9);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  // Registra la X del último hover de cada gráfico.
  await page.evaluate(() => {
    const w = window as unknown as {
      hovers: Record<string, number | null>;
      charts: Record<
        string,
        { events: { on(n: string, f: (p: { hits: { x: number }[] } | null) => void): void } }
      >;
    };
    w.hovers = {};
    for (const [id, c] of Object.entries(w.charts)) {
      c.events.on('hover', (p) => {
        w.hovers[id] = p?.hits[0]?.x ?? null;
      });
    }
  });
}

test('el cursor marca el mismo instante en los tres y el zoom se comparte', async ({ page }) => {
  await abrir(page);
  const box = (await page.locator('#s1').boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const [a, b, c] = await Promise.all(['s1', 's2', 's3'].map((id) => estado(page, id)));
  expect(a!.hover).not.toBeNull();
  // Las series tienen el mismo eje de tiempo: el dato marcado comparte X exactamente.
  expect(b!.hover).toBe(a!.hover);
  expect(c!.hover).toBe(a!.hover);

  await page.mouse.wheel(0, -300);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const despues = await Promise.all(['s1', 's2', 's3'].map((id) => estado(page, id)));
  expect(despues[0]!.x[1] - despues[0]!.x[0]).toBeLessThan(a!.x[1] - a!.x[0]);
  expect(despues[1]!.x).toEqual(despues[0]!.x);
  expect(despues[2]!.x).toEqual(despues[0]!.x);

  // Al salir del primero, los demás también quitan el cursor.
  await page.mouse.move(5, 5);
  await expect.poll(() => estado(page, 's3').then((e) => e.hover)).toBeNull();
  await expect(page.locator('#s2')).toHaveScreenshot('sincronia-zoom.png');
});

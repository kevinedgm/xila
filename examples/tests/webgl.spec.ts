import { expect, test, type Page } from '@playwright/test';

/**
 * Backend WebGL para dispersiones: dibuja con la GPU cuando existe y cae a Canvas 2D (con un
 * aviso) cuando no. El benchmark de 1M vive aparte (docs/benchmarks.md); aquí 100K bastan.
 */

const backend = (page: Page) =>
  page.evaluate(() => (window as unknown as { backend(): string }).backend());

async function esperarDibujo(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    (window as unknown as { grafico?: { hasDrawn(): boolean } }).grafico?.hasDrawn(),
  );
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

test('dibuja los puntos con WebGL y el canvas 2D de datos queda vacío', async ({ page }) => {
  await page.goto('/webgl.html?n=100000');
  await esperarDibujo(page);
  expect(await backend(page)).toBe('webgl');
  // El canvas WebGL tiene píxeles pintados; el canvas 2D `data` no (los puntos no pasan por él).
  const pintados = await page.evaluate(() => {
    const cuenta = (c: HTMLCanvasElement | null): number => {
      if (!c) return -1;
      const ctx = c.getContext('2d');
      if (!ctx) return -2;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    };
    return { data: cuenta(document.querySelector('canvas[data-layer="data"]')) };
  });
  expect(pintados.data).toBe(0);
  await expect(page.locator('#nube')).toHaveScreenshot('webgl-100k.png');
});

test('sin WebGL2 cae a Canvas con un aviso y el gráfico se ve igual', async ({ page }) => {
  const avisos: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning') avisos.push(m.text());
  });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HTMLCanvasElement.prototype as any).getContext = function (
      this: HTMLCanvasElement,
      tipo: string,
      ...rest: unknown[]
    ) {
      if (tipo === 'webgl2' || tipo === 'webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(this, tipo, ...rest);
    };
  });
  await page.goto('/webgl.html?n=100000');
  await esperarDibujo(page);
  expect(await backend(page)).toBe('canvas');
  expect(avisos.some((a) => a.includes('WebGL2 no está disponible'))).toBe(true);
  // Misma referencia que con WebGL: el fallback debe verse igual salvo el antialiasing.
  await expect(page.locator('#nube')).toHaveScreenshot('webgl-100k.png', {
    maxDiffPixelRatio: 0.05,
  });
});

test('perder el contexto WebGL redibuja con Canvas sin dejar el gráfico en blanco', async ({
  page,
}) => {
  await page.goto('/webgl.html?n=100000');
  await esperarDibujo(page);
  expect(await backend(page)).toBe('webgl');
  await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>('canvas[data-layer="gl"]');
    const ctx = gl?.getContext('webgl2');
    ctx?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect.poll(() => backend(page)).toBe('canvas');
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const pintados = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas[data-layer="data"]');
    const d = c?.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    if (d) for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
  expect(pintados).toBeGreaterThan(1000);
});

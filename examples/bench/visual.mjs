// Compara píxel a píxel el render sin decimación contra el decimado para 1M de puntos.
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';

const DIST = resolve(import.meta.dirname, '../dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const path = join(DIST, (req.url ?? '/').split('?')[0]);
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const url = `http://localhost:${server.address().port}/bench.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

async function shot(kind) {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 500 },
    deviceScaleFactor: 1,
  });
  await page.goto(url);
  await page.waitForFunction(() => window.bench !== undefined);
  await page.evaluate((k) => window.bench.setupRenderer(k, 1_000_000), kind);
  await page.evaluate(() => window.bench.firstRender());
  const png = await page.locator('#host canvas').screenshot();
  await page.close();
  writeFileSync(resolve(import.meta.dirname, `${kind}.png`), png);
  return PNG.sync.read(png);
}

const a = await shot('naive');
const b = await shot('decimated');
let diff = 0;
let inkA = 0;
let inkB = 0;
for (let i = 0; i < a.data.length; i += 4) {
  // La captura trae fondo blanco opaco, así que "tinta" es cualquier píxel que no sea blanco.
  const ia = a.data[i] < 250 || a.data[i + 1] < 250 || a.data[i + 2] < 250;
  const ib = b.data[i] < 250 || b.data[i + 1] < 250 || b.data[i + 2] < 250;
  inkA += ia;
  inkB += ib;
  if (ia !== ib) diff++;
}
const total = a.width * a.height;
console.log({
  width: a.width,
  height: a.height,
  inkNaive: inkA,
  inkDecimated: inkB,
  differentPixels: diff,
  pct: ((100 * diff) / total).toFixed(3) + '%',
});
await browser.close();
server.close();

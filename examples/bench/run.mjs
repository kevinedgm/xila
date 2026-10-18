// Ejecuta el benchmark del prototipo en Chromium headless y escribe los resultados en JSON.
// Uso: pnpm --filter examples build && node examples/bench/run.mjs [salida.json]
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = resolve(import.meta.dirname, '../dist');
const OUT = process.argv[2] ?? resolve(import.meta.dirname, 'resultados.json');
// En CI se acorta con BENCH_RENDERERS=decimated BENCH_REPEATS=3 (ver bench/check.mjs).
const SIZES = [10_000, 100_000, 1_000_000];
const RENDERERS = (process.env.BENCH_RENDERERS ?? 'naive,decimated,uplot').split(',');
const REPEATS = Number(process.env.BENCH_REPEATS ?? 5);
const PAN_FRAMES = 120;

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

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--js-flags=--expose-gc'],
});

async function freshPage() {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 500 },
    deviceScaleFactor: 1,
  });
  await page.goto(url);
  await page.waitForFunction(() => window.bench !== undefined);
  return page;
}

async function heapUsed(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return usedSize;
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const results = { machine: {}, memory: [], firstRender: [], pan: [] };
results.machine = {
  browser: browser.version(),
  node: process.version,
  platform: process.platform,
  note: 'Chromium headless en contenedor, sin GPU; usar solo para comparar entre sí',
};

// 1. Memoria y recorrido: objetos {x, y} contra Float64Array por columna.
for (const mode of ['objects', 'columns']) {
  const heaps = [];
  const traversals = [];
  for (let r = 0; r < REPEATS; r++) {
    const page = await freshPage();
    const base = await heapUsed(page);
    await page.evaluate((m) => window.bench.loadMemory(m, 1_000_000), mode);
    heaps.push((await heapUsed(page)) - base);
    await page.evaluate(() => window.bench.traverse()); // calentamiento
    traversals.push(await page.evaluate(() => window.bench.traverse()));
    await page.close();
  }
  // Los Float64Array viven fuera del heap de V8 (ArrayBuffer): se suman por construcción, 2 × n × 8 bytes.
  const external = mode === 'columns' ? (2 * 1_000_000 * 8) / 2 ** 20 : 0;
  results.memory.push({
    mode,
    n: 1_000_000,
    heapMB: median(heaps) / 2 ** 20,
    externalMB: external,
    totalMB: median(heaps) / 2 ** 20 + external,
    traverseMs: median(traversals),
  });
  console.log('memoria', mode, results.memory.at(-1));
}

// 2. Primer render y pan.
for (const kind of RENDERERS) {
  for (const n of SIZES) {
    const first = [];
    const pans = [];
    for (let r = 0; r < REPEATS; r++) {
      const page = await freshPage();
      await page.evaluate(([k, size]) => window.bench.setupRenderer(k, size), [kind, n]);
      first.push(await page.evaluate(() => window.bench.firstRender()));
      pans.push(await page.evaluate((f) => window.bench.pan(f), PAN_FRAMES));
      await page.close();
    }
    const fr = { kind, n, ms: median(first.map((f) => f.ms)), vertices: first[0].vertices };
    const pan = {
      kind,
      n,
      workMedian: median(pans.map((p) => p.workMedian)),
      workP95: median(pans.map((p) => p.workP95)),
      intervalMedian: median(pans.map((p) => p.intervalMedian)),
      intervalP95: median(pans.map((p) => p.intervalP95)),
      vertices: pans[0].vertices,
    };
    results.firstRender.push(fr);
    results.pan.push(pan);
    console.log('render', fr, '\npan', pan);
  }
}

await browser.close();
server.close();
writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`Resultados en ${OUT}`);

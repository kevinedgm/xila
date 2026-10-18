// Benchmark de dispersión: Canvas 2D contra WebGL para 100K, 1M y 5M puntos (E6.12).
// Mide primer dibujo, trabajo por fotograma en un pan y memoria. Escribe JSON y una tabla Markdown.
// Uso: pnpm --filter examples build && CHROMIUM_PATH=... node examples/bench/dispersion.mjs [salida.json]
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = resolve(import.meta.dirname, '../dist');
const OUT = process.argv[2] ?? resolve(import.meta.dirname, 'dispersion.json');
const SIZES = (process.env.BENCH_SIZES ?? '100000,1000000,5000000').split(',').map(Number);
const BACKENDS = (process.env.BENCH_BACKENDS ?? 'canvas,webgl').split(',');
const REPEATS = Number(process.env.BENCH_REPEATS ?? 3);
const PAN_FRAMES = Number(process.env.BENCH_PAN_FRAMES ?? 20);
// Con Canvas a 5M puntos cada fotograma cuesta segundos: menos fotogramas en los tamaños grandes.
const framesFor = (n) =>
  Math.max(5, Math.min(PAN_FRAMES, Math.round((PAN_FRAMES * 1_000_000) / n)));

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
const base = `http://localhost:${server.address().port}/webgl.html`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--js-flags=--expose-gc'],
});
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))];

async function heapUsed(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return usedSize;
}

/** Una corrida: carga la página con `n` y `backend`, mide y devuelve los números. */
async function run(n, backend) {
  const page = await browser.newPage({
    // uPlot llama Intl.NumberFormat(navigator.language) al cargar; el headless shell de CI
    // reporta "en-US@posix", que no es una etiqueta válida, y el módulo nunca termina de cargar.
    locale: 'es-MX',
    viewport: { width: 1200, height: 600 },
    deviceScaleFactor: 1,
  });
  try {
    return await measure(page, n, backend);
  } finally {
    await page.close();
  }
}

async function measure(page, n, backend) {
  await page.goto('about:blank');
  const heapBase = await heapUsed(page);
  await page.goto(`${base}?n=${n}&renderer=${backend}`);
  await page.waitForFunction(() => window.grafico?.hasDrawn(), null, { timeout: 120_000 });
  const info = await page.evaluate(() => ({
    backend: window.backend(),
    // El ejemplo escribe "… · primer dibujo N ms" en #estado al terminar el primer dibujo.
    firstMs: Number(
      /primer dibujo (\d+) ms/.exec(document.getElementById('estado')?.textContent ?? '')?.[1],
    ),
  }));
  const heapMB = ((await heapUsed(page)) - heapBase) / 2 ** 20;

  const pan = await page.evaluate(
    ({ frames }) => {
      const g = window.grafico;
      const gl = document.querySelector('canvas[data-layer="gl"]');
      const data = document.querySelector('canvas[data-layer="data"]');
      const ctx2d = data.getContext('2d');
      const glCtx = gl && gl.style.display !== 'none' ? gl.getContext('webgl2') : null;
      const px = new Uint8Array(4);
      // Forzar al navegador a terminar de rasterizar, para medir el costo real del fotograma.
      const flush = () => {
        if (glCtx) glCtx.readPixels(0, 0, 1, 1, glCtx.RGBA, glCtx.UNSIGNED_BYTE, px);
        else ctx2d.getImageData(0, 0, 1, 1);
      };
      const { x } = g.getScales();
      const [x0, x1] = x.domain;
      const span = x1 - x0;
      const work = [];
      for (let f = 0; f < frames; f++) {
        const t = performance.now();
        const offset = span * 0.004 * (f + 1);
        g.setViewDomain('x', [x0 + offset, x1 + offset]);
        g.drawNow();
        flush();
        work.push(performance.now() - t);
      }
      return work;
    },
    { frames: framesFor(n) },
  );
  return { backend: info.backend, firstMs: info.firstMs, heapMB, pan };
}

const results = {
  machine: {
    browser: browser.version(),
    node: process.version,
    platform: process.platform,
    note: 'Chromium headless en contenedor; WebGL por SwiftShader (software, sin GPU). Sirve para comparar backends entre sí, no como cifra absoluta.',
  },
  runs: [],
};

for (const n of SIZES) {
  for (const backend of BACKENDS) {
    const firsts = [];
    const heaps = [];
    const workMed = [];
    const workP95 = [];
    let real = backend;
    for (let r = 0; r < REPEATS; r++) {
      let out;
      try {
        out = await run(n, backend);
      } catch (e) {
        // Canvas con 5M puntos no termina ni el primer dibujo en el límite: se anota y se sigue.
        console.error(`n=${n} ${backend} #${r + 1}: ${e.message.split('\n')[0]}`);
        out = { backend, firstMs: NaN, heapMB: NaN, pan: [NaN] };
      }
      real = out.backend;
      firsts.push(out.firstMs);
      heaps.push(out.heapMB);
      workMed.push(median(out.pan));
      workP95.push(p95(out.pan));
      console.error(
        `n=${n} ${backend}(${out.backend}) #${r + 1}: primer ${out.firstMs} ms, pan med ${median(out.pan).toFixed(1)} ms`,
      );
    }
    results.runs.push({
      n,
      requested: backend,
      backend: real,
      firstRenderMs: median(firsts),
      panMedianMs: median(workMed),
      panP95Ms: median(workP95),
      heapMB: median(heaps),
      // Los Float64Array viven fuera del heap de V8: 2 columnas × n × 8 bytes, más el buffer
      // float32 relativo que WebGL sube (2 × n × 4 bytes).
      columnsMB: (2 * n * 8) / 2 ** 20,
      gpuBufferMB: real === 'webgl' ? (2 * n * 4) / 2 ** 20 : 0,
    });
  }
}

await browser.close();
server.close();
writeFileSync(OUT, JSON.stringify(results, null, 2));

const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
let md =
  '| Puntos | Backend | Primer dibujo (ms) | Pan, mediana (ms) | Pan, p95 (ms) | Heap JS (MB) | Columnas float64 (MB) | Buffer GPU (MB) |\n';
md += '|---:|---|---:|---:|---:|---:|---:|---:|\n';
for (const r of results.runs) {
  md += `| ${r.n.toLocaleString('es-MX')} | ${r.backend} | ${fmt(r.firstRenderMs, 0)} | ${fmt(r.panMedianMs)} | ${fmt(r.panP95Ms)} | ${fmt(r.heapMB)} | ${fmt(r.columnsMB)} | ${fmt(r.gpuBufferMB)} |\n`;
}
console.log(md);

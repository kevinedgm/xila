#!/usr/bin/env node
// Recorrido rápido de todas las páginas del sitio con Chromium: HTTP 200, consola limpia, ejemplos vivos dibujados
// (se recorre la página para vencer el render diferido) y sin desplazamiento horizontal. Para iterar con dev o preview.
//
//   node sitio/scripts/comprobar-paginas.mjs [--base http://localhost:4300/xila/] [--width 1280] [ruta…]
//
// Sin rutas, recorre todas las de sitio/src/.site-data.json (ejecuta antes el generador).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const base = opt('base', 'http://localhost:4300/xila/');
const width = Number(opt('width', '1280'));
const data = JSON.parse(fs.readFileSync(path.join(here, '../src/.site-data.json'), 'utf8'));
const rutas = args.length ? args : data.pages.map((p) => p.url.replace(/^\//, ''));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height: 900 } });
let failures = 0;
for (const ruta of rutas) {
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type()))
      problems.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 300)}`));
  const res = await page.goto(base + ruta, { waitUntil: 'networkidle' });
  if (!res || res.status() !== 200) problems.push(`HTTP ${res?.status()}`);
  const info = await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 1500));
    return {
      demos: document.querySelectorAll('.x-demo, .x-live').length,
      canvases: document.querySelectorAll('.x-demo canvas, .x-live canvas').length,
      errors: [...document.querySelectorAll('.x-demo__error')].map((e) => e.textContent),
      h1: document.querySelectorAll('h1').length,
      hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (info.demos && info.canvases < info.demos)
    problems.push(`${info.canvases}/${info.demos} ejemplos dibujados`);
  for (const e of info.errors) problems.push(`ejemplo con error: ${e}`);
  if (info.h1 !== 1) problems.push(`${info.h1} h1`);
  if (info.hscroll > 0) problems.push(`desplazamiento horizontal de ${info.hscroll} px`);
  const ok = problems.length === 0;
  if (!ok) failures++;
  console.log(
    `${ok ? 'ok ' : 'FAIL'} /${ruta}  ${info.demos ? `${info.canvases}/${info.demos} ejemplos` : ''}${ok ? '' : '\n     ' + problems.join('\n     ')}`,
  );
  await page.close();
}
await browser.close();
console.log(
  failures ? `${failures} páginas con problemas` : `${rutas.length} páginas sin problemas`,
);
process.exit(failures ? 1 : 0);

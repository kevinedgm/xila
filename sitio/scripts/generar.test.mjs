// Pruebas del generador (node --test): el plan de páginas sale entero de las fuentes, cada valla `ts demo` llega a su
// módulo, los enlaces internos quedan resueltos, el índice cubre todas las páginas y los controles de la ficha
// coinciden con las uniones de tipos de packages/core/src/config.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, PAGINAS, INDICE, NAV, discoverAdrs, homeData } from './generar.mjs';
import * as lib from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const r = generate({ root, write: false });
const readRoot = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('cada página del plan se genera y las decisiones salen de docs/adr', () => {
  const ids = new Set(r.pages.map((p) => p.id));
  for (const p of PAGINAS) assert.ok(ids.has(p.id), `falta la página ${p.id}`);
  const adrs = discoverAdrs(root);
  assert.ok(adrs.length >= 6);
  for (const a of adrs)
    assert.ok(ids.has(`referencia/decisiones/${a.id}`), `falta la decisión ${a.id}`);
  assert.equal(r.files.size, r.pages.length);
});

test('las vallas `ts demo` de docs/ llegan a sitio/src/.demos y la portada tiene su muestra', () => {
  const docs = ['docs/galeria.md', 'docs/guia/primer-grafico.md', 'docs/guia/plugin.md'];
  let esperados = 0;
  for (const d of docs)
    esperados += lib.extractDemos(readRoot(d)).filter((s) => s.type === 'demo').length;
  assert.equal(r.demoFiles.size, esperados);
  for (const [, code] of r.demoFiles) {
    assert.match(code, /export default/, 'cada demo exporta por defecto');
    assert.doesNotMatch(
      code,
      /from '\.\/datos'/,
      'la importación de los ayudantes se reescribe a @demos/datos',
    );
  }
  const galeria = r.pages.find((p) => p.id === 'galeria');
  assert.ok(galeria.demoCount >= 26, `la galería tiene ${galeria.demoCount} ejemplos vivos`);
  const h2 = lib.parseHeadings(readRoot('docs/galeria.md')).filter((h) => h.level === 2).length;
  assert.equal(galeria.sections, h2, 'cada sección de la galería recibe su número');
  assert.match(r.files.get('index.md'), /@demos\/portada\.ts/);
});

test('la portada lee del README las preguntas, las ventajas y el estado, y cada pregunta lleva a la galería', () => {
  const titulos = lib
    .parseHeadings(readRoot('docs/galeria.md'))
    .filter((x) => x.level === 2)
    .map((x) => x.text);
  const h = homeData(readRoot('README.md'), titulos);
  assert.ok(h.preguntas.length >= 14);
  assert.ok(h.features.length >= 4);
  assert.match(h.estado, /experimental/);
  const sinDestino = h.preguntas.filter((q) => !q.href).map((q) => q.nombre);
  assert.deepEqual(sinDestino, [], 'toda alternativa de la tabla tiene su sección en la galería');
});

test('ningún enlace relativo queda sin resolver y no hay avisos del generador', () => {
  for (const [file, text] of r.files) {
    for (const href of lib.listLinks(text)) {
      if (
        lib.isExternal(href) ||
        href.startsWith('#') ||
        href.startsWith('/') ||
        href.startsWith('mailto:')
      )
        continue;
      assert.fail(`${file}: enlace relativo sin resolver «${href}»`);
    }
  }
  assert.deepEqual(r.warnings, []);
});

test('las fichas interactivas de la guía de tipos cubren los siete tipos', () => {
  const tipos = r.files.get('guia/tipos.md');
  for (const t of ['line', 'bar', 'scatter', 'box', 'heatmap', 'dots', 'waffle']) {
    assert.match(tipos, new RegExp(`<XilaLive chart="${t}" />`), `falta la ficha ${t}`);
    assert.ok(fs.existsSync(path.join(root, `sitio/live/${t}.ts`)), `falta sitio/live/${t}.ts`);
  }
});

test('el índice y la barra cubren todas las páginas (salvo la portada) y los números no se repiten', () => {
  const inIndex = new Set(r.sidebar.flatMap((g) => g.items.map((i) => i.id)));
  for (const p of r.pages)
    if (!p.home) assert.ok(inIndex.has(p.url), `${p.url} no está en el índice`);
  for (const g of INDICE) assert.ok(r.sidebar.some((x) => x.id === g.id));
  const codes = r.sidebar.flatMap((g) => g.items.map((i) => i.code).filter(Boolean));
  assert.equal(new Set(codes).size, codes.length);
  for (const n of NAV)
    if (!n.external)
      assert.ok(
        r.pages.some((p) => p.url === n.href),
        `la barra apunta a ${n.href}, que no existe`,
      );
  const withPrev = r.pages.filter((p) => p.prev).length;
  assert.ok(withPrev >= r.pages.length - 3, 'las vecinas siguen el orden del índice');
});

test('los controles enumerados de la ficha coinciden con las uniones de config.ts', () => {
  const src = readRoot('packages/core/src/config.ts');
  const txt = readRoot('sitio/live/controles.ts');
  const bloques = [...txt.matchAll(/^ {2}(\w+): \{\n {4}grupo: '(\w+)',([\s\S]*?)\n {2}\},\n/gm)];
  assert.ok(bloques.length >= 7, `siete tipos con controles (hay ${bloques.length})`);
  for (const [, , grupo, cuerpo] of bloques) {
    const grupoSrc = src.slice(src.indexOf(`readonly ${grupo}?: {`));
    for (const m of cuerpo.matchAll(/\{ key: '(\w+)', values: \[([^\]]+)\], kind: 'enum' \}/g)) {
      const [, key, values] = m;
      const declared = values.split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
      const union = grupoSrc.match(new RegExp(`readonly ${key}\\?: ([^;]+);`));
      assert.ok(union, `${grupo}.${key} no está en config.ts`);
      const literals = [...union[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      assert.deepEqual(
        [...declared].sort(),
        [...literals].sort(),
        `${grupo}.${key}: la ficha dice ${declared} y config.ts ${literals}`,
      );
    }
  }
});

test('la forma del índice de búsqueda local de VitePress (@localSearchIndex) no cambió', () => {
  const dist = path.join(root, 'sitio/.vitepress/dist');
  if (!fs.existsSync(dist)) return; // sin build no se comprueba
  const chunks = fs
    .readdirSync(path.join(dist, 'assets/chunks'))
    .filter((f) => /^@localSearchIndexroot\./.test(f));
  assert.equal(chunks.length, 1, 'un índice para el idioma raíz');
  const text = fs.readFileSync(path.join(dist, 'assets/chunks', chunks[0]), 'utf8');
  assert.match(text, /storedFields/);
  assert.match(text, /titles/);
});

#!/usr/bin/env node
// Genera las páginas del sitio (sitio/src/, ignorado por git) desde una sola fuente de verdad:
//   - README.md raíz          → inicio, empezar, formas, motor, dashboards para clientes, publicar
//   - docs/**/*.md            → guías, galería, plugins, configuración, dashboards, documentación técnica, benchmarks, ADR
//   - packages/*/README.md, plantilla/README.md, marca/README.md, CONTRIBUTING.md → referencia y proyecto
// Ejemplos vivos: vallas ```ts demo del Markdown (convención en sitio/README.md), escritas a
// sitio/src/.demos/<página>-<n>.ts y pintadas con <XilaDemo>. Fichas interactivas: <!-- ficha: <tipo> -->.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as lib from './lib.mjs';

const SITIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_URL = 'https://github.com/kevinedgm/xila';
export const ADR_DIR = 'docs/adr';

/**
 * Plan de páginas. `file` + `sections`: los `##` del README raíz (por el comienzo del título) que forman
 * la página; `file` solo: el documento entero (su `#` es el título). `home`: la portada. `adrs`: índice de
 * decisiones (una página más por archivo de docs/adr/). `numbered`: los `##` reciben un número estable.
 */
export const PAGINAS = [
  { id: 'index', file: 'README.md', sections: ['Qué es Xila hoy'], home: true, title: 'Xila' },
  {
    id: 'guia/empezar',
    file: 'README.md',
    sections: ['Estructura', 'Cómo correrlo'],
    title: 'Empezar',
  },
  { id: 'guia/primer-grafico', file: 'docs/guia/primer-grafico.md' },
  { id: 'guia/tipos', file: 'docs/guia/tipos.md' },
  { id: 'guia/plugin', file: 'docs/guia/plugin.md' },
  { id: 'guia/dashboards', file: 'docs/guia/dashboards.md' },
  { id: 'guia/rendimiento', file: 'docs/guia/rendimiento.md' },
  { id: 'galeria', file: 'docs/galeria.md', numbered: true },
  {
    id: 'formas',
    file: 'README.md',
    sections: ['Histogramas', 'Gráfico de unidades', 'Unidades del total', 'Box plot', 'Heatmap'],
    title: 'Formas',
    intro:
      'Lo que hace el núcleo con cada forma: cómo se calcula, qué claves la cambian y qué ejemplo la enseña. Las alternativas a cada forma clásica están en la [galería](/galeria).',
  },
  {
    id: 'motor',
    file: 'README.md',
    sections: ['Render diferido', 'Escalas', 'Incertidumbre', 'Backends'],
    title: 'Motor',
    intro:
      'Lo que pasa por debajo de todo gráfico: cuándo se dibuja, cómo se escala, cómo se declara la incertidumbre y quién pinta los puntos.',
  },
  {
    id: 'dashboards/',
    file: 'README.md',
    sections: ['Dashboards para clientes'],
    title: 'Dashboards para clientes',
  },
  { id: 'dashboards/configuracion', file: 'docs/configuracion-dashboard.md' },
  { id: 'dashboards/contrato-csv', file: 'docs/contrato-csv.md' },
  { id: 'dashboards/plantilla', file: 'plantilla/README.md' },
  { id: 'dashboards/despliegue', file: 'docs/despliegue.md' },
  { id: 'referencia/configuracion', file: 'docs/configuracion.md' },
  { id: 'referencia/plugins', file: 'docs/plugins.md' },
  { id: 'referencia/documentacion-tecnica', file: 'docs/documentacion-tecnica.md' },
  { id: 'referencia/xilaplot', file: 'packages/core/README.md' },
  { id: 'referencia/xilaplot-vue', file: 'packages/vue/README.md' },
  { id: 'referencia/benchmarks', file: 'docs/benchmarks.md' },
  { id: 'referencia/decisiones/', adrs: true, title: 'Decisiones' },
  { id: 'referencia/marca', file: 'marca/README.md', marca: true },
  { id: 'proyecto/contribuir', file: 'CONTRIBUTING.md' },
  {
    id: 'proyecto/publicar',
    file: 'README.md',
    sections: ['Publicar en npm', 'Licencia', 'Benchmark del prototipo'],
    title: 'Publicar y licencia',
  },
];

/** Índice izquierdo: grupos de páginas (por `id`). `api` es la referencia generada con TypeDoc. */
export const INDICE = [
  {
    id: 'guia',
    label: 'Guía',
    items: [
      'guia/empezar',
      'guia/primer-grafico',
      'guia/tipos',
      'guia/plugin',
      'guia/dashboards',
      'guia/rendimiento',
    ],
  },
  { id: 'formas', label: 'Formas', items: ['galeria', 'formas', 'motor'] },
  {
    id: 'dashboards',
    label: 'Dashboards',
    items: [
      'dashboards/',
      'dashboards/configuracion',
      'dashboards/contrato-csv',
      'dashboards/plantilla',
      'dashboards/despliegue',
    ],
  },
  {
    id: 'referencia',
    label: 'Referencia',
    items: [
      'referencia/configuracion',
      'referencia/plugins',
      'referencia/documentacion-tecnica',
      'api',
      'referencia/xilaplot',
      'referencia/xilaplot-vue',
      'referencia/benchmarks',
      'referencia/decisiones/',
      'referencia/marca',
    ],
  },
  { id: 'proyecto', label: 'Proyecto', items: ['proyecto/contribuir', 'proyecto/publicar'] },
];

/** Barra superior. `match` es la expresión (sin `base`) que marca el enlace como actual. */
export const NAV = [
  { id: 'guia', label: 'Guía', href: '/guia/empezar', match: '^/guia/' },
  { id: 'galeria', label: 'Galería', href: '/galeria', match: '^/(galeria|formas|motor)$' },
  { id: 'dashboards', label: 'Dashboards', href: '/dashboards/', match: '^/dashboards/' },
  {
    id: 'referencia',
    label: 'Referencia',
    href: '/referencia/configuracion',
    match: '^/(referencia/|api/)',
  },
  { id: 'github', label: 'GitHub', href: REPO_URL, external: true },
];

/** Etiquetas cortas del índice cuando el `#` del documento es largo. */
const ETIQUETAS = {
  'referencia/documentacion-tecnica': 'Documentación técnica',
  'referencia/configuracion': 'Configuración del gráfico',
  'referencia/plugins': 'Plugins incluidos',
  'dashboards/configuracion': 'Configuración',
  'dashboards/contrato-csv': 'Contrato de CSV',
  'dashboards/plantilla': 'Plantilla',
  'dashboards/despliegue': 'Despliegue',
  'dashboards/': 'Para clientes',
  'referencia/benchmarks': 'Benchmarks',
  'proyecto/contribuir': 'Contribuir',
  'referencia/marca': 'Marca',
  'guia/primer-grafico': 'Primer gráfico',
  'guia/tipos': 'Tipos de gráfico',
  'guia/plugin': 'Crear un plugin',
  'guia/dashboards': 'Dashboards desde CSV',
  'guia/rendimiento': 'Rendimiento',
};

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const pageUrl = (id) => (id === 'index' ? '/' : '/' + id);
const pageFile = (id) =>
  id === 'index' ? 'index.md' : id.endsWith('/') ? id + 'index.md' : id + '.md';
const pageSlug = (id) => (id === 'index' ? 'inicio' : id.replace(/\/$/, '').replace(/\//g, '-'));
export const formatCode = (n) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ descubrimiento */

/** Decisiones de arquitectura: [{ file, id, number, title, status }] en orden de número. */
export function discoverAdrs(root) {
  const dir = path.join(root, ADR_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort()
    .map((f) => {
      const text = read(root, `${ADR_DIR}/${f}`);
      const { title } = lib.stripH1(text);
      const linea = (text.match(/^\*{0,2}Estado:?\*{0,2}:?\s*(.+)$/m) || [])[1] || '';
      const status = linea.split(/\s*·\s*/)[0];
      const date = (linea.match(/Fecha:\*{0,2}\s*([\d-]+)/) || [])[1] || '';
      return {
        file: `${ADR_DIR}/${f}`,
        id: f.replace(/\.md$/, ''),
        number: Number(f.slice(0, 4)),
        title: (title || f).replace(/^ADR\s+\d+\s*[·:-]\s*/, ''),
        status: lib.plainText(status),
        date,
      };
    });
}

/* ------------------------------------------------------------------ portada */

/**
 * Datos de la portada desde el README: la descripción (primer párrafo tras el `#`), el aviso de estado
 * (`> **Estado:**`), la introducción de «Qué es Xila hoy», la tabla pregunta → forma → alternativa y los
 * párrafos `**Título.** texto` como ventajas.
 */
export function homeData(readme, galleryHeadings = []) {
  const { preamble, sections } = lib.splitSections(readme, 2);
  const pre = lib.stripH1(preamble).body;
  const prePars = lib.paragraphs(pre).filter((p) => !/^</.test(p));
  const estado = (pre.match(/^>\s*\*\*Estado:\*\*\s*(.*)$/m) || [])[1] || '';
  const sec = sections.find((s) => s.title.startsWith('Qué es Xila hoy'));
  if (!sec) throw new Error('README.md: no existe la sección «Qué es Xila hoy»');
  const pars = lib.paragraphs(sec.text);
  // El primer párrafo («**Parte de la pregunta del lector…** Cada forma…») presenta la tabla: es la entradilla.
  const bold = pars.filter((p) => /^\*\*[^*]+\*\*/.test(p));
  const intro = lib.inlineHtml(
    (bold[0] || '').replace(/^\*\*([^*]+?)\.?\*\*\s*/, '$1. ').replace(/:\s*$/, '.'),
  );
  const features = bold.slice(1).map((p) => {
    const m = p.match(/^\*\*([^*]+?)\.?\*\*\s*(.*)$/);
    return { title: lib.inlineHtml(m[1]), details: lib.inlineHtml(m[2]) };
  });
  const slug = lib.uniqueSlugger(lib.vpSlug);
  const anchors = new Map(galleryHeadings.map((h) => [h.toLowerCase(), slug(h)]));
  const { rows } = lib.tableRows(sec.text);
  const preguntas = rows.map(([pregunta, clasica, alternativa]) => {
    const nombre = (alternativa.match(/\*\*([^*]+)\*\*/) || [])[1] || lib.plainText(alternativa);
    const resto = lib.plainText(alternativa.replace(/\*\*[^*]+\*\*\s*/, ''));
    const dm = resto.match(/^\(([^)]*)\)\s*:?\s*(.*)$/);
    const code = dm ? dm[1] : '';
    const detalle = dm ? dm[2] : resto;
    // «Unidades» en la tabla es «Casos como unidades» en la galería; «Un punto por año» igual en las dos.
    const key = [nombre, `casos como ${nombre}`]
      .map((k) => k.toLowerCase())
      .find((k) => anchors.has(k));
    return {
      pregunta: lib.plainText(pregunta),
      clasica: lib.plainText(clasica),
      nombre,
      code,
      detalle,
      href: key ? `/galeria#${anchors.get(key)}` : null,
    };
  });
  const estadoText = lib
    .plainText(estado)
    .replace(/<(https?:[^>]+)>/g, '$1')
    .split(/\s+Documentación:/)[0];
  return {
    description: lib.plainText(prePars[0] || ''),
    estado: estadoText,
    intro,
    features,
    preguntas,
  };
}

/* ------------------------------------------------------------------ plan */

function buildPlan(root) {
  const warnings = [];
  const pages = [];
  const readme = read(root, 'README.md');
  const split = lib.splitSections(readme, 2);
  const readmeHeadings = lib.parseHeadings(readme);
  const adrs = discoverAdrs(root);
  const galleryHeadings = exists(root, 'docs/galeria.md')
    ? lib
        .parseHeadings(read(root, 'docs/galeria.md'))
        .filter((h) => h.level === 2)
        .map((h) => h.text)
    : [];

  const add = (page) => {
    page.url = pageUrl(page.id);
    page.file = pageFile(page.id);
    page.slug = pageSlug(page.id);
    pages.push(page);
    return page;
  };

  for (const p of PAGINAS) {
    if (p.adrs) {
      const index = add({ id: p.id, title: p.title, parts: [], adrIndex: true });
      const rows = [
        `# ${p.title}`,
        '',
        'Registros de decisiones de arquitectura (ADR): qué se decidió, por qué y qué se descartó. Cada uno es un archivo en `docs/adr/`; se enmiendan con uno nuevo, no se reescriben.',
        '',
        '| Nº | Decisión | Estado | Fecha |',
        '| --- | --- | --- | --- |',
        ...adrs.map(
          (a) =>
            `| \`${formatCode(a.number)}\` | [${a.title}](${pageUrl(`referencia/decisiones/${a.id}`)}) | ${a.status || '—'} | ${a.date || '—'} |`,
        ),
        '',
      ];
      index.parts.push({ kind: 'gen', text: rows.join('\n') });
      for (const a of adrs) {
        const text = read(root, a.file);
        const { title, body } = lib.stripH1(text);
        const page = add({
          id: `referencia/decisiones/${a.id}`,
          title: title || a.id,
          adr: a,
          parts: [],
        });
        page.parts.push({ kind: 'gen', text: `# ${page.title}\n` });
        page.parts.push({ kind: 'src', doc: a.file, text: body, headingOffset: 1 });
        page.parts.push(sourceNote(a.file));
      }
      continue;
    }
    if (p.sections) {
      const idx = p.sections.map((name) => {
        const i = split.sections.findIndex((s) => s.title.startsWith(name));
        if (i === -1) throw new Error(`README.md: no existe la sección «${name}» (página ${p.id})`);
        return i;
      });
      const page = add({ id: p.id, title: p.title, home: !!p.home, parts: [] });
      if (p.home) {
        page.homeData = homeData(readme, galleryHeadings);
        // La portada enseña una muestra en vivo (sitio/demos/portada.ts) y nada más del README: el resto tiene su página.
        if (exists(root, 'sitio/demos/portada.ts'))
          page.parts.push({ kind: 'demo', file: 'sitio/demos/portada.ts', height: 440 });
        continue;
      }
      const promote = idx.length === 1;
      if (!promote)
        page.parts.push({
          kind: 'gen',
          text: `# ${page.title}\n` + (p.intro ? `\n${p.intro}\n` : ''),
        });
      for (const i of idx) {
        const sec = split.sections[i];
        const offset = readmeHeadings.findIndex((h) => h.level === 2 && h.text === sec.title);
        page.parts.push({
          kind: 'src',
          doc: 'README.md',
          text: promote ? lib.promoteHeadings(sec.text) : sec.text,
          headingOffset: offset,
        });
      }
      page.parts.push(sourceNote('README.md'));
      continue;
    }
    // documento entero
    const text = read(root, p.file);
    const { title, body } = lib.stripH1(text);
    const page = add({
      id: p.id,
      title: p.title || title || p.id,
      parts: [],
      marca: !!p.marca,
      numbered: !!p.numbered,
    });
    page.parts.push({ kind: 'gen', text: `# ${page.title}\n` });
    let n = 0;
    let offset = 1;
    for (const seg of lib.extractDemos(body)) {
      if (seg.type === 'md') {
        let md = seg.text;
        if (p.numbered) {
          md = lib
            .scanLines(md)
            .map((l) =>
              !l.fence && /^##\s/.test(l.line)
                ? `${l.line.replace(/\s+$/, '')} {data-n="${formatCode(++n)}"}`
                : l.line,
            )
            .join('\n');
        }
        page.parts.push({ kind: 'src', doc: p.file, text: md, headingOffset: offset });
        offset += lib.parseHeadings(seg.text).length;
      } else if (seg.type === 'demo')
        page.parts.push({ kind: 'demo', code: seg.code, height: seg.height });
      else page.parts.push({ kind: 'ficha', chart: seg.chart });
    }
    page.demoCount = page.parts.filter((x) => x.kind === 'demo').length;
    page.sections = n;
    if (p.marca) page.parts.push({ kind: 'gen', text: marcaGallery(root) });
    page.parts.push(sourceNote(p.file));
  }
  return { pages, warnings, adrs };
}

const sourceNote = (rel) => ({
  kind: 'gen',
  text: `<p class="x-source">Fuente: <a href="${REPO_URL}/blob/main/${rel}"><code>${rel}</code></a></p>\n`,
});

/** La página de marca enseña los archivos SVG de `marca/` tal cual, claro y oscuro. */
function marcaGallery(root) {
  const files = fs
    .readdirSync(path.join(root, 'marca'))
    .filter((f) => f.endsWith('.svg'))
    .sort();
  const items = files
    .map(
      (f) =>
        `  <figure class="x-marca__item"><img src="${REPO_URL.replace('github.com', 'raw.githubusercontent.com')}/main/marca/${f}" alt="" width="96" height="96" loading="lazy"><figcaption><code>${f}</code></figcaption></figure>`,
    )
    .join('\n');
  return `## Archivos\n\nLos archivos de \`marca/\`, sobre manta y sobre tinta:\n\n<div class="x-marca x-marca--claro">\n${items}\n</div>\n\n<div class="x-marca x-marca--oscuro">\n${items}\n</div>\n`;
}

/* ------------------------------------------------------------------ anclas y enlaces */

function ghHeadings(text) {
  const slug = lib.uniqueSlugger(lib.ghSlug);
  return lib.parseHeadings(text).map((h) => ({ ...h, gh: slug(h.text) }));
}

/** Para cada documento y slug de GitHub, la página y el slug de VitePress finales. */
function anchorMap(plan, root) {
  const map = new Map();
  const docMain = new Map();
  const cache = new Map();
  const ghOf = (rel) => {
    if (!cache.has(rel)) cache.set(rel, ghHeadings(read(root, rel)));
    return cache.get(rel);
  };
  for (const page of plan.pages) {
    const slug = lib.uniqueSlugger(lib.vpSlug);
    for (const part of page.parts) {
      if (part.kind !== 'gen' && part.kind !== 'src') continue;
      const hs = lib.parseHeadings(part.text);
      if (part.kind === 'gen') {
        hs.forEach((h) => slug(h.text));
        continue;
      }
      if (!docMain.has(part.doc)) docMain.set(part.doc, page.url);
      const docHs = ghOf(part.doc);
      hs.forEach((h, i) => {
        const vp = slug(h.text);
        const gh = docHs[part.headingOffset + i]?.gh;
        if (gh && !map.has(`${part.doc}#${gh}`))
          map.set(`${part.doc}#${gh}`, { url: page.url, slug: vp });
      });
    }
  }
  // README.md: su página «principal» es la portada solo para enlaces sin ancla; con ancla manda el mapa.
  return { map, docMain };
}

function linkResolver({ root, page, part, anchors, warnings }) {
  return (href) => {
    if (lib.isExternal(href) || href.startsWith('mailto:')) return null;
    const { file, hash } = lib.splitHref(href);
    let doc = part.doc;
    let target = part.doc;
    if (file) {
      target = lib.repoPath(part.doc, decodeURI(file));
      doc = target;
    }
    const decoded = hash ? decodeURIComponent(hash) : '';
    const known = anchors.docMain.get(doc);
    if (known) {
      if (decoded) {
        const hit = anchors.map.get(`${doc}#${decoded}`);
        if (hit) return hit.url === page.url ? `#${hit.slug}` : `${hit.url}#${hit.slug}`;
        warnings.push(`${part.doc}: ancla #${decoded} no encontrada en ${doc}`);
        return known === page.url ? `#${decoded}` : known;
      }
      return known;
    }
    if (!file) return null;
    const abs = path.join(root, target);
    if (!fs.existsSync(abs)) {
      warnings.push(`${part.doc}: enlace a ${target}, que no existe`);
      return `${REPO_URL}/blob/main/${target}${hash ? '#' + hash : ''}`;
    }
    const kind = fs.statSync(abs).isDirectory() ? 'tree' : 'blob';
    return `${REPO_URL}/${kind}/main/${target.replace(/\/$/, '')}${hash ? '#' + hash : ''}`;
  };
}

/* ------------------------------------------------------------------ escritura */

const yaml = (v) => JSON.stringify(v);

function renderPage(page, ctx) {
  const imports = [];
  const body = [];
  let n = 0;
  for (const part of page.parts) {
    if (part.kind === 'gen') body.push(part.text);
    else if (part.kind === 'src') {
      const text = lib.rewriteLinks(part.text, linkResolver({ ...ctx, page, part }));
      // v-pre: el texto de los documentos no se compila como plantilla de Vue ({{ }}, etiquetas).
      body.push(`<div v-pre>\n\n${text.trim()}\n\n</div>\n`);
    } else if (part.kind === 'demo') {
      n++;
      const name = `Demo${n}`;
      let spec;
      let code;
      if (part.file) {
        spec = `@demos/${path.basename(part.file)}`;
        code = ctx.read(part.file);
      } else {
        const file = `${page.slug}-${n}.ts`;
        ctx.demoFiles.set(
          file,
          part.code.replace(/(['"])\.\/datos\1/g, "'@demos/datos'").trimEnd() + '\n',
        );
        spec = `@gen-demos/${file}`;
        code = part.code;
      }
      imports.push(`import ${name} from '${spec}'`);
      const fence = code.includes('```') ? '````' : '```';
      body.push(
        `<XilaDemo :cargar="${name}"${part.height ? ` :height="${part.height}"` : ''} />\n\n<details class="x-code"><summary>Código</summary>\n\n${fence}ts\n${code.trim()}\n${fence}\n\n</details>\n`,
      );
    } else if (part.kind === 'ficha') {
      body.push(`<ClientOnly><XilaLive chart="${part.chart}" /></ClientOnly>\n`);
    }
  }
  const fm = ['---', `title: ${yaml(page.title)}`];
  if (page.description) fm.push(`description: ${yaml(page.description)}`);
  if (page.prev) fm.push(`prev: ${yaml(page.prev)}`);
  if (page.next) fm.push(`next: ${yaml(page.next)}`);
  if (page.home) {
    fm.push('layout: home');
    fm.push(`description: ${yaml(page.homeData.description)}`);
    fm.push(`home: ${yaml(page.homeData)}`);
  }
  fm.push('---', '');
  const out = [fm.join('\n')];
  if (imports.length) out.push(`<script setup>\n${imports.join('\n')}\n</script>\n`);
  out.push(body.join('\n'));
  return out.join('\n');
}

/** Índice izquierdo con los grupos de INDICE; etiqueta = la corta o el título de la página; números en galería y ADR. */
function sidebarFor(plan) {
  const byId = new Map(plan.pages.map((p) => [p.id, p]));
  const groups = INDICE.map((g) => ({
    id: g.id,
    label: g.label,
    items: g.items.flatMap((id) => {
      if (id === 'api')
        return [
          {
            id: '/api/',
            label: 'API (TypeDoc)',
            href: '/api/',
            keywords: ['typedoc', 'api', 'tipos'],
            external: 'self',
          },
        ];
      const p = byId.get(id);
      if (!p) throw new Error(`INDICE: la página «${id}» no existe en el plan`);
      const item = {
        id: p.url,
        label: ETIQUETAS[id] || p.title,
        href: p.url,
        keywords: [id.replace(/\//g, ' ').trim()],
      };
      if (p.adrIndex) {
        return [
          item,
          ...plan.adrs.map((a) => ({
            id: pageUrl(`referencia/decisiones/${a.id}`),
            label: a.title,
            href: pageUrl(`referencia/decisiones/${a.id}`),
            code: formatCode(a.number),
            keywords: ['adr', a.id],
          })),
        ];
      }
      return [item];
    }),
  }));
  return groups;
}

/** Anterior y siguiente por el orden del índice. */
function linkNeighbours(pages, groups) {
  const order = groups.flatMap((g) => g.items).filter((i) => i.href && !i.external);
  const at = new Map(order.map((o, i) => [o.href, i]));
  const brief = (o) => (o ? { text: o.label, link: o.href } : undefined);
  for (const page of pages) {
    const i = at.get(page.url);
    if (i == null) continue;
    page.prev = brief(order[i - 1]);
    page.next = brief(order[i + 1]);
  }
}

/** Escribe solo lo que cambió y borra lo que ya no se genera. */
function writeTree(out, all) {
  const existing = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else existing.push(path.relative(out, abs).split(path.sep).join('/'));
    }
  };
  walk(out);
  for (const rel of existing) if (!all.has(rel)) fs.rmSync(path.join(out, rel));
  for (const [rel, text] of all) {
    const abs = path.join(out, rel);
    if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === text) continue;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}

export function generate({
  root = path.resolve(SITIO, '..'),
  out = path.join(SITIO, 'src'),
  write = true,
} = {}) {
  const plan = buildPlan(root);
  const warnings = [...plan.warnings];
  const sidebar = sidebarFor(plan);
  linkNeighbours(plan.pages, sidebar);
  const anchors = anchorMap(plan, root);
  const demoFiles = new Map();
  const ctx = { root, anchors, warnings: [], demoFiles, read: (rel) => read(root, rel) };
  const files = new Map();
  for (const page of plan.pages) files.set(page.file, renderPage(page, ctx));
  warnings.push(...new Set(ctx.warnings));
  const data = {
    nav: NAV,
    sidebar,
    pages: plan.pages.map((p) => ({
      id: p.id,
      url: p.url,
      title: p.title,
      demos: p.demoCount || 0,
      sections: p.sections || 0,
    })),
  };
  if (write) {
    const all = new Map(files);
    for (const [rel, text] of demoFiles) all.set(`.demos/${rel}`, text);
    all.set('.site-data.json', JSON.stringify(data, null, 2) + '\n');
    writeTree(out, all);
  }
  return { pages: plan.pages, files, demoFiles, sidebar, data, warnings };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t0 = performance.now();
  const r = generate();
  const demos = [...r.pages].reduce(
    (n, p) => n + (p.parts.filter((x) => x.kind === 'demo').length || 0),
    0,
  );
  console.log(
    `sitio generado: ${r.files.size} páginas, ${demos} ejemplos vivos, ${Math.round(performance.now() - t0)} ms`,
  );
  for (const w of r.warnings) console.warn('aviso:', w);
}

// Utilidades puras del generador del sitio: vallas, encabezados y slugs, secciones, enlaces y
// ejemplos vivos marcados en el Markdown. Sin dependencias: se prueban con `node --test`.
// Misma forma que `site/scripts/lib.mjs` del sitio de Grana (mismo autor), adaptada a Xila.

import path from 'node:path';

/* ------------------------------------------------------------------ líneas y vallas */

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

/** Recorre las líneas marcando si están dentro de un bloque de código cercado. */
export function scanLines(md) {
  const lines = md.split('\n');
  const out = [];
  let open = null; // { char, len }
  for (const line of lines) {
    const m = line.match(FENCE);
    if (!open && m) {
      open = { char: m[2][0], len: m[2].length };
      out.push({ line, fence: 'open', info: m[3].trim(), indent: m[1].length });
      continue;
    }
    if (open && m && m[2][0] === open.char && m[2].length >= open.len && m[3].trim() === '') {
      open = null;
      out.push({ line, fence: 'close' });
      continue;
    }
    out.push({ line, fence: open ? 'inside' : null });
  }
  return out;
}

/* ------------------------------------------------------------------ encabezados */

/** Texto visible de un encabezado Markdown (sin `**`, sin comillas invertidas, enlaces → texto). */
export function headingText(raw) {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s*\{[^}]*\}\s*$/, '')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .trim();
}

/** Slug de GitHub (github-slugger): minúsculas, fuera la puntuación, espacios → guiones. */
export function ghSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

// Slug de VitePress 1.6 (@mdit-vue/shared), copiado tal cual para que los anclajes coincidan.
// eslint-disable-next-line no-control-regex
const rControl = /[\u0000-\u001f]/g;
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|;:"'“”‘’<>,.?/]+/g;
const rCombining = /[̀-ͯ]/g;
export function vpSlug(str) {
  return str
    .normalize('NFKD')
    .replace(rCombining, '')
    .replace(rControl, '')
    .replace(rSpecial, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase();
}

/** Crea un asignador de slugs únicos (sufijo -1, -2… como GitHub y markdown-it-anchor). */
export function uniqueSlugger(fn) {
  const used = new Set();
  return (text) => {
    const base = fn(text);
    let slug = base;
    let n = 0;
    while (used.has(slug)) slug = `${base}-${++n}`;
    used.add(slug);
    return slug;
  };
}

/** Encabezados fuera de las vallas: [{ level, raw, text, line }]. */
export function parseHeadings(md) {
  const out = [];
  scanLines(md).forEach((l, i) => {
    if (l.fence) return;
    const m = l.line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (m) out.push({ level: m[1].length, raw: m[2], text: headingText(m[2]), line: i });
  });
  return out;
}

/* ------------------------------------------------------------------ secciones */

/** Parte un documento por encabezados de nivel `level`: { preamble, sections: [{ title, text }] }. */
export function splitSections(md, level = 2) {
  const lines = md.split('\n');
  const scan = scanLines(md);
  const sections = [];
  const preamble = [];
  let current = null;
  scan.forEach((l, i) => {
    const m = !l.fence && l.line.match(/^(#{1,6})\s+(.*)$/);
    if (m && m[1].length === level) {
      current = { title: headingText(m[2]), lines: [lines[i]] };
      sections.push(current);
    } else {
      (current ? current.lines : preamble).push(lines[i]);
    }
  });
  return {
    preamble: preamble.join('\n'),
    sections: sections.map((s) => ({
      title: s.title,
      text: s.lines.join('\n').replace(/\s+$/, '') + '\n',
    })),
  };
}

/** Sube un nivel todos los encabezados (## → #), fuera de las vallas. */
export function promoteHeadings(md) {
  return scanLines(md)
    .map((l) => (!l.fence && /^#{2,6}\s/.test(l.line) ? l.line.slice(1) : l.line))
    .join('\n');
}

/** Baja un nivel todos los encabezados (# → ##), fuera de las vallas. */
export function demoteHeadings(md) {
  return scanLines(md)
    .map((l) => (!l.fence && /^#{1,5}\s/.test(l.line) ? '#' + l.line : l.line))
    .join('\n');
}

/** Quita el primer encabezado de nivel 1 y lo devuelve aparte. */
export function stripH1(md) {
  const scan = scanLines(md);
  for (let i = 0; i < scan.length; i++) {
    if (scan[i].fence) continue;
    const m = scan[i].line.match(/^#\s+(.*)$/);
    if (m) {
      const lines = md.split('\n');
      lines.splice(i, 1);
      return { title: headingText(m[1]), body: lines.join('\n') };
    }
    if (scan[i].line.trim() !== '' && !/^\s*<(p|picture|img|source|\/)/.test(scan[i].line)) break;
  }
  return { title: null, body: md };
}

/* ------------------------------------------------------------------ ejemplos vivos y fichas */

/**
 * Convención de ejemplo vivo: un bloque cercado de primer nivel (sin sangría) con la información
 * `ts demo` (opcional `height=N`). Se pinta en vivo y se muestra su código, en el mismo sitio.
 * Una ficha interactiva se pide con el comentario `<!-- ficha: <tipo> -->` en su propia línea.
 * Devuelve segmentos [{ type: 'md', text } | { type: 'demo', code, height } | { type: 'ficha', chart }].
 */
export function extractDemos(md) {
  const scan = scanLines(md);
  const segments = [];
  let buf = [];
  let demo = null;
  const flush = () => {
    if (buf.length) segments.push({ type: 'md', text: buf.join('\n') });
    buf = [];
  };
  for (const l of scan) {
    if (!demo && l.fence === 'open' && l.indent === 0 && /^ts\s+demo\b/.test(l.info)) {
      flush();
      const h = l.info.match(/\bheight=(\d+)/);
      demo = { height: h ? Number(h[1]) : null, lines: [] };
      continue;
    }
    if (demo) {
      if (l.fence === 'close') {
        segments.push({ type: 'demo', code: demo.lines.join('\n'), height: demo.height });
        demo = null;
      } else demo.lines.push(l.line);
      continue;
    }
    const f = !l.fence && l.line.match(/^<!--\s*ficha:\s*([a-z]+)\s*-->\s*$/);
    if (f) {
      flush();
      segments.push({ type: 'ficha', chart: f[1] });
      continue;
    }
    buf.push(l.line);
  }
  if (demo) throw new Error('Bloque `ts demo` sin cerrar');
  flush();
  return segments;
}

/* ------------------------------------------------------------------ enlaces */

const LINK = /(!?)\[((?:[^\]\\]|\\.)*)\]\(\s*(<[^>]*>|[^)\s]+)(\s+"[^"]*")?\s*\)/g;

/** Aplica `fn` a los fragmentos de texto fuera de vallas y de código en línea. */
export function mapProse(md, fn) {
  const scan = scanLines(md);
  const out = [];
  let block = [];
  const flush = () => {
    if (!block.length) return;
    const text = block.join('\n');
    const codes = [];
    const masked = text.replace(/(`+)[\s\S]*?\1/g, (m) => `\u0000${codes.push(m) - 1}\u0000`);
    // eslint-disable-next-line no-control-regex
    out.push(fn(masked).replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]));
    block = [];
  };
  for (const l of scan) {
    if (l.fence) {
      flush();
      out.push(l.line);
    } else block.push(l.line);
  }
  flush();
  return out.join('\n');
}

/** Reescribe los destinos de los enlaces con `resolve(href)`, que devuelve el nuevo destino o `null`. */
export function rewriteLinks(md, resolve) {
  return mapProse(md, (text) =>
    text.replace(LINK, (all, bang, label, href, title = '') => {
      const clean = href.startsWith('<') ? href.slice(1, -1) : href;
      const next = resolve(clean, { image: !!bang });
      if (next == null) return all;
      return `${bang}[${label}](${next}${title})`;
    }),
  );
}

/** Lista los destinos de enlace de un documento (para pruebas y diagnósticos). */
export function listLinks(md) {
  const found = [];
  mapProse(md, (text) => {
    for (const m of text.matchAll(LINK))
      found.push(m[3].startsWith('<') ? m[3].slice(1, -1) : m[3]);
    return text;
  });
  return found;
}

/** Separa un destino en ruta y ancla. */
export function splitHref(href) {
  const i = href.indexOf('#');
  return i === -1 ? { file: href, hash: '' } : { file: href.slice(0, i), hash: href.slice(i + 1) };
}

export const isExternal = (href) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');

/** Resuelve un destino relativo de un documento del repositorio a una ruta del repositorio. */
export function repoPath(fromFile, file) {
  if (file.startsWith('/')) return file.replace(/^\/+/, '');
  return path.posix
    .normalize(path.posix.join(path.posix.dirname(fromFile), file))
    .replace(/^\.\//, '');
}

/* ------------------------------------------------------------------ tablas y párrafos */

/** Filas de la primera tabla Markdown del texto: [[celda, …], …] sin la cabecera ni el separador. */
export function tableRows(md) {
  const lines = md.split('\n');
  const rows = [];
  let header = null;
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) {
      if (header) break;
      continue;
    }
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim());
    if (!header) {
      header = cells;
      continue;
    }
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    rows.push(cells);
  }
  return { header: header || [], rows };
}

/** Párrafos del texto fuera de vallas, tablas y encabezados. */
export function paragraphs(md) {
  const out = [];
  let buf = [];
  for (const l of scanLines(md)) {
    const blank = l.line.trim() === '';
    const skip = l.fence || /^\s*(\||#|>|- |\* |\d+\. )/.test(l.line);
    if (blank || skip) {
      if (buf.length) out.push(buf.join(' '));
      buf = [];
      continue;
    }
    buf.push(l.line.trim());
  }
  if (buf.length) out.push(buf.join(' '));
  return out;
}

/** Markdown en línea → HTML sencillo (código, negrita, enlaces → texto). */
export function inlineHtml(md) {
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split(/(`[^`]*`)/g)
    .map((p, i) =>
      i % 2
        ? `<code>${p.slice(1, -1).replace(/</g, '&lt;')}</code>`
        : p.replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
    )
    .join('');
}

/** Texto plano de Markdown en línea (sin código, negrita ni enlaces). */
export function plainText(md) {
  return md
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\\\|/g, '|')
    .trim();
}

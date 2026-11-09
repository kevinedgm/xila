#!/usr/bin/env node
// Verificación de la auditoría del sitio (contraste, tamaño, foco, desbordes y movimiento), en Chromium sobre el sitio
// servido (preview en 4300 por defecto). Mide en claro y en oscuro: contraste de los textos del marco (≥ 4,5:1) y de
// las formas (puntada, ≥ 3:1), anillo de foco visible, tamaño de lo pulsable con puntero grueso (≥ 44 px), sin
// desplazamiento horizontal a 320 y 375 px, y que con `prefers-reduced-motion` no queda ninguna transición.
//
//   node sitio/scripts/auditoria-verificar.mjs [--base http://localhost:4300/xila/]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const i = args.indexOf('--base');
const base = i === -1 ? 'http://localhost:4300/xila/' : args[i + 1];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
};

/** Contraste WCAG entre el color de texto de un elemento y el fondo efectivo (primer antepasado con fondo opaco). */
const CONTRAST_JS = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const parse = (c) => {
    const m = (c.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number);
    return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  let node = el,
    bg = null;
  while (node && node !== document.documentElement) {
    const c = parse(getComputedStyle(node).backgroundColor);
    if (c.a >= 1) {
      bg = c;
      break;
    }
    node = node.parentElement;
  }
  if (!bg) bg = parse(getComputedStyle(document.documentElement).backgroundColor);
  const raw = parse(getComputedStyle(el).color);
  const fg =
    raw.a < 1
      ? {
          r: raw.r * raw.a + bg.r * (1 - raw.a),
          g: raw.g * raw.a + bg.g * (1 - raw.a),
          b: raw.b * raw.a + bg.b * (1 - raw.a),
        }
      : raw;
  const [a, b] = [lum(fg), lum(bg)];
  return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
};

const TEXTS = [
  ['.x-nav__link:not(.is-current)', 'banda · sección'],
  ['.x-nav__link.is-current', 'banda · sección actual'],
  ['.x-search-btn__text', 'banda · Buscar'],
  ['.x-index__title', 'índice · título de grupo'],
  ['.x-index__link:not(.is-current) .x-index__label', 'índice · item'],
  ['.x-index__link.is-current .x-index__label', 'índice · actual'],
  ['.x-index__code', 'índice · número'],
  ['.x-aside .x-toc__link:not(.is-active) .x-toc__text', 'en esta página · item'],
  ['.x-aside .x-toc__link.is-active .x-toc__text', 'en esta página · activa'],
  ['.x-pager__label', 'vecinas · etiqueta'],
  ['.x-pager__title', 'vecinas · título'],
  ['.x-source', 'fuente'],
  ['.vp-doc p', 'documento · párrafo'],
  ['.vp-doc a:not(.header-anchor)', 'documento · enlace'],
  ['.x-live__title', 'ficha · título'],
  ['.x-live__val.is-default', 'ficha · valor por defecto'],
  ['.x-live__val:not(.is-default)', 'ficha · valor cambiado'],
  ['.x-live__comment', 'ficha · comentario'],
  ['.x-live__theme-row dd', 'ficha · qué lee del tema'],
  ['.x-chip[aria-pressed="true"]', 'ficha · chip activo'],
  ['.x-chip[aria-pressed="false"]', 'ficha · chip'],
];
const SHAPES = [
  ['.x-index__link.is-current .x-stitch', 'índice · puntada'],
  ['.x-aside .x-toc__link.is-active .x-stitch', 'en esta página · puntada'],
];
const HOME = [
  ['.x-q__pregunta', 'portada · pregunta'],
  ['.x-q__clasica', 'portada · forma clásica'],
  ['.x-q__nombre', 'portada · alternativa'],
  ['.x-q__detalle', 'portada · detalle'],
  ['.x-q__code', 'portada · clave'],
  ['.x-hero__estado', 'portada · estado'],
  ['.x-hero__text', 'portada · descripción'],
  ['.x-feature__text', 'portada · ventaja'],
  ['.x-btn--brand', 'portada · botón principal'],
  ['.x-footer', 'pie'],
];

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.goto(`${base}guia/tipos`, { waitUntil: 'networkidle' });
  await page.evaluate((t) => localStorage.setItem('vitepress-theme-appearance', t), theme);
  await page.reload({ waitUntil: 'networkidle' });
  const actual = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check(`${theme}: data-theme`, actual === theme, actual);
  await page.locator('.x-live').first().scrollIntoViewIfNeeded();
  await page.locator('.x-live__val').first().click();
  for (const [sel, name] of TEXTS) {
    const c = await page.evaluate(CONTRAST_JS, sel);
    check(
      `${theme}: contraste ${name}`,
      c != null && c >= 4.5,
      c == null ? 'no encontrado' : `${c}:1`,
    );
  }
  for (const [sel, name] of SHAPES) {
    const c = await page.evaluate(CONTRAST_JS, sel);
    check(
      `${theme}: contraste forma ${name}`,
      c != null && c >= 3,
      c == null ? 'no encontrado' : `${c}:1`,
    );
  }
  // foco por teclado (programático no enciende :focus-visible en un botón): Tab hasta «Buscar»
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  for (let k = 0; k < 15; k++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.classList.contains('x-search-btn')))
      break;
  }
  const ring = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return `${s.outlineStyle} ${s.outlineWidth}`;
  });
  check(`${theme}: anillo de foco visible en Buscar`, /solid 2px/.test(ring), ring);
  await page.goto(base, { waitUntil: 'networkidle' });
  for (const [sel, name] of HOME) {
    const c = await page.evaluate(CONTRAST_JS, sel);
    check(
      `${theme}: contraste ${name}`,
      c != null && c >= 4.5,
      c == null ? 'no encontrado' : `${c}:1`,
    );
  }
  await context.close();
}

// Teléfono: desbordes y tamaños con puntero grueso
{
  const context = await browser.newContext({
    viewport: { width: 375, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  for (const w of [320, 375]) {
    await page.setViewportSize({ width: w, height: 740 });
    for (const p of [
      '',
      'galeria',
      'guia/tipos',
      'guia/primer-grafico',
      'referencia/documentacion-tecnica',
    ]) {
      await page.goto(base + p, { waitUntil: 'networkidle' });
      const h = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`${w} px: sin desplazamiento horizontal /${p}`, h === 0, `${h} px`);
    }
  }
  await page.goto(`${base}guia/tipos`, { waitUntil: 'networkidle' });
  const sizes = await page.evaluate(() => {
    const out = [];
    for (const sel of [
      '.x-search-btn',
      '.x-burger',
      '.x-local__menu',
      '.x-toc__fold',
      '.x-chip',
      '.x-live__val',
      '.x-live__bool',
    ]) {
      const el = document.querySelector(sel);
      if (!el) {
        out.push([sel, null]);
        continue;
      }
      const r = el.getBoundingClientRect();
      out.push([sel, Math.round(Math.min(r.width, r.height))]);
    }
    return out;
  });
  for (const [sel, s] of sizes)
    check(`táctil: ${sel} ≥ 44 px`, s != null && s >= 44, s == null ? 'no encontrado' : `${s} px`);
  await page.goto(`${base}galeria`, { waitUntil: 'networkidle' });
  const summary = await page.evaluate(() => {
    const r = document.querySelector('details.x-code > summary')?.getBoundingClientRect();
    return r ? Math.round(r.height) : null;
  });
  check('táctil: «Código» del ejemplo ≥ 44 px', summary != null && summary >= 44, `${summary} px`);
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  const drawerItem = await page.evaluate(() => {
    const r = document.querySelector('dialog.x-drawer .x-index__link')?.getBoundingClientRect();
    return r ? Math.round(r.height) : null;
  });
  check(
    'táctil: item del cajón ≥ 44 px',
    drawerItem != null && drawerItem >= 44,
    `${drawerItem} px`,
  );
  await context.close();
}

// Movimiento reducido: sin transiciones en el marco
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${base}guia/tipos`, { waitUntil: 'networkidle' });
  const withTransition = await page.evaluate(
    () =>
      [...document.querySelectorAll('.x-shell *')].filter((el) => {
        const d = getComputedStyle(el).transitionDuration;
        return d && d.split(',').some((v) => parseFloat(v) > 0);
      }).length,
  );
  check(
    'movimiento reducido: ninguna transición en el marco',
    withTransition === 0,
    `${withTransition} elementos`,
  );
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones pasan`);
process.exit(failed.length ? 1 : 0);

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';

const here = path.dirname(fileURLToPath(import.meta.url));
const sitio = path.resolve(here, '..');
const dataFile = path.join(sitio, 'src/.site-data.json');
if (!fs.existsSync(dataFile)) {
  throw new Error(
    'Falta sitio/src/: ejecuta antes `node sitio/scripts/generar.mjs` (lo hacen dev, build y typecheck)',
  );
}

// El sitio se publica en GitHub Pages bajo /xila/ (workflow .github/workflows/docs.yml).
const base = process.env['DOCS_BASE'] ?? '/xila/';

export default defineConfig({
  srcDir: 'src',
  base,
  lang: 'es-MX',
  title: 'Xila',
  description:
    'Librería de gráficos en TypeScript para dashboards y datos científicos: Canvas por capas, WebGL para millones de puntos y plugins.',
  cleanUrls: true,
  lastUpdated: false,
  // Un enlace interno roto detiene el build.
  ignoreDeadLinks: false,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    // Familjen Grotesk: la primaria de la marca (lema y títulos); Instrument Sans viene con xilaplot/fuentes.
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@600&display=swap',
      },
    ],
    // Vista previa para enlaces y redes (marca/tarjeta-redes.png, 1200 × 630).
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Xila · Primero la pregunta, después la gráfica' }],
    [
      'meta',
      { property: 'og:image', content: 'https://kevinedgm.github.io/xila/tarjeta-redes.png' },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    // Tema antes de pintar: VitePress pone la clase `dark` con su propio script (clave `vitepress-theme-appearance`:
    // auto · light · dark); este escribe a la vez `data-theme` para los tokens del sitio y de los gráficos.
    [
      'script',
      {},
      `;(()=>{try{var p=localStorage.getItem('vitepress-theme-appearance')||'auto';var d=p==='auto'?matchMedia('(prefers-color-scheme: dark)').matches:p==='dark';document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}})()`,
    ],
  ],
  // El marco es propio (theme/Layout.vue): de la configuración del tema solo queda la búsqueda local, que construye
  // el índice `@localSearchIndex` que lee la búsqueda modal.
  themeConfig: {
    search: { provider: 'local' },
  },
  // Portada «arriba del todo» desde el servidor: `data-top` en <html>; el Layout lo quita y lo pone al desplazar.
  transformHtml(html, _id, { pageData }) {
    if (pageData.frontmatter['layout'] !== 'home') return html;
    return html.replace(/<html([^>]*)>/, (m, attrs: string) =>
      /data-top/.test(attrs) ? m : `<html${attrs} data-top>`,
    );
  },
  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    // `page.headers` con los h2 y h3: las secciones de «En esta página».
    headers: { level: [2, 3] },
  },
  vite: {
    // Con srcDir «src» VitePress buscaría src/public, que el generador vacía: los estáticos siguen en sitio/public.
    publicDir: path.join(sitio, 'public'),
    resolve: {
      alias: {
        '@demos': path.join(sitio, 'demos'),
        '@gen-demos': path.join(sitio, 'src/.demos'),
        '@live': path.join(sitio, 'live'),
        '@marca': path.resolve(sitio, '../marca'),
      },
      dedupe: ['vue'],
    },
    // Los ejemplos se sirven con la versión del monorepo, sin publicar en npm.
    optimizeDeps: { exclude: ['xilaplot', 'xilaplot-vue'] },
    ssr: { noExternal: ['xilaplot', 'xilaplot-vue'] },
  },
});

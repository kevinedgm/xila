import { defineConfig } from 'vitepress';

// El sitio se publica en GitHub Pages bajo /xila/ (workflow .github/workflows/docs.yml).
export default defineConfig({
  lang: 'es-MX',
  title: 'Xila',
  description:
    'Librería de gráficos en TypeScript para dashboards y datos científicos: Canvas por capas, WebGL para millones de puntos y plugins.',
  base: process.env['DOCS_BASE'] ?? '/xila/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guía', link: '/guia/primer-grafico' },
      { text: 'Galería', link: '/galeria/' },
      { text: 'Referencia', link: '/referencia/' },
      { text: 'GitHub', link: 'https://github.com/kevinedgm/xila' },
    ],
    sidebar: {
      '/guia/': [
        {
          text: 'Guía',
          items: [
            { text: 'Primer gráfico en 5 minutos', link: '/guia/primer-grafico' },
            { text: 'Tipos de gráfico', link: '/guia/tipos' },
            { text: 'Crear un plugin', link: '/guia/plugin' },
            { text: 'Dashboards desde CSV', link: '/guia/dashboards' },
            { text: 'Rendimiento', link: '/guia/rendimiento' },
          ],
        },
      ],
      '/galeria/': [
        { text: 'Galería', items: [{ text: 'Todos los ejemplos', link: '/galeria/' }] },
      ],
      '/referencia/': [
        {
          text: 'Referencia',
          items: [
            { text: 'Configuración del gráfico', link: '/referencia/' },
            { text: 'Plugins incluidos', link: '/referencia/plugins' },
            { text: 'Contrato de CSV', link: '/referencia/contrato-csv' },
            { text: 'Configuración de dashboards', link: '/referencia/dashboard' },
            { text: 'Despliegue', link: '/referencia/despliegue' },
            { text: 'Benchmarks', link: '/referencia/benchmarks' },
            { text: 'API (TypeDoc)', link: '/api/', target: '_self' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/kevinedgm/xila' }],
    outline: { label: 'En esta página', level: [2, 3] },
    docFooter: { prev: 'Anterior', next: 'Siguiente' },
    lastUpdated: { text: 'Actualizado' },
    search: { provider: 'local' },
    footer: { message: 'Licencia MIT. "Xila" es un nombre provisional.' },
  },
  vite: {
    // Los ejemplos se sirven con la versión del monorepo, sin publicar en npm.
    resolve: { dedupe: ['vue'] },
    optimizeDeps: { exclude: ['@xila/core', '@xila/vue'] },
  },
});

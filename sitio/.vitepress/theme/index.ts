// Tema del sitio: el marco es propio (Layout.vue, vestido con la marca Xila) y de VitePress solo quedan sus estilos de
// documento (.vp-doc: Markdown, tablas, bloques de código con Shiki y su botón de copiar, custom-block). Sin
// `extends: DefaultTheme`: así no viajan VPNav, VPSidebar, VPDocAside ni la búsqueda en ventana, que el marco no pinta.
import type { Theme } from 'vitepress';
import 'vitepress/dist/client/theme-default/styles/vars.css';
import 'vitepress/dist/client/theme-default/styles/base.css';
import 'vitepress/dist/client/theme-default/styles/utils.css';
import 'vitepress/dist/client/theme-default/styles/components/custom-block.css';
import 'vitepress/dist/client/theme-default/styles/components/vp-code.css';
import 'vitepress/dist/client/theme-default/styles/components/vp-code-group.css';
import 'vitepress/dist/client/theme-default/styles/components/vp-doc.css';
import 'xilaplot/fuentes/xila.css';
import './sitio.css';
import Layout from './Layout.vue';
import XilaDemo from './XilaDemo.vue';
import XilaLive from './XilaLive.vue';

const theme: Theme = {
  Layout,
  enhanceApp({ app }) {
    // Disponibles en cualquier página generada: el ejemplo vivo y la ficha interactiva.
    app.component('XilaDemo', XilaDemo);
    app.component('XilaLive', XilaLive);
  },
};

export default theme;

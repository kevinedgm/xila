import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Demo from './Demo.vue';
import './estilos.css';

// `<Demo>` queda disponible en cualquier página Markdown: dibuja un gráfico en vivo.
const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Demo', Demo);
  },
};

export default theme;

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        bench: resolve(import.meta.dirname, 'bench.html'),
        dashboard: resolve(import.meta.dirname, 'dashboard.html'),
        muchos: resolve(import.meta.dirname, 'muchos.html'),
        sincronia: resolve(import.meta.dirname, 'sincronia.html'),
        webgl: resolve(import.meta.dirname, 'webgl.html'),
      },
    },
  },
});

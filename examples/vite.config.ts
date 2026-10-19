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
        calor: resolve(import.meta.dirname, 'calor.html'),
        unidades: resolve(import.meta.dirname, 'unidades.html'),
        ahora: resolve(import.meta.dirname, 'ahora.html'),
        comparar: resolve(import.meta.dirname, 'comparar.html'),
        relacion: resolve(import.meta.dirname, 'relacion.html'),
        reparto: resolve(import.meta.dirname, 'reparto.html'),
        matriz: resolve(import.meta.dirname, 'matriz.html'),
        ranura: resolve(import.meta.dirname, 'ranura.html'),
        galeria: resolve(import.meta.dirname, 'galeria.html'),
      },
    },
  },
});

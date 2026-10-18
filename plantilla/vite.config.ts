import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: la carpeta `dist` funciona en la raíz del dominio o en un subdirectorio
  // (https://cliente.com/reportes/) sin reconstruir.
  base: './',
  build: {
    // Un solo archivo JS y sin hash en los datos: el cliente puede reemplazar un CSV a mano.
    assetsDir: 'app',
  },
});

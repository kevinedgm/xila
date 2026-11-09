import { defineConfig } from '@playwright/test';

// Pruebas de navegador del sitio construido (`pnpm --filter sitio build` antes): vitepress preview en el puerto 4300.
const port = Number(process.env['SITIO_PORT'] ?? 4300);

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.mjs/,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${port}/xila/`,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: `npx vitepress preview . --port ${port}`,
    url: `http://localhost:${port}/xila/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});

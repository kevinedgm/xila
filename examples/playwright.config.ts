import { defineConfig } from '@playwright/test';

/**
 * Tests visuales: sirven `examples/dist` (hay que construir antes) y comparan capturas.
 * Las referencias viven en `tests/__capturas__` y se generaron en Linux; en otra plataforma
 * las fuentes cambian un poco, por eso la tolerancia de píxeles y el sufijo solo por navegador.
 */
export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: '{testDir}/__capturas__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  use: {
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 1,
    baseURL: 'http://localhost:4173',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/index.html',
    reuseExistingServer: !process.env.CI,
  },
});

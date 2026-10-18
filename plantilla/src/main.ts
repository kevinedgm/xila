import { DashboardConfigError, loadDashboard } from 'xilaplot';
import { XilaDashboard } from 'xilaplot-vue';
import { createApp, h } from 'vue';

/**
 * Todo el código del dashboard. Lo que cambia por cliente está fuera de aquí:
 * `public/dashboard.json`, `public/data/*.csv` y `public/logo.svg`.
 */
const app = document.getElementById('app') as HTMLElement;

try {
  const loaded = await loadDashboard('dashboard.json');
  document.title = loaded.config.titulo;
  createApp({
    render: () =>
      h(XilaDashboard, { config: loaded.config, tables: loaded.tables, errors: loaded.errors }),
  }).mount(app);
} catch (e) {
  const pre = document.createElement('pre');
  pre.style.cssText =
    'padding:24px;color:#8a1c1c;white-space:pre-wrap;font-family:ui-monospace,monospace';
  pre.textContent =
    e instanceof DashboardConfigError
      ? `Revisa dashboard.json:\n${e.errors.map((x) => `· ${x.path}: ${x.message}`).join('\n')}`
      : `No se pudo cargar el dashboard: ${String(e)}`;
  app.replaceChildren(pre);
}

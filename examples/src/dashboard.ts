import 'xilaplot/fuentes/xila.css';
import { DashboardConfigError, loadDashboard } from 'xilaplot';
import { XilaDashboard } from 'xilaplot-vue';
import { createApp, h } from 'vue';

/**
 * Plantilla mínima de dashboard estático: un `dashboard.json` y sus CSV junto al
 * `index.html`. Esto es todo el código que un cliente aloja.
 */
const app = document.getElementById('app') as HTMLElement;

try {
  // `?config=co2/dashboard.json` carga otro dashboard; los CSV se resuelven relativos al JSON.
  const config = new URLSearchParams(location.search).get('config') ?? 'dashboard.json';
  const loaded = await loadDashboard(config);
  createApp({
    render: () =>
      h(XilaDashboard, { config: loaded.config, tables: loaded.tables, errors: loaded.errors }),
  }).mount(app);
  Object.assign(window, { dashboard: loaded });
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

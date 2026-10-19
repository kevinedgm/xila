import 'xilaplot/fuentes/xila.css';
import { Chart, DataTable, numberColumn, tooltipPlugin, zoomPanPlugin } from 'xilaplot';
import { mulberry32 } from './bench/synthetic';

/**
 * Dispersión grande con el backend WebGL. `window.grafico` expone el gráfico para las pruebas
 * y el benchmark; `window.backend()` dice qué backend terminó dibujando los puntos.
 */
const params = new URLSearchParams(location.search);
const n = Number(params.get('n') ?? 1_000_000);
const renderer = (params.get('renderer') ?? 'webgl') as 'canvas' | 'webgl' | 'auto';

const rand = mulberry32(7);
const x = new Float64Array(n);
const y = new Float64Array(n);
for (let i = 0; i < n; i++) {
  // Tres nubes gaussianas de distinto tamaño, con Box–Muller.
  const r = Math.sqrt(-2 * Math.log(rand() || 1e-12));
  const a = 2 * Math.PI * rand();
  const nube = i % 3;
  x[i] = (nube === 0 ? -3 : nube === 1 ? 2 : 4) + r * Math.cos(a) * (nube === 2 ? 0.4 : 1);
  y[i] = (nube === 0 ? 1 : nube === 1 ? -2 : 3) + r * Math.sin(a) * (nube === 2 ? 0.4 : 1);
}

const t0 = performance.now();
const grafico = new Chart(document.getElementById('nube') as HTMLElement, {
  type: 'scatter',
  renderer,
  lazy: false,
  plugins: [tooltipPlugin({ mode: 'nearest' }), zoomPanPlugin({ axis: 'xy' })],
  data: new DataTable({ x: numberColumn(x), y: numberColumn(y) }),
  series: [{ id: 'p', name: 'Puntos', x: 'x', y: 'y' }],
  scatter: { radius: 1.5 },
  axes: { x: { title: 'x' }, y: { title: 'y' } },
});
grafico.events.on('draw', ({ first }) => {
  if (!first) return;
  const estado = document.getElementById('estado');
  if (estado) {
    estado.textContent = `${n.toLocaleString('es-MX')} puntos · ${grafico.getBackend()} · primer dibujo ${(performance.now() - t0).toFixed(0)} ms`;
  }
});

Object.assign(window, { grafico, backend: () => grafico.getBackend() });

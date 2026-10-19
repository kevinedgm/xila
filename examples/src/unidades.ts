import 'xilaplot/fuentes/xila.css';
import {
  Chart,
  DataTable,
  numberColumn,
  selectionPlugin,
  summaryPlugin,
  tooltipPlugin,
} from 'xilaplot';
import { mulberry32 } from './bench/synthetic';

/**
 * Gráfico de unidades (E8.01) con la estructura "A · Resumen al lado" elegida en la ronda r01:
 * un punto por caso, transición entre tira y cubetas, selección que cuenta en vez de hacer zoom y
 * un panel con cifra, porcentaje, rango, mediana, forma y "Quitar selección". `window.grafico` y
 * `window.modo(m)` sirven a las pruebas; `?n=` cambia el número de casos (el wireframe tenía 1 240).
 */
const params = new URLSearchParams(location.search);
const n = Number(params.get('n') ?? 1240);
const rand = mulberry32(42);
const minutos = new Float64Array(n);
for (let i = 0; i < n; i++) {
  const z = Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
  let v = Math.exp(2.6 + 0.45 * z);
  if (rand() < 0.03) v += 40 + rand() * 60;
  minutos[i] = Math.round(v * 10) / 10;
}
(document.getElementById('n') as HTMLElement).textContent = n.toLocaleString('es-MX');

const grafico = new Chart(document.getElementById('unidades') as HTMLElement, {
  type: 'dots',
  lazy: false,
  data: new DataTable({ minutos: numberColumn(minutos) }),
  series: [{ id: 'casos', name: 'Caso', x: 'minutos' }],
  dots: { mode: 'strip' },
  plugins: [
    selectionPlugin({ unit: ['caso', 'casos'], readout: false }),
    summaryPlugin({ unit: ['caso', 'casos'], format: (v) => `${v.toFixed(1)} min` }),
    tooltipPlugin({ mode: 'nearest', formatY: (v) => `${v} min` }),
  ],
  axes: { x: { title: 'Minutos de atención' }, y: { title: 'Casos' } },
});

function modo(m: 'strip' | 'binned'): void {
  grafico.update({ dots: { mode: m } });
}

declare global {
  interface Window {
    grafico: Chart;
    modo: typeof modo;
  }
}
window.grafico = grafico;
window.modo = modo;

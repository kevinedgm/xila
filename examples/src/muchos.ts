import 'xilaplot/fuentes/xila.css';
import { Chart, DataTable, tooltipPlugin } from 'xilaplot';
import { generateSeries } from './bench/synthetic';

/**
 * Treinta gráficos de 50 000 puntos cada uno. Con `lazy` (por defecto) solo se dibujan los
 * visibles; `window.dibujados()` cuenta cuántos tienen escalas, es decir, ya se dibujaron.
 */
const lista = document.getElementById('lista') as HTMLElement;
const charts: Chart[] = [];
const t0 = performance.now();

for (let i = 0; i < 30; i++) {
  const el = document.createElement('div');
  el.className = 'chart';
  el.id = `g${i}`;
  el.dataset['nombre'] = `Sensor ${i + 1}`;
  lista.appendChild(el);
  const s = generateSeries(50_000, i + 1);
  charts.push(
    new Chart(el, {
      type: 'line',
      lazy: new URLSearchParams(location.search).get('lazy') !== '0',
      plugins: [tooltipPlugin()],
      data: new DataTable({
        t: { kind: 'time', values: s.x },
        v: { kind: 'number', values: s.y },
      }),
      series: [{ id: 'v', name: `Sensor ${i + 1}`, x: 't', y: 'v' }],
    }),
  );
}

const dibujados = (): number => charts.filter((c) => c.getScales() !== null).length;
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    const estado = document.getElementById('estado') as HTMLElement;
    estado.textContent = `· ${dibujados()} de 30 dibujados en ${Math.round(performance.now() - t0)} ms`;
  }),
);
Object.assign(window, { charts, dibujados });

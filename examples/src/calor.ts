import { Chart, DataTable, categoryColumn, numberColumn, tooltipPlugin } from 'xilaplot';
import type { ColormapName } from 'xilaplot';

/**
 * Heatmap grande para medir el dibujo (E6.07: 500 × 500 en menos de 16 ms). `window.grafico`
 * expone el gráfico y `window.medir(k)` devuelve los milisegundos de `k` dibujos completos.
 */
const params = new URLSearchParams(location.search);
const n = Number(params.get('n') ?? 500);
const mapa = (params.get('colormap') ?? 'viridis') as ColormapName;

const total = n * n;
const col = new Array<string>(total);
const fila = new Array<string>(total);
const valor = new Float64Array(total);
for (let yi = 0; yi < n; yi++) {
  for (let xi = 0; xi < n; xi++) {
    const i = yi * n + xi;
    col[i] = `c${xi}`;
    fila[i] = `f${yi}`;
    // Un campo suave con dos "montañas", para ver el mapa de color completo.
    const dx = xi / n - 0.3;
    const dy = yi / n - 0.4;
    const ex = xi / n - 0.75;
    const ey = yi / n - 0.7;
    valor[i] = Math.exp(-(dx * dx + dy * dy) * 12) + 0.6 * Math.exp(-(ex * ex + ey * ey) * 30);
  }
}

const t0 = performance.now();
const grafico = new Chart(document.getElementById('calor') as HTMLElement, {
  type: 'heatmap',
  lazy: false,
  plugins: [tooltipPlugin()],
  data: new DataTable({
    columna: categoryColumn(col),
    fila: categoryColumn(fila),
    valor: numberColumn(valor),
  }),
  series: [{ id: 'v', name: 'Intensidad', x: 'columna', y: 'fila', value: 'valor' }],
  heatmap: { colormap: mapa },
  axes: { x: { show: false }, y: { show: false } },
});
grafico.events.on('draw', ({ first }) => {
  if (!first) return;
  const estado = document.getElementById('estado');
  if (estado) estado.textContent = `primer dibujo ${(performance.now() - t0).toFixed(0)} ms`;
});

function medir(veces: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < veces; i++) {
    const t = performance.now();
    grafico.drawNow();
    out.push(performance.now() - t);
  }
  return out;
}

Object.assign(window, { grafico, medir });

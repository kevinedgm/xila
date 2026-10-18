import { Chart, DataTable, syncPlugin, tooltipPlugin, zoomPanPlugin } from 'xilaplot';
import { generateSeries } from './bench/synthetic';

/** Tres gráficos con el mismo eje de tiempo en el grupo "sensores". */
const charts: Record<string, Chart> = {};
const nombres = ['Temperatura', 'Humedad', 'Presión'];

nombres.forEach((nombre, i) => {
  const el = document.getElementById(`s${i + 1}`) as HTMLElement;
  const s = generateSeries(20_000, 11 + i);
  charts[`s${i + 1}`] = new Chart(el, {
    type: 'line',
    plugins: [tooltipPlugin(), zoomPanPlugin(), syncPlugin({ group: 'sensores' })],
    data: new DataTable({
      t: { kind: 'time', values: s.x },
      v: { kind: 'number', values: s.y },
    }),
    series: [{ id: 'v', name: nombre, x: 't', y: 'v' }],
    axes: { y: { title: nombre } },
  });
});

Object.assign(window, { charts });

import 'xilaplot/fuentes/xila.css';
import { accessibilityPlugin, Chart, fetchCsv, titlePlugin } from 'xilaplot';

/**
 * Nudos con camino (`heatmap.mark: 'knot'` + `heatmap.path`): la versión día × hora de la
 * dirección de arte Kiwi, sobre la rejilla del heatmap. La línea de lectura repite en texto lo
 * que señala el camino (hace de tooltip); en reposo, el máximo. `window.graficos` sirve a las pruebas.
 */
const { table } = await fetchCsv('/nudos/pedidos.csv');

const DIAS: Record<string, string> = {
  Lun: 'Lunes',
  Mar: 'Martes',
  Mié: 'Miércoles',
  Jue: 'Jueves',
  Vie: 'Viernes',
  Sáb: 'Sábado',
  Dom: 'Domingo',
};
const pedidos = table.numeric('pedidos');
const dia = table.column('dia');
const hora = table.column('hora');
const etiqueta = (i: number, col: typeof dia) =>
  col.kind === 'category' ? (col.categories[col.codes[i] as number] ?? '') : '';
let max = 0;
let min = 0;
pedidos.forEach((v, i) => {
  if (v > (pedidos[max] as number)) max = i;
  if (v < (pedidos[min] as number)) min = i;
});

const lectura = document.getElementById('lectura') as HTMLElement;
function leer(i: number): void {
  const v = pedidos[i] as number;
  const nota = i === max ? ' · el máximo' : i === min ? ' · el más bajo' : '';
  lectura.innerHTML = `<b>${DIAS[etiqueta(i, dia)] ?? ''} · ${etiqueta(i, hora)}</b> → <span class="cifra">${v}</span> pedidos${nota}`;
}

const grafico = new Chart(document.getElementById('nudos') as HTMLElement, {
  type: 'heatmap',
  data: table,
  series: [{ id: 'pedidos', name: 'pedidos', x: 'hora', y: 'dia', value: 'pedidos' }],
  heatmap: { mark: 'knot', path: true },
  plugins: [
    titlePlugin({
      title: 'Los pedidos se anudan a las 9 h y a las 17 h; el domingo a las 9 h es el máximo',
      subtitle: 'Pedidos por día y hora · panadería 2023–2024',
    }),
    accessibilityPlugin(),
  ],
});
grafico.events.on('hover', (h) => leer(h?.nearest ? h.nearest.index : max));
leer(max);

(window as unknown as { graficos: Chart[] }).graficos = [grafico];

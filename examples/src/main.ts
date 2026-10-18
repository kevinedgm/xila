import {
  categoryColumn,
  Chart,
  DataTable,
  legendPlugin,
  numberColumn,
  timeColumn,
  tooltipPlugin,
  version,
  zoomPanPlugin,
  annotationsPlugin,
  accessibilityPlugin,
  type ChartConfig,
} from '@xila/core';
import { generateSeries } from './bench/synthetic';

const plugins = () => [tooltipPlugin(), legendPlugin(), accessibilityPlugin()];

const estado = document.getElementById('estado');
if (estado) estado.textContent = `@xila/core ${version}`;

const charts: Record<string, Chart> = {};
function mount(id: string, config: ChartConfig): Chart {
  const container = document.getElementById(id);
  if (!container) throw new Error(`falta #${id}`);
  charts[id] = new Chart(container, config);
  return charts[id];
}

// 1. Serie temporal: 100 000 lecturas de sensor a 1 kHz, con decimación min/max.
const sensor = generateSeries(100_000, 7);
const sensorTable = new DataTable({
  tiempo: { kind: 'time', values: sensor.x },
  temperatura: { kind: 'number', values: sensor.y },
});
mount('linea', {
  type: 'line',
  plugins: [...plugins(), zoomPanPlugin()],
  data: sensorTable,
  series: [{ id: 'temp', name: 'Temperatura', x: 'tiempo', y: 'temperatura' }],
  axes: { x: { title: 'Tiempo (UTC)' }, y: { title: '°C' } },
});

// 2. Varias series con un hueco (NaN) en la segunda.
const n = 200;
const xs = Array.from({ length: n }, (_, i) => i);
const y1 = xs.map((i) => 50 + 20 * Math.sin(i / 15));
const y2 = xs.map((i) => (i > 80 && i < 110 ? Number.NaN : 40 + 15 * Math.cos(i / 10)));
const y3 = xs.map((i) => 30 + i / 8);
mount('multi', {
  type: 'line',
  plugins: plugins(),
  data: new DataTable({
    x: numberColumn(xs),
    a: numberColumn(y1),
    b: numberColumn(y2),
    c: numberColumn(y3),
  }),
  series: [
    { id: 'a', name: 'Serie A', x: 'x', y: 'a' },
    { id: 'b', name: 'Serie B (con hueco)', x: 'x', y: 'b' },
    { id: 'c', name: 'Serie C', x: 'x', y: 'c' },
  ],
  line: { width: 2 },
  axes: { x: { title: 'Muestra' }, y: { title: 'Valor' } },
});

// 3. Barras agrupadas y apiladas: ventas por mes y región (CSV en formato largo ya pivotado).
const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
const ventas = new DataTable({
  mes: categoryColumn(meses),
  norte: numberColumn([120, 135, 150, 142, 160, 175]),
  sur: numberColumn([80, 95, 70, 110, 105, 130]),
  centro: numberColumn([60, -20, 75, 90, 85, 95]),
});
const barras: ChartConfig = {
  type: 'bar',
  plugins: plugins(),
  data: ventas,
  series: [
    { id: 'norte', name: 'Norte', x: 'mes', y: 'norte' },
    { id: 'sur', name: 'Sur', x: 'mes', y: 'sur' },
    { id: 'centro', name: 'Centro', x: 'mes', y: 'centro' },
  ],
  axes: { y: { title: 'Ventas (miles MXN)' } },
};
mount('barras', barras);
// Cada gráfico necesita sus propias instancias de plugins: guardan estado y nodos del DOM.
mount('apiladas', { ...barras, plugins: plugins(), bar: { mode: 'stacked' } });

// 4. Dispersión: 20 000 puntos con dos nubes.
const m = 20_000;
const sx = new Float64Array(m);
const sy = new Float64Array(m);
let seed = 3;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
for (let i = 0; i < m; i++) {
  const cluster = i % 2;
  sx[i] = (cluster ? 3 : -2) + rand() + rand();
  sy[i] = (cluster ? -1 : 2) + rand() + rand();
}
mount('dispersion', {
  type: 'scatter',
  plugins: [tooltipPlugin({ mode: 'nearest' }), zoomPanPlugin({ axis: 'xy' })],
  data: new DataTable({
    x: { kind: 'number', values: sx },
    y: { kind: 'number', values: sy },
  }),
  series: [{ id: 'p', name: 'Puntos', x: 'x', y: 'y' }],
  scatter: { radius: 2 },
  axes: { x: { title: 'Componente 1' }, y: { title: 'Componente 2' } },
});

// 5. Fechas: ventas diarias de un año, en un contenedor angosto para probar el adelgazado de etiquetas.
const dias = 365;
const fechas: Date[] = [];
const diario: number[] = [];
for (let d = 0; d < dias; d++) {
  fechas.push(new Date(Date.UTC(2025, 0, 1 + d)));
  diario.push(
    1000 +
      300 * Math.sin((d / 365) * Math.PI * 2) +
      150 * Math.sin(d / 7) +
      (d % 7 === 0 ? -400 : 0),
  );
}
mount('fechas', {
  type: 'line',
  plugins: [
    ...plugins(),
    zoomPanPlugin(),
    annotationsPlugin([
      {
        type: 'band',
        axis: 'x',
        from: new Date(Date.UTC(2025, 6, 7)),
        to: new Date(Date.UTC(2025, 6, 20)),
        label: 'Campaña de verano',
        description: 'Anuncios en redes del 7 al 20 de julio.',
        color: '#f59e0b',
      },
      {
        type: 'line',
        axis: 'x',
        value: new Date(Date.UTC(2025, 10, 17)),
        label: 'Buen Fin',
        description: 'Fin de semana de descuentos: 14 al 17 de noviembre.',
        dash: [4, 3],
      },
      { type: 'line', axis: 'y', value: 1000, label: 'Meta', color: '#10b981' },
    ]),
  ],
  data: new DataTable({ fecha: timeColumn(fechas), ventas: numberColumn(diario) }),
  series: [{ id: 'v', name: 'Ventas diarias', x: 'fecha', y: 'ventas' }],
  axes: { y: { title: 'MXN' } },
  theme: 'dark',
});

// 7. Escala logarítmica en Y: crecimiento exponencial con ruido y algunos ceros (se omiten con aviso).
const nLog = 400;
const xLog = new Float64Array(nLog);
const yLog = new Float64Array(nLog);
for (let i = 0; i < nLog; i++) {
  xLog[i] = i;
  yLog[i] = i % 97 === 0 ? 0 : 10 ** (i / 80) * (0.7 + 0.6 * Math.abs(Math.sin(i * 1.7)));
}
mount('log', {
  type: 'line',
  plugins: [...plugins(), zoomPanPlugin({ axis: 'xy' })],
  data: new DataTable({
    dia: numberColumn(Array.from(xLog)),
    casos: numberColumn(Array.from(yLog)),
  }),
  series: [{ id: 'c', name: 'Casos', x: 'dia', y: 'casos' }],
  scales: { y: { type: 'log' } },
  axes: { x: { title: 'Día' }, y: { title: 'Casos (log)' } },
});

// 8. Incertidumbre: media con su intervalo de confianza del 95 % (banda) y mediciones con
// error simétrico (barras). Las columnas vienen tal cual de un groupby en pandas.
const nMeses = 24;
const mes = new Float64Array(nMeses);
const media = new Float64Array(nMeses);
const icBajo = new Float64Array(nMeses);
const icAlto = new Float64Array(nMeses);
for (let i = 0; i < nMeses; i++) {
  mes[i] = i;
  media[i] = 50 + 10 * Math.sin(i / 3) + (i % 5) - 2;
  const semi = 3 + 2 * Math.abs(Math.cos(i / 2));
  icBajo[i] = media[i]! - semi;
  icAlto[i] = media[i]! + semi * 1.4; // asimétrico: la cola alta es más larga
}
mount('banda', {
  type: 'line',
  plugins: plugins(),
  data: new DataTable({
    mes: numberColumn(Array.from(mes)),
    media: numberColumn(Array.from(media)),
    ic_bajo: numberColumn(Array.from(icBajo)),
    ic_alto: numberColumn(Array.from(icAlto)),
  }),
  series: [
    { id: 'm', name: 'Media ± IC 95 %', x: 'mes', y: 'media', yLow: 'ic_bajo', yHigh: 'ic_alto' },
  ],
  axes: { x: { title: 'Mes' }, y: { title: 'Tiempo de entrega (h)' } },
});
const muestras = 30;
const dosis = new Float64Array(muestras);
const respuesta = new Float64Array(muestras);
const error = new Float64Array(muestras);
for (let i = 0; i < muestras; i++) {
  dosis[i] = 1 + i * 0.5;
  respuesta[i] = 20 + 4 * Math.log1p(dosis[i]!) + ((i * 7919) % 11) / 5 - 1;
  error[i] = 0.8 + ((i * 31) % 7) / 4;
}
mount('errores', {
  type: 'scatter',
  plugins: [tooltipPlugin({ mode: 'nearest' }), accessibilityPlugin()],
  data: new DataTable({
    dosis: numberColumn(Array.from(dosis)),
    respuesta: numberColumn(Array.from(respuesta)),
    error: numberColumn(Array.from(error)),
  }),
  series: [{ id: 'r', name: 'Respuesta ± error', x: 'dosis', y: 'respuesta', yError: 'error' }],
  axes: { x: { title: 'Dosis (mg)' }, y: { title: 'Respuesta' } },
});

Object.assign(window, { charts });

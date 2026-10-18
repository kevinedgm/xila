import {
  categoryColumn,
  Chart,
  DataTable,
  numberColumn,
  timeColumn,
  version,
  type ChartConfig,
} from '@xila/core';
import { generateSeries } from './bench/synthetic';

const estado = document.getElementById('estado');
if (estado) estado.textContent = `@xila/core ${version}`;

function mount(id: string, config: ChartConfig): Chart {
  const container = document.getElementById(id);
  if (!container) throw new Error(`falta #${id}`);
  return new Chart(container, config);
}

// 1. Serie temporal: 100 000 lecturas de sensor a 1 kHz, con decimación min/max.
const sensor = generateSeries(100_000, 7);
const sensorTable = new DataTable({
  tiempo: { kind: 'time', values: sensor.x },
  temperatura: { kind: 'number', values: sensor.y },
});
mount('linea', {
  type: 'line',
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
  data: ventas,
  series: [
    { id: 'norte', name: 'Norte', x: 'mes', y: 'norte' },
    { id: 'sur', name: 'Sur', x: 'mes', y: 'sur' },
    { id: 'centro', name: 'Centro', x: 'mes', y: 'centro' },
  ],
  axes: { y: { title: 'Ventas (miles MXN)' } },
};
mount('barras', barras);
mount('apiladas', { ...barras, bar: { mode: 'stacked' } });

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
  diario.push(1000 + 300 * Math.sin((d / 365) * Math.PI * 2) + 150 * Math.sin(d / 7) + (d % 7 === 0 ? -400 : 0));
}
mount('fechas', {
  type: 'line',
  data: new DataTable({ fecha: timeColumn(fechas), ventas: numberColumn(diario) }),
  series: [{ id: 'v', name: 'Ventas diarias', x: 'fecha', y: 'ventas' }],
  axes: { y: { title: 'MXN' } },
  theme: 'dark',
});

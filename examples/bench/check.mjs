// Puerta de regresión: lee resultados.json y falla si el renderer decimado se sale del presupuesto.
// Uso: node examples/bench/check.mjs [resultados.json]
// Los umbrales son holgados a propósito: los runners de CI no tienen GPU y varían de carga.
// Sirven para atrapar una regresión de 5-10×, no de 10 %.
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = process.argv[2] ?? resolve(import.meta.dirname, 'resultados.json');
const r = JSON.parse(readFileSync(file, 'utf8'));

const LIMITS = [
  // 1M puntos con decimación: medido ~4.6 ms localmente; 16.7 ms es un frame a 60 Hz.
  {
    name: 'pan 1M decimado (ms/frame, mediana)',
    value: pan('decimated', 1_000_000)?.workMedian,
    max: 30,
  },
  // La gráfica completa (ejes, escalas, eventos): ~10 ms. Atrapa trabajo O(n) por fotograma
  // fuera de la decimación, como el recorrido del dominio que costaba 13 ms antes de cachearlo.
  {
    name: 'pan 1M Chart completa (ms/frame, mediana)',
    value: pan('xila', 1_000_000)?.workMedian,
    max: 40,
  },
  { name: 'primer render 1M decimado (ms)', value: first('decimated', 1_000_000)?.ms, max: 200 },
  { name: 'memoria 1M puntos en columnas (MB)', value: mem('columns')?.totalMB, max: 25 },
];

function pan(kind, n) {
  return r.pan.find((p) => p.kind === kind && p.n === n);
}
function first(kind, n) {
  return r.firstRender.find((p) => p.kind === kind && p.n === n);
}
function mem(mode) {
  return r.memory.find((m) => m.mode === mode);
}

let ok = true;
const rows = LIMITS.map(({ name, value, max }) => {
  const pass = value !== undefined && value <= max;
  if (!pass) ok = false;
  return `| ${name} | ${value === undefined ? 'sin dato' : value.toFixed(2)} | ${max} | ${pass ? '✅' : '❌'} |`;
});
const table = ['| Métrica | Medido | Máximo | |', '|---|---:|---:|---|', ...rows].join('\n');
console.log(`Máquina: ${r.machine.browser}, ${r.machine.platform}\n${table}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Benchmark\n\n${table}\n`);
}
if (!ok) {
  console.error('Benchmark fuera de presupuesto');
  process.exit(1);
}

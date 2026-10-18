import { Chart, version } from '@xila/core';

const container = document.getElementById('chart');
const estado = document.getElementById('estado');

if (container && estado) {
  const chart = new Chart({ container });
  estado.textContent = `@xila/core ${version} cargado; canvas creado: ${chart.canvas.tagName}`;
}

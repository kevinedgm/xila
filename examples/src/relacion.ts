import 'xilaplot/fuentes/xila.css';
import {
  Chart,
  DataTable,
  fetchCsv,
  filterRows,
  pivot,
  titlePlugin,
  tooltipPlugin,
  trajectoryPlugin,
  trendPlugin,
  type Column,
  type SeriesSpec,
} from 'xilaplot';

/**
 * Las dos formas elegidas en la ronda r01 de "Más allá de la dispersión": A (trayectorias:
 * `scatter.path` + `trajectoryPlugin`) y C (contra lo esperado: `trendPlugin`).
 * Cada país necesita su propio par de columnas x/y, así que la tabla larga se pivota dos veces
 * (PIB y CO₂ por país) y se junta en una tabla ancha con la fecha. `window.graficos` sirve a
 * las pruebas.
 */
const { table } = await fetchCsv('/co2/data/co2.csv');
const pib = table.numeric('pib_per_capita');
const desde1970 = filterRows(
  table,
  (i) =>
    (table.numeric('fecha')[i] as number) >= Date.UTC(1970, 0, 1) &&
    (pib[i] as number) === (pib[i] as number),
);
const pibAncho = pivot(desde1970, { index: 'fecha', columns: 'pais', values: 'pib_per_capita' });
const co2Ancho = pivot(desde1970, { index: 'fecha', columns: 'pais', values: 'co2_t_por_persona' });
const paises = pibAncho.names().filter((n) => n !== 'fecha');
const columnas: Record<string, Column> = { fecha: pibAncho.column('fecha') };
for (const p of paises) {
  columnas[`pib ${p}`] = pibAncho.column(p);
  columnas[`co2 ${p}`] = co2Ancho.column(p);
}
const ancha = new DataTable(columnas);
const series: SeriesSpec[] = paises.map((p) => ({ id: p, name: p, x: `pib ${p}`, y: `co2 ${p}` }));
const ejes = {
  x: { title: 'PIB por persona, $ (log)' },
  y: { title: 't de CO₂ por persona' },
};
const año = (t: number): string => String(new Date(t).getUTCFullYear());

const trayectorias = new Chart(document.getElementById('trayectorias') as HTMLElement, {
  type: 'scatter',
  data: ancha,
  series,
  scales: { x: { type: 'log' } },
  axes: ejes,
  plugins: [
    titlePlugin({
      title: 'China sube en diagonal; Alemania y Estados Unidos bajan mientras se enriquecen',
      subtitle: 'Camino de cada país de 1970 a 2022',
    }),
    tooltipPlugin(),
    trajectoryPlugin({
      time: 'fecha',
      series: 'China',
      formatTime: año,
      format: (v) => `${v.toFixed(1)} t`,
      formatX: (v) => `${Math.round(v / 1000)} k$`,
    }),
  ],
});

const fechas = ancha.numeric('fecha');
const en2022 = filterRows(ancha, (i) => (fechas[i] as number) === Date.UTC(2022, 0, 1));
const tendencia = new Chart(document.getElementById('tendencia') as HTMLElement, {
  type: 'scatter',
  data: en2022,
  series,
  scatter: { radius: 5 },
  scales: { x: { type: 'log' } },
  axes: ejes,
  plugins: [
    titlePlugin({
      title: 'Estados Unidos y China emiten más de lo que su riqueza predice; España, menos',
      subtitle: 'Siete países en 2022 y la tendencia entre ellos',
    }),
    tooltipPlugin(),
    trendPlugin({ label: 'tendencia de estos siete', format: (v) => `${v.toFixed(1)} t` }),
  ],
});

(window as unknown as { graficos: Chart[] }).graficos = [trayectorias, tendencia];

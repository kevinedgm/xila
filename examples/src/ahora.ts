import {
  Chart,
  fetchCsv,
  filterRows,
  focusPlugin,
  nowPlugin,
  pivot,
  titlePlugin,
  tooltipPlugin,
} from 'xilaplot';

/**
 * Las dos formas elegidas en la ronda r01 de "Más allá de la línea": A (ahora con estela,
 * `nowPlugin`) y C (protagonista y contexto, `focusPlugin`). `window.graficos` sirve a las pruebas.
 */
const { table } = await fetchCsv('/co2/data/co2.csv');
const fechas = table.numeric('fecha');
const desde1970 = filterRows(table, (i) => (fechas[i] as number) >= Date.UTC(1970, 0, 1));
const ancho = pivot(desde1970, { index: 'fecha', columns: 'pais', values: 'co2_t_por_persona' });
const paises = ['Estados Unidos', 'Alemania', 'España', 'China', 'México', 'Brasil', 'India'];
const series = paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p }));
const ejes = { y: { title: 't de CO₂ por persona' } };

const ahora = new Chart(document.getElementById('ahora') as HTMLElement, {
  type: 'line',
  data: ancho,
  series,
  axes: ejes,
  plugins: [
    tooltipPlugin(),
    nowPlugin({
      position: 'top',
      format: (v) => v.toFixed(1),
      lookback: 10,
      labels: { ago: 'en {n} años' },
    }),
  ],
});

const protagonista = new Chart(document.getElementById('protagonista') as HTMLElement, {
  type: 'line',
  data: ancho,
  series,
  axes: ejes,
  plugins: [
    titlePlugin({
      title: 'México emite hoy lo mismo que España en 1970',
      subtitle: 'Toneladas de CO₂ por persona y año',
    }),
    tooltipPlugin(),
    focusPlugin({ series: 'México', format: (v) => v.toFixed(1) }),
  ],
});

(window as unknown as { graficos: Chart[] }).graficos = [ahora, protagonista];

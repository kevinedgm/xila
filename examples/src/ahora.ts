import 'xilaplot/fuentes/xila.css';
import {
  Chart,
  RhythmStrip,
  fetchCsv,
  filterRows,
  findMoments,
  focusPlugin,
  narratePlugin,
  nowPlugin,
  pivot,
  titlePlugin,
  tooltipPlugin,
} from 'xilaplot';

/**
 * Las cuatro formas elegidas en la ronda r01 de "Más allá de la línea": A (ahora con estela,
 * `nowPlugin`), B (tira de ritmo, `RhythmStrip`), C (protagonista y contexto, `focusPlugin`) y D
 * (línea narrada, `narratePlugin`). `window.graficos` y `window.ritmo` sirven a las pruebas.
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

const anio = (ms: number): string => String(new Date(ms).getUTCFullYear());

const ritmo = new RhythmStrip(document.getElementById('ritmo') as HTMLElement, {
  data: ancho,
  x: 'fecha',
  series: paises.map((p) => ({ id: p, name: p, y: p })),
  window: 3,
  cap: 0.06,
  formatX: anio,
  stepLabel: 'al año',
});

// El título dice el hallazgo, calculado de los mismos momentos que la gráfica anota.
const alemania = ancho.numeric('Alemania');
const maximo = findMoments(alemania).find((m) => m.kind === 'max');
const ultimo = alemania[alemania.length - 1] as number;
const caida = maximo ? Math.round((1 - ultimo / (alemania[maximo.index] as number)) * 100) : 0;
const narra = narratePlugin({
  series: 'Alemania',
  drops: 3,
  format: (v) => v.toFixed(1),
  formatX: anio,
});
const narrada = new Chart(document.getElementById('narrada') as HTMLElement, {
  type: 'line',
  data: ancho,
  series: [{ id: 'Alemania', name: 'Alemania', x: 'fecha', y: 'Alemania' }],
  axes: ejes,
  // Sin render diferido: las pruebas esperan a que todas las gráficas de la página se dibujen.
  lazy: false,
  plugins: [
    titlePlugin({
      title: `Alemania emite hoy ${caida} % menos por persona que en su máximo`,
      subtitle: 'Toneladas de CO₂ por persona y año',
    }),
    tooltipPlugin(),
    narra,
  ],
});
// Las mismas notas, como lista: el resumen accesible de lo que dice la gráfica.
narrada.events.on('draw', () => {
  const ul = document.getElementById('narrada-momentos') as HTMLElement;
  ul.replaceChildren(
    ...narra
      .getMoments()
      .map((m) => Object.assign(document.createElement('li'), { textContent: m.text })),
  );
});

Object.assign(window, { graficos: [ahora, protagonista, narrada], ritmo, narra });

import { Chart, fetchCsv, titlePlugin, tooltipPlugin, type BoxChartConfig } from 'xilaplot';

/**
 * Las tres formas elegidas en la ronda r01 de "Más allá del box plot": A (`box.mark: 'dots'`
 * con `shade` por fecha), B (`'density'`) y C (`'range'` con `now: 'last'`). Las tres leen el
 * formato largo tal cual, como el box plot. `window.graficos` sirve a las pruebas.
 */
const { table } = await fetchCsv('/co2/data/co2.csv');
const base = {
  type: 'box',
  data: table,
  series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
  axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
} satisfies Partial<BoxChartConfig>;

const puntos = new Chart(document.getElementById('puntos') as HTMLElement, {
  ...base,
  box: { mark: 'dots', shade: 'fecha', now: 'last' },
  plugins: [
    titlePlugin({
      title: 'China pasó de los años claros abajo a los oscuros arriba; Alemania, al revés',
      subtitle: 'Un punto por año, de 1950 (claro) a 2024 (oscuro); raya en la mediana',
    }),
    tooltipPlugin(),
  ],
});

const franja = new Chart(document.getElementById('franja') as HTMLElement, {
  ...base,
  box: { mark: 'density' },
  plugins: [
    titlePlugin({
      title: 'Estados Unidos lleva 75 años entre 14 y 22 t; India nunca pasó de 2,2',
      subtitle: 'Más oscuro, más años en ese tramo; raya en la mediana',
    }),
    tooltipPlugin(),
  ],
});

const hoy = new Chart(document.getElementById('hoy') as HTMLElement, {
  ...base,
  box: { mark: 'range', now: 'last' },
  plugins: [
    titlePlugin({
      title: 'Alemania está hoy en lo más bajo de su historia; China e India, en su máximo',
      subtitle: 'Bandas del percentil 10 al 90 y del 25 al 75; el punto es 2024',
    }),
    tooltipPlugin(),
  ],
});

(window as unknown as { graficos: Chart[] }).graficos = [puntos, franja, hoy];

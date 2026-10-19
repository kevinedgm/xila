import {
  bucketTime,
  categoryColumn,
  Chart,
  DataTable,
  fetchCsv,
  numberColumn,
  pivot,
  titlePlugin,
  tooltipPlugin,
  type Column,
} from 'xilaplot';

/**
 * Las dos formas elegidas en la ronda r01 de "Más allá del mapa de calor": A (`heatmap.scale:
 * 'row'`, cada fila contra su mediana, con `rowLabels: 'max'`) y D (`values` y `gap`, una tabla
 * con tono sobre promedios por década). `window.graficos` sirve a las pruebas.
 */
const { table } = await fetchCsv('/co2/data/co2.csv');

/** La misma tabla con una columna categórica `anio` ("1950", "1951", …) derivada de `fecha`. */
function conAnio(tabla: DataTable): DataTable {
  const columnas: Record<string, Column> = {};
  for (const nombre of tabla.names()) columnas[nombre] = tabla.column(nombre);
  columnas['anio'] = categoryColumn(
    Array.from(tabla.numeric('fecha'), (ms) => String(new Date(ms).getUTCFullYear())),
  );
  return new DataTable(columnas);
}

const propia = new Chart(document.getElementById('propia') as HTMLElement, {
  type: 'heatmap',
  data: conAnio(table),
  series: [{ id: 'tpp', name: 't por persona', x: 'anio', y: 'pais', value: 'co2_t_por_persona' }],
  heatmap: { scale: 'row', rowLabels: 'max' },
  plugins: [
    titlePlugin({
      title: 'Alemania y Estados Unidos ya bajaron de su mediana; China e India están en su máximo',
      subtitle: 'Cada fila contra su propia mediana: azul por debajo, naranja por encima',
    }),
    tooltipPlugin(),
  ],
});

/**
 * Promedio por década: `bucketTime` redondea la fecha al inicio de su década y `pivot` deja una
 * fila por década y una columna por país; de ahí se vuelve al formato largo que el heatmap lee.
 */
const ancho = pivot(bucketTime(table, 'fecha', 'decade', 'decada'), {
  index: 'decada',
  columns: 'pais',
  values: 'co2_t_por_persona',
  agg: 'mean',
});
const decadas = Array.from(ancho.numeric('decada'), (ms) => {
  const y = new Date(ms).getUTCFullYear();
  return y === 2020 ? '2020–24' : `${y}s`;
});
const paises = ancho.names().filter((n) => n !== 'decada');
const decada: string[] = [];
const pais: string[] = [];
const media: number[] = [];
decadas.forEach((etiqueta, i) => {
  for (const p of paises) {
    decada.push(etiqueta);
    pais.push(p);
    media.push(ancho.numeric(p)[i] as number);
  }
});

const tabla = new Chart(document.getElementById('tabla') as HTMLElement, {
  type: 'heatmap',
  data: new DataTable({
    decada: categoryColumn(decada),
    pais: categoryColumn(pais),
    media: numberColumn(media),
  }),
  series: [{ id: 'm', name: 't por persona', x: 'decada', y: 'pais', value: 'media' }],
  // Dominio más alto que el máximo para que el tono más oscuro quede legible con la cifra.
  heatmap: { values: true, gap: 2, legend: false, domain: [0, 26] },
  plugins: [
    titlePlugin({
      title: 'Alemania pasó de 13,1 t en los setenta a 7,5 en los veinte',
      subtitle: 'Promedio de t de CO₂ por persona en cada década',
    }),
    tooltipPlugin(),
  ],
});

(window as unknown as { graficos: Chart[] }).graficos = [propia, tabla];

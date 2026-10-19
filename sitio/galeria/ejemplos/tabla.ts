import {
  categoryColumn,
  DataTable,
  numberColumn,
  pivot,
  titlePlugin,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2, conDecada } from './datos';

/**
 * Tabla con tono: el mismo heatmap por década que el ejemplo anterior, con la cifra en cada
 * celda (`values`) y un hueco entre ellas (`gap`). El color solo guía el ojo; el dominio se
 * estira para que la celda más oscura siga siendo legible.
 */
export default async function tabla(): Promise<ChartConfig> {
  const ancho = pivot(conDecada(await co2()), {
    index: 'decada',
    columns: 'pais',
    values: 'co2_t_por_persona',
    agg: 'mean',
  });
  const col = ancho.column('decada');
  const etiquetas =
    col.kind === 'category' ? Array.from(col.codes, (c) => col.categories[c] ?? '') : [];
  const paises = ancho.names().filter((n) => n !== 'decada');
  const decada: string[] = [];
  const pais: string[] = [];
  const media: number[] = [];
  etiquetas.forEach((etiqueta, i) => {
    for (const p of paises) {
      decada.push(etiqueta);
      pais.push(p);
      media.push(ancho.numeric(p)[i] as number);
    }
  });
  return {
    type: 'heatmap',
    data: new DataTable({
      decada: categoryColumn(decada),
      pais: categoryColumn(pais),
      media: numberColumn(media),
    }),
    series: [{ id: 'm', name: 't por persona', x: 'decada', y: 'pais', value: 'media' }],
    heatmap: { values: true, gap: 2, legend: false, domain: [0, 26] },
    plugins: [
      titlePlugin({
        title: 'Alemania pasó de 13,1 t en los setenta a 7,5 en los veinte',
        subtitle: 'Promedio por década',
      }),
      tooltipPlugin(),
    ],
  };
}

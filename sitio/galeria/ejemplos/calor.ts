import {
  categoryColumn,
  DataTable,
  numberColumn,
  pivot,
  tooltipPlugin,
  type ChartConfig,
} from '@xila/core';
import { co2, conDecada } from './datos';

/**
 * Heatmap: promedio de toneladas por persona por país y década. `pivot` con `agg: 'mean'` deja
 * una fila por década y una columna por país; luego se vuelve a formato largo (década, país,
 * media), que es lo que el heatmap consume.
 */
export default async function calor(): Promise<ChartConfig> {
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
    plugins: [tooltipPlugin()],
  };
}

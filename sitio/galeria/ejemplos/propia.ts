import {
  categoryColumn,
  DataTable,
  titlePlugin,
  tooltipPlugin,
  type ChartConfig,
  type Column,
} from 'xilaplot';
import { co2 } from './datos';

/**
 * Cada fila contra sí misma: `heatmap.scale: 'row'` colorea cada celda por su diferencia con la
 * mediana de su propio país (azul por debajo, naranja por encima) y `rowLabels: 'max'` escribe
 * el año del máximo y la mediana. Una fila por país y una columna por año, en formato largo.
 */
export default async function propia(): Promise<ChartConfig> {
  const tabla = await co2();
  const columnas: Record<string, Column> = {};
  for (const nombre of tabla.names()) columnas[nombre] = tabla.column(nombre);
  columnas['anio'] = categoryColumn(
    Array.from(tabla.numeric('fecha'), (ms) => String(new Date(ms).getUTCFullYear())),
  );
  return {
    type: 'heatmap',
    data: new DataTable(columnas),
    series: [{ id: 't', name: 't por persona', x: 'anio', y: 'pais', value: 'co2_t_por_persona' }],
    heatmap: { scale: 'row', rowLabels: 'max' },
    plugins: [
      titlePlugin({
        title:
          'Alemania y Estados Unidos ya bajaron de su mediana; China e India están en su máximo',
        subtitle: 'Cada fila contra su propia mediana',
      }),
      tooltipPlugin(),
    ],
  };
}

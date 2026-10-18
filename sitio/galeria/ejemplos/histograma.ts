import { histogramTable, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Histograma: distribución de toneladas por persona en todos los país-año (Freedman–Diaconis). */
export default async function histograma(): Promise<ChartConfig> {
  const tabla = await co2();
  return {
    type: 'bar',
    bar: { padding: 0, radius: 0, gap: 1 },
    data: histogramTable(tabla.numeric('co2_t_por_persona'), {
      binColumn: 'rango',
      countColumn: 'n',
    }),
    series: [{ id: 'n', name: 'País-años', x: 'rango', y: 'n' }],
    plugins: [tooltipPlugin()],
    axes: { x: { title: 't de CO₂ por persona' }, y: { title: 'Frecuencia' } },
  };
}

import { tooltipPlugin, zoomPanPlugin, type ChartConfig } from 'xilaplot';
import { pais } from './datos';

/** Serie temporal: emisiones anuales de México. Rueda para hacer zoom, arrastrar para mover. */
export default async function linea(): Promise<ChartConfig> {
  return {
    type: 'line',
    data: await pais('México'),
    series: [{ id: 'mx', name: 'México', x: 'fecha', y: 'co2_mt' }],
    plugins: [tooltipPlugin(), zoomPanPlugin()],
    axes: { y: { title: 'Mt de CO₂' } },
  };
}

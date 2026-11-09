import { tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from '@demos/datos';

/** Base de la ficha `dots`: un punto por país-año, 525 casos de toneladas por persona. */
export default async function dots(): Promise<ChartConfig> {
  return {
    type: 'dots',
    data: await co2(),
    series: [{ id: 'c', name: 'país-año', x: 'co2_t_por_persona' }],
    plugins: [tooltipPlugin()],
    axes: { x: { title: 't de CO₂ por persona' } },
  };
}

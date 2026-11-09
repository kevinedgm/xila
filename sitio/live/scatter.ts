import { tooltipPlugin, type ChartConfig } from 'xilaplot';
import { pais } from '@demos/datos';

/** Base de la ficha `scatter`: PIB por persona frente a emisiones por persona, un punto por año de China. */
export default async function scatter(): Promise<ChartConfig> {
  return {
    type: 'scatter',
    data: await pais('China'),
    series: [{ id: 'cn', name: 'China', x: 'pib_per_capita', y: 'co2_t_por_persona' }],
    plugins: [tooltipPlugin()],
    axes: { x: { title: 'PIB por persona' }, y: { title: 't de CO₂ por persona' } },
  };
}

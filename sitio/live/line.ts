import { tooltipPlugin, type ChartConfig } from 'xilaplot';
import { pais } from '@demos/datos';

/** Base de la ficha `line`: emisiones anuales de México, con un hueco para que `spanGaps` tenga algo que unir. */
export default async function line(): Promise<ChartConfig> {
  return {
    type: 'line',
    data: await pais('México'),
    series: [{ id: 'mx', name: 'México', x: 'fecha', y: 'co2_mt' }],
    plugins: [tooltipPlugin()],
    axes: { y: { title: 'Mt de CO₂' } },
  };
}

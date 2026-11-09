import { tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from '@demos/datos';

/** Base de la ficha `box`: el reparto de 75 años de emisiones por persona, un grupo por país (formato largo). */
export default async function box(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 't', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    box: { shade: 'fecha' },
    plugins: [tooltipPlugin()],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}

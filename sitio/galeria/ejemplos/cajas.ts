import { tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Box plot: la distribución 1950–2024 de toneladas por persona, por país, directo del formato largo. */
export default async function cajas(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    plugins: [tooltipPlugin()],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}

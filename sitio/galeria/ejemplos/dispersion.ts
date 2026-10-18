import { tooltipPlugin, zoomPanPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Dispersión: PIB per cápita contra toneladas por persona, un punto por país y año. */
export default async function dispersion(): Promise<ChartConfig> {
  return {
    type: 'scatter',
    data: await co2(),
    series: [{ id: 'p', name: 'País-año', x: 'pib_per_capita', y: 'co2_t_por_persona' }],
    plugins: [tooltipPlugin({ mode: 'nearest' }), zoomPanPlugin({ axis: 'xy' })],
    scales: { x: { type: 'log' } },
    axes: { x: { title: 'PIB per cápita (USD, log)' }, y: { title: 't de CO₂ por persona' } },
  };
}

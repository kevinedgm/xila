import { groupBy, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from '@demos/datos';

/** Base de la ficha `waffle`: las emisiones de 2024 de cada país como parte del total de los siete. */
export default async function waffle(): Promise<ChartConfig> {
  const ultimo = groupBy(await co2(), 'pais', { agg: 'last', column: 'co2_mt', as: 'mt' });
  return {
    type: 'waffle',
    data: ultimo,
    series: [{ id: 'mt', name: 'Mt de CO₂ en 2024', x: 'pais', y: 'mt' }],
    plugins: [tooltipPlugin()],
  };
}

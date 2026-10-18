import { filterRows, tooltipPlugin, type ChartConfig } from '@xila/core';
import { co2 } from './datos';

/** Barras: emisiones de 2023 por país. `filterRows` acepta condiciones declarativas con rango inclusivo. */
export default async function barras(): Promise<ChartConfig> {
  const tabla = await co2();
  const año2023 = filterRows(tabla, {
    column: 'fecha',
    min: Date.UTC(2023, 0, 1),
    max: Date.UTC(2023, 11, 31),
  });
  return {
    type: 'bar',
    data: año2023,
    series: [{ id: 'mt', name: 'Mt de CO₂ en 2023', x: 'pais', y: 'co2_mt' }],
    plugins: [tooltipPlugin()],
    axes: { y: { title: 'Mt de CO₂' } },
  };
}

import { filterRows, titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Unidades del total: cada cuadro vale 100 Mt; los de un país van juntos y se cuenta su parte. */
export default async function total(): Promise<ChartConfig> {
  const año2024 = filterRows(await co2(), {
    column: 'fecha',
    min: Date.UTC(2024, 0, 1),
    max: Date.UTC(2024, 11, 31),
  });
  return {
    type: 'waffle',
    data: año2024,
    series: [{ id: 'mt', x: 'pais', y: 'co2_mt' }],
    waffle: { unit: 100 },
    plugins: [
      titlePlugin({
        title: 'China emite más de la mitad del total de los siete',
        subtitle: 'Millones de toneladas de CO₂ en 2024; cada cuadro, 100 Mt',
      }),
      tooltipPlugin(),
    ],
  };
}

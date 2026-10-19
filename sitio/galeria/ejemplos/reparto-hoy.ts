import { titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Hoy frente a su historia: bandas de percentiles y el valor de 2024 con su contexto. */
export default async function hoy(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    box: { mark: 'range', now: 'last' },
    plugins: [
      titlePlugin({
        title: 'Alemania está hoy en lo más bajo de su historia; China e India, en su máximo',
        subtitle: 'Bandas del percentil 10 al 90 y del 25 al 75; el punto es 2024',
      }),
      tooltipPlugin(),
    ],
    axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
  };
}

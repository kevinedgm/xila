import { titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Franja de densidad: la intensidad es cuántos años caen en cada tramo. */
export default async function franja(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    box: { mark: 'density' },
    plugins: [
      titlePlugin({
        title: 'Estados Unidos lleva 75 años entre 14 y 22 t; India nunca pasó de 2,2',
        subtitle: 'Más oscuro, más años en ese tramo; raya en la mediana',
      }),
      tooltipPlugin(),
    ],
    axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
  };
}

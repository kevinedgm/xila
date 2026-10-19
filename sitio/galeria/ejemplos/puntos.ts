import {
  filterRows,
  referencePlugin,
  titlePlugin,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2 } from './datos';

/** Puntos con referencia: donde terminaría cada barra, un punto; la distancia al promedio es la respuesta. */
export default async function puntos(): Promise<ChartConfig> {
  const año2024 = filterRows(await co2(), {
    column: 'fecha',
    min: Date.UTC(2024, 0, 1),
    max: Date.UTC(2024, 11, 31),
  });
  return {
    type: 'bar',
    data: año2024,
    series: [{ id: 'pc', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    bar: { mark: 'dot' },
    plugins: [
      titlePlugin({
        title: 'Estados Unidos emite dos veces el promedio; India, una tercera parte',
        subtitle: 'Toneladas de CO₂ por persona en 2024',
      }),
      tooltipPlugin(),
      referencePlugin({ value: 'mean', format: (v) => v.toFixed(1) }),
    ],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}

import { titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Un punto por año: un enjambre por país, con el tono por fecha y el valor de hoy marcado. */
export default async function puntos(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    box: { mark: 'dots', shade: 'fecha', now: 'last' },
    plugins: [
      titlePlugin({
        title: 'China pasó de los años claros abajo a los oscuros arriba; Alemania, al revés',
        subtitle: 'Un punto por año, de 1950 (claro) a 2024 (oscuro); raya en la mediana',
      }),
      tooltipPlugin(),
    ],
    axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
  };
}

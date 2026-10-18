import { endLabelsPlugin, legendPlugin, pivot, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/**
 * Varias series: toneladas por persona. `pivot` pasa de formato largo a una columna por país y
 * `endLabelsPlugin` nombra cada línea en su extremo, para no ir y venir a la leyenda.
 */
export default async function multi(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = ['Estados Unidos', 'Alemania', 'China', 'México'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [tooltipPlugin(), legendPlugin(), endLabelsPlugin({ format: (v) => v.toFixed(1) })],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}

import { nowPlugin, pivot, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/**
 * La muestra de la portada: «ahora con estela», la primera alternativa de la tabla del README. Cifra actual por país,
 * cambio en diez años y la historia como estela.
 */
export default async function portada(): Promise<ChartConfig> {
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
    plugins: [
      tooltipPlugin(),
      nowPlugin({ position: 'top', format: (v) => v.toFixed(1), labels: { ago: 'en {n} años' } }),
    ],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}

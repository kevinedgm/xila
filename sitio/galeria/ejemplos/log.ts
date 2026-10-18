import { legendPlugin, pivot, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Escala logarítmica: siete países que difieren en dos órdenes de magnitud, todos legibles. */
export default async function log(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), { index: 'fecha', columns: 'pais', values: 'co2_mt' });
  const paises = ['China', 'Estados Unidos', 'India', 'Alemania', 'Brasil', 'México', 'España'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [tooltipPlugin(), legendPlugin()],
    scales: { y: { type: 'log' } },
    axes: { y: { title: 'Mt de CO₂ (log)' } },
  };
}

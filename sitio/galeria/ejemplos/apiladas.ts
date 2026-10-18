import { legendPlugin, pivot, tooltipPlugin, type ChartConfig } from '@xila/core';
import { co2, conDecada } from './datos';

/**
 * Barras apiladas: emisiones acumuladas por década y país. `conDecada` añade la categoría de
 * la década y `pivot` deja una columna por país sumando las filas que caen en la misma celda.
 */
export default async function apiladas(): Promise<ChartConfig> {
  const porDecada = conDecada(await co2());
  const ancho = pivot(porDecada, {
    index: 'decada',
    columns: 'pais',
    values: 'co2_mt',
    agg: 'sum',
  });
  const paises = ['China', 'Estados Unidos', 'India', 'Alemania', 'Brasil', 'México', 'España'];
  return {
    type: 'bar',
    bar: { mode: 'stacked' },
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'decada', y: p })),
    plugins: [tooltipPlugin(), legendPlugin({ position: 'bottom' })],
    axes: { y: { title: 'Mt de CO₂ acumuladas' } },
  };
}

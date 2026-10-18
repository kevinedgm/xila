import { legendPlugin, pivot, tooltipPlugin, type ChartConfig } from '@xila/core';
import { co2 } from './datos';
import { ultimoValorPlugin } from './ultimo-valor';

/** Plugin propio: `ultimoValorPlugin` (ver la guía "Crear un plugin") etiqueta el final de cada serie. */
export default async function plugin(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = ['Estados Unidos', 'Alemania', 'China', 'México', 'India'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [tooltipPlugin(), legendPlugin(), ultimoValorPlugin()],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}

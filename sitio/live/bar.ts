import { DataTable, groupBy, type ChartConfig } from 'xilaplot';
import { co2 } from '@demos/datos';

/** Base de la ficha `bar`: por país, toneladas por persona en 1950 y en 2024 (dos series para `stacked`). */
export default async function bar(): Promise<ChartConfig> {
  const tabla = await co2();
  const primero = groupBy(tabla, 'pais', {
    agg: 'first',
    column: 'co2_t_por_persona',
    as: 'v1950',
  });
  const ultimo = groupBy(tabla, 'pais', { agg: 'last', column: 'co2_t_por_persona', as: 'v2024' });
  const data = new DataTable({
    pais: primero.column('pais'),
    v1950: primero.column('v1950'),
    v2024: ultimo.column('v2024'),
  });
  return {
    type: 'bar',
    data,
    series: [
      { id: 'a', name: '1950', x: 'pais', y: 'v1950' },
      { id: 'b', name: '2024', x: 'pais', y: 'v2024' },
    ],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}

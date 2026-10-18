import { selectionPlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Unidades: un punto por país-año, apilados por cubeta; arrastrar cuenta los de un rango. */
export default async function unidades(): Promise<ChartConfig> {
  const tabla = await co2();
  return {
    type: 'dots',
    dots: { mode: 'binned' },
    data: tabla,
    series: [{ id: 'casos', name: 'País-año', x: 'co2_t_por_persona' }],
    plugins: [
      selectionPlugin({ unit: ['país-año', 'país-años'] }),
      tooltipPlugin({ mode: 'nearest', formatY: (v) => `${v.toFixed(2)} t` }),
    ],
    axes: { x: { title: 't de CO₂ por persona' }, y: { title: 'País-años' } },
  };
}

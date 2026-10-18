import { annotationsPlugin, tooltipPlugin, zoomPanPlugin, type ChartConfig } from '@xila/core';
import { pais } from './datos';

/** Anotaciones en valores de datos: siguen al zoom y al cambio de tamaño sin recalcular nada. */
export default async function anotaciones(): Promise<ChartConfig> {
  return {
    type: 'line',
    data: await pais('China'),
    series: [{ id: 'cn', name: 'China', x: 'fecha', y: 'co2_mt' }],
    plugins: [
      tooltipPlugin(),
      zoomPanPlugin(),
      annotationsPlugin([
        {
          type: 'band',
          axis: 'x',
          from: new Date('2001-12-11'),
          to: new Date('2008-09-15'),
          label: 'OMC → crisis 2008',
          description: 'De la entrada a la OMC a la caída de Lehman Brothers',
        },
        { type: 'line', axis: 'x', value: new Date('2020-01-01'), label: 'COVID-19', dash: [4, 3] },
        { type: 'line', axis: 'y', value: 10_000, label: '10 000 Mt', color: '#b45309' },
      ]),
    ],
    axes: { y: { title: 'Mt de CO₂' } },
  };
}

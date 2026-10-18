import {
  accessibilityPlugin,
  legendPlugin,
  pivot,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2 } from './datos';

/**
 * Accesibilidad: haz clic en el gráfico y usa ← → para recorrer los datos, ↑ ↓ para cambiar de
 * serie. Un lector de pantalla recibe un resumen generado y una tabla oculta con los datos.
 */
export default async function accesible(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'porcentaje_global',
  });
  return {
    type: 'line',
    line: { area: true },
    data: ancho,
    series: [
      { id: 'us', name: 'Estados Unidos', x: 'fecha', y: 'Estados Unidos' },
      { id: 'cn', name: 'China', x: 'fecha', y: 'China' },
    ],
    plugins: [tooltipPlugin(), legendPlugin(), accessibilityPlugin()],
    axes: { y: { title: '% de las emisiones globales' } },
  };
}

import { focusPlugin, pivot, titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Protagonista y contexto: una serie en color con su valor; las demás en gris con su nombre. */
export default async function protagonista(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = ['Estados Unidos', 'Alemania', 'España', 'China', 'México', 'Brasil', 'India'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [
      titlePlugin({
        title: 'México emite hoy lo mismo que España en 1970',
        subtitle: 'Toneladas de CO₂ por persona y año',
      }),
      tooltipPlugin(),
      focusPlugin({ series: 'México', format: (v) => v.toFixed(1) }),
    ],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}

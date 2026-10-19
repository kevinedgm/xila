import {
  DataTable,
  filterRows,
  pivot,
  titlePlugin,
  tooltipPlugin,
  trajectoryPlugin,
  type ChartConfig,
  type Column,
} from 'xilaplot';
import { co2 } from './datos';

/** Trayectorias: cada país es un camino en el plano PIB–CO₂; la protagonista en color, el resto en gris. */
export default async function trayectorias(): Promise<ChartConfig> {
  const tabla = await co2();
  const pib = tabla.numeric('pib_per_capita');
  const fechas = tabla.numeric('fecha');
  const desde1970 = filterRows(
    tabla,
    (i) =>
      (fechas[i] as number) >= Date.UTC(1970, 0, 1) && (pib[i] as number) === (pib[i] as number),
  );
  // Cada país necesita su par de columnas x/y: dos pivots (PIB y CO₂) juntos en una tabla ancha.
  const pibAncho = pivot(desde1970, { index: 'fecha', columns: 'pais', values: 'pib_per_capita' });
  const co2Ancho = pivot(desde1970, {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = pibAncho.names().filter((n) => n !== 'fecha');
  const columnas: Record<string, Column> = { fecha: pibAncho.column('fecha') };
  for (const p of paises) {
    columnas[`pib ${p}`] = pibAncho.column(p);
    columnas[`co2 ${p}`] = co2Ancho.column(p);
  }
  return {
    type: 'scatter',
    data: new DataTable(columnas),
    series: paises.map((p) => ({ id: p, name: p, x: `pib ${p}`, y: `co2 ${p}` })),
    scales: { x: { type: 'log' } },
    axes: { x: { title: 'PIB por persona, $ (log)' }, y: { title: 't de CO₂ por persona' } },
    plugins: [
      titlePlugin({
        title: 'China sube en diagonal; Alemania y Estados Unidos bajan mientras se enriquecen',
        subtitle: 'Camino de cada país de 1970 a 2022',
      }),
      tooltipPlugin(),
      trajectoryPlugin({
        time: 'fecha',
        series: 'China',
        formatTime: (t) => String(new Date(t).getUTCFullYear()),
        format: (v) => `${v.toFixed(1)} t`,
        formatX: (v) => `${Math.round(v / 1000)} k$`,
      }),
    ],
  };
}

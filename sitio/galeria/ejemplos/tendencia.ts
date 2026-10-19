import {
  DataTable,
  filterRows,
  numberColumn,
  titlePlugin,
  tooltipPlugin,
  trendPlugin,
  type ChartConfig,
  type Column,
} from 'xilaplot';
import { co2 } from './datos';

/** Contra lo esperado: la tendencia dice cuánto "debería" emitir cada país; el tallo es la diferencia. */
export default async function tendencia(): Promise<ChartConfig> {
  const tabla = await co2();
  const fechas = tabla.numeric('fecha');
  const en2022 = filterRows(tabla, (i) => (fechas[i] as number) === Date.UTC(2022, 0, 1));
  // Una serie por país (una fila cada una) para que la lista y los puntos lleven su color.
  const pais = en2022.column('pais');
  const nombres =
    pais.kind === 'category' ? Array.from(pais.codes, (c) => pais.categories[c] ?? '') : [];
  const columnas: Record<string, Column> = {};
  const pib = en2022.numeric('pib_per_capita');
  const pc = en2022.numeric('co2_t_por_persona');
  nombres.forEach((n, i) => {
    columnas[`pib ${n}`] = numberColumn([pib[i] as number]);
    columnas[`co2 ${n}`] = numberColumn([pc[i] as number]);
  });
  return {
    type: 'scatter',
    data: new DataTable(columnas),
    series: nombres.map((n) => ({ id: n, name: n, x: `pib ${n}`, y: `co2 ${n}` })),
    scatter: { radius: 5 },
    scales: { x: { type: 'log' } },
    axes: { x: { title: 'PIB por persona, $ (log)' }, y: { title: 't de CO₂ por persona' } },
    plugins: [
      titlePlugin({
        title: 'Estados Unidos y China emiten más de lo que su riqueza predice; España, menos',
        subtitle: 'Siete países en 2022 y la tendencia entre ellos',
      }),
      tooltipPlugin(),
      trendPlugin({ label: 'tendencia de estos siete', format: (v) => `${v.toFixed(1)} t` }),
    ],
  };
}

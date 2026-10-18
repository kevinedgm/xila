import { categoryColumn, DataTable, fetchCsv, splitBy, type Column } from 'xilaplot';

/**
 * Emisiones de CO₂ 1950–2024 de siete países (Our World in Data, limpiado con pandas según
 * `docs/contrato-csv.md`). Columnas: fecha, pais, co2_mt, co2_t_por_persona, porcentaje_global,
 * poblacion, pib_per_capita. Se descarga una vez y se comparte entre los ejemplos.
 */
let promesa: Promise<DataTable> | null = null;

export function co2(): Promise<DataTable> {
  promesa ??= fetchCsv(`${import.meta.env.BASE_URL}co2.csv`).then((r) => r.table);
  return promesa;
}

/** La tabla de un solo país, ordenada por fecha como viene en el CSV. */
export async function pais(nombre: string): Promise<DataTable> {
  const tabla = splitBy(await co2(), 'pais').get(nombre);
  if (!tabla) throw new Error(`No hay datos de ${nombre}`);
  return tabla;
}

/** La misma tabla con una columna categórica `decada` ("1950s", "1960s", …) derivada de `fecha`. */
export function conDecada(tabla: DataTable): DataTable {
  const columnas: Record<string, Column> = {};
  for (const nombre of tabla.names()) columnas[nombre] = tabla.column(nombre);
  columnas['decada'] = categoryColumn(
    Array.from(
      tabla.numeric('fecha'),
      (ms) => `${Math.floor(new Date(ms).getUTCFullYear() / 10) * 10}s`,
    ),
  );
  return new DataTable(columnas);
}

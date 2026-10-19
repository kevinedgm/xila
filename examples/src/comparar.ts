import { DataTable, DotRank, Waffle, categoryColumn, fetchCsv, numberColumn } from 'xilaplot';

/**
 * Las dos propuestas elegidas para "comparar": Puntos y promedio (DotRank) y Cien cuadros
 * (Waffle), con el último año de los datos de CO₂. `window.puntos` y `window.cuadros` quedan
 * para las pruebas.
 */
const { table } = await fetchCsv('/co2/data/co2.csv');
const fecha = table.numeric('fecha');
const pais = table.column('pais');
const porPersona = table.numeric('co2_t_por_persona');
const total = table.numeric('co2_mt');
const ultimo = Math.max(...fecha);

const nombres: string[] = [];
const pc: number[] = [];
const mt: number[] = [];
if (pais.kind === 'category') {
  for (let i = 0; i < fecha.length; i++) {
    if (fecha[i] !== ultimo) continue;
    nombres.push(pais.categories[pais.codes[i] as number] ?? '');
    pc.push(porPersona[i] as number);
    mt.push(total[i] as number);
  }
}
const datos = new DataTable({
  pais: categoryColumn(nombres),
  pc: numberColumn(pc),
  mt: numberColumn(mt),
});
const uno = (v: number): string =>
  v.toLocaleString('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const puntos = new DotRank(document.getElementById('puntos') as HTMLElement, {
  data: datos,
  category: 'pais',
  value: 'pc',
  reference: 'mean',
  format: uno,
  unit: 't por persona',
  theme: 'xila',
});

const cuadros = new Waffle(document.getElementById('cuadros') as HTMLElement, {
  data: datos,
  category: 'pais',
  value: 'mt',
  format: (v) => Math.round(v).toLocaleString('es-MX'),
  unit: 'Mt',
  theme: 'xila',
});

Object.assign(window, { puntos, cuadros });

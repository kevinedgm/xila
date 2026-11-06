import diarioCsv from '../../../examples/public/cafeteria/data/diario.csv?raw';
import { describe, expect, it } from 'vitest';
import { answerText, compareRange, rangeText } from './answer';
import { parseCsv } from './data/csv';
import { filterRows } from './data/transform';
import { formatCurrency } from './format/number';

const diario = parseCsv(diarioCsv).table;
const GUELAGUETZA = [{ nombre: 'Guelaguetza', meses: [7] }];
const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

describe('compareRange con la cafetería simulada', () => {
  const facts = compareRange({
    table: diario,
    time: 'fecha',
    value: 'ventas_mxn',
    category: 'sucursal',
    seasons: GUELAGUETZA,
  });

  it('sin rango toma los últimos 28 días y compara con 52 semanas antes', () => {
    expect(facts).not.toBeNull();
    expect(new Date(facts!.from).toISOString().slice(0, 10)).toBe('2025-08-04');
    expect(new Date(facts!.to).toISOString().slice(0, 10)).toBe('2025-08-31');
    expect(new Date(facts!.yearAgo!.from).toISOString().slice(0, 10)).toBe('2024-08-05');
    // Cifras verificadas a mano con pandas sobre diario.csv.
    expect(facts!.yearAgo!.change).toBeGreaterThan(0.15);
    expect(facts!.previous!.change).toBeLessThan(-0.05);
    expect(facts!.previous!.season).toBe('Guelaguetza');
  });

  it('dice primero el año, luego el periodo anterior con la temporada', () => {
    const text = answerText(facts!, {
      subject: 'las ventas',
      format: (v) => formatCurrency(Math.round(v)),
      groups: 'las sucursales',
    });
    expect(text).toMatch(/^Del 4 al 31 de agosto de 2025, las ventas suman \$/);
    expect(text).toMatch(/20 ?% más que en las mismas fechas del año pasado\./);
    expect(text).toMatch(
      /Contra las 4 semanas anteriores bajaron 10 ?%, pero esas fechas fueron de Guelaguetza\./,
    );
    expect(text).toMatch(
      /Las tres sucursales están arriba del año pasado; Jalatlaco, la que más \(\+34 ?%\)\./,
    );
  });

  it('es determinista', () => {
    const again = compareRange({
      table: diario,
      time: 'fecha',
      value: 'ventas_mxn',
      category: 'sucursal',
      seasons: GUELAGUETZA,
    });
    expect(again).toEqual(facts);
  });
});

describe('compareRange en los bordes', () => {
  it('sin un año de datos no inventa la comparación anual', () => {
    const recientes = filterRows(diario, { column: 'fecha', min: '2025-01-01' });
    const f = compareRange({ table: recientes, time: 'fecha', value: 'ventas_mxn' })!;
    expect(f.yearAgo).toBeNull();
    const text = answerText(f, { subject: 'las ventas', format: String });
    expect(text).toContain('Todavía no hay datos de hace un año');
  });

  it('un rango al inicio de los datos no tiene periodo anterior', () => {
    const f = compareRange({
      table: diario,
      time: 'fecha',
      value: 'ventas_mxn',
      range: [day('2024-01-01'), day('2024-01-31')],
    })!;
    expect(f.previous).toBeNull();
    expect(f.days).toBe(31);
  });

  it('cambios menores al umbral se dicen como lo mismo', () => {
    const text = answerText(
      {
        from: day('2025-08-01'),
        to: day('2025-08-07'),
        days: 7,
        value: 101,
        yearAgo: { from: 0, to: 0, value: 100, change: 0.01, season: null },
        previous: { from: 0, to: 0, value: 102, change: -0.01, season: null },
        season: null,
        groups: null,
        threshold: 0.03,
      },
      { subject: 'los pedidos', format: String },
    );
    expect(text).toBe(
      'Del 1 al 7 de agosto de 2025, los pedidos suman 101: prácticamente lo mismo que en las mismas fechas del año pasado. Contra la semana anterior quedaron prácticamente igual.',
    );
  });

  it('nombra rangos que cruzan mes y año', () => {
    expect(rangeText(day('2025-07-07'), day('2025-08-03'))).toBe(
      'del 7 de julio al 3 de agosto de 2025',
    );
    expect(rangeText(day('2024-12-01'), day('2025-01-31'))).toBe(
      'del 1 de diciembre de 2024 al 31 de enero de 2025',
    );
  });

  it('sin datos devuelve null', () => {
    const vacia = filterRows(diario, () => false);
    expect(compareRange({ table: vacia, time: 'fecha', value: 'ventas_mxn' })).toBeNull();
  });
});

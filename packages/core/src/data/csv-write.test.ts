import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { tableToCsv } from './csv-write';

describe('tableToCsv', () => {
  it('escribe según el contrato y parseCsv lo vuelve a leer igual', () => {
    const texto = `fecha,region,monto
2026-01-01,Norte,1250.5
2026-01-02T15:30:00Z,"Centro, Bajío",
2026-01-03,"dice ""hola""",-3
`;
    const { table } = parseCsv(texto);
    const salida = tableToCsv(table);
    expect(salida).toBe(texto);
    const otra = parseCsv(salida).table;
    expect(Array.from(otra.numeric('fecha'))).toEqual(Array.from(table.numeric('fecha')));
    expect(Array.from(otra.numeric('monto'))).toEqual([1250.5, Number.NaN, -3]);
  });

  it('permite elegir y ordenar columnas', () => {
    const { table } = parseCsv('a,b\n1,2\n');
    expect(tableToCsv(table, ['b', 'a'])).toBe('b,a\n2,1\n');
  });
});

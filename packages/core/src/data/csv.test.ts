import { describe, expect, it } from 'vitest';
import { CsvError, parseCsv, parseIsoDate } from './csv';

const EJEMPLO = `fecha,region,monto
2026-01-01,Norte,1250.5
2026-01-01,Sur,980
2026-01-02,Norte,
2026-01-02,"Centro, Bajío",1100
`;

describe('parseCsv', () => {
  it('lee el ejemplo del contrato con tipos inferidos', () => {
    const { table, rows, kinds } = parseCsv(EJEMPLO);
    expect(rows).toBe(4);
    expect(kinds).toEqual({ fecha: 'time', region: 'category', monto: 'number' });
    expect(Array.from(table.numeric('monto'))).toEqual([1250.5, 980, Number.NaN, 1100]);
    expect(table.numeric('fecha')[0]).toBe(Date.UTC(2026, 0, 1));
    const region = table.column('region');
    if (region.kind !== 'category') throw new Error();
    expect(region.categories).toEqual(['Norte', 'Sur', 'Centro, Bajío']);
    expect(Array.from(region.codes)).toEqual([0, 1, 0, 2]);
  });

  it('acepta CRLF, BOM, comillas escapadas y última línea sin salto', () => {
    const texto = '﻿nombre,valor\r\n"dice ""hola""",1\r\n"con\nsalto",2';
    const { table } = parseCsv(texto);
    const nombre = table.column('nombre');
    if (nombre.kind !== 'category') throw new Error();
    expect(nombre.categories).toEqual(['dice "hola"', 'con\nsalto']);
    expect(Array.from(table.numeric('valor'))).toEqual([1, 2]);
  });

  it('una coma al final de la línea es una celda vacía', () => {
    const { table } = parseCsv('a,b\n1,\n2,3\n');
    expect(Array.from(table.numeric('b'))).toEqual([Number.NaN, 3]);
  });

  it('reporta número de fila y columna cuando un valor no es número', () => {
    const texto = 'fecha,monto\n2026-01-01,10\n2026-01-02,N/A\n';
    expect(() => parseCsv(texto, { types: { monto: 'number' } })).toThrow(
      'fila 3, columna "monto": "N/A" no es un número',
    );
  });

  it('con tipo inferido, un valor raro después de la muestra también es error', () => {
    const lineas = ['x'];
    for (let i = 0; i < 300; i++) lineas.push(String(i));
    lineas.push('texto');
    let err: unknown;
    try {
      parseCsv(lineas.join('\n'));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CsvError);
    expect((err as CsvError).row).toBe(302);
    expect((err as CsvError).column).toBe('x');
  });

  it('un código con cero a la izquierda se infiere como categoría, y se puede forzar', () => {
    expect(parseCsv('cp,valor\n01000,1\n06600,2\n').kinds['cp']).toBe('category');
    expect(parseCsv('cp,valor\n1000,1\n6600,2\n').kinds['cp']).toBe('number');
    expect(parseCsv('cp,valor\n1000,1\n6600,2\n', { types: { cp: 'category' } }).kinds['cp']).toBe(
      'category',
    );
    expect(parseCsv('v\n0\n0.5\n-0.25\n').kinds['v']).toBe('number');
  });

  it('rechaza filas con distinto número de columnas, encabezados repetidos y comillas sin cerrar', () => {
    expect(() => parseCsv('a,b\n1,2,3\n')).toThrow('fila 2: tiene 3 columnas y el encabezado 2');
    expect(() => parseCsv('a,a\n1,2\n')).toThrow('la columna "a" está repetida');
    expect(() => parseCsv('a\n"abc\n')).toThrow('comillas sin cerrar');
  });

  it('no acepta formatos de número fuera del contrato', () => {
    expect(() => parseCsv('v\n1,5\n')).toThrow('columnas');
    expect(() => parseCsv('v\n$10\n', { types: { v: 'number' } })).toThrow('no es un número');
    expect(() => parseCsv('v\n 10\n', { types: { v: 'number' } })).toThrow('no es un número');
  });

  it('lee 100 000 filas en menos de 500 ms', () => {
    const lineas = ['fecha,region,monto,unidades'];
    const regiones = ['Norte', 'Sur', 'Centro', 'Bajío'];
    for (let i = 0; i < 100_000; i++) {
      const d = new Date(Date.UTC(2024, 0, 1) + i * 60_000).toISOString();
      lineas.push(`${d},${regiones[i % 4]},${(i * 1.5).toFixed(2)},${i % 50}`);
    }
    const texto = lineas.join('\n');
    const t0 = performance.now();
    const { table, kinds } = parseCsv(texto);
    const ms = performance.now() - t0;
    expect(table.length).toBe(100_000);
    expect(kinds).toEqual({
      fecha: 'time',
      region: 'category',
      monto: 'number',
      unidades: 'number',
    });
    expect(ms).toBeLessThan(500);
  });
});

describe('parseIsoDate', () => {
  it('fecha sola y fecha-hora sin zona se interpretan en UTC', () => {
    expect(parseIsoDate('2026-10-18')).toBe(Date.UTC(2026, 9, 18));
    expect(parseIsoDate('2026-10-18T15:30:00')).toBe(Date.UTC(2026, 9, 18, 15, 30));
    expect(parseIsoDate('2026-10-18 15:30')).toBe(Date.UTC(2026, 9, 18, 15, 30));
    expect(parseIsoDate('2026-10-18T15:30:00-06:00')).toBe(Date.UTC(2026, 9, 18, 21, 30));
  });

  it('rechaza lo que no es ISO 8601', () => {
    for (const s of ['18/10/2026', 'Oct 18 2026', '2026-1-1', '', '20261018']) {
      expect(parseIsoDate(s)).toBeNaN();
    }
  });
});

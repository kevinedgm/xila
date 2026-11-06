import diarioCsv from '../../../../examples/public/cafeteria/data/diario.csv?raw';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../data/csv';
import { buildAnswer } from './build';
import { DashboardConfigError, parseDashboard, validateDashboard, type PanelChart } from './config';

const diario = parseCsv(diarioCsv).table;
const panel = {
  tipo: 'linea',
  datos: 'diario',
  x: 'fecha',
  y: 'ventas_mxn',
  color: 'sucursal',
  agregado: 'sum',
  respuesta: { sujeto: 'las ventas', formato: 'moneda', grupos: 'las sucursales' },
} as const satisfies PanelChart;
const temporadas = [{ nombre: 'Guelaguetza', meses: [7] }];

describe('buildAnswer', () => {
  it('sin filtro de fechas responde por las últimas cuatro semanas, en pesos sin centavos', () => {
    const text = buildAnswer(panel, diario, [], temporadas)!;
    expect(text).toMatch(/^Del 4 al 31 de agosto de 2025, las ventas suman \$[\d,]+:/);
    expect(text).not.toMatch(/\.\d\d[: ]/);
    expect(text).toContain('Guelaguetza');
    expect(text).toContain('sucursales');
  });

  it('el filtro de fechas sobre x da el rango; no recorta el año anterior', () => {
    const text = buildAnswer(
      panel,
      diario,
      [{ column: 'fecha', min: '2025-06-01', max: '2025-06-30T23:59:59.999Z' }],
      temporadas,
    )!;
    expect(text).toMatch(/^Del 1 al 30 de junio de 2025/);
    expect(text).toContain('año pasado');
  });

  it('los demás filtros sí se aplican: una sola sucursal no habla de grupos', () => {
    const text = buildAnswer(panel, diario, [{ column: 'sucursal', in: ['Centro'] }], temporadas)!;
    expect(text).toContain('las ventas suman');
    expect(text).not.toContain('sucursales');
  });

  it('sin respuesta, o con x que no es tiempo, no hay frase', () => {
    const sin: PanelChart = { tipo: 'linea', datos: 'diario', x: 'fecha', y: 'ventas_mxn' };
    expect(buildAnswer(sin, diario)).toBeNull();
    expect(buildAnswer({ ...panel, x: 'sucursal' }, diario)).toBeNull();
  });
});

describe('configuración de respuesta y temporadas', () => {
  const base = { titulo: 'T', datos: { diario: 'd.csv' } };
  const errorsOf = (raw: unknown): string[] => {
    try {
      parseDashboard(raw);
      return [];
    } catch (e) {
      return (e as DashboardConfigError).errors.map((x) => x.path);
    }
  };

  it('acepta la configuración de la cafetería', () => {
    expect(errorsOf({ ...base, temporadas, paneles: [panel] })).toEqual([]);
  });

  it('pide sujeto, meses válidos y una sola y', () => {
    expect(
      errorsOf({
        ...base,
        temporadas: [{ nombre: 'Navidad', meses: [13] }],
        paneles: [{ ...panel, y: ['a', 'b'], respuesta: { formato: 'pesos' } }],
      }),
    ).toEqual([
      'temporadas[0].meses',
      'paneles[0].respuesta.sujeto',
      'paneles[0].respuesta.formato',
      'paneles[0].respuesta',
    ]);
  });

  it('con datos cargados, exige que x sea de tiempo', () => {
    const config = parseDashboard({
      ...base,
      paneles: [{ ...panel, x: 'sucursal', color: undefined }],
    });
    const errs = validateDashboard(config, { diario });
    expect(errs.map((e) => e.message).join()).toMatch(/sucursal.*se esperaba time/);
  });
});

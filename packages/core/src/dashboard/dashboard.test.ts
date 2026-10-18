import { describe, expect, it } from 'vitest';
import { parseCsv } from '../data/csv';
import { buildChart, buildKpi } from './build';
import { DashboardConfigError, parseDashboard, validateDashboard } from './config';

const CSV = `fecha,region,monto
2026-01-05,Norte,100
2026-01-20,Sur,80
2026-02-03,Norte,50
2026-02-10,Sur,120
2026-02-28,Norte,60
2026-03-01,Centro,200
2026-03-15,Norte,40
`;
const ventas = parseCsv(CSV).table;

const base = {
  titulo: 'Ventas 2026',
  datos: { ventas: 'data/ventas.csv' },
  paneles: [
    {
      tipo: 'kpi',
      datos: 'ventas',
      valor: { columna: 'monto', agregado: 'sum', formato: 'moneda' },
    },
    { tipo: 'linea', datos: 'ventas', x: 'fecha', y: 'monto', color: 'region' },
  ],
};

describe('parseDashboard', () => {
  it('acepta el ejemplo del plan', () => {
    const cfg = parseDashboard(base);
    expect(cfg.paneles).toHaveLength(2);
  });

  it('junta todos los errores de forma con su ruta', () => {
    let err: unknown;
    try {
      parseDashboard({
        datos: {},
        paneles: [
          { tipo: 'kpi', datos: 'ventas' },
          { tipo: 'lineas', datos: 'ventas', x: 'fecha', y: 'monto' },
          { tipo: 'barras', datos: 'ventas', x: 'fecha', y: 'monto', periodo: 'month' },
        ],
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DashboardConfigError);
    const paths = (err as DashboardConfigError).errors.map((e) => e.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'titulo',
        'datos',
        'paneles[0].valor',
        'paneles[1].tipo',
        'paneles[2].periodo',
      ]),
    );
    const tipo = (err as DashboardConfigError).errors.find((e) => e.path === 'paneles[1].tipo');
    expect(tipo?.message).toContain('¿quisiste decir "linea"?');
  });
});

describe('validateDashboard', () => {
  it('una columna mal escrita muestra el nombre correcto sugerido', () => {
    const cfg = parseDashboard({
      ...base,
      paneles: [{ tipo: 'linea', datos: 'ventas', x: 'fecha', y: 'mnto', color: 'region' }],
    });
    const errors = validateDashboard(cfg, { ventas });
    expect(errors).toEqual([
      {
        path: 'paneles[0].y',
        message: 'la columna "mnto" no existe en ventas; ¿quisiste decir "monto"?',
      },
    ]);
  });

  it('revisa tipos: color debe ser categórica y fechas de filtro, tiempo', () => {
    const cfg = parseDashboard({
      ...base,
      filtros: [{ tipo: 'fechas', datos: 'ventas', columna: 'region' }],
      paneles: [{ tipo: 'linea', datos: 'ventas', x: 'fecha', y: 'monto', color: 'monto' }],
    });
    const errors = validateDashboard(cfg, { ventas });
    expect(errors.map((e) => e.path)).toEqual(['filtros[0].columna', 'paneles[0].color']);
  });

  it('sin errores con el ejemplo válido', () => {
    expect(validateDashboard(parseDashboard(base), { ventas })).toEqual([]);
  });
});

describe('buildKpi', () => {
  it('suma con formato moneda y compara con el mes anterior', () => {
    const r = buildKpi(
      {
        tipo: 'kpi',
        datos: 'ventas',
        valor: { columna: 'monto', agregado: 'sum', formato: 'moneda' },
        comparar: { columna: 'fecha', periodo: 'month' },
      },
      ventas,
    );
    // Marzo: 240; febrero: 230 → +4.3 %
    expect(r.value).toBe(240);
    expect(r.text).toMatch(/240/);
    expect(r.change).toBeCloseTo(10 / 230, 6);
    expect(r.changeText).toMatch(/^\+4\.3/);
  });

  it('los filtros se aplican antes de agregar', () => {
    const r = buildKpi(
      { tipo: 'kpi', datos: 'ventas', valor: { columna: 'monto', agregado: 'mean' } },
      ventas,
      [{ column: 'region', in: ['Sur'] }],
    );
    expect(r.value).toBe(100);
  });
});

describe('buildChart', () => {
  it('color parte en una serie por región sin agregar', () => {
    const cfg = buildChart(
      { tipo: 'linea', datos: 'ventas', x: 'fecha', y: 'monto', color: 'region' },
      ventas,
    );
    expect(cfg.type).toBe('line');
    expect(cfg.series.map((s) => s.id)).toEqual(['Norte', 'Sur', 'Centro']);
    expect(cfg.data.length).toBe(7);
    expect(Array.from(cfg.data.numeric('Sur')).filter((v) => v === v)).toEqual([80, 120]);
  });

  it('barras por mes y región con sum apilado', () => {
    const cfg = buildChart(
      {
        tipo: 'barras',
        datos: 'ventas',
        x: 'fecha',
        y: 'monto',
        color: 'region',
        agregado: 'sum',
        periodo: 'month',
        apilado: true,
      },
      ventas,
    );
    expect(cfg.type).toBe('bar');
    if (cfg.type !== 'bar') return;
    expect(cfg.bar?.mode).toBe('stacked');
    const x = cfg.data.column('fecha_month');
    expect(x.kind).toBe('category');
    if (x.kind === 'category')
      expect(x.categories.map((c) => c.replace('.', ''))).toEqual(['ene 26', 'feb 26', 'mar 26']);
    expect(Array.from(cfg.data.numeric('Norte'))).toEqual([100, 110, 40]);
  });

  it('un filtro de fechas reduce las filas de todas las series', () => {
    const cfg = buildChart(
      { tipo: 'linea', datos: 'ventas', x: 'fecha', y: 'monto', agregado: 'sum', periodo: 'month' },
      ventas,
      [{ column: 'fecha', min: '2026-02-01' }],
    );
    expect(Array.from(cfg.data.numeric('monto'))).toEqual([230, 240]);
  });
});

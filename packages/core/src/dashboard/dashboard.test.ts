import { describe, expect, it } from 'vitest';
import { parseCsv } from '../data/csv';
import { buildChart, buildKpi } from './build';
import { DashboardConfigError, parseDashboard, validateDashboard, type PanelChart } from './config';

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

  it('un filtro con `tambien` revisa la columna en cada tabla que nombra', () => {
    const resumen = parseCsv('mes,monto\n2026-01-01,180\n').table;
    const cfg = parseDashboard({
      ...base,
      datos: { ventas: 'data/ventas.csv', resumen: 'data/resumen.csv' },
      filtros: [{ tipo: 'categoria', datos: 'ventas', columna: 'region', tambien: ['resumen'] }],
    });
    const errors = validateDashboard(cfg, { ventas, resumen });
    expect(errors.map((e) => e.message)).toEqual(['la columna "region" no existe en resumen']);
    expect(() =>
      parseDashboard({
        ...base,
        filtros: [{ tipo: 'categoria', datos: 'ventas', columna: 'region', tambien: ['ventaz'] }],
      }),
    ).toThrow('filtros[0].tambien[0]');
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

describe('formas de "Qué es Xila hoy" en el dashboard', () => {
  const co2 = parseCsv(`fecha,pais,pib,co2
2020-01-01,A,10,1
2021-01-01,A,12,2
2020-01-01,B,20,3
2021-01-01,B,22,2
`).table;
  const datos = { co2: 'data/co2.csv' };

  it('línea con forma protagonista y barras con puntos traen sus plugins', () => {
    const cfg = parseDashboard({
      titulo: 'x',
      datos,
      paneles: [
        {
          tipo: 'linea',
          datos: 'co2',
          x: 'fecha',
          y: 'co2',
          color: 'pais',
          forma: 'protagonista',
          protagonista: 'B',
        },
        { tipo: 'barras', datos: 'co2', x: 'pais', y: 'co2', agregado: 'last', forma: 'puntos' },
        { tipo: 'barras', datos: 'co2', x: 'pais', y: 'co2', agregado: 'sum', forma: 'unidades' },
      ],
    });
    expect(validateDashboard(cfg, { co2 })).toEqual([]);
    const linea = buildChart(cfg.paneles[0] as PanelChart, co2);
    expect(linea.type).toBe('line');
    expect(linea.plugins).toHaveLength(1);
    const puntos = buildChart(cfg.paneles[1] as PanelChart, co2);
    expect(puntos.type).toBe('bar');
    expect(puntos.type === 'bar' && puntos.bar?.mark).toBe('dot');
    expect(buildChart(cfg.paneles[2] as PanelChart, co2).type).toBe('waffle');
  });

  it('trayectorias pivota x e y por categoría sobre el tiempo', () => {
    const cfg = parseDashboard({
      titulo: 'x',
      datos,
      paneles: [
        {
          tipo: 'dispersion',
          datos: 'co2',
          x: 'pib',
          y: 'co2',
          color: 'pais',
          tiempo: 'fecha',
          forma: 'trayectorias',
          protagonista: 'A',
        },
      ],
    });
    expect(validateDashboard(cfg, { co2 })).toEqual([]);
    const chart = buildChart(cfg.paneles[0] as PanelChart, co2);
    expect(chart.type).toBe('scatter');
    expect(chart.series.map((s) => s.id)).toEqual(['A', 'B']);
    expect(chart.data.names()).toEqual(['fecha', 'x A', 'y A', 'x B', 'y B']);
    expect(Array.from(chart.data.numeric('y B'))).toEqual([3, 2]);
  });

  it('cajas y calor leen el formato largo; calor agrega por celda y acepta periodo', () => {
    const cfg = parseDashboard({
      titulo: 'x',
      datos,
      paneles: [
        { tipo: 'cajas', datos: 'co2', x: 'pais', y: 'co2', forma: 'hoy' },
        {
          tipo: 'calor',
          datos: 'co2',
          x: 'fecha',
          y: 'pais',
          valor: 'co2',
          periodo: 'year',
          forma: 'tabla',
        },
      ],
    });
    expect(validateDashboard(cfg, { co2 })).toEqual([]);
    const cajas = buildChart(cfg.paneles[0] as PanelChart, co2);
    expect(cajas.type).toBe('box');
    expect(cajas.type === 'box' && cajas.box?.mark).toBe('range');
    const calor = buildChart(cfg.paneles[1] as PanelChart, co2);
    expect(calor.type).toBe('heatmap');
    expect(calor.data.length).toBe(4);
    expect(Array.from(calor.data.numeric('co2'))).toEqual([1, 3, 2, 2]);
    expect(calor.type === 'heatmap' && calor.heatmap?.values).toBe(true);
  });

  it('rechaza formas que no son del tipo y trayectorias sin tiempo', () => {
    let err: DashboardConfigError | undefined;
    try {
      parseDashboard({
        titulo: 'x',
        datos,
        paneles: [
          { tipo: 'linea', datos: 'co2', x: 'fecha', y: 'co2', forma: 'tabla' },
          { tipo: 'dispersion', datos: 'co2', x: 'pib', y: 'co2', forma: 'trayectorias' },
        ],
      });
    } catch (e) {
      err = e as DashboardConfigError;
    }
    expect(err?.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['paneles[0].forma', 'paneles[1].tiempo', 'paneles[1].color']),
    );
  });
});

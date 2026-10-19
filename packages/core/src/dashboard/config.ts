import type { Aggregation } from '../data/transform';
import type { DataTable } from '../data/table';
import type { TimeUnit } from '../scales/time';

/**
 * Configuración declarativa del dashboard: el archivo que cambia por cliente
 * (`dashboard.json`). Las claves están en español porque lo escribe Kevin a mano junto al
 * notebook; el código interno sigue en inglés.
 *
 * La validación tiene dos niveles: `parseDashboard` revisa la forma (tipos y claves) sin
 * tocar datos, y `validateDashboard` revisa contra las tablas ya cargadas que cada columna
 * exista, sugiriendo la más parecida cuando no. Un error de dedo da
 * "la columna 'mnto' no existe en ventas; ¿quisiste decir 'monto'?", no una pantalla en blanco.
 */

export type FormatoValor = 'numero' | 'entero' | 'moneda' | 'porcentaje';
export type PeriodoTiempo = TimeUnit;

export interface FiltroFechas {
  readonly tipo: 'fechas';
  readonly datos: string;
  readonly columna: string;
  /** Otras tablas con la misma columna a las que también se aplica el filtro. */
  readonly tambien?: readonly string[];
  readonly etiqueta?: string;
}

export interface FiltroCategoria {
  readonly tipo: 'categoria';
  readonly datos: string;
  readonly columna: string;
  /** Otras tablas con la misma columna a las que también se aplica el filtro. */
  readonly tambien?: readonly string[];
  readonly etiqueta?: string;
  /** `true`: permite elegir varias categorías a la vez. */
  readonly multiple?: boolean;
}

export type FiltroConfig = FiltroFechas | FiltroCategoria;

interface PanelBase {
  readonly titulo?: string;
  /** Nombre de la tabla en `datos`. */
  readonly datos: string;
  /** Columnas del grid (1 a 12). Por defecto 12 para gráficos y 3 para KPI. */
  readonly ancho?: number;
}

export interface PanelKpi extends PanelBase {
  readonly tipo: 'kpi';
  readonly valor: {
    readonly columna: string;
    readonly agregado: Aggregation;
    readonly formato?: FormatoValor;
  };
  /** Compara con el periodo anterior de la columna de tiempo indicada. */
  readonly comparar?: { readonly columna: string; readonly periodo: PeriodoTiempo };
}

/**
 * Formas de "Qué es Xila hoy", por tipo de panel. Cada una responde una pregunta distinta a la
 * del gráfico clásico; sin `forma` el panel es el clásico.
 *
 * - `linea`: `ahora` (cifra actual, cambio y estela) o `protagonista` (una en color, resto gris).
 * - `barras`: `puntos` (puntos con referencia al promedio) o `unidades` (un cuadro por cada N).
 * - `dispersion`: `trayectorias` (camino de cada categoría en el tiempo, con `tiempo`) o
 *   `tendencia` (línea esperada, tallos y ranking).
 */
export type FormaLinea = 'ahora' | 'protagonista';
export type FormaBarras = 'puntos' | 'unidades';
export type FormaDispersion = 'trayectorias' | 'tendencia';
export type FormaCajas = 'puntos' | 'franja' | 'hoy';
export type FormaCalor = 'filas' | 'tabla';

export interface PanelGrafico extends PanelBase {
  readonly tipo: 'linea' | 'barras' | 'dispersion';
  readonly forma?: FormaLinea | FormaBarras | FormaDispersion;
  /** Categoría (de `color`) que empieza en color con `protagonista` o `trayectorias`. */
  readonly protagonista?: string;
  /** Referencia de `puntos`: `mean` (defecto), `median` o un número. */
  readonly referencia?: 'mean' | 'median' | number;
  /** Columna de tiempo que ordena el camino de `trayectorias`. */
  readonly tiempo?: string;
  readonly x: string;
  /** Una o varias columnas numéricas. */
  readonly y: string | readonly string[];
  /** Columna categórica que parte `y` en una serie por categoría. */
  readonly color?: string;
  /** Si se indica, las filas con la misma `x` (y mismo `color`) se agregan. */
  readonly agregado?: Aggregation;
  /** Redondea la `x` temporal a esta unidad antes de agregar (día, mes, …). */
  readonly periodo?: PeriodoTiempo;
  readonly apilado?: boolean;
  readonly ejes?: { readonly x?: string; readonly y?: string };
}

/** Reparto de `y` por grupo `x`: box plot clásico o, con `forma`, un punto por caso, franja o hoy. */
export interface PanelCajas extends PanelBase {
  readonly tipo: 'cajas';
  readonly forma?: FormaCajas;
  /** Columna categórica del grupo. */
  readonly x: string;
  /** Columna numérica del valor. */
  readonly y: string;
  /** Columna (numérica o de tiempo) que da el tono de cada punto en `puntos`. */
  readonly sombra?: string;
  readonly ejes?: { readonly x?: string; readonly y?: string };
}

/**
 * Matriz: una celda por `x` × `y` con `valor` agregado. `x` puede ser de tiempo si se da
 * `periodo`. `forma`: `filas` (cada fila contra su mediana) o `tabla` (cifra en cada celda).
 */
export interface PanelCalor extends PanelBase {
  readonly tipo: 'calor';
  readonly forma?: FormaCalor;
  readonly x: string;
  readonly y: string;
  readonly valor: string;
  /** Cómo combinar las filas de cada celda; `mean` por defecto. */
  readonly agregado?: Aggregation;
  readonly periodo?: PeriodoTiempo;
  readonly ejes?: { readonly x?: string; readonly y?: string };
}

export type PanelChart = PanelGrafico | PanelCajas | PanelCalor;
export type PanelConfig = PanelKpi | PanelChart;

export interface DashboardConfig {
  readonly titulo: string;
  /** Nombre de tabla → ruta del CSV relativa al dashboard. */
  readonly datos: Readonly<Record<string, string>>;
  readonly filtros?: readonly FiltroConfig[];
  readonly paneles: readonly PanelConfig[];
  readonly tema?: 'light' | 'dark';
}

export interface ValidationError {
  /** Ruta en el archivo, p. ej. `paneles[2].y`. */
  readonly path: string;
  readonly message: string;
}

export class DashboardConfigError extends Error {
  constructor(readonly errors: readonly ValidationError[]) {
    super(errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
    this.name = 'DashboardConfigError';
  }
}

const AGREGADOS: readonly Aggregation[] = ['sum', 'mean', 'count', 'min', 'max', 'first', 'last'];
const PERIODOS: readonly TimeUnit[] = [
  'second',
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year',
  'decade',
];
const FORMATOS: readonly FormatoValor[] = ['numero', 'entero', 'moneda', 'porcentaje'];
const TIPOS_PANEL = ['kpi', 'linea', 'barras', 'dispersion', 'cajas', 'calor'] as const;
const FORMAS: Record<string, readonly string[]> = {
  linea: ['ahora', 'protagonista'],
  barras: ['puntos', 'unidades'],
  dispersion: ['trayectorias', 'tendencia'],
  cajas: ['puntos', 'franja', 'hoy'],
  calor: ['filas', 'tabla'],
};

/** Revisa la forma del JSON y devuelve la configuración tipada; lanza con todos los errores. */
export function parseDashboard(raw: unknown): DashboardConfig {
  const errors: ValidationError[] = [];
  const fail = (path: string, message: string): void => {
    errors.push({ path, message });
  };
  const obj = isRecord(raw) ? raw : (fail('', 'la configuración debe ser un objeto'), {});

  if (typeof obj['titulo'] !== 'string' || obj['titulo'] === '') fail('titulo', 'falta el título');
  const datos = obj['datos'];
  if (!isRecord(datos) || Object.keys(datos).length === 0) {
    fail('datos', 'debe tener al menos una tabla, p. ej. { "ventas": "data/ventas.csv" }');
  } else {
    for (const [name, path] of Object.entries(datos)) {
      if (typeof path !== 'string' || path === '') fail(`datos.${name}`, 'la ruta debe ser texto');
    }
  }
  const tablas = isRecord(datos) ? Object.keys(datos) : [];
  const checkTabla = (path: string, name: unknown): void => {
    if (typeof name !== 'string') return fail(path, 'falta el nombre de la tabla en "datos"');
    if (!tablas.includes(name))
      fail(path, `la tabla "${name}" no está en "datos"${suggest(name, tablas)}`);
  };
  const checkEnum = (
    path: string,
    value: unknown,
    allowed: readonly string[],
    what: string,
  ): void => {
    if (value === undefined) return;
    if (typeof value !== 'string' || !allowed.includes(value)) {
      fail(
        path,
        `${what} debe ser uno de: ${allowed.join(', ')}${typeof value === 'string' ? suggest(value, allowed) : ''}`,
      );
    }
  };
  const checkCol = (path: string, value: unknown, optional = false): void => {
    if (value === undefined && optional) return;
    if (typeof value !== 'string' || value === '') fail(path, 'debe ser el nombre de una columna');
  };

  if (obj['tema'] !== undefined) checkEnum('tema', obj['tema'], ['light', 'dark'], 'el tema');

  const filtros = obj['filtros'];
  if (filtros !== undefined) {
    if (!Array.isArray(filtros)) fail('filtros', 'debe ser una lista');
    else {
      filtros.forEach((f: unknown, i) => {
        const p = `filtros[${i}]`;
        if (!isRecord(f)) return fail(p, 'debe ser un objeto');
        checkEnum(`${p}.tipo`, f['tipo'] ?? null, ['fechas', 'categoria'], 'el tipo de filtro');
        checkTabla(`${p}.datos`, f['datos']);
        checkCol(`${p}.columna`, f['columna']);
        const tambien = f['tambien'];
        if (tambien !== undefined) {
          if (!Array.isArray(tambien)) fail(`${p}.tambien`, 'debe ser una lista de tablas');
          else tambien.forEach((t: unknown, j) => checkTabla(`${p}.tambien[${j}]`, t));
        }
      });
    }
  }

  const paneles = obj['paneles'];
  if (!Array.isArray(paneles) || paneles.length === 0)
    fail('paneles', 'debe ser una lista con al menos un panel');
  else {
    paneles.forEach((panel: unknown, i) => {
      const p = `paneles[${i}]`;
      if (!isRecord(panel)) return fail(p, 'debe ser un objeto');
      checkEnum(`${p}.tipo`, panel['tipo'] ?? null, TIPOS_PANEL, 'el tipo de panel');
      checkTabla(`${p}.datos`, panel['datos']);
      if (panel['ancho'] !== undefined) {
        const a = panel['ancho'];
        if (typeof a !== 'number' || !Number.isInteger(a) || a < 1 || a > 12)
          fail(`${p}.ancho`, 'debe ser un entero de 1 a 12');
      }
      if (panel['tipo'] === 'kpi') {
        const v = panel['valor'];
        if (!isRecord(v)) fail(`${p}.valor`, 'falta { columna, agregado }');
        else {
          checkCol(`${p}.valor.columna`, v['columna']);
          checkEnum(`${p}.valor.agregado`, v['agregado'] ?? null, AGREGADOS, 'el agregado');
          checkEnum(`${p}.valor.formato`, v['formato'], FORMATOS, 'el formato');
        }
        const c = panel['comparar'];
        if (c !== undefined) {
          if (!isRecord(c)) fail(`${p}.comparar`, 'debe ser { columna, periodo }');
          else {
            checkCol(`${p}.comparar.columna`, c['columna']);
            checkEnum(`${p}.comparar.periodo`, c['periodo'] ?? null, PERIODOS, 'el periodo');
          }
        }
      } else if (panel['tipo'] === 'cajas') {
        checkCol(`${p}.x`, panel['x']);
        checkCol(`${p}.y`, panel['y']);
        checkCol(`${p}.sombra`, panel['sombra'], true);
        checkEnum(`${p}.forma`, panel['forma'], FORMAS['cajas'] as string[], 'la forma');
      } else if (panel['tipo'] === 'calor') {
        checkCol(`${p}.x`, panel['x']);
        checkCol(`${p}.y`, panel['y']);
        checkCol(`${p}.valor`, panel['valor']);
        checkEnum(`${p}.agregado`, panel['agregado'], AGREGADOS, 'el agregado');
        checkEnum(`${p}.periodo`, panel['periodo'], PERIODOS, 'el periodo');
        checkEnum(`${p}.forma`, panel['forma'], FORMAS['calor'] as string[], 'la forma');
      } else if (
        typeof panel['tipo'] === 'string' &&
        TIPOS_PANEL.includes(panel['tipo'] as never)
      ) {
        checkEnum(`${p}.forma`, panel['forma'], FORMAS[panel['tipo']] ?? [], 'la forma');
        if (panel['forma'] === 'trayectorias') {
          checkCol(`${p}.tiempo`, panel['tiempo']);
          checkCol(`${p}.color`, panel['color']);
        }
        if (panel['protagonista'] !== undefined && typeof panel['protagonista'] !== 'string')
          fail(`${p}.protagonista`, 'debe ser el nombre de una categoría de "color"');
        const ref = panel['referencia'];
        if (ref !== undefined && ref !== 'mean' && ref !== 'median' && typeof ref !== 'number')
          fail(`${p}.referencia`, 'debe ser mean, median o un número');
        checkCol(`${p}.x`, panel['x']);
        const y = panel['y'];
        if (Array.isArray(y)) y.forEach((c: unknown, j) => checkCol(`${p}.y[${j}]`, c));
        else checkCol(`${p}.y`, y);
        checkCol(`${p}.color`, panel['color'], true);
        checkEnum(`${p}.agregado`, panel['agregado'], AGREGADOS, 'el agregado');
        checkEnum(`${p}.periodo`, panel['periodo'], PERIODOS, 'el periodo');
        if (panel['periodo'] !== undefined && panel['agregado'] === undefined) {
          fail(`${p}.periodo`, 'requiere "agregado" para combinar las filas de cada periodo');
        }
      }
    });
  }

  if (errors.length > 0) throw new DashboardConfigError(errors);
  return obj as unknown as DashboardConfig;
}

/**
 * Revisa que cada columna exista en su tabla y tenga el tipo que el panel necesita.
 * Devuelve la lista de errores (vacía si todo está bien) para mostrarla en pantalla.
 */
export function validateDashboard(
  config: DashboardConfig,
  tables: Readonly<Record<string, DataTable>>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const column = (
    path: string,
    tableName: string,
    name: string,
    kinds?: readonly string[],
  ): void => {
    const table = tables[tableName];
    if (!table) {
      errors.push({ path, message: `la tabla "${tableName}" no se cargó` });
      return;
    }
    if (!table.has(name)) {
      errors.push({
        path,
        message: `la columna "${name}" no existe en ${tableName}${suggest(name, table.names())}`,
      });
      return;
    }
    const kind = table.column(name).kind;
    if (kinds && !kinds.includes(kind)) {
      errors.push({
        path,
        message: `la columna "${name}" es de tipo ${kind}; se esperaba ${kinds.join(' o ')}`,
      });
    }
  };

  config.filtros?.forEach((f, i) => {
    for (const datos of [f.datos, ...(f.tambien ?? [])])
      column(
        `filtros[${i}].columna`,
        datos,
        f.columna,
        f.tipo === 'fechas' ? ['time'] : ['category'],
      );
  });
  config.paneles.forEach((panel, i) => {
    const p = `paneles[${i}]`;
    if (panel.tipo === 'kpi') {
      column(
        `${p}.valor.columna`,
        panel.datos,
        panel.valor.columna,
        panel.valor.agregado === 'count' ? undefined : ['number', 'time'],
      );
      if (panel.comparar)
        column(`${p}.comparar.columna`, panel.datos, panel.comparar.columna, ['time']);
      return;
    }
    if (panel.tipo === 'cajas') {
      column(`${p}.x`, panel.datos, panel.x, ['category']);
      column(`${p}.y`, panel.datos, panel.y, ['number']);
      if (panel.sombra) column(`${p}.sombra`, panel.datos, panel.sombra, ['number', 'time']);
      return;
    }
    if (panel.tipo === 'calor') {
      column(`${p}.x`, panel.datos, panel.x, panel.periodo ? ['time'] : ['category']);
      column(`${p}.y`, panel.datos, panel.y, ['category']);
      column(`${p}.valor`, panel.datos, panel.valor, ['number']);
      return;
    }
    column(`${p}.x`, panel.datos, panel.x, panel.periodo ? ['time'] : undefined);
    if (panel.tiempo) column(`${p}.tiempo`, panel.datos, panel.tiempo, ['time']);
    const ys = typeof panel.y === 'string' ? [panel.y] : panel.y;
    ys.forEach((y, j) =>
      column(ys.length === 1 ? `${p}.y` : `${p}.y[${j}]`, panel.datos, y, ['number', 'time']),
    );
    if (panel.color) column(`${p}.color`, panel.datos, panel.color, ['category']);
    if (panel.tipo === 'barras' && !panel.agregado) {
      const table = tables[panel.datos];
      if (table?.has(panel.x) && table.column(panel.x).kind === 'time') {
        errors.push({
          path: `${p}.x`,
          message:
            'barras con eje de tiempo necesitan "agregado" y "periodo" (p. ej. sum por month)',
        });
      }
    }
  });
  return errors;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** "; ¿quisiste decir X?" si hay un candidato a distancia de edición pequeña. */
export function suggest(name: string, candidates: readonly string[]): string {
  let best = '';
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name.toLowerCase(), c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best && bestDist <= Math.max(2, Math.floor(name.length / 3))
    ? `; ¿quisiste decir "${best}"?`
    : '';
}

function levenshtein(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] as number;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] as number;
      prev[j] = Math.min(
        tmp + 1,
        (prev[j - 1] as number) + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length] as number;
}

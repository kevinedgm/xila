import { fetchCsv } from '../data/csv';
import type { DataTable } from '../data/table';
import {
  parseDashboard,
  validateDashboard,
  type DashboardConfig,
  type ValidationError,
} from './config';

export interface LoadedDashboard {
  readonly config: DashboardConfig;
  readonly tables: Readonly<Record<string, DataTable>>;
  /** Errores de columnas contra los datos reales; vacío si todo cuadra. */
  readonly errors: readonly ValidationError[];
}

/**
 * Descarga `dashboard.json`, valida su forma, descarga cada CSV (rutas relativas al JSON)
 * y valida las columnas contra las tablas. Los errores de forma se lanzan; los de columnas
 * se devuelven para pintarlos en pantalla junto al dashboard.
 */
export async function loadDashboard(url: string): Promise<LoadedDashboard> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer ${url}: HTTP ${res.status}`);
  const config = parseDashboard(await res.json());
  const base = new URL(url, globalThis.location?.href ?? 'http://localhost/');
  const entries = await Promise.all(
    Object.entries(config.datos).map(async ([name, path]) => {
      const { table } = await fetchCsv(new URL(path, base).href);
      return [name, table] as const;
    }),
  );
  const tables = Object.fromEntries(entries);
  return { config, tables, errors: validateDashboard(config, tables) };
}

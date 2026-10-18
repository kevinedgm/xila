import type { DataTable } from './table';

/**
 * Escribe una tabla como CSV según docs/contrato-csv.md: coma, comillas solo cuando hacen
 * falta, fechas ISO 8601 en UTC, nulos como celda vacía. Lo que sale de aquí lo vuelve a
 * leer `parseCsv` sin pérdida.
 */
export function tableToCsv(table: DataTable, columns: readonly string[] = table.names()): string {
  const cols = columns.map((name) => table.column(name));
  const lines: string[] = [columns.map(quote).join(',')];
  for (let r = 0; r < table.length; r++) {
    const cells: string[] = [];
    for (const c of cols) {
      if (c.kind === 'category') {
        cells.push(quote(c.categories[c.codes[r] as number] ?? ''));
        continue;
      }
      const v = c.values[r] as number;
      if (v !== v) cells.push('');
      else if (c.kind === 'time') cells.push(isoDate(v));
      else cells.push(String(v));
    }
    lines.push(cells.join(','));
  }
  return `${lines.join('\n')}\n`;
}

/** `2026-01-05` si es medianoche UTC; si no, fecha y hora completas con `Z`. */
function isoDate(ms: number): string {
  const iso = new Date(ms).toISOString();
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.replace('.000Z', 'Z');
}

function quote(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

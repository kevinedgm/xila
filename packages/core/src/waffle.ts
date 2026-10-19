import type { Rect } from './plugin';

export interface WaffleCell {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** Índice de la categoría a la que pertenece el cuadro. */
  readonly category: number;
}

export interface WaffleLayout {
  readonly cells: readonly WaffleCell[];
  readonly unit: number;
  readonly columns: number;
  readonly rows: number;
  readonly size: number;
  /** Cuadros por categoría (al menos uno si el valor es positivo). */
  readonly counts: readonly number[];
}

/** Paso redondo (1, 2, 5 × 10ⁿ) que reparte `total` en entre 100 y 250 cuadros. */
export function autoUnit(total: number): number {
  if (!(total > 0)) return 1;
  const raw = total / 150;
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) {
    const step = m * power;
    const n = total / step;
    if (n <= 250) return step;
  }
  return 10 * power;
}

/**
 * Coloca los cuadros fila por fila, de izquierda a derecha y de arriba abajo, con los de cada
 * categoría juntos. `columns: 'auto'` elige las columnas para que la cuadrícula llene el área
 * sin salirse: el lado del cuadro parte de la raíz del área por cuadro y se ajusta al alto.
 */
export function waffleLayout(
  values: readonly number[],
  area: Rect,
  options: { unit: number | 'auto'; columns: number | 'auto'; gap: number },
): WaffleLayout {
  const total = values.reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const unit = options.unit === 'auto' ? autoUnit(total) : options.unit;
  const counts = values.map((v) => (v > 0 ? Math.max(1, Math.round(v / unit)) : 0));
  const n = counts.reduce((s, c) => s + c, 0);
  if (n === 0 || area.width <= 0 || area.height <= 0) {
    return { cells: [], unit, columns: 0, rows: 0, size: 0, counts };
  }
  let columns: number;
  if (options.columns === 'auto') {
    const side = Math.sqrt((area.width * area.height) / n);
    columns = Math.max(1, Math.floor(area.width / side));
    // Si con ese lado las filas no caben, se añaden columnas hasta que quepan.
    while (Math.ceil(n / columns) * (area.width / columns) > area.height && columns < n) columns++;
  } else {
    columns = Math.max(1, options.columns);
  }
  const rows = Math.ceil(n / columns);
  const size = Math.min(area.width / columns, area.height / rows);
  const cells: WaffleCell[] = [];
  let k = 0;
  counts.forEach((count, category) => {
    for (let j = 0; j < count; j++, k++) {
      cells.push({
        x: area.x + (k % columns) * size,
        y: area.y + Math.floor(k / columns) * size,
        size: Math.max(0, size - options.gap),
        category,
      });
    }
  });
  return { cells, unit, columns, rows, size, counts };
}

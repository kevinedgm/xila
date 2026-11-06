import type { DataTable } from './data/table';
import { formatPercent } from './format/number';

/**
 * Frases que responden: para un rango de fechas, compara la cifra contra las mismas fechas del
 * año anterior y contra el periodo anterior del mismo largo, y lo dice en una o tres oraciones.
 *
 * Reglas (plan/presentacion/plan.md):
 * - Mismos datos y mismo rango → misma frase. Nada aleatorio, nada que dependa del reloj.
 * - Describe; no predice, no recomienda ni atribuye causas. La temporada se nombra solo porque
 *   el dueño la declaró (`temporadas`), no porque el motor la deduzca.
 * - Cambios dentro de ±`threshold` (3 %) se dicen como "prácticamente lo mismo".
 * - Sin datos suficientes para una base, esa comparación no se inventa: la frase lo dice.
 *
 * El motor (`compareRange`) devuelve hechos; el texto (`answerText`) sale de ellos.
 */

const DAY = 86_400_000;
/** Un año atrás en días múltiplo de 7: compara lunes con lunes (52 semanas). */
const YEAR = 364 * DAY;

export interface Season {
  readonly nombre: string;
  /** Meses del 1 (enero) al 12. */
  readonly meses: readonly number[];
}

export interface CompareOptions {
  readonly table: DataTable;
  /** Columna de tiempo (fechas en ms, UTC). */
  readonly time: string;
  readonly value: string;
  readonly agg?: 'sum' | 'mean' | 'count';
  /** Columna categórica opcional: compara además cada grupo contra su año anterior. */
  readonly category?: string;
  /** Rango [desde, hasta] en ms, ambos días incluidos. Sin él, los últimos `days` días. */
  readonly range?: readonly [number | null, number | null] | null;
  readonly days?: number;
  /** Cambio relativo por debajo del cual se dice "prácticamente lo mismo" (0.03). */
  readonly threshold?: number;
  readonly seasons?: readonly Season[];
}

export interface Base {
  readonly from: number;
  readonly to: number;
  readonly value: number;
  /** Cambio relativo del rango actual contra esta base. */
  readonly change: number;
  /** Temporada declarada en la que cae la base (y el rango actual no), si la hay. */
  readonly season: string | null;
}

export interface GroupFacts {
  readonly name: string;
  readonly value: number;
  /** Cambio contra las mismas fechas del año anterior; `null` sin datos de ese año. */
  readonly yearAgoChange: number | null;
}

export interface CompareFacts {
  readonly from: number;
  readonly to: number;
  readonly days: number;
  readonly value: number;
  readonly yearAgo: Base | null;
  readonly previous: Base | null;
  /** Temporada en la que cae el rango actual (y el anterior no), si la hay. */
  readonly season: string | null;
  readonly groups: readonly GroupFacts[] | null;
  readonly threshold: number;
}

export function compareRange(options: CompareOptions): CompareFacts | null {
  const { table, time, value } = options;
  const agg = options.agg ?? 'sum';
  const threshold = options.threshold ?? 0.03;
  const t = table.numeric(time);
  const v = table.numeric(value);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < t.length; i++) {
    const x = t[i] as number;
    if (x !== x) continue;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (!Number.isFinite(min)) return null;
  const firstDay = floorDay(min);
  const lastDay = floorDay(max);
  const to = floorDay(Math.min(options.range?.[1] ?? lastDay, lastDay));
  const from = floorDay(
    Math.max(options.range?.[0] ?? to - ((options.days ?? 28) - 1) * DAY, firstDay),
  );
  if (from > to) return null;
  const length = Math.round((to - from) / DAY) + 1;

  const aggregate = (a: number, b: number, rows?: (i: number) => boolean): number => {
    let sum = 0;
    let n = 0;
    const end = b + DAY;
    for (let i = 0; i < t.length; i++) {
      const x = t[i] as number;
      if (!(x >= a && x < end)) continue;
      if (rows && !rows(i)) continue;
      const y = v[i] as number;
      if (y !== y) continue;
      sum += agg === 'count' ? 1 : y;
      n++;
    }
    return agg === 'mean' ? (n ? sum / n : Number.NaN) : n ? sum : Number.NaN;
  };
  const current = aggregate(from, to);
  if (current !== current) return null;
  const change = (now: number, before: number): number | null =>
    before === 0 || before !== before ? null : (now - before) / Math.abs(before);

  const seasonOf = (a: number, b: number): string | null => {
    for (const s of options.seasons ?? []) {
      let inside = 0;
      for (let d = a; d <= b; d += DAY)
        if (s.meses.includes(new Date(d).getUTCMonth() + 1)) inside++;
      if (inside * 2 > Math.round((b - a) / DAY) + 1) return s.nombre;
    }
    return null;
  };
  const here = seasonOf(from, to);

  const base = (a: number, b: number, season: string | null): Base | null => {
    // Solo si los datos cubren la base completa: media base no es una base.
    if (a < firstDay) return null;
    const value = aggregate(a, b);
    const c = change(current, value);
    if (c === null) return null;
    return { from: a, to: b, value, change: c, season };
  };
  const yearAgo = base(from - YEAR, to - YEAR, null);
  const prevFrom = from - length * DAY;
  const there = seasonOf(prevFrom, from - DAY);
  const previous = base(prevFrom, from - DAY, there !== here ? there : null);

  let groups: GroupFacts[] | null = null;
  if (options.category) {
    const col = table.column(options.category);
    if (col.kind === 'category') {
      groups = col.categories
        .map((name, code) => {
          const rows = (i: number): boolean => col.codes[i] === code;
          const now = aggregate(from, to, rows);
          const before = yearAgo ? aggregate(yearAgo.from, yearAgo.to, rows) : Number.NaN;
          return { name, value: now, yearAgoChange: change(now, before) };
        })
        .filter((g) => g.value === g.value)
        .sort((a, b) => b.value - a.value);
    }
  }
  return {
    from,
    to,
    days: length,
    value: current,
    yearAgo,
    previous,
    // La temporada del rango actual se nombra solo si el anterior no estaba en ella.
    season: previous && !previous.season && here !== there ? here : null,
    groups,
    threshold,
  };
}

export interface AnswerTextOptions {
  /** Sujeto en plural con artículo: "las ventas", "los pedidos", "las tazas". */
  readonly subject: string;
  readonly format: (value: number) => string;
  /** Promedio en vez de suma: el verbo pasa de "suman" a "promedian". */
  readonly mean?: boolean;
  /**
   * Los grupos en plural y con artículo ("las sucursales", "los canales"); el artículo da el
   * género de la frase. Sin él no se habla de grupos.
   */
  readonly groups?: string;
  readonly locale?: string;
}

export function answerText(facts: CompareFacts, options: AnswerTextOptions): string {
  const pct = (c: number): string => formatPercent(Math.abs(c), 0, options.locale);
  const flat = (c: number): boolean => Math.abs(c) < facts.threshold;
  const verb = options.mean ? 'promedian' : 'suman';
  const out: string[] = [];

  let first = `${capitalize(rangeText(facts.from, facts.to, options.locale))}, ${options.subject} ${verb} ${options.format(facts.value)}`;
  if (facts.yearAgo) {
    const c = facts.yearAgo.change;
    first += flat(c)
      ? `: prácticamente lo mismo que en las mismas fechas del año pasado.`
      : `: ${pct(c)} ${c > 0 ? 'más' : 'menos'} que en las mismas fechas del año pasado.`;
  } else first += '. Todavía no hay datos de hace un año para comparar.';
  out.push(first);

  if (facts.previous) {
    const c = facts.previous.change;
    const span = spanText(facts.days);
    let s = flat(c)
      ? `Contra ${span} quedaron prácticamente igual`
      : `Contra ${span} ${c > 0 ? 'subieron' : 'bajaron'} ${pct(c)}`;
    if (facts.previous.season) s += `, pero esas fechas fueron de ${facts.previous.season}`;
    else if (facts.season) s += `; estas fechas son de ${facts.season}`;
    out.push(`${s}.`);
  }

  const groups = facts.groups;
  if (options.groups && groups && groups.length > 1 && facts.yearAgo) {
    const known = groups.filter((g) => g.yearAgoChange !== null);
    const up = known.filter((g) => (g.yearAgoChange as number) >= facts.threshold);
    const down = known.filter((g) => (g.yearAgoChange as number) <= -facts.threshold);
    const top = [...known].sort(
      (a, b) => (b.yearAgoChange as number) - (a.yearAgoChange as number),
    );
    const n = known.length;
    const [article, ...rest] = options.groups.split(' ');
    const feminine = article?.toLowerCase() === 'las';
    const noun = rest.join(' ');
    const all = `${capitalize(article ?? '')} ${count(n, feminine)} ${noun}`;
    const which = feminine ? 'la que más' : 'el que más';
    if (n > 1 && up.length === n) {
      const best = top[0] as GroupFacts;
      out.push(
        `${all} están arriba del año pasado; ${best.name}, ${which} (+${pct(best.yearAgoChange as number)}).`,
      );
    } else if (n > 1 && down.length === n) {
      const worst = top[n - 1] as GroupFacts;
      out.push(
        `${all} están abajo del año pasado; ${worst.name}, ${which} bajó (−${pct(worst.yearAgoChange as number)}).`,
      );
    } else if (down.length > 0) {
      const names = down.map((g) => `${g.name} (−${pct(g.yearAgoChange as number)})`);
      out.push(`${listText(names)} ${down.length === 1 ? 'está' : 'están'} abajo del año pasado.`);
    }
  }
  return out.join(' ');
}

function floorDay(ms: number): number {
  return Math.floor(ms / DAY) * DAY;
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('es-MX') + s.slice(1);
}

const NUMBERS = [
  'cero',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
];
function count(n: number, feminine: boolean): string {
  if (n === 1) return feminine ? 'una' : 'un';
  return NUMBERS[n] ?? String(n);
}

function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** "las 4 semanas anteriores", "la semana anterior", "los 31 días anteriores". */
function spanText(days: number): string {
  if (days === 7) return 'la semana anterior';
  if (days % 7 === 0) return `las ${days / 7} semanas anteriores`;
  if (days === 1) return 'el día anterior';
  return `los ${days} días anteriores`;
}

/** "del 4 al 31 de agosto de 2025", "del 7 de julio al 3 de agosto de 2025". */
export function rangeText(from: number, to: number, locale = 'es-MX'): string {
  const a = new Date(from);
  const b = new Date(to);
  const month = (d: Date): string =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(d);
  const day = (d: Date): number => d.getUTCDate();
  const year = (d: Date): number => d.getUTCFullYear();
  if (from === to) return `el ${day(a)} de ${month(a)} de ${year(a)}`;
  if (year(a) !== year(b))
    return `del ${day(a)} de ${month(a)} de ${year(a)} al ${day(b)} de ${month(b)} de ${year(b)}`;
  if (a.getUTCMonth() !== b.getUTCMonth())
    return `del ${day(a)} de ${month(a)} al ${day(b)} de ${month(b)} de ${year(b)}`;
  return `del ${day(a)} al ${day(b)} de ${month(b)} de ${year(b)}`;
}

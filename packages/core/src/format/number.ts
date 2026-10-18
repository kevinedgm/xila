export type NumberFormatter = (value: number) => string;

export interface NumberFormatOptions {
  readonly locale?: string;
  /** Decimales fijos. Si falta, se deducen de `step`. */
  readonly decimals?: number;
  /** Paso entre ticks: con 0.1 basta un decimal, con 0.001 hacen falta tres. */
  readonly step?: number;
}

const DEFAULT_LOCALE = 'es-MX';

/** `decimales = max(0, −floor(log10(paso)))`. Evita etiquetas como 0.30000000000000004. */
export function decimalsForStep(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(15, -Math.floor(Math.log10(step) + 1e-9)));
}

export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  if (!Number.isFinite(value)) return value !== value ? '' : value > 0 ? '∞' : '−∞';
  const decimals = options.decimals ?? decimalsForStep(options.step ?? 1);
  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const SI_PREFIXES: readonly [number, string][] = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
];

/** 1234 → "1.2k", 0.0012 → "1.2m". */
export function formatSI(value: number, decimals = 1, unit = ''): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  if (value === 0) return `0${unit}`;
  const abs = Math.abs(value);
  const [factor, prefix] = SI_PREFIXES.find(([f]) => abs >= f) ?? [1e-9, 'n'];
  const scaled = value / factor;
  return `${trimZeros(scaled.toFixed(decimals))}${prefix}${unit}`;
}

/** 0.00123 → "1.23e-3". */
export function formatScientific(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  return value.toExponential(decimals).replace('e+', 'e');
}

export function formatPercent(value: number, decimals = 0, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCurrency(value: number, currency = 'MXN', locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

/** Formateador para ticks: decimales según el paso y prefijo SI cuando los valores son grandes. */
export function tickFormatter(step: number, maxAbs: number): NumberFormatter {
  if (maxAbs >= 1e6 || (maxAbs > 0 && maxAbs < 1e-3)) {
    const decimals = Math.max(0, Math.ceil(Math.log10(maxAbs / step)) - 1);
    return (v) => formatSI(v, Math.min(decimals, 3));
  }
  return (v) => formatNumber(v, { step });
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

import { describe, expect, it } from 'vitest';
import {
  decimalsForStep,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSI,
  formatScientific,
  tickFormatter,
} from './number';

describe('formatNumber', () => {
  it('0.1 + 0.2 con paso 0.1 se muestra como 0.3', () => {
    expect(formatNumber(0.1 + 0.2, { step: 0.1 })).toBe('0.3');
  });

  it('deduce los decimales del paso', () => {
    expect(decimalsForStep(1)).toBe(0);
    expect(decimalsForStep(0.1)).toBe(1);
    expect(decimalsForStep(0.001)).toBe(3);
    expect(decimalsForStep(20)).toBe(0);
  });

  it('usa separadores de miles en es-MX', () => {
    expect(formatNumber(1234567, { step: 1 })).toBe('1,234,567');
  });

  it('maneja NaN e infinitos', () => {
    expect(formatNumber(Number.NaN)).toBe('');
    expect(formatNumber(Infinity)).toBe('∞');
  });
});

describe('formatSI y científico', () => {
  it('aplica prefijos SI', () => {
    expect(formatSI(1234)).toBe('1.2k');
    expect(formatSI(3_400_000, 1)).toBe('3.4M');
    expect(formatSI(0.0012)).toBe('1.2m');
    expect(formatSI(0)).toBe('0');
    expect(formatSI(1500, 1, 'Hz')).toBe('1.5kHz');
  });

  it('notación científica', () => {
    expect(formatScientific(0.00123)).toBe('1.23e-3');
    expect(formatScientific(12345, 1)).toBe('1.2e4');
  });

  it('porcentaje y moneda', () => {
    expect(formatPercent(0.256, 1)).toBe('25.6%');
    expect(formatCurrency(1250.5)).toBe('$1,250.50');
  });
});

describe('tickFormatter', () => {
  it('usa decimales normales para rangos cotidianos', () => {
    expect(tickFormatter(0.5, 10)(2.5)).toBe('2.5');
  });

  it('cambia a prefijos SI para millones', () => {
    expect(tickFormatter(2e6, 1e7)(4e6)).toBe('4M');
  });
});

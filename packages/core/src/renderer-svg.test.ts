import { describe, expect, it } from 'vitest';
import { parseFont } from './renderer-svg';

describe('parseFont', () => {
  it('separa peso, tamaño y familia de una fuente CSS corta', () => {
    expect(parseFont('600 14px "Instrument Sans", sans-serif')).toEqual({
      style: 'normal',
      weight: '600',
      size: 14,
      family: '"Instrument Sans", sans-serif',
    });
  });

  it('entiende bold, italic y tamaños con decimales', () => {
    expect(parseFont('italic bold 16.8px Fraunces, serif')).toEqual({
      style: 'italic',
      weight: '700',
      size: 16.8,
      family: 'Fraunces, serif',
    });
  });

  it('con solo tamaño y familia, el peso es 400', () => {
    expect(parseFont('12px monospace')).toEqual({
      style: 'normal',
      weight: '400',
      size: 12,
      family: 'monospace',
    });
  });
});

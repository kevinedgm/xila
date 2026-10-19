import { describe, expect, it } from 'vitest';
import { focusPlugin, mixHex, spreadLabels } from './focus';
import { DataTable, numberColumn } from '../data/table';
import type { ChartConfig } from '../config';

describe('mixHex', () => {
  it('mezcla en línea recta entre dos colores', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#102030', 0.3)).toBe('#102030');
  });
});

describe('spreadLabels', () => {
  it('separa las etiquetas encimadas y conserva el orden de entrada', () => {
    expect(spreadLabels([100, 102, 50], 14)).toEqual([100, 114, 50]);
  });
});

describe('focusPlugin.beforeUpdate', () => {
  const data = new DataTable({
    x: numberColumn([1, 2]),
    a: numberColumn([1, 2]),
    b: numberColumn([3, 4]),
    c: numberColumn([5, 6]),
  });
  const config: ChartConfig = {
    type: 'line',
    data,
    series: [
      { id: 'a', x: 'x', y: 'a' },
      { id: 'b', x: 'x', y: 'b' },
      { id: 'c', x: 'x', y: 'c' },
    ],
    theme: {
      palette: ['#111111', '#222222', '#333333'],
      background: '#ffffff',
      text: '#000000',
      axis: '#888888',
      grid: '#eeeeee',
      fontFamily: 'x',
      fontSize: 12,
    },
  };

  it('pone la protagonista al final con su color original y el resto en gris', () => {
    const out = focusPlugin({ series: 'b' }).beforeUpdate!(config, {} as never) as ChartConfig;
    expect(out.series.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    const theme = out.theme as unknown as { palette: string[] };
    expect(theme.palette[2]).toBe('#222222');
    expect(theme.palette[0]).toBe(theme.palette[1]);
    expect(theme.palette[0]).not.toBe('#222222');
  });

  it('sin protagonista válida usa la primera serie', () => {
    const p = focusPlugin({ series: 'zzz' });
    p.beforeUpdate!(config, {} as never);
    expect(p.getFocus()).toBe('a');
  });
});

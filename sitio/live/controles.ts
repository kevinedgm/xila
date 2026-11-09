import type { ChartType } from 'xilaplot';

/**
 * Controles de la ficha interactiva («el código es el control»): por tipo de gráfico, el grupo de opciones de
 * `ChartConfig` que se edita y, por clave, los valores por los que cicla cada botón. Los valores por defecto los
 * da `DEFAULTS` de xilaplot (la ficha no los repite). `generar.test.mjs` comprueba que cada lista enumerada coincide
 * con la unión de tipos declarada en `packages/core/src/config.ts`.
 */
export interface Control {
  readonly key: string;
  /** Valores por los que cicla el botón; con `[false, true]` se pinta como casilla. */
  readonly values: readonly (string | number | boolean | null)[];
  /** `enum`: la lista es la unión de tipos completa (se verifica); `sample`: una muestra de números o nombres. */
  readonly kind: 'enum' | 'sample' | 'boolean';
}

export interface Ficha {
  /** Clave del grupo en `ChartConfig` (`line`, `bar`, …). */
  readonly grupo: ChartType;
  readonly controles: readonly Control[];
}

const bool = (key: string): Control => ({ key, values: [false, true], kind: 'boolean' });

export const CONTROLES: Readonly<Record<ChartType, Ficha>> = {
  line: {
    grupo: 'line',
    controles: [
      { key: 'curve', values: ['linear', 'monotone', 'step'], kind: 'enum' },
      bool('area'),
      bool('spanGaps'),
      { key: 'width', values: [1, 2, 3, 4], kind: 'sample' },
      { key: 'decimate', values: ['auto', 'scan', 'pyramid'], kind: 'enum' },
    ],
  },
  bar: {
    grupo: 'bar',
    controles: [
      { key: 'mode', values: ['grouped', 'stacked'], kind: 'enum' },
      { key: 'orientation', values: ['vertical', 'horizontal'], kind: 'enum' },
      { key: 'mark', values: ['bar', 'dot'], kind: 'enum' },
      { key: 'radius', values: [0, 2, 4, 8], kind: 'sample' },
      { key: 'gap', values: [0, 1, 2, 4], kind: 'sample' },
      { key: 'padding', values: [0, 0.1, 0.2, 0.4], kind: 'sample' },
    ],
  },
  scatter: {
    grupo: 'scatter',
    controles: [
      { key: 'radius', values: [2, 3, 5, 8], kind: 'sample' },
      { key: 'ring', values: [0, 1.5, 3], kind: 'sample' },
      bool('path'),
    ],
  },
  box: {
    grupo: 'box',
    controles: [
      { key: 'mark', values: ['box', 'dots', 'density', 'range'], kind: 'enum' },
      { key: 'now', values: ['none', 'last'], kind: 'enum' },
      bool('outliers'),
      { key: 'whisker', values: [1, 1.5, 3], kind: 'sample' },
      { key: 'padding', values: [0.1, 0.3, 0.5], kind: 'sample' },
    ],
  },
  heatmap: {
    grupo: 'heatmap',
    controles: [
      {
        key: 'colormap',
        values: ['cobalto', 'viridis', 'magma', 'inferno', 'plasma', 'rdbu', 'cobalto-naranja'],
        kind: 'sample',
      },
      { key: 'scale', values: ['shared', 'row'], kind: 'enum' },
      { key: 'mark', values: ['cell', 'knot'], kind: 'enum' },
      { key: 'rowLabels', values: ['none', 'max'], kind: 'enum' },
      bool('values'),
      bool('legend'),
      bool('path'),
      { key: 'gap', values: [0, 1, 2, 4], kind: 'sample' },
    ],
  },
  dots: {
    grupo: 'dots',
    controles: [
      { key: 'mode', values: ['strip', 'binned'], kind: 'enum' },
      { key: 'radius', values: ['auto', 2, 3, 4], kind: 'sample' },
      { key: 'bins', values: ['fd', 'sturges', 'sqrt', 10, 25], kind: 'sample' },
    ],
  },
  waffle: {
    grupo: 'waffle',
    controles: [
      { key: 'unit', values: ['auto', 100, 250, 500], kind: 'sample' },
      { key: 'columns', values: ['auto', 10, 20, 25], kind: 'sample' },
      { key: 'gap', values: [0, 1, 2, 4], kind: 'sample' },
      bool('labels'),
    ],
  },
};

/** Nombres de la paleta del tema, en su orden fijo (tema.ts de xilaplot). */
export const PALETA = ['cobalto', 'hilo', 'jade', 'ocre', 'ciruela', 'nopal', 'jacaranda'] as const;

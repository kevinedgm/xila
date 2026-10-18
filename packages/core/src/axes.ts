import type { ResolvedAxisConfig } from './config';
import { formatNumber, formatSI, tickFormatter } from './format/number';
import type { Layout, Rect } from './plugin';
import type { Renderer, TextStyle } from './renderer';
import type { BandScale } from './scales/band';
import type { ContinuousScale } from './scales/linear';
import { timeTickFormatter, timeTicks } from './scales/time';
import type { Theme } from './theme';

export const TICK_SIZE = 5;
export const TICK_GAP = 4;
export const TITLE_GAP = 6;

export interface AxisTicks {
  readonly values: number[];
  readonly labels: string[];
  /** Posición en píxeles de cada tick, una vez que la escala tiene su rango final. */
  readonly positions: number[];
}

export function textStyle(theme: Theme, fill = theme.text): TextStyle {
  return { font: `${theme.fontSize}px ${theme.fontFamily}`, fill };
}

/** Ticks y etiquetas de una escala continua (lineal o de tiempo). */
export function continuousTicks(
  scale: ContinuousScale,
  count: number,
  axis: ResolvedAxisConfig,
): AxisTicks {
  let values: number[];
  let fmt: (v: number, i: number, all: readonly number[]) => string;
  if (scale.kind === 'time') {
    const t = timeTicks(scale.domain, count);
    values = t.values;
    fmt = axis.format ?? timeTickFormatter(t.interval);
  } else if (scale.kind === 'log') {
    values = scale.ticks(count);
    // Cada tick es una potencia (o 2×, 5×): se formatea solo, sin decimales de un paso común.
    fmt =
      axis.format ??
      ((v) =>
        v >= 1e4 || v < 1e-2
          ? formatSI(v)
          : formatNumber(v, { decimals: Math.max(0, -Math.floor(Math.log10(v))) }));
  } else {
    values = scale.ticks(count);
    const step = scale.tickStep(count);
    const maxAbs = Math.max(Math.abs(scale.domain[0]), Math.abs(scale.domain[1]));
    fmt = axis.format ?? tickFormatter(step, maxAbs);
  }
  const labels = values.map((v, i) => fmt(v, i, values));
  return { values, labels, positions: values.map((v) => scale.toPixel(v)) };
}

export function bandTicks(scale: BandScale, categories: readonly string[]): AxisTicks {
  const values = categories.map((_, i) => i);
  return { values, labels: [...categories], positions: values.map((i) => scale.center(i)) };
}

/** Cuánto espacio necesita cada eje, medido con las etiquetas reales. */
export function axisMargins(
  renderer: Renderer,
  theme: Theme,
  xTicks: AxisTicks,
  yTicks: AxisTicks,
  xAxis: ResolvedAxisConfig,
  yAxis: ResolvedAxisConfig,
): { left: number; bottom: number } {
  const style = textStyle(theme);
  const line = theme.fontSize * 1.2;
  let left = 0;
  if (yAxis.show) {
    const widest = Math.max(0, ...yTicks.labels.map((l) => renderer.measureText(l, style)));
    left = TICK_SIZE + TICK_GAP + widest + (yAxis.title ? line + TITLE_GAP : 0);
  }
  let bottom = 0;
  if (xAxis.show) {
    bottom = TICK_SIZE + TICK_GAP + line + (xAxis.title ? line + TITLE_GAP : 0);
  }
  // Media etiqueta del último tick de X puede sobresalir por la derecha.
  return { left: Math.ceil(left), bottom: Math.ceil(bottom) };
}

/** Quita etiquetas de X hasta que ninguna se solape con la vecina. */
export function thinLabels(renderer: Renderer, theme: Theme, ticks: AxisTicks): AxisTicks {
  const style = textStyle(theme);
  const widths = ticks.labels.map((l) => renderer.measureText(l, style) + 8);
  let every = 1;
  for (;;) {
    let ok = true;
    for (let i = every; i < ticks.positions.length; i += every) {
      const gap = Math.abs((ticks.positions[i] as number) - (ticks.positions[i - every] as number));
      if (gap < ((widths[i] as number) + (widths[i - every] as number)) / 2) {
        ok = false;
        break;
      }
    }
    if (ok || every >= ticks.positions.length) break;
    every++;
  }
  if (every === 1) return ticks;
  const keep = (_: unknown, i: number) => i % every === 0;
  return {
    values: ticks.values.filter(keep),
    labels: ticks.labels.filter(keep),
    positions: ticks.positions.filter(keep),
  };
}

export function drawAxes(
  renderer: Renderer,
  theme: Theme,
  layout: Layout,
  xTicks: AxisTicks,
  yTicks: AxisTicks,
  xAxis: ResolvedAxisConfig,
  yAxis: ResolvedAxisConfig,
): void {
  const area: Rect = layout.plotArea;
  const bottom = area.y + area.height;
  const right = area.x + area.width;
  const grid = { stroke: theme.grid, width: 1 };
  const axisLine = { stroke: theme.axis, width: 1 };
  const label = textStyle(theme);

  if (yAxis.grid) {
    for (const py of yTicks.positions) renderer.drawRule('background', area.x, py, right, py, grid);
  }
  if (xAxis.grid) {
    for (const px of xTicks.positions)
      renderer.drawRule('background', px, area.y, px, bottom, grid);
  }

  if (yAxis.show) {
    renderer.drawRule('background', area.x, area.y, area.x, bottom, axisLine);
    yTicks.positions.forEach((py, i) => {
      renderer.drawRule('background', area.x - TICK_SIZE, py, area.x, py, axisLine);
      renderer.drawText('background', yTicks.labels[i] ?? '', area.x - TICK_SIZE - TICK_GAP, py, {
        ...label,
        align: 'right',
        baseline: 'middle',
      });
    });
    if (yAxis.title) {
      renderer.drawText(
        'background',
        yAxis.title,
        layout.width * 0 + theme.fontSize,
        area.y + area.height / 2,
        {
          ...label,
          align: 'center',
          baseline: 'middle',
          rotate: -90,
        },
      );
    }
  }

  if (xAxis.show) {
    renderer.drawRule('background', area.x, bottom, right, bottom, axisLine);
    xTicks.positions.forEach((px, i) => {
      renderer.drawRule('background', px, bottom, px, bottom + TICK_SIZE, axisLine);
      renderer.drawText('background', xTicks.labels[i] ?? '', px, bottom + TICK_SIZE + TICK_GAP, {
        ...label,
        align: 'center',
        baseline: 'top',
      });
    });
    if (xAxis.title) {
      renderer.drawText(
        'background',
        xAxis.title,
        area.x + area.width / 2,
        layout.height - theme.fontSize * 0.4,
        {
          ...label,
          align: 'center',
          baseline: 'bottom',
        },
      );
    }
  }
}

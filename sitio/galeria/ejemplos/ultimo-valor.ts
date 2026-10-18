import { formatNumber, type ChartPlugin } from 'xilaplot';

/**
 * Plugin de ejemplo: escribe el último valor de cada serie visible a la derecha de su punto
 * final. Pide espacio a la derecha en `reserveSpace` y dibuja en `afterDraw`, sobre la capa
 * `overlay`, convirtiendo valores a píxeles con las escalas del dibujo actual.
 */
export function ultimoValorPlugin(): ChartPlugin {
  return {
    id: 'ultimo-valor',
    reserveSpace: () => ({ right: 56 }),
    afterDraw(ctx) {
      const scales = ctx.getScales();
      if (!scales) return;
      const sx = scales.x;
      if (sx.kind === 'band') return;
      const { theme } = ctx.config;
      ctx.getSeries().forEach((serie, i) => {
        if (ctx.hiddenSeries.has(serie.id) || serie.length === 0) return;
        const ultimo = serie.length - 1;
        const px = sx.toPixel(serie.x[ultimo] as number);
        const py = scales.y.toPixel(serie.y[ultimo] as number);
        ctx.renderer.drawText('overlay', formatNumber(serie.y[ultimo] as number), px + 6, py, {
          font: `600 ${theme.fontSize}px ${theme.fontFamily}`,
          fill: theme.palette[i % theme.palette.length] ?? theme.text,
          baseline: 'middle',
        });
      });
    },
  };
}

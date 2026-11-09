# Crear un plugin

Un plugin es un objeto con un `id` y hooks opcionales. El núcleo los llama en un orden fijo en
cada ciclo, y les pasa un `PluginContext` con el renderer, las escalas, las series y los
eventos. Nada en el núcleo sabe qué es un tooltip: tooltip, leyenda, zoom, anotaciones,
accesibilidad y sincronización son plugins como el que vas a escribir.

## El ciclo

```
install        → una vez, al crear el gráfico (crear nodos, suscribirse a eventos)
beforeUpdate   → antes de resolver una configuración nueva; puede devolver otra
reserveSpace   → cuánto margen pide el plugin (leyenda arriba, etiquetas a la derecha)
afterLayout    → ya se conoce el área de dibujo
beforeDraw     → antes de pintar las series
afterDraw      → después: lo que dibujes aquí queda encima
onEvent        → hover, click, zoom, visibility, dataChanged, resize, draw
uninstall      → deshacer todo lo de install
```

Dos plugins que dependen uno del otro (tooltip sobre anotaciones) tienen un resultado
predecible porque dentro de cada hook corren en orden de registro.

## Ejemplo: etiquetar el último valor

Queremos que cada línea termine con su último valor escrito al lado, como en los gráficos de
prensa. Necesita dos cosas: espacio a la derecha para que el texto no se corte, y dibujar
después de las series.

```ts
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
```

Qué hace cada parte:

- **`reserveSpace`** devuelve `{ right: 56 }`. El núcleo resta esos píxeles al área de dibujo
  antes de calcular las escalas; sin esto el texto saldría fuera del canvas.
- **`ctx.getScales()`** da las escalas del dibujo actual. `toPixel(valor)` convierte un valor
  de datos a píxel CSS, y respeta el zoom: si el usuario hace zoom, la etiqueta se mueve con el
  punto sin código extra. Es `null` antes del primer dibujo, de ahí la comprobación.
- **`ctx.getSeries()`** devuelve las series resueltas a `Float64Array`, incluidas las ocultas;
  `ctx.hiddenSeries` dice cuáles apagó la leyenda.
- **`ctx.renderer.drawText('overlay', ...)`** pinta en la capa superior. Las capas son
  `background` (grid), `data` (series) y `overlay` (cursores, etiquetas); dibujar en `overlay`
  evita que una serie tape el texto.
- **`ctx.config.theme`** trae la paleta y la fuente, así el plugin hereda el tema oscuro sin
  saber que existe.

Se usa como cualquier otro:

```ts
new Chart(el, {
  type: 'line',
  data,
  series,
  plugins: [tooltipPlugin(), legendPlugin(), ultimoValorPlugin()],
});
```

```ts demo
import {
  formatNumber,
  legendPlugin,
  pivot,
  tooltipPlugin,
  type ChartConfig,
  type ChartPlugin,
} from 'xilaplot';
import { co2 } from './datos';

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

/** Plugin propio: `ultimoValorPlugin` (ver la guía "Crear un plugin") etiqueta el final de cada serie. */
export default async function plugin(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = ['Estados Unidos', 'Alemania', 'China', 'México', 'India'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [tooltipPlugin(), legendPlugin(), ultimoValorPlugin()],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}
```

Prueba a ocultar una serie en la leyenda: la etiqueta desaparece porque `afterDraw` vuelve a
correr en cada dibujo y consulta `hiddenSeries`.

## Reaccionar a eventos y pedir redibujos

Un plugin que cambia algo fuera de un hook de dibujo (llega un dato, el usuario pulsa una
tecla) llama a `ctx.requestDraw()`, que agrupa las peticiones en un solo fotograma. Para
escuchar el cursor hay dos vías equivalentes: el hook `onEvent('hover', payload)` o
`ctx.events.on('hover', ...)` en `install` (guardando la función que devuelve para llamarla
en `uninstall`).

```ts
export function resaltarPlugin(): ChartPlugin {
  let quitar: (() => void) | null = null;
  return {
    id: 'resaltar',
    install(ctx) {
      quitar = ctx.events.on('hover', (h) => {
        if (h?.nearest) console.log(h.nearest.seriesId, h.nearest.x, h.nearest.y);
      });
    },
    uninstall() {
      quitar?.();
    },
  };
}
```

## Cambiar el rango visible

`ctx.setViewDomain('x', [min, max])` fija lo que se muestra y `null` vuelve al automático. Así
está hecho el zoom: el plugin no toca los datos, solo el dominio, y el núcleo redibuja con la
escala nueva. `ctx.getDataDomain('x')` da el rango completo de los datos para no salirse.

## Reglas prácticas

- Una instancia por gráfico: un plugin guarda estado y nodos. `const plugins = () => [...]`.
- Todo lo que `install` cree, `uninstall` lo quita; `chart.destroy()` cuenta con ello.
- Trabaja en valores de datos y convierte a píxeles en el momento de dibujar: el zoom y el
  cambio de tamaño salen gratis.
- Dibuja en `overlay` lo que debe quedar encima; en `background` lo que va bajo las series.

La referencia completa de los plugins incluidos, con sus opciones, está en
[Plugins incluidos](../plugins.md).

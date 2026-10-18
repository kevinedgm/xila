# Plugins incluidos

Un plugin es un objeto con `id` y hooks opcionales (`install`, `reserveSpace`, `afterLayout`,
`beforeDraw`, `afterDraw`, `onEvent`, `uninstall`). Se pasan en `plugins` al crear el gráfico y
corren en orden de registro. Todos los de esta lista viven en `@xila/core`.

Cada gráfico necesita **sus propias instancias**: un plugin guarda estado y nodos del DOM, así
que compartir `tooltipPlugin()` entre dos gráficos deja al primero sin tooltip. Lo práctico es
una función `const plugins = () => [tooltipPlugin(), legendPlugin()]` y llamarla por gráfico.

```ts
import { Chart, tooltipPlugin, legendPlugin, zoomPanPlugin, annotationsPlugin } from '@xila/core';

new Chart(el, {
  type: 'line',
  data,
  series: [{ id: 'temp', x: 'tiempo', y: 'temperatura' }],
  plugins: [tooltipPlugin(), legendPlugin(), zoomPanPlugin(), annotationsPlugin([...])],
});
```

## `tooltipPlugin(opciones)`

Tooltip HTML sobre el canvas. Lee los aciertos que publica el evento `hover`.

| Opción            | Valores                 | Por defecto                  |
| ----------------- | ----------------------- | ---------------------------- |
| `mode`            | `'nearest'` \| `'x'`    | `'x'` en líneas y barras     |
| `maxDistance`     | píxeles                 | depende del tipo             |
| `format`          | `(hits, ctx) => string` | nombre y valores formateados |
| `formatX/formatY` | `(valor) => string`     | formato del eje              |

## `legendPlugin(opciones)`

Leyenda HTML arriba (`position: 'top'`) o abajo. Con `interactive: true` (por defecto) un clic
oculta la serie y el eje Y se recalcula con las visibles.

## `zoomPanPlugin(opciones)`

Zoom con la rueda centrado en el cursor, pan arrastrando, pellizco en pantallas táctiles y
doble clic para volver al rango automático.

| Opción                     | Valores                          | Por defecto |
| -------------------------- | -------------------------------- | ----------- |
| `axis`                     | `'x'` \| `'y'` \| `'xy'`         | `'x'`       |
| `modifier`                 | `'shift'` \| `'ctrl'` \| `'alt'` | `'shift'`   |
| `wheel` / `drag` / `pinch` | `boolean`                        | `true`      |
| `limits`                   | `'data'` \| `'none'`             | `'data'`    |
| `minSpanRatio`             | fracción del rango de datos      | `1e-6`      |
| `doubleClickReset`         | `boolean`                        | `true`      |
| `wheelFactor`              | factor por cada 100 px de rueda  | `2`         |

Mecanismo: el plugin no toca los datos; fija un _dominio de vista_ por eje con
`ctx.setViewDomain(eje, [min, max])` y el núcleo redibuja con esa escala. El valor bajo el
cursor se queda quieto porque el nuevo dominio es `[v − (v − min)/k, v + (max − v)/k]`.
Con `limits: 'data'` nunca se sale del rango de los datos, y al volver a verlos todos el
dominio pasa a `null` (automático, con ticks "bonitos"). Cada cambio emite el evento `zoom`
con `{ x, y }`; sirve para sincronizar gráficos.

Para gráficos de barras el eje X es categórico y no hace zoom; sí el eje Y con `axis: 'y'`.

## `annotationsPlugin(anotaciones)`

Marca eventos sobre el gráfico. Las anotaciones guardan su posición en **valores de datos**
(número, `Date` o categoría), no en píxeles: en cada dibujo se convierten con la escala
vigente, así siguen al zoom y al cambio de tamaño sin más código.

```ts
annotationsPlugin([
  // Banda entre dos fechas. Sin `from` o sin `to` llega hasta el borde del área.
  {
    type: 'band',
    axis: 'x',
    from: new Date('2025-07-07'),
    to: new Date('2025-07-20'),
    label: 'Campaña',
  },
  // Línea vertical (axis 'x') u horizontal (axis 'y').
  { type: 'line', axis: 'x', value: new Date('2025-11-17'), label: 'Buen Fin', dash: [4, 3] },
  { type: 'line', axis: 'y', value: 1000, label: 'Meta', color: '#10b981' },
  // Texto anclado a un punto; `offset` lo separa del dato (por defecto 8 px arriba).
  { type: 'text', x: new Date('2025-03-01'), y: 1400, text: 'máximo', offset: [0, -10] },
]);
```

Campos comunes: `label`, `color` (por defecto el texto del tema) y `opacity` (líneas 0.8,
bandas 0.12). En un gráfico de barras `value`, `from` y `to` admiten el nombre de la categoría
(`'sur'`) o su índice.

El plugin devuelve `set(anotaciones)` para reemplazarlas en caliente (pide un redibujo) y
`get()` para leerlas:

```ts
const anot = annotationsPlugin();
new Chart(el, { ..., plugins: [anot] });
anot.set([{ type: 'line', axis: 'x', value: Date.now() }]);
```

Se dibujan en la capa `data`, recortadas al área de dibujo y encima de las series.

## `accessibilityPlugin(opciones)`

Un canvas es una imagen para un lector de pantalla. El plugin añade tres cosas al elemento del
gráfico:

1. `role="img"`, `tabindex="0"` y un `aria-label` generado en cada dibujo (o fijo con
   `label`): "Gráfico de líneas. 2 series: Norte y Sur. 365 datos de 1 ene 2025 a 31 dic 2025.
   Valores entre 420 y 1,450 (MXN)."
2. Teclado: con el gráfico enfocado, ← → recorren los datos (con Shift, saltos de 5 %), Inicio y
   Fin van a los extremos, ↑ ↓ cambian de serie y Escape quita el cursor. Mueve el mismo cursor
   que el ratón, así que el tooltip aparece y una región `aria-live` lee "Serie, x: y".
3. Una `<table>` oculta visualmente (hermana del gráfico) con una fila por dato, muestreada a
   `tableRows` (200) filas como máximo, y una columna por serie.

| Opción      | Valores   | Por defecto      |
| ----------- | --------- | ---------------- |
| `label`     | texto     | resumen generado |
| `locale`    | BCP 47    | `'es-MX'`        |
| `timeZone`  | IANA      | `'UTC'`          |
| `tableRows` | número    | `200`            |
| `keyboard`  | `boolean` | `true`           |
| `table`     | `boolean` | `true`           |

`chartSummary(ctx)` genera el resumen por separado, por si se quiere mostrar en pantalla.

# Configuración del gráfico

`new Chart(contenedor, config)` recibe un `ChartConfig`, una unión discriminada por `type`:
el editor solo sugiere las claves del tipo elegido. Todo lo opcional tiene un valor por defecto
en `DEFAULTS`, exportado por `xilaplot`.

## Claves comunes

| Clave      | Tipo                                                 | Por defecto | Qué hace                                          |
| ---------- | ---------------------------------------------------- | ----------- | ------------------------------------------------- |
| `type`     | `'line' \| 'bar' \| 'scatter' \| 'box' \| 'heatmap'` | —           | tipo de gráfico                                   |
| `data`     | `DataTable`                                          | —           | la tabla; las series nombran sus columnas         |
| `series`   | `SeriesSpec[]`                                       | —           | al menos una; `id` único                          |
| `scales`   | `{ x?, y? }` de `ScaleConfig`                        | según tipo  | `type`, `domain`, `nice`                          |
| `axes`     | `{ x?, y? }` de `AxisConfig`                         | mostrados   | `title`, `show`, `grid`, `format`                 |
| `plugins`  | `ChartPlugin[]`                                      | `[]`        | instancias propias de este gráfico                |
| `theme`    | `'light' \| 'dark' \| Theme`                         | `'light'`   | paleta, fondo, texto, fuente                      |
| `padding`  | `{ top, right, bottom, left }`                       | 8 px        | margen exterior; el de los ejes se calcula aparte |
| `lazy`     | `boolean`                                            | `true`      | no dibujar hasta estar cerca de la pantalla       |
| `renderer` | `'canvas' \| 'webgl' \| 'auto'`                      | `'canvas'`  | backend de los puntos de dispersión               |

## `SeriesSpec`

| Clave           | Qué es                                                     |
| --------------- | ---------------------------------------------------------- |
| `id`, `name`    | identificador (leyenda, eventos) y nombre visible          |
| `x`, `y`        | columnas; `x` categórica en barras, box y heatmap          |
| `value`         | heatmap: columna numérica de la celda                      |
| `size`          | dispersión: radio por punto                                |
| `yError`        | incertidumbre simétrica (`y ± error`)                      |
| `yLow`, `yHigh` | límites explícitos (por ejemplo un intervalo de confianza) |

## Por tipo

```ts
line:    { width: 1.5, area: false, step: false }
bar:     { mode: 'grouped', orientation: 'vertical', padding: 0.2 }
scatter: { radius: 3 }
box:     { whisker: 1.5, padding: 0.3, outliers: true }
heatmap: { colormap: 'viridis', domain: 'auto', center: null, legend: true }
```

Los valores exactos están en `packages/core/src/config.ts`; la explicación de cada tipo en
[Tipos de gráfico](../guia/tipos).

## Métodos de `Chart`

| Método                             | Qué hace                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `update(parcial)`                  | mezcla con la configuración actual y redibuja                                                              |
| `resize()`                         | recalcula el tamaño (normalmente lo hace `ResizeObserver`)                                                 |
| `destroy()`                        | desinstala plugins y quita nodos y listeners                                                               |
| `events.on(nombre, fn)`            | `hover`, `click`, `zoom`, `visibility`, `dataChanged`, `resize`, `draw`; devuelve la función para quitarlo |
| `setViewDomain(eje, [min, max])`   | fija el rango visible; `null` vuelve al automático                                                         |
| `getViewDomain(eje)`               | rango visible o `null`                                                                                     |
| `toggleSeries(id, oculta?)`        | lo que hace la leyenda al hacer clic                                                                       |
| `hoverAt(px, py)` / `clearHover()` | simular el cursor (pruebas, accesibilidad)                                                                 |
| `toDataURL(tipo?, pixelRatio?)`    | PNG del gráfico; `chartToPng` y `chartToCsv` descargan                                                     |
| `getScales()`, `getLayout()`       | escalas y área de dibujo del último dibujo                                                                 |
| `getBackend()`                     | `'canvas'` o `'webgl'`, lo que terminó dibujando los puntos                                                |
| `drawNow()`                        | dibujar de inmediato, sin esperar al siguiente fotograma                                                   |

## Datos y transformaciones

| Función                                             | Devuelve                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `fetchCsv(url)` / `parseCsv(texto)`                 | `{ table, rows, kinds }`                                                  |
| `new DataTable({ col: numberColumn([...]) })`       | tabla en memoria (`timeColumn`, `categoryColumn`)                         |
| `filterRows(tabla, condición \| condiciones \| fn)` | tabla con las filas que pasan (`equals`, `in`, `min`, `max`)              |
| `groupBy(tabla, columna, { agg, column, as? })`     | una fila por grupo; `sum`, `mean`, `count`, `min`, `max`, `first`, `last` |
| `bucketTime(tabla, columna, unidad, as?)`           | columna de tiempo redondeada (`year`, `month`, `day`, `decade`…)          |
| `pivot(tabla, { index, columns, values, agg? })`    | de largo a ancho                                                          |
| `splitBy(tabla, columna)`                           | `Map<categoría, DataTable>`                                               |
| `histogram(valores, { bins })` / `histogramTable`   | cubetas y conteos (`'fd'`, `'sturges'`, `'sqrt'` o un entero)             |
| `boxStats(valores)`                                 | Q1, mediana, Q3, bigotes y atípicos                                       |
| `summary`, `quantile`, `mean`, `std`…               | estadísticos sobre `Float64Array`                                         |

La [API generada con TypeDoc](/api/){target="_self"} tiene todas las firmas y tipos.

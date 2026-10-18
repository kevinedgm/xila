# Tipos de gráfico

Cinco tipos, todos sobre la misma `DataTable`. Lo que cambia entre ellos es qué columnas pide
cada serie y qué escala X va por defecto.

| `type`    | Serie                         | Escala X por defecto | Datos                                              |
| --------- | ----------------------------- | -------------------- | -------------------------------------------------- |
| `line`    | `x`, `y`, opcional `yError`   | tiempo o lineal      | una fila por punto; X ordenada para decimar        |
| `scatter` | `x`, `y`, opcional `size`     | lineal               | cualquier orden; WebGL con `renderer: 'webgl'`     |
| `bar`     | `x` categórica, `y`           | banda                | ancho (una columna por serie) o largo tras `pivot` |
| `box`     | `x` categórica, `y`           | banda                | largo: una fila por medición, el gráfico agrupa    |
| `heatmap` | `x`, `y` categóricas, `value` | banda                | largo: una fila por celda                          |

## Línea

`line.width`, `line.area` (relleno hasta cero) y `line.step` (escalones). Con más puntos que
píxeles la serie se **decima por mín y máx**: por cada columna de píxeles se dibujan el mínimo y
el máximo, así los picos no desaparecen y un millón de puntos se traza en unos milisegundos.
Requiere X ordenada; `isSorted` lo comprueba.

Incertidumbre: `yError` (simétrico) o `yLow` y `yHigh` se dibujan como banda bajo la línea y
entran en el dominio Y.

## Dispersión

`scatter.radius` fija el radio. A partir de 50 000 puntos conviene `renderer: 'webgl'` (o
`'auto'`, que lo decide por el tamaño): los puntos suben una vez a la GPU y el pan solo cambia
dos uniforms. En dispersión las barras de error se dibujan con remates.

## Barras

`bar.mode: 'grouped' | 'stacked'`, `bar.orientation`, `bar.padding` (fracción vacía de la
banda). Una barra por categoría de `x` y una serie por columna `y`; del formato largo se llega
con `pivot(tabla, { index, columns, values, agg })`. Un histograma es `histogramTable(valores)`
más un gráfico `bar` con `padding: 0`.

## Box plot

Recibe el formato largo directo: `x` es la columna del grupo y `y` la del valor. Por grupo
calcula Q1, mediana y Q3 con la interpolación de `df.describe()`, bigotes hasta el último dato
dentro de `box.whisker · IQR` (1.5 por defecto) y atípicos como puntos. `boxStats(valores)`
devuelve los mismos números para usarlos fuera.

## Heatmap

`x` e `y` categóricas más `value` numérica. Se dibuja como una imagen de un píxel por celda
escalada sin suavizado, por eso 500 × 500 celdas cuestan lo mismo que 10 × 10.
`heatmap.colormap`: `viridis`, `magma`, `inferno`, `plasma` (perceptuales), `rdbu`
(divergente) o una lista de hexadecimales. `center: 0` hace el dominio simétrico, útil para
correlaciones. `legend: false` quita la barra de color.

## Escalas y ejes

`scales.x.type` y `scales.y.type` aceptan `linear`, `time`, `band` y `log`; `domain: [min, max]`
fija el rango y `nice: false` evita redondearlo a ticks bonitos. `axes.x.title`, `grid`, `show`
y `format: (valor) => string` controlan cada eje. Los ticks de tiempo se alinean al calendario
(UTC) y los números se formatean en `es-MX`.

Cada tipo tiene su ejemplo con datos reales en la [Galería](../galeria/).

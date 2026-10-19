# Tipos de gráfico

Siete tipos, todos sobre la misma `DataTable`. Lo que cambia entre ellos es qué columnas pide
cada serie y qué escala X va por defecto.

| `type`    | Serie                         | Escala X por defecto | Datos                                              |
| --------- | ----------------------------- | -------------------- | -------------------------------------------------- |
| `line`    | `x`, `y`, opcional `yError`   | tiempo o lineal      | una fila por punto; X ordenada para decimar        |
| `scatter` | `x`, `y`, opcional `size`     | lineal               | cualquier orden; WebGL con `renderer: 'webgl'`     |
| `bar`     | `x` categórica, `y`           | banda                | ancho (una columna por serie) o largo tras `pivot` |
| `box`     | `x` categórica, `y`           | banda                | largo: una fila por medición, el gráfico agrupa    |
| `heatmap` | `x`, `y` categóricas, `value` | banda                | largo: una fila por celda                          |
| `dots`    | `x` numérica                  | lineal               | una fila por caso; un punto por fila               |
| `waffle`  | `x` categórica, `y`           | banda (sin ejes)     | una fila por categoría; un cuadro por cada `unit`  |

## Línea

`line.width` (2 px por defecto), `line.area` (relleno hasta cero) y `line.step` (escalones). Con más puntos que
píxeles la serie se **decima por mín y máx**: por cada columna de píxeles se dibujan el mínimo y
el máximo, así los picos no desaparecen y un millón de puntos se traza en unos milisegundos.
Requiere X ordenada; `isSorted` lo comprueba. Para salir de la línea clásica: `nowPlugin`
(cifra actual con estela y reproducción) y `focusPlugin` (una protagonista, el resto en gris).

Incertidumbre: `yError` (simétrico) o `yLow` y `yHigh` se dibujan como banda bajo la línea y
entran en el dominio Y.

## Dispersión

`scatter.radius` fija el radio (3) y `scatter.ring` el anillo del color del fondo que separa
puntos encimados (1,5 px; se omite a partir de 5 000 puntos). A partir de 50 000 puntos conviene `renderer: 'webgl'` (o
`'auto'`, que lo decide por el tamaño): los puntos suben una vez a la GPU y el pan solo cambia
dos uniforms. En dispersión las barras de error se dibujan con remates.

`scatter.path: true` une los puntos de cada serie en el orden de las filas (dispersión
conectada): la serie deja de ser una nube y pasa a ser un camino en el plano, útil cuando cada
fila es un instante. El trazo usa `line.width`. Con X sin ordenar el núcleo dibuja todos los
puntos en vez de recortar por rango. `trajectoryPlugin` lo activa solo y añade protagonista,
cabezas con nombre y valor, y un deslizador de tiempo; `trendPlugin` dibuja la tendencia y los
tallos de cada punto a ella.

## Barras

`bar.mode: 'grouped' | 'stacked'`, `bar.orientation`, `bar.padding` (fracción vacía de la
banda), `bar.radius` (extremo de datos redondeado, 4 px) y `bar.gap` (hueco del color del
fondo entre barras vecinas y entre segmentos apilados, 2 px). Una barra por categoría de `x` y una serie por columna `y`; del formato largo se llega
con `pivot(tabla, { index, columns, values, agg })`. Un histograma es `histogramTable(valores)`
más un gráfico `bar` con `padding: 0, radius: 0, gap: 1` (barras pegadas, sin redondeo).

`bar.mark: 'dot'` cambia cada barra por un punto en el valor (anillo del color del fondo, radio
entre 4 y 7 px según la banda). Es la forma "puntos con referencia": la barra solo servía para
llegar al valor, y el punto deja el área libre para una línea de comparación. Con
`referencePlugin({ value: 'mean' | 'median' | número })` se dibuja esa línea, un tallo de cada
punto hasta ella y la diferencia encima; la distancia es la respuesta a "¿cuánto más que el
promedio?". `bar.orientation: 'horizontal'` sigue pendiente: hoy la categoría va siempre en X.

## Box plot

Recibe el formato largo directo: `x` es la columna del grupo y `y` la del valor. Por grupo
calcula Q1, mediana y Q3 con la interpolación de `df.describe()`, bigotes hasta el último dato
dentro de `box.whisker · IQR` (1.5 por defecto) y atípicos como puntos. `boxStats(valores)`
devuelve los mismos números para usarlos fuera.

`box.mark` cambia lo que se dibuja por grupo con los mismos datos: `'dots'` es un enjambre con
un punto por valor a su altura exacta (el radio baja hasta que el grupo más apretado cabe en
su banda), con `box.shade` como columna numérica que da el tono de cada punto del claro al
oscuro (por ejemplo la fecha, para leer el tiempo dentro del reparto); `'density'` es una
franja cuya intensidad es cuántos valores caen en cada tramo (`box.bins`, suavizado con la
media de tres cubetas); `'range'` son dos bandas de percentiles (`box.range`, `[0.1, 0.9]` por
defecto, y Q1–Q3) con un hueco en la mediana. En los tres hay una raya en la mediana.
`box.now: 'last'` marca la última fila de cada grupo con un punto, su valor y en qué parte del
reparto cae ("el 1 % más bajo", "en su máximo", textos en `box.labels`): la distribución pasa
a ser el contexto de una cifra. Ejemplo: `examples/reparto.html`.

## Heatmap

`x` e `y` categóricas más `value` numérica. Se dibuja como una imagen de un píxel por celda
escalada sin suavizado, por eso 500 × 500 celdas cuestan lo mismo que 10 × 10.
`heatmap.colormap`: `cobalto` (por defecto, un solo tono claro → oscuro), `viridis`, `magma`,
`inferno`, `plasma` (perceptuales), `rdbu` y `cobalto-naranja`
(divergentes) o una lista de hexadecimales. `center: 0` hace el dominio simétrico, útil para
correlaciones. `legend: false` quita la barra de color.

Más allá del mapa de calor (ronda r01): `heatmap.scale: 'row'` colorea cada fila contra su
propia mediana con `cobalto-naranja` (azul por debajo, naranja por encima), para que una fila
grande no deje en blanco a las pequeñas y se vea cuándo cambió cada una; `rowLabels: 'max'`
escribe a la derecha el año del máximo y la mediana. `values: true` pone la cifra en cada celda
(blanca sobre tonos oscuros) y `gap` deja un hueco entre celdas: una tabla con tono, que se
dibuja con rectángulos en vez de imagen (hasta 2 000 celdas). Para resumir por década,
`bucketTime(tabla, 'fecha', 'decade')` y luego `pivot` con `agg: 'mean'`. Ejemplo:
`examples/matriz.html`.

## Unidades

Un punto por caso. `dots.mode: 'strip'` reparte los puntos en vertical con una dispersión
determinista (el índice decide la altura, así el gráfico no "baila" al redibujar) y muestra la
nube real con su cola. `'binned'` manda cada punto a su cubeta (`dots.bins`, las reglas de
`histogram`) y lo apila en columnas: es el histograma, pero cada barra se lee como pila de
casos. Al cambiar de modo con `chart.update({ dots: { mode } })` cada punto viaja de su
posición anterior a la nueva durante `dots.transition` ms, y se respeta `prefers-reduced-motion`.

El eje Y en cubetas cuenta casos y es lineal en píxeles: el radio (`dots.radius`, `'auto'` por
defecto) baja hasta que la cubeta más alta cabe en el área. Con `selectionPlugin` arrastrar
cuenta el rango y `summaryPlugin` lo resume en un panel al lado (cifra, porcentaje, rango,
mediana, forma); en cubetas la selección salta a los bordes.

## Unidades del total

`type: 'waffle'` reparte un total en cuadros iguales: `x` es la categoría y `y` el valor; cada
categoría recibe `round(valor / unidad)` cuadros (al menos uno si el valor es positivo) y los
cuadros van juntos, fila por fila, de izquierda a derecha y de arriba abajo. El lector cuenta
en vez de comparar alturas, y la parte de cada categoría se lee como fracción del total.
`waffle.unit` fija cuánto vale un cuadro (`'auto'` elige un paso redondo que da entre 100 y 250
cuadros); `waffle.columns` fija las columnas (`'auto'` las calcula para llenar el área sin
salirse); `waffle.gap` es el hueco entre cuadros (2 px) y `waffle.labels: false` quita la línea
de leyenda con nombre y porcentaje. No hay ejes; el tooltip da categoría y valor.

## Escalas y ejes

`scales.x.type` y `scales.y.type` aceptan `linear`, `time`, `band` y `log`; `domain: [min, max]`
fija el rango y `nice: false` evita redondearlo a ticks bonitos. `axes.x.title`, `grid`, `show`
y `format: (valor) => string` controlan cada eje. Por defecto solo el eje Y dibuja grid
(`axes.x.grid: true` lo enciende en X). Los ticks de tiempo se alinean al calendario
(UTC) y los números se formatean en `es-MX`.

Cada tipo tiene su ejemplo con datos reales en la [Galería](../galeria/).

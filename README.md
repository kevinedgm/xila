# Xila

Librería de gráficos en TypeScript para dashboards y datos científicos: lee tablas columnares
(CSV exportado desde pandas), dibuja en Canvas 2D (WebGL para dispersiones masivas) y se
extiende con plugins. Es la base de un kit de dashboards estáticos para clientes y, sobre todo,
un lugar donde proponer formas de representar datos que salen de la línea y la barra clásicas.

> **Estado:** experimental (0.x). La API puede cambiar entre versiones. Paquetes en npm: `xilaplot` (núcleo) y `xilaplot-vue` (Vue 3). Documentación: <https://kevinedgm.github.io/xila/>.

## Qué es Xila hoy

**Parte de la pregunta del lector, no del tipo de gráfico.** Cada forma responde una tarea de
lectura concreta: ver la tendencia, comparar magnitudes, contar casos, encontrar la relación,
localizar el patrón en una matriz. Las formas clásicas están (`line`, `bar`, `scatter`, `box`,
`heatmap`) y junto a ellas las alternativas que nacieron de preguntar "¿qué quiere ver quien
mira esto?":

| Pregunta                                   | Forma clásica | Alternativa en Xila                                                   |
| ------------------------------------------ | ------------- | --------------------------------------------------------------------- |
| ¿Dónde está hoy y de dónde viene?          | línea         | **Ahora con estela** (`nowPlugin`): cifra actual, cambio y estela     |
| ¿Cómo va este frente a los demás?          | líneas        | **Protagonista y contexto** (`focusPlugin`): una en color, resto gris |
| ¿Cuánto más que el promedio o la meta?     | barras        | **Puntos con referencia** (`bar.mark: 'dot'` + `referencePlugin`)     |
| ¿Qué parte del total es de cada uno?       | barras        | **Unidades del total** (`type: 'waffle'`): un cuadro por cada N       |
| ¿Cómo se reparten los casos?               | histograma    | **Unidades** (`type: 'dots'`): un punto por caso, tira o cubetas      |
| ¿Por dónde ha pasado y hacia dónde va?     | dispersión    | **Trayectorias** (`scatter.path` + `trajectoryPlugin`): caminos y año |
| ¿Quién se sale del patrón?                 | dispersión    | **Contra lo esperado** (`trendPlugin`): tendencia, tallos y ranking   |
| ¿Dónde han estado y dónde están ahora?     | box plot      | **Un punto por año** (`box.mark: 'dots'` + `shade` + `now`): enjambre |
| ¿Dónde se concentra cada grupo?            | box plot      | **Franja de densidad** (`box.mark: 'density'`)                        |
| ¿Dónde cae hoy dentro de su historia?      | box plot      | **Hoy frente a su historia** (`box.mark: 'range'` + `now: 'last'`)    |
| ¿Cuándo cambió cada uno?                   | mapa de calor | **Cada fila contra sí misma** (`heatmap.scale: 'row'` + `rowLabels`)  |
| ¿Cuánto exactamente, sin perder el patrón? | mapa de calor | **Tabla con tono** (`heatmap.values` + `gap`): cifra en cada celda    |

**Anatomía editorial.** Grid solo horizontal, líneas de 2 px con nombre y último valor al final
en vez de leyenda, barras con el extremo redondeado y un hueco del color del fondo entre
vecinas, puntos con anillo de superficie, y un título que dice el hallazgo (`titlePlugin`).
Nada de sombras, degradados ni cajas: el dato manda.

**Marca Xila.** Superficie «manta» (#f6f1e8) y tinta, cobalto #1f4bd8 como color de marca, «hilo»
naranja de acento y una categórica de siete validada para daltonismo; Instrument Sans para la
interfaz, JetBrains Mono para las cifras y Fraunces para el título del hallazgo (importa
`xilaplot/fuentes/xila.css` una vez por página); el heatmap va de la manta al marino pasando por el cobalto (`cobalto`).
Los tokens viven en el tema y se cambian en una sola configuración.

**Interacción incluida.** Tooltip, leyenda, zoom y pan, selección que cuenta, panel de resumen,
anotaciones, sincronización entre gráficos y accesibilidad por teclado vienen como plugins; un
plugin propio son unas funciones de ciclo de vida (`docs/plugins.md`).

**Rápida con muchos datos.** Columnas tipadas, decimación min/max para líneas y WebGL para un
millón de puntos; los números están en [`docs/benchmarks.md`](docs/benchmarks.md).

## Estructura

```
packages/
  core/      # xilaplot: motor, datos, escalas, renderer Canvas
  vue/       # xilaplot-vue: componente <XilaChart>
examples/    # app Vite para probar la librería a mano
```

## Cómo correrlo

Requiere Node 20 o superior y pnpm 10.

```bash
pnpm install
pnpm build      # construye core y vue
pnpm dev        # abre los ejemplos en http://localhost:5173
pnpm test       # tests con Vitest
pnpm lint       # ESLint
pnpm typecheck  # TypeScript estricto en todos los paquetes
```

### Tests visuales

Comparan capturas de cada ejemplo contra las referencias en `examples/tests/__capturas__`
(generadas en Ubuntu 24.04 con las fuentes de la marca, que viven en `packages/core/fuentes/ttf`;
CI las instala en el sistema). Con otra fuente el texto mide distinto y las capturas no coinciden. Si un cambio de dibujo es
intencional, se regeneran con `--update-snapshots` y se revisan en el diff del commit.

```bash
pnpm build && pnpm --filter examples build
pnpm --filter examples exec playwright install chromium   # una vez
pnpm --filter examples test:visual                         # o con CHROMIUM_PATH=/ruta/a/chrome
pnpm --filter examples test:visual --update-snapshots      # aceptar cambios
```

## Render diferido

Por defecto un gráfico no se dibuja hasta que su contenedor está a menos de 200 px de la
pantalla, y no redibuja mientras está fuera (`IntersectionObserver`). Una página con 30
gráficos solo paga los visibles: `examples/muchos.html` lo muestra con un contador. Para
dibujar siempre (por ejemplo, exportar sin mostrar) se pasa `lazy: false`.
Mientras un gráfico no se ha dibujado, `XilaChart` (y por tanto los paneles del dashboard)
muestra una silueta gris del tamaño final, así la página no salta al aparecer; `skeleton: false`
la quita. El evento `draw` de `Chart` (`{ first }`) avisa de cada dibujo.

## Escalas

`scales.x.type` y `scales.y.type` aceptan `linear` (por defecto), `time` (columna de tiempo;
ticks alineados al calendario), `band` (barras) y `log` (base 10: ticks en potencias de 10 con
subticks 2 y 5 cuando caben; los valores ≤ 0 no tienen logaritmo, se omiten y se avisa una vez
en consola). El zoom en una escala log se hace en espacio logarítmico.

## Incertidumbre

Una serie puede declarar su error: `yError` (simétrico, `y ± error`) o `yLow` y `yHigh`
(límites explícitos, por ejemplo un intervalo de confianza calculado en pandas). En líneas se
dibuja como banda sombreada bajo la línea; en dispersión, como barras de error con remates. El
dominio Y incluye los límites y el tooltip muestra el intervalo entre paréntesis.

## Backends: Canvas y WebGL

Por defecto todo se dibuja con Canvas 2D. Con `renderer: 'webgl'` los puntos de una dispersión
van a la GPU: `x` e `y` se suben una vez como buffer y cada fotograma solo cambian la escala y el
desplazamiento (uniforms), así que el pan y el zoom de un millón de puntos no vuelven a recorrer
los datos. Ejes, texto, líneas y barras siguen en Canvas. `renderer: 'auto'` elige WebGL para
dispersiones de 50 000 puntos o más. Si WebGL2 no existe o el navegador pierde el contexto, los
puntos se dibujan con Canvas y se avisa una vez en consola; `chart.getBackend()` dice cuál quedó.
Mecanismo y límites en [`docs/adr/0004-webgl-hibrido-para-puntos.md`](docs/adr/0004-webgl-hibrido-para-puntos.md).

## Histogramas

`histogram(valores, { bins })` cuenta en cubetas iguales (los `NaN` se ignoran; el último borde
es inclusivo, como `numpy.histogram`). `bins` acepta un entero o una regla: `'fd'`
(Freedman–Diaconis, por defecto: ancho `2·IQR/n^(1/3)`, robusto a atípicos), `'sturges'` o
`'sqrt'`. `histogramTable` devuelve una `DataTable` con la etiqueta de cada cubeta y su conteo,
lista para un gráfico `bar` con `bar: { padding: 0, radius: 0, gap: 1 }`.

## Gráfico de unidades

`type: 'dots'` dibuja **un punto por caso** de una columna numérica (`x`; `y` no hace falta).
Dos modos sobre la misma lista de puntos: `dots.mode: 'strip'` (tira con dispersión vertical
determinista, para ver la nube y su cola) y `'binned'` (cada punto va a su cubeta y se apila
en columnas: el histograma explicado como pila de casos). Cambiar de modo con `update` mueve
cada punto de su posición anterior a la nueva durante `dots.transition` ms (600; se omite con
`prefers-reduced-motion`). `dots.bins` acepta las mismas reglas que `histogram` y
`dots.radius` fija el radio o lo ajusta (`'auto'`) para que la cubeta más alta quepa. Con
`selectionPlugin` arrastrar cuenta los casos de un rango en vez de hacer zoom, y `summaryPlugin`
pone al lado la cifra, el porcentaje, el rango, la mediana y los botones de forma. Ejemplo:
`examples/unidades.html`.

## Unidades del total

`type: 'waffle'` reparte un total en cuadros iguales: `x` es la categoría y `y` el valor; cada
categoría recibe `round(valor / unidad)` cuadros y van juntos, fila por fila. `waffle.unit`
(`'auto'`: paso redondo que da entre 100 y 250 cuadros), `waffle.columns`, `waffle.gap` y
`waffle.labels`. Con `type: 'bar'` y `bar: { mark: 'dot' }` cada barra se vuelve un punto en el
valor, listo para `referencePlugin`. Ejemplo: `examples/comparar.html`.

## Box plot

`type: 'box'` recibe datos en formato largo (una fila por medición): `x` es la columna
categórica del grupo y `y` la del valor. Por grupo calcula Q1, mediana y Q3 con la misma
interpolación que `df.describe()`, bigotes hasta el último dato dentro de `1.5·IQR` (ajustable
con `box.whisker`) y dibuja los atípicos como puntos (`box.outliers: false` los quita). Varias
series se colocan lado a lado; el tooltip muestra mediana, cuartiles y `n`. `boxStats` y
`boxGroups` están disponibles por separado. `box.mark` cambia la marca con los mismos datos:
`'dots'` (enjambre, un punto por valor; `shade` da el tono por otra columna), `'density'`
(franja de intensidad) o `'range'` (bandas de percentiles); `box.now: 'last'` marca la última
fila de cada grupo con su valor y en qué parte del reparto cae. Ejemplo: `examples/reparto.html`.

## Heatmap

`type: 'heatmap'` toma datos en formato largo: `x` e `y` son las columnas categóricas (columna y
fila de la celda) y `value` la numérica. Se dibuja como una imagen de un píxel por celda
escalada sin suavizado, así 500 × 500 celdas cuestan milisegundos. `heatmap.colormap` acepta
`cobalto` (por defecto: un solo tono, de la manta al marino), `viridis`, `magma`,
`inferno`, `plasma` (perceptuales: la luminosidad crece de forma uniforme, legibles con
daltonismo y en blanco y negro), `rdbu` y `cobalto-naranja` (divergentes) o paradas
hexadecimales propias. `center: 0` hace el dominio simétrico para correlaciones; `legend`
dibuja la barra de color. `colormap()` está exportada para usar los mismos colores fuera.

Más allá del mapa de calor: `heatmap.scale: 'row'` colorea cada fila contra su propia mediana
(azul por debajo, naranja por encima) y `rowLabels: 'max'` anota el año del máximo y la mediana;
`values: true` y `gap` convierten el mapa en una tabla con tono, con la cifra en cada celda.
`bucketTime` acepta `'decade'` para resumir por década. Ejemplo: `examples/matriz.html`.

## Plugins

Título con hallazgo, tooltip, leyenda, etiquetas al final de las líneas, "ahora con estela" y "protagonista y contexto" (`nowPlugin`, `focusPlugin`), línea de referencia con diferencias (`referencePlugin`), trayectorias en el plano (`trajectoryPlugin`), tendencia con tallos (`trendPlugin`), zoom/pan, selección que cuenta, panel de resumen y anotaciones vienen en `xilaplot`; opciones y mecanismo en
[`docs/plugins.md`](docs/plugins.md).

## Dashboards para clientes

El flujo completo, sin escribir código de gráficos:

1. Notebook → `exportar_xila(df, 'ventas')` (`python/xila_export.py`) escribe `data/ventas.csv`
   según `docs/contrato-csv.md`.
2. `pnpm nuevo-cliente acme` copia `plantilla/` a `clientes/acme/`.
3. Se edita `public/dashboard.json` (`docs/configuracion-dashboard.md`): tablas, filtros y paneles.
4. `pnpm build` genera `dist/`; se sube y se protege en el servidor (`docs/despliegue.md`).

Ejemplos funcionando con `pnpm dev`: `/dashboard.html` (ventas sintéticas),
`/dashboard.html?config=co2/dashboard.json` (emisiones de CO₂ de Our World in Data,
generado con `python3 python/ejemplo_co2.py`: descarga, limpia, exporta; el JSON no tiene código)
y `/dashboard.html?config=co2/muestra.json`, el dashboard de muestra con las once alternativas de
"Qué es Xila hoy" declaradas con la clave `forma` de cada panel (`ahora`, `protagonista`,
`puntos`, `unidades`, `trayectorias`, `tendencia`, `cajas` y `calor` con sus formas).

## Publicar en npm

`git tag v0.1.0 && git push origin v0.1.0` lanza `.github/workflows/publicar.yml`, que construye,
prueba y publica los dos paquetes con procedencia. Requiere el secreto `NPM_TOKEN`. Antes de
etiquetar, subir `version` en `packages/*/package.json` y en `packages/core/src/index.ts`.

## Licencia

MIT

## Benchmark del prototipo

```bash
pnpm build && pnpm --filter examples build
CHROMIUM_PATH=/ruta/a/chrome pnpm --filter examples bench         # memoria, primer render y pan
CHROMIUM_PATH=/ruta/a/chrome pnpm --filter examples bench:visual  # compara píxel a píxel
pnpm --filter examples bench:check                                 # puerta de regresión (umbrales en bench/check.mjs)
```

CI corre el benchmark en un job aparte (solo el renderer decimado, 3 repeticiones) y falla si
1M puntos tardan más de 30 ms por frame, el primer render más de 200 ms o las columnas pesan
más de 25 MB. Son umbrales holgados: atrapan regresiones grandes, no variaciones del runner.

Resultados y decisiones en `docs/adr/`. La comparación Canvas contra WebGL para dispersiones
de 100K a 5M puntos está en [`docs/benchmarks.md`](docs/benchmarks.md)
(`node examples/bench/dispersion.mjs`).

# Xila

Librería de gráficos en TypeScript para dashboards y datos científicos, con identidad inspirada en los textiles de Oaxaca.

> **Estado:** experimental (0.x). La API puede cambiar entre versiones. Paquetes en npm: `xilaplot` (núcleo) y `xilaplot-vue` (Vue 3). Documentación: <https://kevinedgm.github.io/xila/>.

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
(generadas en Ubuntu 24.04 con la fuente Inter 4.0, paquete `fonts-inter`; CI la instala). Con
otra fuente el texto mide distinto y las capturas no coinciden. Si un cambio de dibujo es
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
lista para un gráfico `bar` con `bar: { padding: 0 }`.

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

## Box plot

`type: 'box'` recibe datos en formato largo (una fila por medición): `x` es la columna
categórica del grupo y `y` la del valor. Por grupo calcula Q1, mediana y Q3 con la misma
interpolación que `df.describe()`, bigotes hasta el último dato dentro de `1.5·IQR` (ajustable
con `box.whisker`) y dibuja los atípicos como puntos (`box.outliers: false` los quita). Varias
series se colocan lado a lado; el tooltip muestra mediana, cuartiles y `n`. `boxStats` y
`boxGroups` están disponibles por separado.

## Heatmap

`type: 'heatmap'` toma datos en formato largo: `x` e `y` son las columnas categóricas (columna y
fila de la celda) y `value` la numérica. Se dibuja como una imagen de un píxel por celda
escalada sin suavizado, así 500 × 500 celdas cuestan milisegundos. `heatmap.colormap` acepta
`viridis` (por defecto), `magma`, `inferno`, `plasma` (perceptuales: la luminosidad crece de
forma uniforme, legibles con daltonismo y en blanco y negro), `rdbu` (divergente) o paradas
hexadecimales propias. `center: 0` hace el dominio simétrico para correlaciones; `legend`
dibuja la barra de color. `colormap()` está exportada para usar los mismos colores fuera.

## Plugins

Tooltip, leyenda, zoom/pan, selección que cuenta, panel de resumen y anotaciones vienen en `xilaplot`; opciones y mecanismo en
[`docs/plugins.md`](docs/plugins.md).

## Dashboards para clientes

El flujo completo, sin escribir código de gráficos:

1. Notebook → `exportar_xila(df, 'ventas')` (`python/xila_export.py`) escribe `data/ventas.csv`
   según `docs/contrato-csv.md`.
2. `pnpm nuevo-cliente acme` copia `plantilla/` a `clientes/acme/`.
3. Se edita `public/dashboard.json` (`docs/configuracion-dashboard.md`): tablas, filtros y paneles.
4. `pnpm build` genera `dist/`; se sube y se protege en el servidor (`docs/despliegue.md`).

Ejemplos funcionando con `pnpm dev`: `/dashboard.html` (ventas sintéticas) y
`/dashboard.html?config=co2/dashboard.json` (emisiones de CO₂ de Our World in Data,
generado con `python3 python/ejemplo_co2.py`: descarga, limpia, exporta; el JSON no tiene código).

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

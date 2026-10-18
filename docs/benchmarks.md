# Benchmarks de dispersión: Canvas 2D contra WebGL (E6.12)

Medido el 2026-10-18 con `examples/bench/dispersion.mjs` en Chromium 141 headless dentro de un
contenedor Linux **sin GPU**: WebGL corre por SwiftShader (software). Las cifras sirven para
comparar los dos backends entre sí y para ver cómo escalan; en una máquina con GPU real la
columna WebGL baja uno o dos órdenes de magnitud y la de Canvas cambia poco.

Cómo se mide:

- **Primer dibujo**: tiempo de JavaScript desde `new Chart` hasta el final del primer `draw`
  (construir paths o subir el buffer). No incluye la rasterización del navegador.
- **Pan**: por fotograma, `setViewDomain` + `drawNow` + leer un píxel (`getImageData` o
  `readPixels`), que obliga al navegador a terminar de rasterizar. Es el costo real.
- **Heap JS**: uso del heap de V8 después del primer dibujo, menos el de una página en blanco.
  Las columnas `Float64Array` viven fuera del heap y se suman por construcción.

|    Puntos | Backend |  Primer dibujo (ms) | Pan, mediana (ms) | Columnas float64 (MB) | Buffer GPU (MB) |
| --------: | ------- | ------------------: | ----------------: | --------------------: | --------------: |
|   100 000 | canvas  |                  83 |               313 |                   1.5 |               — |
|   100 000 | webgl   |                  61 |               170 |                   1.5 |             0.8 |
| 1 000 000 | canvas  |                 630 |            10 640 |                  15.3 |               — |
| 1 000 000 | webgl   |                 152 |             1 627 |                  15.3 |             7.6 |
| 5 000 000 | canvas  | no terminó (>120 s) |        no terminó |                  76.3 |               — |
| 5 000 000 | webgl   |                 592 |             7 639 |                  76.3 |            38.1 |

Lectura:

1. **Canvas no escala con los puntos**: un `arc` por punto, 1M de arcos son 10 s por fotograma
   aunque el JavaScript del dibujo tarde 0.6 s; el costo está en rasterizar. A 5M no termina
   ni el primer dibujo en dos minutos.
2. **WebGL sí escala**: el buffer se sube una vez y el pan solo cambia uniforms; el tiempo
   que queda es rasterizar los puntos, que aquí lo hace la CPU (SwiftShader) y por eso sigue
   siendo de segundos. Con GPU el mismo trabajo es de milisegundos: es exactamente el trabajo
   que una GPU paraleliza.
3. **La memoria es la misma** en ambos backends salvo el buffer float32 relativo (la mitad de
   las columnas), que WebGL mantiene mientras la serie no cambie.

Criterio de salida de la Etapa 6: con 1M puntos, WebGL hace el pan 6.5× más rápido que Canvas
en software, y es el único backend que llega a 5M. La medición "fluida" (< 16 ms) solo tiene
sentido con GPU y queda para la máquina de referencia de Kevin:

```bash
pnpm build && pnpm --filter examples build
CHROMIUM_PATH=/ruta/a/chrome node examples/bench/dispersion.mjs
```

El benchmark de líneas (decimación min/max contra uPlot) sigue en `examples/bench/run.mjs` y
en CI como puerta de regresión; la línea con decimación ya estaba en ~5 ms por fotograma para
1M puntos (ADR 0002), por eso las líneas en WebGL (E6.10) se quedan en P2.

## Comparativa con otras librerías: líneas de 10K a 1M puntos (E7.08)

Medido el 2026-10-18 con `examples/bench/run.mjs` (`pnpm --filter examples bench`), mismo
contenedor sin GPU, Chromium 141 headless, 3 repeticiones por celda, mediana. La serie es
sintética y determinista (`examples/src/bench/synthetic.ts`: tendencia + ciclo + ruido +
picos, `x` en milisegundos a 1 kHz). Todas las librerías dibujan una línea de 1 px en un
lienzo de 1000 × 400 sin tooltip ni animación, con la configuración que cada documentación
recomienda para series grandes:

| Renderer    | Qué es                                                                           |
| ----------- | -------------------------------------------------------------------------------- |
| `xila`      | `Chart` completa de Xila: ejes, grid, ticks, layout y decimación min/max         |
| `decimated` | solo el canvas decimado de Xila, sin ejes (el techo del motor)                   |
| `naive`     | un `lineTo` por punto, sin decimar (la línea base)                               |
| `uplot`     | uPlot 1.6, ejes y cursor apagados                                                |
| `chartjs`   | Chart.js 4 con el plugin `decimation` (min-max), `parsing: false`, sin animación |
| `echarts`   | ECharts 5 con `sampling: 'lttb'`, `large: true`, columnas tipadas en `dataset`   |
| `plotly`    | Plotly 2 con `scattergl` (WebGL) y `staticPlot`                                  |

**Primer dibujo** (ms, desde `draw` hasta terminar de rasterizar):

|    Puntos | xila | decimated | naive | uplot | chartjs | echarts | plotly |
| --------: | ---: | --------: | ----: | ----: | ------: | ------: | -----: |
|    10 000 |  3.3 |       4.8 |   3.8 |   2.8 |    10.3 |     6.1 |    248 |
|   100 000 |  5.4 |       4.3 |  19.0 |   7.2 |    14.4 |     7.5 |  2 191 |
| 1 000 000 | 20.0 |      11.0 | 139.2 |  22.8 |    32.5 |    31.7 | 21 196 |

**Pan** (ms por fotograma, mediana de hasta 120 fotogramas; 16.7 ms es un fotograma a 60 Hz):

|    Puntos | xila | decimated | naive | uplot | chartjs | echarts | plotly |
| --------: | ---: | --------: | ----: | ----: | ------: | ------: | -----: |
|    10 000 |  1.2 |       0.8 |   1.5 |   1.0 |     3.1 |     1.9 |    232 |
|   100 000 |  2.9 |       1.4 |  12.3 |   2.0 |     4.7 |     3.2 |  2 080 |
| 1 000 000 | 16.9 |       3.9 | 123.9 |  10.4 |    16.1 |    15.0 | 20 444 |

Lectura honesta:

1. **A 1M puntos Xila pierde contra uPlot en el pan** (16.9 contra 10.4 ms) y queda a la par de
   Chart.js y ECharts. El motor decimado solo cuesta 3.9 ms, así que los 13 ms restantes están
   en lo que `Chart` hace alrededor: recalcular dominios, ticks, layout y el índice de
   búsqueda del hover en cada fotograma. Es trabajo que no depende del zoom y se puede cachear;
   queda anotado como tarea. A 100K y 10K Xila y uPlot están dentro del ruido de medición.
2. **Chart.js y ECharts aguantan 1M puntos** si se configuran como su documentación indica
   (decimación o muestreo explícitos, sin animación, sin `parsing`). Con la configuración por
   defecto no (Chart.js sin `decimation` dibuja todos los puntos, como `naive`). Chart.js además
   necesita los datos como objetos `{x, y}`, que a 1M pesan tres veces más en memoria que las
   columnas (ver la primera tabla de este documento).
3. **Plotly no es para esto**: `scattergl` reconstruye sus buffers en cada `relayout` y en este
   contenedor sin GPU tarda 20 s por fotograma a 1M; con GPU real baja mucho, pero sigue
   rehaciendo el trabajo completo en cada pan.
4. **El primer dibujo** de Xila a 1M (20 ms) incluye construir el índice de hover; el canvas
   solo tarda 11 ms. uPlot está en 23 ms y Chart.js y ECharts en 32 ms.

Qué no mide esta tabla: calidad visual (uPlot, Chart.js y ECharts muestrean de formas
distintas y pueden perder picos; `bench:visual` compara Xila decimada contra la línea sin
decimar píxel a píxel), tooltip, ejes de tiempo ni dispersión; para dispersión está la tabla
Canvas contra WebGL de arriba. Para reproducirlo:

```bash
pnpm install && pnpm build && pnpm --filter examples build
CHROMIUM_PATH=/ruta/a/chrome pnpm --filter examples bench   # escribe examples/bench/resultados.json
```

`BENCH_RENDERERS=xila,uplot` limita los renderers, `BENCH_REPEATS` las repeticiones y
`BENCH_PAN_MAX_MS` (15 s) corta el pan de una librería lenta, por eso Plotly tiene menos
fotogramas medidos.

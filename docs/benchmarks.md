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

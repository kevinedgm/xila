# ADR 0002 · Renderer por lotes y decimación min/max

**Estado:** aceptada · **Fecha:** 2026-10-18

## Contexto

Había que decidir si Canvas 2D alcanza para líneas de 1M de puntos con pan fluido, o si WebGL tenía que subir de prioridad también para líneas. También si el contrato del renderer recibe primitivas sueltas (`drawPoint`) o series completas.

## Medición

Protocolo en `examples/bench/run.mjs`: canvas de 1000 × 400 px, pan continuo de 120 fotogramas, tiempo de trabajo por fotograma (mediana y p95 de 5 repeticiones), Chromium headless sin GPU. uPlot 1.6 como referencia externa, forzando dibujo síncrono con `batch()`.

### Primer render (ms)

| Puntos | Sin decimación | Con decimación min/max | uPlot |
| ------ | -------------- | ---------------------- | ----- |
| 10K    | 2.9            | 4.1                    | 3.5   |
| 100K   | 15.0           | 5.1                    | 6.8   |
| 1M     | 158.0          | 13.5                   | 17.9  |

### Pan, trabajo por fotograma (ms, mediana / p95)

| Puntos | Sin decimación | Con decimación min/max | uPlot       |
| ------ | -------------- | ---------------------- | ----------- |
| 10K    | 1.6 / 2.3      | 0.9 / 1.4              | 1.1 / 1.9   |
| 100K   | 14.0 / 19.8    | 1.5 / 2.3              | 2.3 / 3.5   |
| 1M     | 134.2 / 192.9  | 4.6 / 7.3              | 11.3 / 17.1 |

Con decimación, 1M de puntos se reducen a ~3 400 vértices por fotograma (4 por columna de píxel como máximo).

### Fidelidad visual

`examples/bench/visual.mjs` compara píxel a píxel el render completo contra el decimado para 1M de puntos: 1.6 % de los píxeles difieren, todos en los bordes antialiasados del trazo (el render completo apila cientos de segmentos por columna y acumula la cobertura de forma distinta). No hay diferencia estructural: todos los picos se conservan, como garantizan los tests de `minMaxDecimate`.

## Decisión

1. **Canvas 2D con decimación min/max es el renderer principal para líneas.** Cumple el criterio de la Etapa 2 (menos de 16 ms por fotograma con 1M de puntos) con margen, incluso sin GPU.
2. **WebGL no sube de prioridad para líneas.** Queda en la Etapa 6, solo para dispersión masiva, donde la decimación por columna no aplica.
3. **El contrato del renderer recibe lotes:** `drawLineSeries(x, y, from, to, estilo, transform)`. La decimación ocurre antes de llegar al backend, así que Canvas, SVG y WebGL reciben la misma serie ya reducida y cada uno decide cómo trazarla.

## Por qué funciona

Una pantalla de 1000 px no puede mostrar más de 1000 posiciones horizontales. Dentro de una columna lo único visible es el trazo vertical entre el mínimo y el máximo, más la entrada y la salida. Guardar esos 4 puntos conserva exactamente lo que se ve. Por eso el costo del dibujo pasa a depender del ancho en píxeles y no del número de puntos: el recorrido de los datos (O(n) sobre el rango visible) es lo único que crece.

## Consecuencias

- `x` debe estar ordenado. El adaptador de entrada lo verifica u ordena.
- La búsqueda binaria (`lowerBound`) acota el recorrido al rango visible: al hacer zoom, el costo baja.
- Pendiente para la Etapa 3: medir en una máquina real con GPU (E2.01 fija la de referencia) y en pantallas con `devicePixelRatio` 2, donde hay el doble de columnas.

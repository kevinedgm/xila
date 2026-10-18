# ADR 0001 · Modelo de datos columnar

**Estado:** aceptada · **Fecha:** 2026-10-18

## Contexto

El brief original proponía `points: [{ x, y }, ...]` como forma de los datos. La meta es manejar series de hasta 1M de puntos en el navegador, y más adelante WebGL, que solo acepta buffers tipados.

## Opciones

1. Array de objetos `{ x, y }` (como Chart.js).
2. Columnas tipadas: `{ x: Float64Array, y: Float64Array }` (como uPlot).

## Medición

Protocolo en `examples/bench/run.mjs`, 1M de puntos, mediana de 5 repeticiones, Chromium headless sin GPU (sirve para comparar entre sí, no como cifras absolutas).

| Formato                 | Memoria total                              | Recorrido min/max |
| ----------------------- | ------------------------------------------ | ----------------- |
| Objetos `{x, y}`        | 45.8 MB en el heap de V8                   | 17.8 ms           |
| Columnas `Float64Array` | 15.3 MB (fuera del heap, 2 × 1M × 8 bytes) | 15.6 ms           |

El heap de JS con columnas queda en 0.01 MB: el recolector de basura no tiene nada que revisar.

## Decisión

La representación interna es columnar. El adaptador de entrada convierte arrays de objetos o CSV una sola vez, al recibir los datos.

## Consecuencias

- 3× menos memoria y sin presión sobre el recolector de basura.
- El recorrido es solo 1.14× más rápido en este caso; la ventaja grande de las columnas no está en recorrerlas sino en que pasan directo a WebGL y no generan basura al actualizar.
- Las categorías se guardan como índices (`Uint32Array`) más un diccionario, para mantener todo tipado.

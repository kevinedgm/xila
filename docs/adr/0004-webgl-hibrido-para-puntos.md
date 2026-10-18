# ADR 0004 · WebGL híbrido: solo los puntos van a la GPU

**Estado:** aceptada · **Fecha:** 2026-10-18

## Contexto

Canvas 2D con decimación min/max dibuja líneas de 1M de puntos en unos milisegundos (ADR 0002),
pero una dispersión no se puede decimar sin perder puntos: cada uno es un `arc`, y un millón de
arcos por fotograma cuesta cientos de milisegundos. Es el único caso del MVP donde Canvas no
alcanza.

## Decisión

1. `WebGLRenderer` extiende `CanvasRenderer` y añade un cuarto canvas (WebGL2) entre `data` y
   `overlay`. Solo `drawPointSeries` sobre la capa `data` va a la GPU; ejes, texto, líneas,
   barras, bandas, barras de error y el marcador de hover siguen en Canvas 2D. Así no se
   reimplementa texto ni trazos en WebGL, que es donde está el trabajo caro y poco rentable.
2. El buffer se sube una vez por serie (identidad de los arreglos `x`/`y`) y se reutiliza
   mientras cubra el rango pedido. Pan y zoom solo cambian cuatro uniforms (`offset`, `scale`
   por eje), que es exactamente la forma `base + (v − offset)·scale` de `LinearMap`.
3. Precisión: se sube `v − origen` en float32 (ADR 0003). El origen de X es el primer punto
   visible al subir; el de Y, el centro del rango. Se vuelve a subir cuando el error de float32
   en los extremos de la ventana supera un cuarto de píxel.
4. Fallback (E6.11): si `getContext('webgl2')` devuelve `null`, el shader no compila o llega
   `webglcontextlost`, el renderer marca `backend = 'canvas'`, oculta el canvas WebGL, avisa una
   vez en consola y pide un redibujo al gráfico. El gráfico nunca queda en blanco.
5. Opt-in: `renderer: 'canvas'` por defecto (capturas y comportamiento estables); `'webgl'`
   explícito o `'auto'` (dispersiones de ≥ 50 000 puntos).

## Consecuencias

- Radios por punto (`radii`) siguen en Canvas; se añadirán como atributo cuando haga falta.
- `preserveDrawingBuffer: true` para que `toDataURL` y las capturas puedan leer el canvas
  WebGL; cuesta un poco de memoria, no de tiempo de dibujo.
- Las líneas en WebGL (E6.10) quedan para después: la decimación ya las hace baratas en Canvas.
- Los tests visuales corren en Chromium sin GPU (SwiftShader): sirven para verificar que se
  dibuja, no para medir rendimiento; el benchmark (E6.12) se interpreta con esa salvedad.

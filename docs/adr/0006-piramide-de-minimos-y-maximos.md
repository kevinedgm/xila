# ADR 0006 · Pirámide de mínimos y máximos para líneas grandes

**Estado:** aceptada · **Fecha:** 2026-10-19

## Contexto

Con la decimación de ADR 0002 el dibujo ya no depende de cuántos puntos hay (4 por columna de
píxel), pero calcular esos 4 puntos sí: `minMaxDecimate` recorre el rango visible en cada
fotograma, unos 3,4 ms por millón de puntos en vista en un contenedor sin GPU. A 1M cabe; a
5M ya no cabe en un fotograma de 16 ms, y a 10M el pan tarda 77 ms.

Se evaluó una propuesta externa (fuente de datos asíncrona con M4 en un Web Worker). Un Worker
no reduce el trabajo, solo lo saca del hilo principal; y M4 es lo que `minMaxDecimate` ya hace
(primero, mínimo, máximo y último por columna).

## Decisión

Para líneas con X ordenada y 100 000 puntos o más (`line.decimate: 'auto'`), `Chart` construye
una vez por serie una **pirámide de mínimos y máximos** (`data/pyramid.ts`): para cada bloque
de 2^k puntos, con k ≥ 4, el índice de su mínimo y de su máximo. Cada columna de píxel se
resuelve uniendo O(log n) bloques alineados; un fotograma cuesta O(px · log n).

- Construcción O(n) al resolver los datos: 22 ms a 1M y 137 ms a 10M.
- Memoria ≈ 1 byte por punto (dos `Uint32Array` por nivel, desde bloques de 16).
- Un bloque con `NaN` se marca y la consulta baja de nivel hasta recorrer sus puntos; así el
  resultado es **idéntico** al de `minMaxDecimate`, cortes incluidos. La prueba de
  `pyramid.test.ts` lo comprueba comparando las salidas elemento a elemento.
- `'scan'` fuerza el recorrido de siempre; `'pyramid'` fuerza la pirámide a cualquier tamaño.

## Medición

Pan de la `Chart` completa, mediana de ms por fotograma (`BENCH_SIZES=…`, Chromium headless
sin GPU):

| Puntos | recorrido | pirámide |
| -----: | --------: | -------: |
|     1M |       9,7 |      3,0 |
|     2M |      17,0 |      3,4 |
|     5M |      43,1 |      3,8 |
|    10M |      77,0 |      4,5 |

## Consecuencias

- El pan es plano hasta donde quepan las columnas en memoria (16 bytes por punto en Float64).
- Lo que queda por fotograma ya no es recorrer datos: es dibujar y el trabajo fijo de ejes y
  layout.
- Cargar, parsear y transferir los datos sigue siendo O(n) y es el siguiente límite para
  series de decenas de millones; ahí entraría una fuente remota con buckets precalculados.

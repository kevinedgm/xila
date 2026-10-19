# Rendimiento

Qué hace Xila para que un millón de puntos sea cómodo y qué perilla mover cuando no lo es.

## Dónde se va el tiempo

Un gráfico paga tres cosas: **memoria** por guardar los datos, **primer dibujo** por
recorrerlos y **cada fotograma** de pan o zoom por volver a recorrerlos. Las decisiones del
núcleo atacan cada una:

| Costo          | Decisión                                                        | Efecto medido                                  |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| Memoria        | columnas `Float64Array`, no objetos                             | 1M puntos: 15 MB en vez de 46 MB               |
| Primer dibujo  | decimación mín/máx por píxel en líneas                          | 1M puntos de línea en unos 3 ms por fotograma  |
| Pan de líneas  | pirámide de mín/máx desde 100 000 puntos (`line.decimate`)      | 10M puntos: 4,5 ms por fotograma, igual que 1M |
| Cada fotograma | WebGL para puntos: datos en la GPU, el pan solo cambia uniforms | 1M puntos: 1.6 s → sin GPU; con GPU, ms        |
| Páginas largas | render diferido (`IntersectionObserver`)                        | solo pagan los gráficos visibles               |

Los números completos, con la metodología, están en [Benchmarks](../referencia/benchmarks).

## Qué perilla mover

- **Líneas con muchos puntos**: nada, la decimación es automática y desde 100 000 puntos usa
  una pirámide de mínimos y máximos (se construye una vez: 22 ms a 1M, 137 ms a 10M; ~1 byte
  por punto). `line.decimate: 'scan'` la apaga, `'pyramid'` la fuerza. Mantén X ordenada; si
  no lo está, la serie se dibuja completa y sin pirámide.
- **Dispersión grande**: `renderer: 'webgl'` o `'auto'` (WebGL a partir de 50 000 puntos). Si
  WebGL2 no está, cae a Canvas con un aviso en consola y `chart.getBackend()` lo dice.
- **Muchos gráficos en una página**: déjalos con `lazy: true` (el valor por defecto). Solo
  usa `lazy: false` para exportar sin mostrar.
- **Filtros de dashboard**: filtra con `filterRows` y pasa la tabla con `chart.update({ data })`;
  no reconstruyas el gráfico.
- **Heatmaps**: el costo es por píxel de pantalla, no por celda; 500 × 500 celdas son
  milisegundos.
- **Vue**: `<XilaChart>` envuelve la configuración con `markRaw`. Si construyes la tabla fuera
  del componente, no la metas en `reactive()`: Vue envolvería cada `Float64Array` en un proxy y
  cada lectura pasaría por él.

## Comprobarlo

```bash
pnpm build && pnpm --filter examples build
pnpm --filter examples bench          # memoria, primer render y pan
node examples/bench/dispersion.mjs    # Canvas contra WebGL, 100K a 5M puntos
```

CI corre el benchmark en un job aparte y falla si un millón de puntos pasa de 30 ms por
fotograma, el primer dibujo de 200 ms o las columnas de 25 MB: umbrales holgados para atrapar
regresiones grandes sin fallar por el ruido del runner.

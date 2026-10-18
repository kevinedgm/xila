<script setup>
import linea from './ejemplos/linea';
import multi from './ejemplos/multi';
import barras from './ejemplos/barras';
import apiladas from './ejemplos/apiladas';
import dispersion from './ejemplos/dispersion';
import log from './ejemplos/log';
import histograma from './ejemplos/histograma';
import unidades from './ejemplos/unidades';
import cajas from './ejemplos/cajas';
import calor from './ejemplos/calor';
import anotaciones from './ejemplos/anotaciones';
import plugin from './ejemplos/plugin';
import accesible from './ejemplos/accesible';
</script>

# Galería

Trece gráficos con un mismo CSV real: emisiones de CO₂ de siete países entre 1950 y 2024
(Our World in Data, limpiado con pandas por `python/ejemplo_co2.py`). Cada ejemplo muestra el
código completo que lo produce; todos empiezan por cargar la tabla una sola vez:

<<< @/galeria/ejemplos/datos.ts

## Serie temporal

<Demo :cargar="linea" />

<<< @/galeria/ejemplos/linea.ts

## Varias series con leyenda

<Demo :cargar="multi" />

<<< @/galeria/ejemplos/multi.ts

## Barras

<Demo :cargar="barras" />

<<< @/galeria/ejemplos/barras.ts

## Barras apiladas

<Demo :cargar="apiladas" />

<<< @/galeria/ejemplos/apiladas.ts

## Dispersión con zoom en dos ejes

<Demo :cargar="dispersion" :alto="380" />

<<< @/galeria/ejemplos/dispersion.ts

## Escala logarítmica

<Demo :cargar="log" />

<<< @/galeria/ejemplos/log.ts

## Histograma

<Demo :cargar="histograma" />

<<< @/galeria/ejemplos/histograma.ts

## Casos como unidades

El mismo histograma, pero cada país-año es un punto: arrastra para contar cuántos caen en un
rango (o usa ← → y Escape con el gráfico enfocado).

<Demo :cargar="unidades" :alto="320" />

<<< @/galeria/ejemplos/unidades.ts

## Box plot

<Demo :cargar="cajas" />

<<< @/galeria/ejemplos/cajas.ts

## Heatmap

<Demo :cargar="calor" />

<<< @/galeria/ejemplos/calor.ts

## Anotaciones

<Demo :cargar="anotaciones" />

<<< @/galeria/ejemplos/anotaciones.ts

## Plugin propio

El plugin está explicado paso a paso en [Crear un plugin](../guia/plugin).

<Demo :cargar="plugin" />

<<< @/galeria/ejemplos/plugin.ts

## Accesibilidad por teclado

<Demo :cargar="accesible" />

<<< @/galeria/ejemplos/accesible.ts

## WebGL con un millón de puntos

No cabe en esta página sin descargar 16 MB, pero el repositorio trae la demo lista:
`pnpm dev` y abre `/webgl.html?n=1000000&renderer=webgl` (cambia `renderer=canvas` para
comparar). El código está en `examples/src/webgl.ts`.

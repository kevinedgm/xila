<script setup>
import linea from './ejemplos/linea';
import multi from './ejemplos/multi';
import ahora from './ejemplos/ahora';
import protagonista from './ejemplos/protagonista';
import barras from './ejemplos/barras';
import apiladas from './ejemplos/apiladas';
import puntos from './ejemplos/puntos';
import total from './ejemplos/total';
import trayectorias from './ejemplos/trayectorias';
import tendencia from './ejemplos/tendencia';
import dispersion from './ejemplos/dispersion';
import log from './ejemplos/log';
import histograma from './ejemplos/histograma';
import unidades from './ejemplos/unidades';
import cajas from './ejemplos/cajas';
import repartoPuntos from './ejemplos/reparto-puntos';
import repartoFranja from './ejemplos/reparto-franja';
import repartoHoy from './ejemplos/reparto-hoy';
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

## Ahora con estela

Cifra actual por país, cambio en diez años y la historia como estela. Reproducir mueve el instante
y el gráfico atenúa lo posterior.

<Demo :cargar="ahora" :alto="520" />

<<< @/galeria/ejemplos/ahora.ts

## Protagonista y contexto

Una serie en color y con valor; las demás en gris con solo su nombre. Los botones cambian la
protagonista.

<Demo :cargar="protagonista" :alto="420" />

<<< @/galeria/ejemplos/protagonista.ts

## Barras

<Demo :cargar="barras" />

<<< @/galeria/ejemplos/barras.ts

## Barras apiladas

<Demo :cargar="apiladas" />

<<< @/galeria/ejemplos/apiladas.ts

## Puntos con referencia

Donde terminaría cada barra hay un punto, y una línea punteada marca el promedio. La distancia
del punto a la línea es la respuesta a "¿cuánto más que el resto?"; el tallo y la cifra la
hacen legible de un vistazo.

<Demo :cargar="puntos" :alto="420" />

<<< @/galeria/ejemplos/puntos.ts

## Unidades del total

Cada cuadro vale lo mismo y los cuadros de un país van juntos: el lector cuenta su parte del
total en vez de comparar alturas. Pasar el ratón sobre un cuadro dice a quién pertenece.

<Demo :cargar="total" :alto="360" />

<<< @/galeria/ejemplos/total.ts

## Dispersión con zoom en dos ejes

<Demo :cargar="dispersion" :alto="380" />

<<< @/galeria/ejemplos/dispersion.ts

## Trayectorias

Cada país es un camino en el plano riqueza–emisiones, con una cabeza en su último punto. La
protagonista va en color; las demás en gris. Reproducir mueve el año y el camino se dibuja detrás.

<Demo :cargar="trayectorias" :alto="520" />

<<< @/galeria/ejemplos/trayectorias.ts

## Contra lo esperado

Una línea de tendencia dice cuánto "debería" valer y para cada x; el tallo de cada punto es su
diferencia y la lista de la derecha la ordena. Con siete puntos el ajuste es ilustrativo.

<Demo :cargar="tendencia" :alto="440" />

<<< @/galeria/ejemplos/tendencia.ts

## Escala logarítmica

<Demo :cargar="log" />

<<< @/galeria/ejemplos/log.ts

## Histograma

<Demo :cargar="histograma" />

<<< @/galeria/ejemplos/histograma.ts

## Casos como unidades

El mismo histograma, pero cada país-año es un punto: arrastra para contar cuántos caen en un
rango (o usa ← → con el gráfico enfocado); el panel de al lado resume el rango.

<Demo :cargar="unidades" :alto="320" />

<<< @/galeria/ejemplos/unidades.ts

## Box plot

<Demo :cargar="cajas" />

<<< @/galeria/ejemplos/cajas.ts

## Un punto por año

Los mismos datos del box plot, pero cada valor es un punto a su altura exacta, en un enjambre
por país; el tono va de 1950 (claro) a 2024 (oscuro) y el punto grande es el valor de hoy con
su lugar en el reparto.

<Demo :cargar="repartoPuntos" :alto="420" />

<<< @/galeria/ejemplos/reparto-puntos.ts

## Franja de densidad

Una franja por país cuya intensidad es cuántos años caen en cada tramo; raya en la mediana.

<Demo :cargar="repartoFranja" :alto="400" />

<<< @/galeria/ejemplos/reparto-franja.ts

## Hoy frente a su historia

Bandas del percentil 10 al 90 y del 25 al 75 con la mediana; el punto es 2024 y el texto dice
en qué parte de su historia cae.

<Demo :cargar="repartoHoy" :alto="420" />

<<< @/galeria/ejemplos/reparto-hoy.ts

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

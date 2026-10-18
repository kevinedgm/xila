# Crear un plugin

Un plugin es un objeto con un `id` y hooks opcionales. El núcleo los llama en un orden fijo en
cada ciclo, y les pasa un `PluginContext` con el renderer, las escalas, las series y los
eventos. Nada en el núcleo sabe qué es un tooltip: tooltip, leyenda, zoom, anotaciones,
accesibilidad y sincronización son plugins como el que vas a escribir.

## El ciclo

```
install        → una vez, al crear el gráfico (crear nodos, suscribirse a eventos)
beforeUpdate   → antes de resolver una configuración nueva; puede devolver otra
reserveSpace   → cuánto margen pide el plugin (leyenda arriba, etiquetas a la derecha)
afterLayout    → ya se conoce el área de dibujo
beforeDraw     → antes de pintar las series
afterDraw      → después: lo que dibujes aquí queda encima
onEvent        → hover, click, zoom, visibility, dataChanged, resize, draw
uninstall      → deshacer todo lo de install
```

Dos plugins que dependen uno del otro (tooltip sobre anotaciones) tienen un resultado
predecible porque dentro de cada hook corren en orden de registro.

## Ejemplo: etiquetar el último valor

Queremos que cada línea termine con su último valor escrito al lado, como en los gráficos de
prensa. Necesita dos cosas: espacio a la derecha para que el texto no se corte, y dibujar
después de las series.

<<< @/galeria/ejemplos/ultimo-valor.ts

Qué hace cada parte:

- **`reserveSpace`** devuelve `{ right: 56 }`. El núcleo resta esos píxeles al área de dibujo
  antes de calcular las escalas; sin esto el texto saldría fuera del canvas.
- **`ctx.getScales()`** da las escalas del dibujo actual. `toPixel(valor)` convierte un valor
  de datos a píxel CSS, y respeta el zoom: si el usuario hace zoom, la etiqueta se mueve con el
  punto sin código extra. Es `null` antes del primer dibujo, de ahí la comprobación.
- **`ctx.getSeries()`** devuelve las series resueltas a `Float64Array`, incluidas las ocultas;
  `ctx.hiddenSeries` dice cuáles apagó la leyenda.
- **`ctx.renderer.drawText('overlay', ...)`** pinta en la capa superior. Las capas son
  `background` (grid), `data` (series) y `overlay` (cursores, etiquetas); dibujar en `overlay`
  evita que una serie tape el texto.
- **`ctx.config.theme`** trae la paleta y la fuente, así el plugin hereda el tema oscuro sin
  saber que existe.

Se usa como cualquier otro:

```ts
new Chart(el, {
  type: 'line',
  data,
  series,
  plugins: [tooltipPlugin(), legendPlugin(), ultimoValorPlugin()],
});
```

<Demo :cargar="plugin" />

<script setup>
import plugin from '../galeria/ejemplos/plugin';
</script>

Prueba a ocultar una serie en la leyenda: la etiqueta desaparece porque `afterDraw` vuelve a
correr en cada dibujo y consulta `hiddenSeries`.

## Reaccionar a eventos y pedir redibujos

Un plugin que cambia algo fuera de un hook de dibujo (llega un dato, el usuario pulsa una
tecla) llama a `ctx.requestDraw()`, que agrupa las peticiones en un solo fotograma. Para
escuchar el cursor hay dos vías equivalentes: el hook `onEvent('hover', payload)` o
`ctx.events.on('hover', ...)` en `install` (guardando la función que devuelve para llamarla
en `uninstall`).

```ts
export function resaltarPlugin(): ChartPlugin {
  let quitar: (() => void) | null = null;
  return {
    id: 'resaltar',
    install(ctx) {
      quitar = ctx.events.on('hover', (h) => {
        if (h?.nearest) console.log(h.nearest.seriesId, h.nearest.x, h.nearest.y);
      });
    },
    uninstall() {
      quitar?.();
    },
  };
}
```

## Cambiar el rango visible

`ctx.setViewDomain('x', [min, max])` fija lo que se muestra y `null` vuelve al automático. Así
está hecho el zoom: el plugin no toca los datos, solo el dominio, y el núcleo redibuja con la
escala nueva. `ctx.getDataDomain('x')` da el rango completo de los datos para no salirse.

## Reglas prácticas

- Una instancia por gráfico: un plugin guarda estado y nodos. `const plugins = () => [...]`.
- Todo lo que `install` cree, `uninstall` lo quita; `chart.destroy()` cuenta con ello.
- Trabaja en valores de datos y convierte a píxeles en el momento de dibujar: el zoom y el
  cambio de tamaño salen gratis.
- Dibuja en `overlay` lo que debe quedar encima; en `background` lo que va bajo las series.

La referencia completa de los plugins incluidos, con sus opciones, está en
[Plugins incluidos](../referencia/plugins).

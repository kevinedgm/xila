# Xila · Documentación técnica

> Versión documentada: `xilaplot` y `xilaplot-vue` **0.1.0**, rama `main` en el commit `b29f2d9`
> (19 de octubre de 2026). Todo lo que aquí aparece se comprobó contra el código fuente; los
> ejemplos de las secciones 3 y 7 se compilaron con TypeScript estricto y se ejecutaron en
> Chromium contra los paquetes construidos desde el repositorio. Cuando el repositorio no
> responde una pregunta se indica **No documentado en el repositorio**; cuando algo es una
> deducción y no un hecho, se marca como **Inferencia**.

## Tabla de contenidos

1. [Visión general](#1-visión-general)
2. [Instalación](#2-instalación)
3. [Inicio rápido](#3-inicio-rápido)
4. [Conceptos clave](#4-conceptos-clave)
5. [Tipos de gráficos disponibles](#5-tipos-de-gráficos-disponibles)
6. [API y configuración](#6-api-y-configuración)
7. [Ejemplos prácticos](#7-ejemplos-prácticos)
8. [Guía de contribución](#8-guía-de-contribución)
9. [Licencia](#9-licencia)
10. [Preguntas frecuentes](#10-preguntas-frecuentes-faq)
11. [Enlaces útiles](#11-enlaces-útiles)
12. [Limitaciones de esta documentación](#12-limitaciones-de-esta-documentación)

---

## 1. Visión general

### Qué es

Xila es una librería de gráficos escrita en TypeScript para dashboards y datos científicos.
Hace tres cosas:

1. **Lee tablas columnares**: un CSV en formato largo (el que sale de pandas con
   `df.to_csv(index=False)`) se convierte en una `DataTable` cuyas columnas son arreglos tipados
   (`Float64Array` para números y fechas, códigos `Uint32Array` para categorías).
2. **Dibuja en Canvas 2D**, con WebGL opcional para los puntos de dispersiones masivas y un
   renderer SVG para exportar.
3. **Se extiende con plugins**: tooltip, leyenda, zoom, accesibilidad y las formas alternativas
   de lectura son plugins con el mismo contrato que uno propio.

### Qué problema resuelve

- **Rendimiento con muchos datos sin configurar nada.** Las líneas se reducen a 4 puntos por
  columna de píxel (primero, mínimo, máximo y último), y a partir de 100 000 puntos con X
  ordenada se usa una pirámide de mínimos y máximos. Resultado medido en el repositorio: el pan
  de 1 millón de puntos cuesta 3,0 ms por fotograma y el de 10 millones 4,5 ms
  (`docs/benchmarks.md`).
- **Formas de representar que responden a una pregunta**, no solo el catálogo clásico (ver
  [sección 4](#4-conceptos-clave)).
- **Dashboards estáticos sin backend**: un `dashboard.json` y unos CSV se convierten en una
  carpeta que se aloja en cualquier servidor (`docs/configuracion-dashboard.md`,
  `docs/despliegue.md`).

### A quién va dirigido

El repositorio no tiene una sección de "audiencia". De lo que sí contiene se deduce
(**Inferencia**):

- **Desarrolladores de dashboards** que entregan sitios estáticos: hay una plantilla de
  cliente (`plantilla/`), un comando `pnpm nuevo-cliente` y una guía de despliegue con
  contraseña en el servidor.
- **Científicos y analistas de datos que trabajan en pandas**: `python/xila_export.py` define
  `exportar_xila(df, nombre)` y el contrato de CSV (`docs/contrato-csv.md`) está escrito para
  ese flujo. Hay escalas logarítmicas, barras de error, intervalos de confianza, histogramas
  con regla de Freedman–Diaconis y box plots con la misma interpolación que `df.describe()`.
- **Desarrolladores Vue 3**, mediante `xilaplot-vue`.

### Estado del proyecto

> **Experimental (0.x). La API puede cambiar entre versiones.** (README, línea de estado).
> `CONTRIBUTING.md` es más explícito: "la API cambia sin aviso".

Qué implica en la práctica:

- No hay `CHANGELOG` ni política de versiones documentada. Un cambio de comportamiento ya
  ocurrido como ejemplo: `chart.update({ plugins })` **sustituye** la lista completa de plugins
  (`docs/plugins.md`).
- Hay opciones declaradas en los tipos que el núcleo todavía no usa (ver
  [Limitaciones](#12-limitaciones-de-esta-documentación)).

---

## 2. Instalación

### Requisitos previos

| Requisito          | Valor                                                     | Fuente                                          |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------- |
| Node.js            | 20 o superior                                             | `package.json` (`engines.node: ">=20"`)         |
| Gestor de paquetes | pnpm 10 para trabajar sobre el repo                       | `package.json` (`packageManager: pnpm@10.28.0`) |
| Formato de módulo  | Solo ESM (`"type": "module"`, sin CJS)                    | `packages/*/package.json` (`exports.import`)    |
| Navegador          | Canvas 2D; WebGL2 solo para `renderer: 'webgl'`           | `README.md`, sección Backends                   |
| Bundler            | No documentado en el repositorio. Los ejemplos usan Vite. | `examples/vite.config.ts`                       |

Versiones mínimas de navegador: **No documentado en el repositorio.**

### Desde npm

```bash
npm install xilaplot                 # núcleo
npm install xilaplot xilaplot-vue    # componentes Vue 3 (incluye el núcleo como dependencia)
```

> **Aviso verificado el 19-10-2026:** el registro de npm responde `Not found` para `xilaplot`.
> Los paquetes están preparados (versión 0.1.0 y workflow `.github/workflows/publicar.yml`),
> pero **todavía no están publicados**. Mientras tanto, se instalan desde el código fuente.

### Desde el código fuente

```bash
git clone https://github.com/kevinedgm/xila
cd xila
pnpm install
pnpm build      # construye xilaplot y xilaplot-vue en packages/*/dist
pnpm dev        # ejemplos en http://localhost:5173
```

### Dependencias

| Paquete        | Dependencias en tiempo de ejecución  | Peer dependencies |
| -------------- | ------------------------------------ | ----------------- |
| `xilaplot`     | ninguna (regla en `CONTRIBUTING.md`) | ninguna           |
| `xilaplot-vue` | `xilaplot`                           | `vue ^3.4.0`      |

### Fuentes de la marca (opcional)

El tema por defecto declara Instrument Sans (interfaz), JetBrains Mono (cifras) y Fraunces
(título del hallazgo). El canvas solo las usa si la página las cargó, así que se importan una
vez por página:

```ts
import 'xilaplot/fuentes/xila.css';
```

Sin ese import el gráfico funciona igual, con las fuentes de respaldo del sistema.

---

## 3. Inicio rápido

Resultado: una línea con tooltip y zoom que lee un CSV. El CSV de este ejemplo es
`examples/public/data/ventas.csv` del repositorio:

```csv
fecha,region,canal,monto,unidades
2025-01-01,Norte,Tienda,1289.05,14
2025-01-01,Norte,En línea,611.25,5
```

**HTML.** El contenedor necesita un alto: el gráfico llena su caja y se redibuja solo cuando
la caja cambia (`ResizeObserver`).

```html
<div id="grafico" style="height: 360px"></div>
<script type="module" src="./main.ts"></script>
```

**TypeScript** (`main.ts`):

```ts
// 1. Fuentes de la marca: una vez por página (opcional).
import 'xilaplot/fuentes/xila.css';
import { Chart, fetchCsv, groupBy, tooltipPlugin, zoomPanPlugin } from 'xilaplot';

// 2. Cargar el CSV. `fetchCsv` infiere el tipo de cada columna:
//    fecha → 'time' (ms UTC), region/canal → 'category', monto/unidades → 'number'.
const { table, kinds } = await fetchCsv('/data/ventas.csv');
console.log(kinds);

// 3. El CSV tiene varias filas por fecha (una por región y canal). Una línea necesita
//    un valor por x, así que se suma por día. Sin este paso la línea zigzaguea.
const porDia = groupBy(table, 'fecha', { agg: 'sum', column: 'monto' });

// 4. Crear el gráfico. `series` nombra columnas de la tabla; si una no existe,
//    el constructor lanza un error con su nombre en vez de dibujar un gráfico vacío.
const chart = new Chart(document.getElementById('grafico') as HTMLElement, {
  type: 'line', //       x de tipo 'time' → eje de tiempo automático
  data: porDia,
  series: [{ id: 'monto', name: 'Ventas', x: 'fecha', y: 'monto' }],
  axes: { y: { title: 'MXN' } },
  plugins: [tooltipPlugin(), zoomPanPlugin()], // instancias nuevas por gráfico
});

// 5. Eventos: el dato bajo el cursor.
chart.events.on('hover', (h) => console.log(h?.nearest));
```

**Resultado esperado:** una línea cobalto de enero de 2025 a enero de 2026, entre unos 5 000 y
15 000 MXN por día, con grid horizontal y ticks de fecha `ene 25 … ene 26`. La rueda acerca, el
arrastre desplaza y el doble clic vuelve a la vista completa.

**Cómo comprobarlo:** `chart.hasDrawn()` devuelve `true` tras el primer dibujo y
`chart.getBackend()` devuelve `'canvas'`.

**Trampa frecuente.** Pasar este CSV directo a una línea, sin agrupar, produce una línea en
zigzag porque hay ocho filas por fecha. Mecanismo: la línea une las filas en su orden, y Xila
no agrega por su cuenta.

---

## 4. Conceptos clave

### 4.1 Parte de la pregunta del lector, no del tipo de gráfico

La idea central del README ("Qué es Xila hoy"): antes de elegir `line` o `bar`, se pregunta
**qué quiere saber quien mira**. Cada forma responde una tarea de lectura concreta (ver la
tendencia, comparar magnitudes, contar casos, encontrar la relación, localizar el patrón). Las
formas clásicas siguen disponibles y, junto a ellas, alternativas construidas con los mismos
datos.

Ejemplo concreto: "¿cuánto más que el promedio?" con barras obliga al lector a restar dos
alturas. Con `bar.mark: 'dot'` + `referencePlugin` la diferencia viene escrita sobre cada
punto y un tallo muestra su sentido.

### 4.2 Tabla pregunta → forma clásica → alternativa (del README)

| Pregunta                                        | Forma clásica | Alternativa en Xila                                                             |
| ----------------------------------------------- | ------------- | ------------------------------------------------------------------------------- |
| ¿Dónde está hoy y de dónde viene?               | línea         | **Ahora con estela** (`nowPlugin`): cifra actual, cambio y estela               |
| ¿Cómo va este frente a los demás?               | líneas        | **Protagonista y contexto** (`focusPlugin`): una en color, resto gris           |
| ¿Cuánto más que el promedio o la meta?          | barras        | **Puntos con referencia** (`bar.mark: 'dot'` + `referencePlugin`)               |
| ¿Qué parte del total es de cada uno?            | barras        | **Unidades del total** (`type: 'waffle'`): un cuadro por cada N                 |
| ¿Cómo se reparten los casos?                    | histograma    | **Unidades** (`type: 'dots'`): un punto por caso, tira o cubetas                |
| ¿Por dónde ha pasado y hacia dónde va?          | dispersión    | **Trayectorias** (`scatter.path` + `trajectoryPlugin`): caminos y año           |
| ¿Quién se sale del patrón?                      | dispersión    | **Contra lo esperado** (`trendPlugin`): tendencia, tallos y ranking             |
| ¿Dónde han estado y dónde están ahora?          | box plot      | **Un punto por año** (`box.mark: 'dots'` + `shade` + `now`): enjambre           |
| ¿Dónde se concentra cada grupo?                 | box plot      | **Franja de densidad** (`box.mark: 'density'`)                                  |
| ¿Dónde cae hoy dentro de su historia?           | box plot      | **Hoy frente a su historia** (`box.mark: 'range'` + `now: 'last'`)              |
| ¿Cuándo cambió cada uno?                        | mapa de calor | **Cada fila contra sí misma** (`heatmap.scale: 'row'` + `rowLabels`)            |
| ¿Cuánto exactamente, sin perder el patrón?      | mapa de calor | **Tabla con tono** (`heatmap.values` + `gap`): cifra en cada celda              |
| ¿Está donde debería, y qué tan seguros estamos? | box plot      | **Ranura de estado** (`box.orientation: 'horizontal'` + `reference` + `status`) |

Hay que distinguir dos mecanismos distintos detrás de la columna de la derecha:

- **Plugins** (`nowPlugin`, `focusPlugin`, `referencePlugin`, `trajectoryPlugin`,
  `trendPlugin`, `titlePlugin`): se añaden en `plugins: [...]`.
- **Opciones del tipo** (`type: 'waffle'`, `type: 'dots'`, `bar.mark`, `scatter.path`,
  `box.mark: 'density' | 'range' | 'dots'`, `box.orientation: 'horizontal'`, `heatmap.scale`,
  `heatmap.values`): se escriben en la clave del tipo. `density`, `range` y la ranura **no** son
  plugins.

### 4.3 Anatomía editorial

Lo que el tema y los valores por defecto aplican sin configurar (verificado en
`packages/core/src/config.ts` y `theme.ts`):

| Principio                        | Dónde se aplica                           | Valor por defecto              |
| -------------------------------- | ----------------------------------------- | ------------------------------ |
| Grid solo horizontal             | `axes.y.grid: true`, `axes.x.grid: false` | se cambia con `axes.x.grid`    |
| Líneas de 2 px                   | `line.width`                              | `2`                            |
| Barras con extremo redondeado    | `bar.radius`                              | `4` px (`0` = esquinas rectas) |
| Hueco del color del fondo        | `bar.gap`                                 | `2` px                         |
| Puntos con anillo de superficie  | `scatter.ring`                            | `1.5` px (`0` lo quita)        |
| Nombre y valor al final de línea | `endLabelsPlugin()` (en vez de leyenda)   | opt-in                         |
| Título que dice el hallazgo      | `titlePlugin({ title, subtitle })`        | opt-in                         |
| Sin sombras, degradados ni cajas | ningún renderer las dibuja                | —                              |

Ejemplo de título-hallazgo, tomado de `examples/src/ahora.ts`: no "CO₂ por persona, 1970–2024"
sino `title: 'México emite hoy lo mismo que España en 1970'`, con la unidad en el `subtitle`.

### 4.4 Modelo de datos columnar

Una `DataTable` es un diccionario de columnas del mismo largo. Tres tipos (`ColumnKind`):

| Tipo       | Se crea con             | Se guarda como                         | Del CSV, si…                 |
| ---------- | ----------------------- | -------------------------------------- | ---------------------------- |
| `number`   | `numberColumn([...])`   | `Float64Array`, vacío = `NaN`          | todas las celdas son números |
| `time`     | `timeColumn([...])`     | `Float64Array` de ms UTC               | todas son fechas ISO 8601    |
| `category` | `categoryColumn([...])` | códigos `Uint32Array` + lista de texto | cualquier otra cosa          |

Por qué importa (ADR 0001): un millón de filas no crea un millón de objetos, y los
renderers recorren arreglos contiguos. Consecuencia: el CSV debe estar en formato largo
(una fila por observación); para tener una serie por categoría se usa `pivot` o `splitBy`.

---

## 5. Tipos de gráficos disponibles

`type` acepta siete valores (`ChartType` en `config.ts`). Las opciones de cada tipo van en una
clave con su nombre (`line: {...}`, `bar: {...}`, etc.). En los fragmentos siguientes `el` es
un `HTMLElement` con alto y las tablas son como las del [Inicio rápido](#3-inicio-rápido). Todos
compilan contra la API de `main`.

### 5.1 Formas clásicas

#### `line`

Tendencias en el tiempo o en una variable continua. Serie: `x`, `y`; opcional `yError` o
`yLow` + `yHigh` (banda de incertidumbre).

| Opción          | Valores                                    | Defecto                                                 |
| --------------- | ------------------------------------------ | ------------------------------------------------------- |
| `line.width`    | píxeles                                    | `2`                                                     |
| `line.area`     | relleno hasta cero                         | `false`                                                 |
| `line.step`     | escalones (atajo de `curve: 'step'`)       | `false`                                                 |
| `line.curve`    | `'linear'` \| `'monotone'` \| `'step'`     | `'linear'`                                              |
| `line.spanGaps` | `false` \| `true` \| distancia máxima en X | `false` (un `NaN` corta la línea)                       |
| `line.decimate` | `'auto'` \| `'scan'` \| `'pyramid'`        | `'auto'` (pirámide desde 100 000 puntos con X ordenada) |

```ts
new Chart(el, {
  type: 'line',
  data: serie, // fecha (time), norte, sur (number)
  series: [
    { id: 'norte', x: 'fecha', y: 'norte' },
    { id: 'sur', x: 'fecha', y: 'sur' },
  ],
  plugins: [tooltipPlugin(), endLabelsPlugin()],
});
```

#### `bar`

Comparar magnitudes entre categorías. Escala X de bandas por defecto; `x` categórica.

| Opción            | Valores                        | Defecto      |
| ----------------- | ------------------------------ | ------------ |
| `bar.mode`        | `'grouped'` \| `'stacked'`     | `'grouped'`  |
| `bar.orientation` | `'vertical'` \| `'horizontal'` | `'vertical'` |
| `bar.padding`     | fracción de la banda, 0–1      | `0.2`        |
| `bar.radius`      | píxeles                        | `4`          |
| `bar.gap`         | píxeles                        | `2`          |
| `bar.mark`        | `'bar'` \| `'dot'`             | `'bar'`      |

```ts
new Chart(el, {
  type: 'bar',
  data: largo, // pais (category), valor (number)
  series: [{ id: 'v', x: 'pais', y: 'valor' }],
  bar: { mode: 'grouped', radius: 4, gap: 2 },
});
```

Histograma: `histogramTable(valores, { bins: 'fd' })` devuelve una `DataTable` lista para
`bar` con `bar: { padding: 0, radius: 0, gap: 1 }`. Reglas de `bins`: entero, `'fd'`
(defecto), `'sturges'`, `'sqrt'`.

Con `bar: { orientation: 'horizontal' }` las categorías van en el eje vertical y el valor en
el horizontal. Las opciones siguen siendo lógicas: `x` es la categoría y `scales.y` / `axes.y`
configuran el eje del valor aunque se dibuje abajo.

`line.curve: 'monotone'` suaviza sin inventar picos (cada tramo queda entre sus dos valores) y
solo se aplica con menos de un punto cada 3 px; con más, el trazo vuelve a rectas. `line.area`
rellena hasta el cero e incluye el cero en el eje.

#### `scatter`

Relación entre dos variables. Serie: `x`, `y`; opcional `size` (columna del radio) y barras de
error.

| Opción           | Valores                               | Defecto    |
| ---------------- | ------------------------------------- | ---------- |
| `scatter.radius` | píxeles                               | `3`        |
| `scatter.ring`   | píxeles (se omite desde 5 000 puntos) | `1.5`      |
| `scatter.path`   | unir los puntos en orden de filas     | `false`    |
| `renderer`       | `'canvas'` \| `'webgl'` \| `'auto'`   | `'canvas'` |

```ts
new Chart(el, {
  type: 'scatter',
  data: serie,
  series: [{ id: 's', x: 'norte', y: 'sur' }],
  renderer: 'auto', // WebGL desde 50 000 puntos
});
```

#### `box`

Reparto de un valor por grupo. Datos largos: `x` es el grupo, `y` el valor; el gráfico calcula
Q1, mediana, Q3 (interpolación de `df.describe()`), bigotes a `1.5·IQR` y atípicos.

| Opción            | Valores                                                    | Defecto      |
| ----------------- | ---------------------------------------------------------- | ------------ |
| `box.whisker`     | factor sobre el IQR                                        | `1.5`        |
| `box.outliers`    | dibujar atípicos                                           | `true`       |
| `box.mark`        | `'box'` \| `'dots'` \| `'density'` \| `'range'`            | `'box'`      |
| `box.orientation` | `'vertical'` \| `'horizontal'` (ranura de estado, ver 5.2) | `'vertical'` |

```ts
new Chart(el, {
  type: 'box',
  data: largo,
  series: [{ id: 'b', x: 'pais', y: 'valor' }],
});
```

#### `heatmap`

Patrón en una matriz. Datos largos: `x` (columna de la celda) e `y` (fila) categóricas,
`value` numérica.

| Opción             | Valores                                                                                     | Defecto     |
| ------------------ | ------------------------------------------------------------------------------------------- | ----------- |
| `heatmap.colormap` | `cobalto`, `viridis`, `magma`, `inferno`, `plasma`, `rdbu`, `cobalto-naranja` o paradas hex | `'cobalto'` |
| `heatmap.domain`   | `[min, max]` \| `'auto'`                                                                    | `'auto'`    |
| `heatmap.center`   | valor central para divergentes (correlaciones: `0`)                                         | `null`      |
| `heatmap.legend`   | barra de color                                                                              | `true`      |

```ts
new Chart(el, {
  type: 'heatmap',
  data: largo, // anio, pais (category), valor (number)
  series: [{ id: 'h', x: 'anio', y: 'pais', value: 'valor' }],
});
```

Se dibuja como una imagen de un píxel por celda escalada sin suavizado: 500 × 500 celdas
cuestan milisegundos (README).

### 5.2 Alternativas

Cada una indica qué es (plugin u opción), qué pregunta responde y su sintaxis. Opciones
completas en `docs/plugins.md`.

#### `nowPlugin` · Ahora con estela (plugin, para `line`)

"¿Dónde está hoy y de dónde viene?" Panel con la cifra actual de cada serie, su cambio contra
`lookback` puntos atrás y la historia como estela; un deslizador y un botón mueven el instante.

```ts
plugins: [
  tooltipPlugin(),
  nowPlugin({ position: 'top', lookback: 10, labels: { ago: 'en {n} años' } }),
];
```

Opciones: `position` (`'bottom'`), `lookback` (`10`), `format`, `formatX`, `controls`
(`true`), `interval` (`120` ms), `dim` (`true`), `labels`. Ejemplo completo en la
[sección 7.2](#72-ahora-con-estela-con-nowplugin).

#### `focusPlugin` · Protagonista y contexto (plugin, para `line`)

"¿Cómo va este frente a los demás?" Una serie en color con nombre y valor; el resto en el color
apagado del tema.

```ts
plugins: [tooltipPlugin(), focusPlugin({ series: 'México', format: (v) => v.toFixed(1) })];
```

Opciones: `series` (la primera), `selector` (`true`: botones para cambiarla), `labels`,
`format`.

#### `referencePlugin` + `bar.mark: 'dot'` · Puntos con referencia

"¿Cuánto más que el promedio o la meta?"

```ts
new Chart(el, {
  type: 'bar',
  data: largo,
  series: [{ id: 'v', x: 'pais', y: 'valor' }],
  bar: { mark: 'dot' },
  plugins: [tooltipPlugin(), referencePlugin({ value: 'mean' })], // o 'median' o un número
});
```

Opciones: `value` (obligatorio), `label`, `deltas` (`true`), `stems` (`true`, solo con
`'dot'`), `format`. Para cambiar la referencia se pasa otro `referencePlugin` en
`chart.update({ plugins: [...] })`.

#### `type: 'waffle'` · Unidades del total (tipo)

"¿Qué parte del total es de cada uno?" Cada categoría de `x` recibe `round(y / unit)` cuadros.

```ts
new Chart(el, {
  type: 'waffle',
  data: largo,
  series: [{ id: 'w', x: 'pais', y: 'valor' }],
  waffle: { unit: 100 }, // 'auto': paso redondo que da entre 100 y 250 cuadros
});
```

Opciones: `unit` (`'auto'`), `columns` (`'auto'`), `gap` (`2`), `labels` (`true`). No tiene
ejes.

#### `type: 'dots'` · Unidades (tipo)

"¿Cómo se reparten los casos?" Un punto por fila; la serie solo necesita `x`.

```ts
new Chart(el, {
  type: 'dots',
  data: new DataTable({ minutos: numberColumn([3, 5, 8, 8, 12]) }),
  series: [{ id: 'casos', x: 'minutos' }],
  dots: { mode: 'binned' }, // 'strip' (defecto) o 'binned'
  plugins: [
    selectionPlugin({ unit: ['caso', 'casos'], readout: false }),
    summaryPlugin({ unit: ['caso', 'casos'] }),
  ],
});
```

`chart.update({ dots: { mode: 'strip' } })` anima cada punto a su nueva posición
(`dots.transition`, 600 ms; instantáneo con `prefers-reduced-motion`).

#### `scatter.path` + `trajectoryPlugin` · Trayectorias

"¿Por dónde ha pasado y hacia dónde va?" Cada serie es un camino en el plano con su cabeza en
el último punto.

```ts
plugins: [tooltipPlugin(), trajectoryPlugin({ time: 'fecha', series: 'China' })];
```

El plugin activa `scatter.path` por su cuenta. Requisito: **cada serie necesita su propio par
de columnas x/y**. Del formato largo se llega con dos `pivot` (uno por variable) unidos en una
`DataTable`, como hace `examples/src/relacion.ts`.

#### `trendPlugin` · Contra lo esperado (plugin, para `scatter`)

"¿Quién se sale del patrón?" Línea de tendencia por mínimos cuadrados, tallos de cada punto a
ella y ranking por diferencia.

```ts
plugins: [tooltipPlugin(), trendPlugin({ label: 'tendencia de estos siete' })];
```

Opciones: `fit` (`'linear'` o `'log'`, según la escala X), `stems`, `ranking`, `label`,
`rankingTitle`, `format`, `colors`. `trendFit(xs, ys, log)` está exportada.

#### `box.mark: 'dots' | 'density' | 'range'` · Repartos (opciones de `box`)

```ts
box: { mark: 'dots', shade: 'fecha', now: 'last' } // un punto por año, tono por fecha
box: { mark: 'density' }                           // franja de densidad
box: { mark: 'range', now: 'last' }                // bandas p10–p90 y p25–p75, punto de hoy
```

`box.range` fija los percentiles de la banda exterior (`[0.1, 0.9]`). `box.now: 'last'` marca
la última fila de cada grupo y escribe dónde cae ("el 1 % más bajo", "en su máximo"). Estas
tres marcas se dibujan en vertical; la versión horizontal es la ranura de estado.

#### `box.orientation: 'horizontal'` · Ranura de estado (opciones de `box`)

"¿Está donde debería, y qué tan seguros estamos?" Cada grupo es una fila; la banda o la línea
punteada es su referencia; el punto es hoy (la última fila del grupo) y su relleno dice el
estado: lleno, salió con claridad; con punto interior, posible; hueco, en su sitio. A la
derecha, el valor con su contexto y el estado en palabras; el `accessibilityPlugin` lee lo mismo
por fila ("R&B, 201 s · 13 s bajo su rango · n = 36, claro") y ↑ ↓ recorren las filas. Los
mismos datos largos que `box`; `yLow`/`yHigh` en la serie son el margen de evidencia, calculado
fuera (pandas: σ y n, bootstrap). Ejemplo con los cuatro casos: `examples/ranura.html`.

```ts
new Chart(el, {
  type: 'box',
  data: largo, // genero, anio, segundos, low, high, n
  series: [{ id: 'g', x: 'genero', y: 'segundos', yLow: 'low', yHigh: 'high' }],
  box: {
    orientation: 'horizontal',
    reference: 'history', // 'peak' | 'previous' | { group: 'China' } | { value: 0 }
    status: 'auto', // 'evidence' | 'direction' | 'side' | 'none'
    range: [0.125, 0.875],
    period: 'anio',
    count: 'n',
    partial: 2026,
  },
  plugins: [titlePlugin({ title: 'R&B y Pop se acortaron con claridad en 2026' }), tooltipPlugin()],
});
```

| Opción                | Valores                                                                                                                                                                                                                     | Defecto     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `box.reference`       | `'history'` (banda de percentiles `range`, escala propia por fila) \| `'peak'` (máximo propio = 100 %, eje común en %) \| `'previous'` (periodo anterior = 0 %) \| `{ group }` (otro grupo como línea común) \| `{ value }` | `'history'` |
| `box.status`          | `'auto'` \| `'evidence'` (claro / posible / dentro, con el margen) \| `'direction'` (subiendo / estable / bajando) \| `'side'` (arriba / abajo / dentro) \| `'none'`                                                        | `'auto'`    |
| `box.statusThreshold` | cambio relativo que cuenta como estable en `'direction'`                                                                                                                                                                    | `0.05`      |
| `box.statusWindow`    | periodos atrás con los que compara `'direction'`                                                                                                                                                                            | `5`         |
| `box.statusLabels`    | palabra de cada estado (`possible: 'no concluyente'`)                                                                                                                                                                       | en español  |
| `box.history`         | `'auto'` (puntos tenues con 5 periodos o más) \| `'dots'` \| `'none'`                                                                                                                                                       | `'auto'`    |
| `box.sort`            | `'status'` \| `'distance'` \| `'input'`                                                                                                                                                                                     | `'status'`  |
| `box.maxRows`         | con más grupos quedan los 8 más lejos de su referencia y "y N más"                                                                                                                                                          | `12`        |
| `box.highlight`       | grupo protagonista en color; el resto en el gris de los ejes                                                                                                                                                                | `null`      |
| `box.period`          | columna del periodo (año de cruce, fila parcial)                                                                                                                                                                            | `null`      |
| `box.count`           | columna con el tamaño de muestra ("n = 120")                                                                                                                                                                                | `null`      |
| `box.partial`         | fecha o número de corte: el grupo cuyo último periodo lo alcanza es parcial                                                                                                                                                 | `null`      |
| `box.labels`          | textos de la columna derecha (`aboveRange`, `ofPeak`, `since`, `partial`, `more`…)                                                                                                                                          | en español  |

Reglas: `'auto'` elige evidencia si hay `yLow`/`yHigh`, dirección con `'peak'` y lado en el
resto; `status: 'evidence'` sin margen avisa una vez en consola y nunca dice "posible". Con
`{ group }` ese grupo no es una fila: es la línea, y cada fila dice desde qué periodo está de su
lado. El eje de valores solo se rotula cuando es común (`'peak'`, `'previous'`, `{ group }`,
`{ value }`); con `'history'` cada fila tiene su escala y las cifras van en la columna derecha.
`statusLayout` y `statusGroups` están exportadas para calcular las filas fuera del gráfico (por
ejemplo, para redactar el título con el hallazgo).

#### `heatmap.scale: 'row'` · Cada fila contra sí misma (opción de `heatmap`)

"¿Cuándo cambió cada uno?" Cada fila se colorea contra su propia mediana con el colormap
divergente `cobalto-naranja` (azul por debajo, naranja por encima).

```ts
heatmap: { scale: 'row', rowLabels: 'max' } // nota a la derecha: "máx 1973 · mediana 18,6"
```

#### `heatmap.values` · Tabla con tono (opción de `heatmap`)

"¿Cuánto exactamente, sin perder el patrón?"

```ts
heatmap: { values: true, gap: 2, legend: false } // cifra en cada celda; se ignora con más de 2 000 celdas
```

Para resumir por década: `bucketTime(tabla, 'fecha', 'decade', 'decada')` y después `pivot`
(`examples/src/matriz.ts`).

#### `titlePlugin` · Título con el hallazgo (plugin, todos los tipos)

```ts
plugins: [
  titlePlugin({
    title: 'Estados Unidos y Alemania bajan; China sube',
    subtitle: 'Toneladas de CO₂ por persona, 1990–2022',
  }),
];
```

### 5.3 Otros plugins incluidos

| Plugin                | Para qué                                                      |
| --------------------- | ------------------------------------------------------------- |
| `tooltipPlugin`       | Tooltip HTML (`mode: 'x'` o `'nearest'`)                      |
| `legendPlugin`        | Leyenda arriba o abajo; clic oculta la serie y reescala Y     |
| `endLabelsPlugin`     | Nombre y último valor al final de cada línea                  |
| `zoomPanPlugin`       | Rueda, arrastre, pellizco, Shift+arrastre, teclado `+ − 0`    |
| `selectionPlugin`     | Arrastrar cuenta los datos de un rango en vez de hacer zoom   |
| `summaryPlugin`       | Panel con conteo, %, rango y estadísticos de la selección     |
| `annotationsPlugin`   | Líneas, bandas y textos en valores de datos                   |
| `accessibilityPlugin` | `role="figure"`, resumen, teclado, tabla oculta para lectores |
| `syncPlugin`          | Cursor y zoom compartidos entre gráficos del mismo `group`    |

---

## 6. API y configuración

### 6.1 Estructura de la configuración

`new Chart(contenedor, config)`. `config` es una unión discriminada por `type`: el editor solo
sugiere las opciones del tipo elegido.

```ts
interface ConfiguracionComun {
  data: DataTable; // obligatoria
  series: SeriesSpec[]; // obligatoria, al menos una, ids únicos
  scales?: { x?: ScaleConfig; y?: ScaleConfig };
  axes?: { x?: AxisConfig; y?: AxisConfig };
  plugins?: ChartPlugin[]; // instancias nuevas por gráfico
  theme?: 'light' | 'dark' | Theme;
  padding?: Partial<{ top; right; bottom; left }>; // 8 px por lado
  lazy?: boolean; // true: no dibuja hasta estar a 200 px de la pantalla
  renderer?: 'canvas' | 'webgl' | 'auto';
}
// + type: 'line' | 'bar' | 'scatter' | 'box' | 'heatmap' | 'dots' | 'waffle'
// + la clave del tipo: line, bar, scatter, box, heatmap, dots o waffle
```

(Esquema simplificado; los tipos exactos están en `packages/core/src/config.ts`.)

### 6.2 Series (`SeriesSpec`)

| Campo           | Uso                                                                 |
| --------------- | ------------------------------------------------------------------- |
| `id`            | Identificador único; lo usan leyenda, `focusPlugin`, `toggleSeries` |
| `name`          | Texto visible (por defecto el `id`)                                 |
| `x`, `y`        | Nombres de columna                                                  |
| `stroke`        | Color CSS fijo (por defecto, el de la paleta según su posición)     |
| `size`          | Columna del radio (solo `scatter`)                                  |
| `yError`        | Error simétrico (`y ± error`)                                       |
| `yLow`, `yHigh` | Límites explícitos (por ejemplo, IC 95 %); van juntos               |
| `value`         | Valor de la celda (solo `heatmap`)                                  |

> `color` existe en `SeriesSpec` pero está reservado: `Chart` todavía no lo lee. Para una serie por categoría se usa `pivot` o `splitBy` (o la clave `color` de un
> panel de `dashboard.json`, que hace el `pivot` por ti).

### 6.3 Escalas y ejes

`scales.x.type` / `scales.y.type`:

| Valor      | Cuándo                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| `'linear'` | Defecto para números                                                     |
| `'time'`   | Defecto si la columna X es `time`; ticks alineados al calendario, UTC    |
| `'band'`   | Defecto en `bar`, `box`, `heatmap`, `waffle`                             |
| `'log'`    | Base 10; valores ≤ 0 se omiten con un aviso; zoom en espacio logarítmico |

Más: `domain: [min, max] | 'auto'` y `nice: true`. Ejes: `axes.x|y = { title, show, grid,
format }`, donde `format` es `(valor: number) => string`. Para formatear hay
`formatNumber`, `formatSI`, `formatScientific`, `formatPercent` y `formatCurrency`.

### 6.4 Temas

`theme: 'light'` (defecto: fondo manta `#f6f1e8`, serie principal cobalto `#1f4bd8`) o
`'dark'` (fondo tinta `#15171f`). Un objeto `Theme` propio define `palette`, `background`,
`text`, `axis`, `grid`, `muted?`, `fontFamily`, `fontSize`, `fontMono?` y `fontDisplay?`.
`theme: 'auto'` (seguir al sistema) **no existe**.

### 6.5 Métodos de `Chart`

| Método / campo                                                           | Qué hace                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `update(patch)`                                                          | Mezcla cambios y redibuja; `plugins` sustituye la lista entera                       |
| `destroy()`                                                              | Quita listeners, plugins y nodos del DOM                                             |
| `resize()`, `drawNow()`, `requestDraw()`                                 | Control manual del dibujo                                                            |
| `events.on(nombre, fn)`                                                  | `hover`, `click`, `visibility`, `zoom`, `dataChanged`, `resize`, `selection`, `draw` |
| `toggleSeries(id, oculta?)`                                              | Mostrar u ocultar una serie                                                          |
| `setViewDomain(eje, [min,max] \| null)`                                  | Fijar el rango visible (lo que usa el zoom)                                          |
| `setSelection(rango)`, `getSelection()`                                  | Selección en X sin ratón                                                             |
| `toSvg(opciones?)`                                                       | El gráfico como texto SVG                                                            |
| `toDataURL(tipo?, escala?)`                                              | Imagen del canvas                                                                    |
| `getBackend()`                                                           | `'canvas'` o `'webgl'` según lo que quedó activo                                     |
| `getConfig()`, `getSeries()`, `getScales()`, `getLayout()`, `hasDrawn()` | Lectura del estado                                                                   |

Exportación: `chartToPng(chart, { scale, title, legend })`, `chartToSvg(chart, { title,
legend, fonts: 'embed' })`, `chartToCsv(chart)` y `downloadFile(nombre, contenido, tipo?)`.

### 6.6 Transformaciones de datos

| Función                                        | Equivalente pandas aproximado           |
| ---------------------------------------------- | --------------------------------------- |
| `filterRows(t, fila => bool \| Condition)`     | `df[mascara]`                           |
| `groupBy(t, 'col', { agg, column, as? })`      | `df.groupby('col')[column].agg(...)`    |
| `pivot(t, { index, columns, values, agg? })`   | `pivot_table`                           |
| `splitBy(t, 'col')` → `Map<string, DataTable>` | iterar `groupby` por categoría          |
| `bucketTime(t, 'col', unidad, as?)`            | `dt.to_period` (`'month'`, `'decade'`…) |
| `takeRows(t, indices)`                         | `df.iloc[indices]`                      |

`agg`: `'sum' | 'mean' | 'count' | 'min' | 'max' | 'first' | 'last'`. Estadísticos sobre
arreglos: `min`, `max`, `sum`, `mean`, `variance`, `std`, `quantile`, `median`, `summary`.

### 6.7 Sistema de plugins

Un plugin es un objeto con `id` y hooks opcionales que el núcleo llama en este orden
(`PLUGIN_HOOK_ORDER`):

```
install       una vez, al crear el gráfico (nodos del DOM, listeners)
beforeUpdate  antes de resolver una configuración nueva; puede devolver otra
reserveSpace  cuánto margen pide (top/right/bottom/left, en px)
afterLayout   ya se conoce el área de dibujo
beforeDraw    antes de pintar las series
afterDraw     después: lo que dibuje aquí queda encima
onEvent       hover, click, zoom, visibility, dataChanged, resize, selection, draw
uninstall     deshace lo que creó install
```

Dentro de cada hook los plugins corren en orden de registro; dos plugins con el mismo `id` en
un gráfico lanzan un error. Cada hook recibe un `PluginContext` con `config`, `renderer`,
`getScales()`, `getSeries()`, `hiddenSeries`, `requestDraw()`, `setViewDomain()`,
`update()`, etc. Regla del repositorio: **los plugins no tocan el estado del núcleo, solo
usan el contexto** (`CONTRIBUTING.md`).

**Plugin propio** (de `sitio/galeria/ejemplos/ultimo-valor.ts`): escribe el último valor de
cada serie a la derecha de su punto final.

```ts
import { formatNumber, type ChartPlugin } from 'xilaplot';

export function ultimoValorPlugin(): ChartPlugin {
  return {
    id: 'ultimo-valor',
    // 1. Pide 56 px a la derecha: el núcleo los resta del área de dibujo antes de
    //    calcular las escalas, así el texto no se corta.
    reserveSpace: () => ({ right: 56 }),
    // 2. Dibuja después de las series.
    afterDraw(ctx) {
      const scales = ctx.getScales(); // null antes del primer dibujo
      if (!scales) return;
      const sx = scales.x;
      if (sx.kind === 'band') return; // solo ejes continuos
      const { theme } = ctx.config;
      ctx.getSeries().forEach((serie, i) => {
        if (ctx.hiddenSeries.has(serie.id) || serie.length === 0) return;
        const ultimo = serie.length - 1;
        // 3. Valores de datos → píxeles con la escala vigente: respeta el zoom sin más código.
        const px = sx.toPixel(serie.x[ultimo] as number);
        const py = scales.y.toPixel(serie.y[ultimo] as number);
        // 4. Capa 'overlay': encima de las series ('background' y 'data' van debajo).
        ctx.renderer.drawText('overlay', formatNumber(serie.y[ultimo] as number), px + 6, py, {
          font: `600 ${theme.fontSize}px ${theme.fontFamily}`,
          fill: theme.palette[i % theme.palette.length] ?? theme.text,
          baseline: 'middle',
        });
      });
    },
  };
}
```

**Registro:** no hay registro global. Un plugin se "registra" pasándolo en `plugins`:

```ts
new Chart(el, { type: 'line', data, series, plugins: [tooltipPlugin(), ultimoValorPlugin()] });
```

Tres reglas que evitan los errores más comunes:

1. **Una instancia por gráfico.** Un plugin guarda estado y nodos; compartir
   `tooltipPlugin()` entre dos gráficos deja al primero sin tooltip. Patrón:
   `const plugins = () => [tooltipPlugin(), legendPlugin()]`.
2. **Todo lo que crea `install`, lo quita `uninstall`.** `chart.destroy()` cuenta con ello.
3. **Trabajar en valores de datos y convertir a píxeles al dibujar.** Zoom y cambio de tamaño
   salen gratis.

### 6.8 Integración con Vue 3 (`xilaplot-vue`)

Exporta `XilaChart`, `XilaDashboard`, `XilaFilters`, `XilaKpi`, `XilaPanelChart` y
`toConditions`.

**`<XilaChart>`**

| Prop / evento | Tipo                       | Qué hace                                        |
| ------------- | -------------------------- | ----------------------------------------------- |
| `config`      | `ChartConfig`, obligatoria | La misma configuración que `new Chart`          |
| `skeleton`    | `boolean` (`true`)         | Silueta gris hasta el primer dibujo             |
| `@ready`      | `(chart: Chart)`           | Instancia creada (para exportar, eventos, etc.) |
| `@draw`       | `(first: boolean)`         | Tras cada dibujo                                |

Mecanismo (`packages/vue/src/chart.ts`): crea el `Chart` en `onMounted`, llama a
`chart.update(config)` cuando cambia la prop y a `chart.destroy()` en `onBeforeUnmount`. La
configuración se marca con `markRaw` para que Vue no envuelva los `Float64Array` en proxies
reactivos. Consecuencia práctica: **el cambio se detecta cuando se reemplaza el objeto
`config`**, no al mutar una propiedad interna (el `watch` no es profundo).

**`<XilaDashboard>`**: recibe `config` (un `DashboardConfig`), `tables` y `errors`, que es
exactamente lo que devuelve `loadDashboard('dashboard.json')`. Ver la
[sección 7.3](#73-integración-en-una-app-vue-3).

---

## 7. Ejemplos prácticos

Los tres ejemplos se ejecutaron en Chromium contra `main` (sin errores en consola) usando los
CSV de `examples/public/`.

### 7.1 Dashboard simple con datos CSV (sin Vue)

Un CSV, una cifra total y dos gráficos con cursor y zoom compartidos.

```html
<p id="kpi"></p>
<button id="png">Descargar PNG</button>
<div id="lineas" style="height: 360px"></div>
<div id="unidades" style="height: 200px"></div>
<script type="module" src="./dashboard.ts"></script>
```

```ts
import 'xilaplot/fuentes/xila.css';
import {
  Chart,
  fetchCsv,
  groupBy,
  pivot,
  sum,
  legendPlugin,
  syncPlugin,
  titlePlugin,
  tooltipPlugin,
  zoomPanPlugin,
  chartToPng,
  downloadFile,
} from 'xilaplot';

// 1. Una sola lectura del CSV largo (fecha, region, canal, monto, unidades).
const { table } = await fetchCsv('/data/ventas.csv');

// 2. KPI: suma directa sobre la columna tipada.
const total = sum(table.numeric('monto'));
document.getElementById('kpi')!.textContent = total.toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

// 3. De largo a ancho: una fila por fecha, una columna por región (suma de los canales).
const porDia = pivot(table, { index: 'fecha', columns: 'region', values: 'monto', agg: 'sum' });
const regiones = porDia.names().filter((n) => n !== 'fecha');

// 4. Plugins por gráfico (función, no arreglo compartido). `syncPlugin` con el mismo
//    `group` mueve cursor y zoom juntos, en valores de datos.
const plugins = () => [
  tooltipPlugin(),
  legendPlugin(),
  zoomPanPlugin(),
  syncPlugin({ group: 'ventas' }),
];

const lineas = new Chart(document.getElementById('lineas')!, {
  type: 'line',
  data: porDia,
  series: regiones.map((r) => ({ id: r, name: r, x: 'fecha', y: r })),
  axes: { y: { title: 'MXN por día' } },
  plugins: [titlePlugin({ title: 'Ventas diarias por región' }), ...plugins()],
});

// 5. Segundo gráfico: unidades totales por día, como área.
new Chart(document.getElementById('unidades')!, {
  type: 'line',
  data: groupBy(table, 'fecha', { agg: 'sum', column: 'unidades' }),
  series: [{ id: 'u', name: 'Unidades', x: 'fecha', y: 'unidades' }],
  line: { area: true },
  plugins: plugins(),
});

// 6. Exportar el primer gráfico a PNG al doble de resolución.
document.getElementById('png')!.addEventListener('click', async () => {
  downloadFile('ventas.png', await chartToPng(lineas, { scale: 2, title: 'Ventas diarias' }));
});
```

**Resultado esperado:** la cifra `$3,638,031.25`; arriba, cuatro líneas (Norte, Centro, Sur,
Bajío) con título en Fraunces y leyenda clicable; abajo, el área de unidades. Al pasar el
cursor por un gráfico aparece la misma fecha marcada en el otro; el zoom de uno se aplica al
otro.

**Variante sin código de gráficos:** el mismo resultado, con filtros, se declara en un
`dashboard.json` (sección 7.3).

### 7.2 "Ahora con estela" con `nowPlugin`

Pregunta: "¿Dónde está hoy cada país y de dónde viene?" Datos:
`examples/public/co2/data/co2.csv` (Our World in Data; columnas `fecha, pais, co2_mt,
co2_t_por_persona, porcentaje_global, poblacion, pib_per_capita`).

```html
<div id="ahora" style="height: 560px"></div>
```

```ts
import 'xilaplot/fuentes/xila.css';
import { Chart, fetchCsv, filterRows, nowPlugin, pivot, tooltipPlugin } from 'xilaplot';

const { table } = await fetchCsv('/co2/data/co2.csv');

// 1. Desde 1970: filtro por función sobre la columna de tiempo (ms UTC).
const fechas = table.numeric('fecha');
const desde1970 = filterRows(table, (i) => (fechas[i] as number) >= Date.UTC(1970, 0, 1));

// 2. Una columna por país: cada línea necesita su propia columna Y.
const ancho = pivot(desde1970, { index: 'fecha', columns: 'pais', values: 'co2_t_por_persona' });
const paises = ['Estados Unidos', 'Alemania', 'China', 'México', 'India'];

new Chart(document.getElementById('ahora')!, {
  type: 'line',
  data: ancho,
  series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
  axes: { y: { title: 't de CO₂ por persona' } },
  plugins: [
    tooltipPlugin(),
    nowPlugin({
      position: 'top', // panel de cifras arriba del gráfico
      lookback: 10, // el cambio se mide contra 10 puntos (años) atrás
      format: (v) => v.toFixed(1),
      labels: { ago: 'en {n} años' },
    }),
  ],
});
```

**Resultado esperado:** arriba, una ficha por país con la cifra de 2024 en mono (Estados Unidos
14.2, Alemania 6.8, China 8.7, México 3.5, India 2.2), el cambio en diez años ("−3.0 en 10
años") y una mini estela que se desvanece hacia atrás. Debajo, el botón Reproducir y un
deslizador; mover el instante atenúa en el gráfico lo posterior y marca el instante con una
regla.

**Mecanismo:** la línea de tiempo es la unión de las X de las series visibles; en cada
instante el plugin toma el último punto con `x ≤ instante`. El panel es un `div` con
`role="region"` y `aria-live="polite"`, y `reserveSpace` descuenta su alto del área de dibujo.

### 7.3 Integración en una app Vue 3

**Opción A · un gráfico (`<XilaChart>`) con un selector de región.**

```vue
<script setup lang="ts">
import { markRaw, onMounted, ref, shallowRef, watch } from 'vue';
import { XilaChart } from 'xilaplot-vue';
import {
  fetchCsv,
  groupBy,
  splitBy,
  tooltipPlugin,
  zoomPanPlugin,
  type Chart,
  type ChartConfig,
  type DataTable,
} from 'xilaplot';

const region = ref('Norte');
const tablas = shallowRef<Map<string, DataTable> | null>(null);
const config = shallowRef<ChartConfig | null>(null);

// Reemplazar el objeto completo: XilaChart observa la referencia, no el interior.
function armar(): void {
  const t = tablas.value?.get(region.value);
  if (!t) return;
  config.value = markRaw<ChartConfig>({
    type: 'line',
    data: groupBy(t, 'fecha', { agg: 'sum', column: 'monto' }), // suma los dos canales
    series: [{ id: 'monto', name: region.value, x: 'fecha', y: 'monto' }],
    axes: { y: { title: 'MXN' } },
    plugins: [tooltipPlugin(), zoomPanPlugin()], // instancias nuevas en cada armado
  });
}

onMounted(async () => {
  const { table } = await fetchCsv('/data/ventas.csv');
  tablas.value = splitBy(table, 'region');
  armar();
});
watch(region, armar);

const alListo = (c: Chart) => console.log(c.getBackend()); // 'canvas'
</script>

<template>
  <select v-model="region">
    <option>Norte</option>
    <option>Centro</option>
    <option>Sur</option>
    <option>Bajío</option>
  </select>
  <div style="height: 360px">
    <XilaChart v-if="config" :config="config" @ready="alListo" />
  </div>
</template>
```

**Resultado esperado:** silueta gris mientras carga; después, la línea de ventas diarias de la
región elegida (Norte: entre ~600 y ~4 200 MXN por día). Cambiar el `<select>` redibuja sin
recrear el componente. Nota de verificación: se ejecutaron la carga, el `groupBy` y el montaje de
`XilaChart`, escritos como `defineComponent` + `h()`; el `<select>` y el SFC tal cual no se
ejecutaron (los ejemplos del repositorio no compilan SFC).

**Opción B · dashboard declarativo (`<XilaDashboard>`).** Es lo que hace
`examples/src/dashboard.ts`:

```ts
import 'xilaplot/fuentes/xila.css';
import { createApp, h } from 'vue';
import { loadDashboard } from 'xilaplot';
import { XilaDashboard } from 'xilaplot-vue';

const loaded = await loadDashboard('dashboard.json'); // valida forma y columnas
createApp({
  render: () =>
    h(XilaDashboard, { config: loaded.config, tables: loaded.tables, errors: loaded.errors }),
}).mount('#app');
```

Con un `dashboard.json` como este (extracto de `docs/configuracion-dashboard.md`):

```json
{
  "titulo": "Ventas 2026",
  "datos": { "ventas": "data/ventas.csv" },
  "filtros": [{ "tipo": "categoria", "datos": "ventas", "columna": "region", "multiple": true }],
  "paneles": [
    {
      "tipo": "kpi",
      "titulo": "Ventas del mes",
      "datos": "ventas",
      "valor": { "columna": "monto", "agregado": "sum", "formato": "moneda" },
      "comparar": { "columna": "fecha", "periodo": "month" },
      "ancho": 3
    },
    {
      "tipo": "linea",
      "titulo": "Ventas diarias por región",
      "datos": "ventas",
      "x": "fecha",
      "y": "monto",
      "color": "region",
      "agregado": "sum",
      "periodo": "day"
    }
  ]
}
```

**Resultado esperado:** título, un selector de región, una tarjeta KPI con la variación contra
el mes anterior y un panel de líneas con botones PNG, SVG y CSV. Un error de dedo en una
columna no rompe la página: se lista arriba ("la columna "mnto" no existe en ventas; ¿quisiste
decir "monto"?") y solo ese panel queda vacío. Paneles disponibles: `kpi`, `linea`, `barras`,
`dispersion`, `cajas`, `calor`; la clave `forma` activa las alternativas de la sección 4.2.

---

## 8. Guía de contribución

Fuente: `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`.

### Reportar errores y proponer mejoras

| Qué           | Cómo                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Error         | Issue con la plantilla **"Reporte de error"**: qué pasa, cómo reproducirlo (configuración y, si se puede, un CSV pequeño), versión o commit, navegador |
| Idea          | Issue con la plantilla **"Propuesta"**: el problema antes que la solución, la API imaginada, y si ya se puede con un plugin                            |
| Cambio grande | Discutirlo en un issue antes de escribir código. Una propuesta que contradiga una ADR (`docs/adr/0001`–`0006`) debe explicar por qué                   |

Al 19-10-2026 no hay issues abiertos y hay un pull request abierto (#2).

### Pull requests

La plantilla pide tres secciones (**Qué cambia**, **Por qué**, **Cómo comprobarlo**) y marcar:
`typecheck`, `lint` y `test` pasan; hay tests para lo que cambia; sin dependencias nuevas en
`xilaplot`. Criterios de aceptación rápida:

- Un cambio por PR (un arreglo y una refactorización van en dos).
- Tests unitarios en `packages/core/src/**/*.test.ts`; un caso en
  `examples/tests/visual.spec.ts` si cambia el dibujo.
- Si el dibujo cambia a propósito, regenerar capturas con `--update-snapshots` y revisar el diff
  de imágenes.

### Convenciones de código

- **Formato:** Prettier (`singleQuote`, `semi`, `printWidth: 100`) y ESLint
  (`typescript-eslint` recomendado + `no-explicit-any` como error).
- **TypeScript estricto** con `noUncheckedIndexedAccess`: `arr[i]` es `T | undefined`; en bucles
  calientes ya comprobados se usa `as number`.
- **Sin objetos por fila:** los datos viven en columnas tipadas; un bucle sobre un millón de
  puntos no debe crear basura.
- **Comentarios en español** que expliquen el porqué, no el qué.
- **Núcleo sin dependencias** en tiempo de ejecución.
- **Plugins** solo a través del `PluginContext`.

### Ejecutar los tests localmente

```bash
pnpm install
pnpm format        # Prettier
pnpm typecheck     # TypeScript estricto en todos los paquetes
pnpm lint          # ESLint
pnpm test          # Vitest (unitarios; sin DOM)

# Pruebas en navegador (Playwright): capturas, accesibilidad con axe-core, exportación…
pnpm build && pnpm --filter examples build
pnpm --filter examples exec playwright install chromium   # una vez
pnpm --filter examples test:visual
```

Las capturas de referencia se generaron en Ubuntu 24.04 con las fuentes de
`packages/core/fuentes/ttf` instaladas; en otra máquina pueden fallar por diferencias de texto
sin que el cambio sea incorrecto ("si CI falla solo por eso, dilo en el PR").

CI (`.github/workflows/ci.yml`) corre tres jobs en cada push a `main` y en cada PR: **ci**
(lint, build, typecheck, Vitest, build de ejemplos, Playwright), **benchmark** (falla si el pan a
1M puntos pasa de los umbrales de `examples/bench/check.mjs`) y **python** (`pytest python/`).

---

## 9. Licencia

**MIT.** Copyright (c) 2026 Kevin Eduardo García Martínez (`LICENSE`). Los dos paquetes declaran
`"license": "MIT"`. Al contribuir se acepta publicar la aportación bajo la misma licencia
(`CONTRIBUTING.md`).

Las fuentes incluidas en `packages/core/fuentes/` (Instrument Sans, JetBrains Mono y Fraunces)
están bajo **SIL Open Font License 1.1**; cada una trae su `OFL-*.txt`, que el paquete publica.

---

## 10. Preguntas frecuentes (FAQ)

### ¿Por qué la API es experimental? ¿Qué implica para producción?

**Hecho:** el README declara 0.x experimental y `CONTRIBUTING.md` dice que la API cambia sin
aviso. No hay `CHANGELOG`, política semver ni lista de cambios incompatibles.
**Inferencia:** es usable en producción si se fija la versión exacta (`"xilaplot": "0.1.0"`, sin
`^`), porque en 0.x un `^0.1.0` aceptaría 0.1.x pero cualquier 0.2 podría romper. Conviene
cubrir con una prueba visual propia los gráficos que se entregan a un cliente. Hoy, además, los
paquetes no están en npm (sección 2).

### ¿Xila reemplaza a D3, Chart.js o Vega-Lite?

El repositorio solo se compara con otras librerías en rendimiento (`docs/benchmarks.md`, pan con
1 millón de puntos sobre una línea, contenedor sin GPU). Xila viene de la corrida posterior a la
pirámide (ADR 0006); las demás, de la tabla comparativa del mismo documento:

| Librería           | ms por fotograma |
| ------------------ | ---------------: |
| Xila               |              3,0 |
| uPlot              |             10,4 |
| ECharts            |             15,0 |
| Chart.js           |             16,1 |
| Plotly (scattergl) |           20 444 |

D3 y Vega-Lite **no aparecen en el repositorio**. Lo que sigue es **Inferencia** a partir del
diseño:

- **Frente a D3:** D3 es un conjunto de primitivas (escalas, formas, DOM) para construir
  cualquier visualización a mano. Xila es un motor con tipos ya armados y plugins; ofrece menos
  libertad y mucho menos código para los casos que cubre. No reemplaza a D3 para
  visualizaciones a medida (mapas, sankey, treemap no existen en Xila).
- **Frente a Chart.js:** API parecida (`new Chart(el, config)` con `type`, `data`, `plugins`).
  Diferencias verificables: datos columnares en vez de objetos `{x, y}` (a 1M puntos, tres veces
  menos memoria según `docs/benchmarks.md`), decimación sin configurar, formas alternativas y
  anatomía editorial por defecto.
- **Frente a Vega-Lite:** Vega-Lite es una gramática declarativa (JSON) para cualquier
  combinación de marcas y canales. Lo más parecido en Xila es `dashboard.json`, que es mucho más
  acotado: paneles predefinidos, no una gramática.

### ¿Cómo maneja grandes volúmenes de datos?

Tres mecanismos, según el tipo:

| Tipo de dato       | Mecanismo                                                                                                                                                                            | Coste medido                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Líneas, X ordenada | Decimación M4: 4 puntos por columna de píxel físico (primero, mín, máx, último). Desde 100 000 puntos, pirámide de mín/máx (ADR 0006): cada columna se resuelve con O(log n) bloques | pan 3,0 ms @1M; 4,5 ms @10M; construir la pirámide 22 ms @1M, ~1 byte/punto |
| Dispersiones       | `renderer: 'webgl'` (o `'auto'` desde 50 000 puntos): `x`, `y` se suben una vez a la GPU; cada fotograma solo cambia escala y desplazamiento (ADR 0004)                              | pan 1 627 ms @1M en contenedor **sin GPU** (Canvas: 10 640 ms)              |
| Heatmaps           | Una imagen de un píxel por celda, escalada sin suavizado                                                                                                                             | 500 × 500 celdas en milisegundos (README)                                   |

Más: coordenadas relativas en float64 para que WebGL (float32) no pierda precisión con fechas
en ms (ADR 0003), y render diferido (`lazy: true`): un gráfico fuera de pantalla no se dibuja.
Si WebGL2 no existe o se pierde el contexto, los puntos vuelven a Canvas con un aviso y
`chart.getBackend()` lo dice. Líneas en WebGL: no implementadas. **Inferencia** del propio
`docs/benchmarks.md`: por encima de unos 10 millones el límite pasa a ser la carga (10M puntos
son ~160 MB de columnas), no el dibujo.

Cómo comprobarlo en tu máquina:

```bash
pnpm build && pnpm --filter examples build
BENCH_SIZES=1000000,10000000 BENCH_RENDERERS=xila pnpm --filter examples bench
```

### ¿Puedo usar Xila sin Vue?

**Sí.** `xilaplot` no depende de Vue ni de nada en tiempo de ejecución; `new Chart(elemento,
config)` funciona con cualquier HTML (secciones 3, 7.1 y 7.2). `xilaplot-vue` es un envoltorio
delgado del ciclo de vida. Para React, Svelte u otros: **No documentado en el repositorio**; el
patrón sería el mismo que el de `packages/vue/src/chart.ts` (crear al montar, `update` al
cambiar la configuración, `destroy` al desmontar).

---

## 11. Enlaces útiles

| Recurso                       | Enlace                                       | Estado verificado (19-10-2026)                                                                                                                               |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documentación oficial         | <https://kevinedgm.github.io/xila/>          | No se pudo cargar desde este entorno; el sitio se genera desde `sitio/` (VitePress + TypeDoc) por el workflow `docs.yml`, que necesita GitHub Pages activado |
| Repositorio                   | <https://github.com/kevinedgm/xila>          | Público                                                                                                                                                      |
| Paquete núcleo                | <https://www.npmjs.com/package/xilaplot>     | Aún no publicado                                                                                                                                             |
| Paquete Vue                   | <https://www.npmjs.com/package/xilaplot-vue> | Aún no publicado                                                                                                                                             |
| Opciones de todos los plugins | `docs/plugins.md`                            | En el repo                                                                                                                                                   |
| Dashboard declarativo         | `docs/configuracion-dashboard.md`            | En el repo                                                                                                                                                   |
| Contrato de CSV (pandas)      | `docs/contrato-csv.md`                       | En el repo                                                                                                                                                   |
| Despliegue con contraseña     | `docs/despliegue.md`                         | En el repo                                                                                                                                                   |
| Rendimiento                   | `docs/benchmarks.md`                         | En el repo                                                                                                                                                   |
| Decisiones de diseño          | `docs/adr/0001` a `0006`                     | En el repo                                                                                                                                                   |
| Ejemplos ejecutables          | `examples/*.html` (`pnpm dev`)               | En el repo                                                                                                                                                   |

---

## 12. Limitaciones de esta documentación

### Lo que no se pudo extraer o verificar

| Tema                              | Situación                                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sitio oficial                     | No se pudo abrir desde el entorno de trabajo (el proxy bloquea github.io). Su contenido se leyó desde las fuentes en `sitio/`, no desde la web publicada. Verificar que el sitio carga. |
| Publicación en npm                | El registro responde `Not found` para `xilaplot`. Los comandos `npm install` de la sección 2 no funcionarán hasta publicar.                                                             |
| Compatibilidad de navegadores     | No documentado en el repositorio.                                                                                                                                                       |
| Bundlers y SSR                    | No documentado. Solo se probó con Vite. `XilaChart` usa `document`, así que en SSR el gráfico solo existe en el cliente (**Inferencia**).                                               |
| Política de versiones y CHANGELOG | No existen.                                                                                                                                                                             |
| Audiencia                         | No declarada; la sección 1 la deduce.                                                                                                                                                   |
| Comparación con D3 y Vega-Lite    | No existe en el repositorio; la de la FAQ es inferencia.                                                                                                                                |
| `<template>` del ejemplo Vue      | La lógica se ejecutó; el SFC tal cual no (el repo no compila SFC en sus ejemplos).                                                                                                      |
| Referencia completa de la API     | Esta guía cubre lo esencial. La lista exhaustiva (unas 150 exportaciones) está en `packages/core/src/index.ts` y en la referencia TypeDoc de `sitio/`.                                  |

### Diferencias entre la documentación del repositorio y el código

Encontradas al escribir esta guía y **corregidas en el mismo commit** que la añadió:

1. **`bar.orientation: 'horizontal'`** estaba en `BarChartConfig` sin que el núcleo la leyera;
   ya funciona (barras horizontales, también apiladas y con `mark: 'dot'`). Lo mismo pasaba con
   `line.area` y `line.step`, que ahora también se dibujan.
2. **`SeriesSpec.color`** se describía como "columna que separa la serie" sin que `Chart` la
   usara; ahora su comentario dice que está reservada y qué usar en su lugar.
3. **`packages/core/README.md`** graficaba `ventas.csv` sin agrupar (línea en zigzag); ahora
   usa `groupBy` como la sección 3.
4. **`docs/contrato-csv.md`** usaba firmas abreviadas de `splitBy` y `groupBy`; ahora usa las
   reales.
5. **`sitio/guia/tipos.md`** decía "Seis tipos" y omitía `waffle`; ahora son siete.
6. **README** decía "Paquetes en npm"; ahora dice que están preparados y sin publicar.
7. **README, `CONTRIBUTING.md`, la guía del sitio y la plantilla** daban el puerto 5173 como
   fijo; ahora avisan que Vite usa otro si está ocupado.

### Qué verificar a mano antes de publicar esta documentación

- Que el sitio <https://kevinedgm.github.io/xila/> carga (GitHub Pages activado).
- Que `npm install xilaplot xilaplot-vue` funciona tras la primera publicación.
- Las cifras de rendimiento en tu máquina con GPU: las del repositorio se midieron en un
  contenedor sin GPU, lo que perjudica sobre todo a WebGL y a Plotly.

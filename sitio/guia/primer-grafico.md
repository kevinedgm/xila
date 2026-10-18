# Primer gráfico en 5 minutos

Al terminar tendrás una línea con tooltip y zoom leyendo un CSV. Tres pasos: instalar, cargar
datos, crear el gráfico.

## 1. Instalar

```bash
npm install xilaplot          # núcleo
npm install xilaplot-vue      # opcional: componentes para Vue 3
```

Para trabajar sobre el código fuente (requiere Node 20 y pnpm 10):

```bash
git clone https://github.com/kevinedgm/xila
cd xila
pnpm install
pnpm build          # construye xilaplot y xilaplot-vue
pnpm dev            # ejemplos en http://localhost:5173
```

## 2. Cargar datos

Xila lee **formato largo**: una fila por observación, una columna por variable. Es lo que sale
de pandas con `df.to_csv(index=False)`. Tipos por columna, inferidos del contenido:

| Contenido                              | Tipo       | Se guarda como                |
| -------------------------------------- | ---------- | ----------------------------- |
| `12.5`, `-3`, vacío                    | `number`   | `Float64Array` (vacío = NaN)  |
| `2024-03-01`, `2024-03-01T10:00:00Z`   | `time`     | `Float64Array` de ms UTC      |
| `México`, `0123` (cero a la izquierda) | `category` | códigos `Uint32Array` + lista |

```ts
import { fetchCsv } from 'xilaplot';

const { table } = await fetchCsv('/data/co2.csv');
table.names(); // ['fecha', 'pais', 'co2_mt', ...]
table.length; //  525 filas
```

También se construye en memoria con `new DataTable({ x: numberColumn([...]), ... })`, y
`fetchCsv` devuelve `kinds` con el tipo que decidió para cada columna, por si quieres comprobarlo.

## 3. Crear el gráfico

```ts
import { Chart, fetchCsv, splitBy, tooltipPlugin, zoomPanPlugin } from 'xilaplot';

const { table } = await fetchCsv('/data/co2.csv');
const mexico = splitBy(table, 'pais').get('México')!;

const chart = new Chart(document.getElementById('grafico')!, {
  type: 'line',
  data: mexico,
  series: [{ id: 'mx', name: 'México', x: 'fecha', y: 'co2_mt' }],
  plugins: [tooltipPlugin(), zoomPanPlugin()],
  axes: { y: { title: 'Mt de CO₂' } },
});
```

El contenedor necesita un tamaño (`#grafico { height: 320px }`): el gráfico llena su caja y se
redibuja solo cuando ésta cambia (`ResizeObserver`).

Qué hace cada pieza:

- `type` decide cómo se dibujan las series y qué escala X va por defecto: `line` y `scatter`
  usan tiempo si la columna es `time`, lineal si no; `bar`, `box` y `heatmap` usan bandas.
- `series` nombra columnas de la tabla. Si una no existe, `new Chart` lanza un error con el
  nombre, no un gráfico vacío.
- `plugins` son instancias por gráfico: cada tooltip guarda su propio nodo HTML.

<Demo :cargar="linea" />

<script setup>
import linea from '../galeria/ejemplos/linea';
</script>

## Después

- `chart.update({ data: otraTabla })` cambia datos o configuración sin recrear el gráfico.
- `chart.events.on('hover', (h) => ...)` da el dato bajo el cursor; `'zoom'`, `'click'`,
  `'draw'` y `'resize'` también se emiten.
- `chart.destroy()` quita listeners y nodos.
- En Vue, `<XilaChart :config="config" />` de `xilaplot-vue` hace lo mismo con el ciclo de vida
  del componente.

Siguiente: [Tipos de gráfico](./tipos) o la [Galería](../galeria/) con el código de cada ejemplo.

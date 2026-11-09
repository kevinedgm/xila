# Galería

Veintiséis gráficos con un mismo CSV real: emisiones de CO₂ de siete países entre 1950 y 2024
(Our World in Data, limpiado con pandas por `python/ejemplo_co2.py`). Cada ejemplo muestra el
código completo que lo produce; todos empiezan por cargar la tabla una sola vez:

Los ayudantes que comparten los ejemplos, `sitio/demos/datos.ts`:

```ts
import { categoryColumn, DataTable, fetchCsv, splitBy, type Column } from 'xilaplot';

/**
 * Emisiones de CO₂ 1950–2024 de siete países (Our World in Data, limpiado con pandas según
 * `docs/contrato-csv.md`). Columnas: fecha, pais, co2_mt, co2_t_por_persona, porcentaje_global,
 * poblacion, pib_per_capita. Se descarga una vez y se comparte entre los ejemplos.
 */
let promesa: Promise<DataTable> | null = null;

export function co2(): Promise<DataTable> {
  promesa ??= fetchCsv(`${import.meta.env.BASE_URL}co2.csv`).then((r) => r.table);
  return promesa;
}

/** La tabla de un solo país, ordenada por fecha como viene en el CSV. */
export async function pais(nombre: string): Promise<DataTable> {
  const tabla = splitBy(await co2(), 'pais').get(nombre);
  if (!tabla) throw new Error(`No hay datos de ${nombre}`);
  return tabla;
}

/** La misma tabla con una columna categórica `decada` ("1950s", "1960s", …) derivada de `fecha`. */
export function conDecada(tabla: DataTable): DataTable {
  const columnas: Record<string, Column> = {};
  for (const nombre of tabla.names()) columnas[nombre] = tabla.column(nombre);
  columnas['decada'] = categoryColumn(
    Array.from(
      tabla.numeric('fecha'),
      (ms) => `${Math.floor(new Date(ms).getUTCFullYear() / 10) * 10}s`,
    ),
  );
  return new DataTable(columnas);
}
```

## Serie temporal

```ts demo
import { tooltipPlugin, zoomPanPlugin, type ChartConfig } from 'xilaplot';
import { pais } from './datos';

/** Serie temporal: emisiones anuales de México. Rueda para hacer zoom, arrastrar para mover. */
export default async function linea(): Promise<ChartConfig> {
  return {
    type: 'line',
    data: await pais('México'),
    series: [{ id: 'mx', name: 'México', x: 'fecha', y: 'co2_mt' }],
    plugins: [tooltipPlugin(), zoomPanPlugin()],
    axes: { y: { title: 'Mt de CO₂' } },
  };
}
```

## Varias series con leyenda

```ts demo
import {
  endLabelsPlugin,
  legendPlugin,
  pivot,
  titlePlugin,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2 } from './datos';

/**
 * Varias series: toneladas por persona. `pivot` pasa de formato largo a una columna por país y
 * `endLabelsPlugin` nombra cada línea en su extremo, para no ir y venir a la leyenda.
 */
export default async function multi(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = ['Estados Unidos', 'Alemania', 'China', 'México'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [
      titlePlugin({
        title: 'Estados Unidos y Alemania bajan; China sube',
        subtitle: 'Toneladas de CO₂ por persona y año',
      }),
      tooltipPlugin(),
      legendPlugin(),
      endLabelsPlugin({ format: (v) => v.toFixed(1) }),
    ],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}
```

## Ahora con estela

Cifra actual por país, cambio en diez años y la historia como estela. Reproducir mueve el instante
y el gráfico atenúa lo posterior.

```ts demo height=520
import { nowPlugin, pivot, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Ahora con estela: cifra actual por país, cambio en diez años y la historia como estela. */
export default async function ahora(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = ['Estados Unidos', 'Alemania', 'China', 'México'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [
      tooltipPlugin(),
      nowPlugin({ position: 'top', format: (v) => v.toFixed(1), labels: { ago: 'en {n} años' } }),
    ],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}
```

## Protagonista y contexto

Una serie en color y con valor; las demás en gris con solo su nombre. Los botones cambian la
protagonista.

```ts demo height=420
import { focusPlugin, pivot, titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Protagonista y contexto: una serie en color con su valor; las demás en gris con su nombre. */
export default async function protagonista(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = ['Estados Unidos', 'Alemania', 'España', 'China', 'México', 'Brasil', 'India'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [
      titlePlugin({
        title: 'México emite hoy lo mismo que España en 1970',
        subtitle: 'Toneladas de CO₂ por persona y año',
      }),
      tooltipPlugin(),
      focusPlugin({ series: 'México', format: (v) => v.toFixed(1) }),
    ],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}
```

## Barras

```ts demo
import { filterRows, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Barras: emisiones de 2023 por país. `filterRows` acepta condiciones declarativas con rango inclusivo. */
export default async function barras(): Promise<ChartConfig> {
  const tabla = await co2();
  const año2023 = filterRows(tabla, {
    column: 'fecha',
    min: Date.UTC(2023, 0, 1),
    max: Date.UTC(2023, 11, 31),
  });
  return {
    type: 'bar',
    data: año2023,
    series: [{ id: 'mt', name: 'Mt de CO₂ en 2023', x: 'pais', y: 'co2_mt' }],
    plugins: [tooltipPlugin()],
    axes: { y: { title: 'Mt de CO₂' } },
  };
}
```

## Barras apiladas

```ts demo
import { legendPlugin, pivot, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2, conDecada } from './datos';

/**
 * Barras apiladas: emisiones acumuladas por década y país. `conDecada` añade la categoría de
 * la década y `pivot` deja una columna por país sumando las filas que caen en la misma celda.
 */
export default async function apiladas(): Promise<ChartConfig> {
  const porDecada = conDecada(await co2());
  const ancho = pivot(porDecada, {
    index: 'decada',
    columns: 'pais',
    values: 'co2_mt',
    agg: 'sum',
  });
  const paises = ['China', 'Estados Unidos', 'India', 'Alemania', 'Brasil', 'México', 'España'];
  return {
    type: 'bar',
    bar: { mode: 'stacked' },
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'decada', y: p })),
    plugins: [tooltipPlugin(), legendPlugin({ position: 'bottom' })],
    axes: { y: { title: 'Mt de CO₂ acumuladas' } },
  };
}
```

## Puntos con referencia

Donde terminaría cada barra hay un punto, y una línea punteada marca el promedio. La distancia
del punto a la línea es la respuesta a "¿cuánto más que el resto?"; el tallo y la cifra la
hacen legible de un vistazo.

```ts demo height=420
import {
  filterRows,
  referencePlugin,
  titlePlugin,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2 } from './datos';

/** Puntos con referencia: donde terminaría cada barra, un punto; la distancia al promedio es la respuesta. */
export default async function puntos(): Promise<ChartConfig> {
  const año2024 = filterRows(await co2(), {
    column: 'fecha',
    min: Date.UTC(2024, 0, 1),
    max: Date.UTC(2024, 11, 31),
  });
  return {
    type: 'bar',
    data: año2024,
    series: [{ id: 'pc', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    bar: { mark: 'dot' },
    plugins: [
      titlePlugin({
        title: 'Estados Unidos emite dos veces el promedio; India, una tercera parte',
        subtitle: 'Toneladas de CO₂ por persona en 2024',
      }),
      tooltipPlugin(),
      referencePlugin({ value: 'mean', format: (v) => v.toFixed(1) }),
    ],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}
```

## Unidades del total

Cada cuadro vale lo mismo y los cuadros de un país van juntos: el lector cuenta su parte del
total en vez de comparar alturas. Pasar el ratón sobre un cuadro dice a quién pertenece.

```ts demo height=360
import { filterRows, titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Unidades del total: cada cuadro vale 100 Mt; los de un país van juntos y se cuenta su parte. */
export default async function total(): Promise<ChartConfig> {
  const año2024 = filterRows(await co2(), {
    column: 'fecha',
    min: Date.UTC(2024, 0, 1),
    max: Date.UTC(2024, 11, 31),
  });
  return {
    type: 'waffle',
    data: año2024,
    series: [{ id: 'mt', x: 'pais', y: 'co2_mt' }],
    waffle: { unit: 100 },
    plugins: [
      titlePlugin({
        title: 'China emite más de la mitad del total de los siete',
        subtitle: 'Millones de toneladas de CO₂ en 2024; cada cuadro, 100 Mt',
      }),
      tooltipPlugin(),
    ],
  };
}
```

## Dispersión con zoom en dos ejes

```ts demo height=380
import { tooltipPlugin, zoomPanPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Dispersión: PIB per cápita contra toneladas por persona, un punto por país y año. */
export default async function dispersion(): Promise<ChartConfig> {
  return {
    type: 'scatter',
    data: await co2(),
    series: [{ id: 'p', name: 'País-año', x: 'pib_per_capita', y: 'co2_t_por_persona' }],
    plugins: [tooltipPlugin({ mode: 'nearest' }), zoomPanPlugin({ axis: 'xy' })],
    scales: { x: { type: 'log' } },
    axes: { x: { title: 'PIB per cápita (USD, log)' }, y: { title: 't de CO₂ por persona' } },
  };
}
```

## Trayectorias

Cada país es un camino en el plano riqueza–emisiones, con una cabeza en su último punto. La
protagonista va en color; las demás en gris. Reproducir mueve el año y el camino se dibuja detrás.

```ts demo height=520
import {
  DataTable,
  filterRows,
  pivot,
  titlePlugin,
  tooltipPlugin,
  trajectoryPlugin,
  type ChartConfig,
  type Column,
} from 'xilaplot';
import { co2 } from './datos';

/** Trayectorias: cada país es un camino en el plano PIB–CO₂; la protagonista en color, el resto en gris. */
export default async function trayectorias(): Promise<ChartConfig> {
  const tabla = await co2();
  const pib = tabla.numeric('pib_per_capita');
  const fechas = tabla.numeric('fecha');
  const desde1970 = filterRows(
    tabla,
    (i) =>
      (fechas[i] as number) >= Date.UTC(1970, 0, 1) && (pib[i] as number) === (pib[i] as number),
  );
  // Cada país necesita su par de columnas x/y: dos pivots (PIB y CO₂) juntos en una tabla ancha.
  const pibAncho = pivot(desde1970, { index: 'fecha', columns: 'pais', values: 'pib_per_capita' });
  const co2Ancho = pivot(desde1970, {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = pibAncho.names().filter((n) => n !== 'fecha');
  const columnas: Record<string, Column> = { fecha: pibAncho.column('fecha') };
  for (const p of paises) {
    columnas[`pib ${p}`] = pibAncho.column(p);
    columnas[`co2 ${p}`] = co2Ancho.column(p);
  }
  return {
    type: 'scatter',
    data: new DataTable(columnas),
    series: paises.map((p) => ({ id: p, name: p, x: `pib ${p}`, y: `co2 ${p}` })),
    scales: { x: { type: 'log' } },
    axes: { x: { title: 'PIB por persona, $ (log)' }, y: { title: 't de CO₂ por persona' } },
    plugins: [
      titlePlugin({
        title: 'China sube en diagonal; Alemania y Estados Unidos bajan mientras se enriquecen',
        subtitle: 'Camino de cada país de 1970 a 2022',
      }),
      tooltipPlugin(),
      trajectoryPlugin({
        time: 'fecha',
        series: 'China',
        formatTime: (t) => String(new Date(t).getUTCFullYear()),
        format: (v) => `${v.toFixed(1)} t`,
        formatX: (v) => `${Math.round(v / 1000)} k$`,
      }),
    ],
  };
}
```

## Contra lo esperado

Una línea de tendencia dice cuánto "debería" valer y para cada x; el tallo de cada punto es su
diferencia y la lista de la derecha la ordena. Con siete puntos el ajuste es ilustrativo.

```ts demo height=440
import {
  DataTable,
  filterRows,
  numberColumn,
  titlePlugin,
  tooltipPlugin,
  trendPlugin,
  type ChartConfig,
  type Column,
} from 'xilaplot';
import { co2 } from './datos';

/** Contra lo esperado: la tendencia dice cuánto "debería" emitir cada país; el tallo es la diferencia. */
export default async function tendencia(): Promise<ChartConfig> {
  const tabla = await co2();
  const fechas = tabla.numeric('fecha');
  const en2022 = filterRows(tabla, (i) => (fechas[i] as number) === Date.UTC(2022, 0, 1));
  // Una serie por país (una fila cada una) para que la lista y los puntos lleven su color.
  const pais = en2022.column('pais');
  const nombres =
    pais.kind === 'category' ? Array.from(pais.codes, (c) => pais.categories[c] ?? '') : [];
  const columnas: Record<string, Column> = {};
  const pib = en2022.numeric('pib_per_capita');
  const pc = en2022.numeric('co2_t_por_persona');
  nombres.forEach((n, i) => {
    columnas[`pib ${n}`] = numberColumn([pib[i] as number]);
    columnas[`co2 ${n}`] = numberColumn([pc[i] as number]);
  });
  return {
    type: 'scatter',
    data: new DataTable(columnas),
    series: nombres.map((n) => ({ id: n, name: n, x: `pib ${n}`, y: `co2 ${n}` })),
    scatter: { radius: 5 },
    scales: { x: { type: 'log' } },
    axes: { x: { title: 'PIB por persona, $ (log)' }, y: { title: 't de CO₂ por persona' } },
    plugins: [
      titlePlugin({
        title: 'Estados Unidos y China emiten más de lo que su riqueza predice; España, menos',
        subtitle: 'Siete países en 2022 y la tendencia entre ellos',
      }),
      tooltipPlugin(),
      trendPlugin({ label: 'tendencia de estos siete', format: (v) => `${v.toFixed(1)} t` }),
    ],
  };
}
```

## Escala logarítmica

```ts demo
import { legendPlugin, pivot, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Escala logarítmica: siete países que difieren en dos órdenes de magnitud, todos legibles. */
export default async function log(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), { index: 'fecha', columns: 'pais', values: 'co2_mt' });
  const paises = ['China', 'Estados Unidos', 'India', 'Alemania', 'Brasil', 'México', 'España'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [tooltipPlugin(), legendPlugin()],
    scales: { y: { type: 'log' } },
    axes: { y: { title: 'Mt de CO₂ (log)' } },
  };
}
```

## Histograma

```ts demo
import { histogramTable, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Histograma: distribución de toneladas por persona en todos los país-año (Freedman–Diaconis). */
export default async function histograma(): Promise<ChartConfig> {
  const tabla = await co2();
  return {
    type: 'bar',
    bar: { padding: 0, radius: 0, gap: 1 },
    data: histogramTable(tabla.numeric('co2_t_por_persona'), {
      binColumn: 'rango',
      countColumn: 'n',
    }),
    series: [{ id: 'n', name: 'País-años', x: 'rango', y: 'n' }],
    plugins: [tooltipPlugin()],
    axes: { x: { title: 't de CO₂ por persona' }, y: { title: 'Frecuencia' } },
  };
}
```

## Casos como unidades

El mismo histograma, pero cada país-año es un punto: arrastra para contar cuántos caen en un
rango (o usa ← → con el gráfico enfocado); el panel de al lado resume el rango.

```ts demo height=320
import { selectionPlugin, summaryPlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Unidades: un punto por país-año apilado por cubeta; arrastrar cuenta y el panel resume el rango. */
export default async function unidades(): Promise<ChartConfig> {
  const tabla = await co2();
  return {
    type: 'dots',
    dots: { mode: 'binned' },
    data: tabla,
    series: [{ id: 'casos', name: 'País-año', x: 'co2_t_por_persona' }],
    plugins: [
      selectionPlugin({ unit: ['país-año', 'país-años'], readout: false }),
      summaryPlugin({ unit: ['país-año', 'país-años'], format: (v) => `${v.toFixed(1)} t` }),
      tooltipPlugin({ mode: 'nearest', formatY: (v) => `${v.toFixed(2)} t` }),
    ],
    axes: { x: { title: 't de CO₂ por persona' }, y: { title: 'País-años' } },
  };
}
```

## Box plot

```ts demo
import { tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Box plot: la distribución 1950–2024 de toneladas por persona, por país, directo del formato largo. */
export default async function cajas(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    plugins: [tooltipPlugin()],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}
```

## Un punto por año

Los mismos datos del box plot, pero cada valor es un punto a su altura exacta, en un enjambre
por país; el tono va de 1950 (claro) a 2024 (oscuro) y el punto grande es el valor de hoy con
su lugar en el reparto.

```ts demo height=420
import { titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Un punto por año: un enjambre por país, con el tono por fecha y el valor de hoy marcado. */
export default async function puntos(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    box: { mark: 'dots', shade: 'fecha', now: 'last' },
    plugins: [
      titlePlugin({
        title: 'China pasó de los años claros abajo a los oscuros arriba; Alemania, al revés',
        subtitle: 'Un punto por año, de 1950 (claro) a 2024 (oscuro); raya en la mediana',
      }),
      tooltipPlugin(),
    ],
    axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
  };
}
```

## Franja de densidad

Una franja por país cuya intensidad es cuántos años caen en cada tramo; raya en la mediana.

```ts demo height=400
import { titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Franja de densidad: la intensidad es cuántos años caen en cada tramo. */
export default async function franja(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    box: { mark: 'density' },
    plugins: [
      titlePlugin({
        title: 'Estados Unidos lleva 75 años entre 14 y 22 t; India nunca pasó de 2,2',
        subtitle: 'Más oscuro, más años en ese tramo; raya en la mediana',
      }),
      tooltipPlugin(),
    ],
    axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
  };
}
```

## Hoy frente a su historia

Bandas del percentil 10 al 90 y del 25 al 75 con la mediana; el punto es 2024 y el texto dice
en qué parte de su historia cae.

```ts demo height=420
import { titlePlugin, tooltipPlugin, type ChartConfig } from 'xilaplot';
import { co2 } from './datos';

/** Hoy frente a su historia: bandas de percentiles y el valor de 2024 con su contexto. */
export default async function hoy(): Promise<ChartConfig> {
  return {
    type: 'box',
    data: await co2(),
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    box: { mark: 'range', now: 'last' },
    plugins: [
      titlePlugin({
        title: 'Alemania está hoy en lo más bajo de su historia; China e India, en su máximo',
        subtitle: 'Bandas del percentil 10 al 90 y del 25 al 75; el punto es 2024',
      }),
      tooltipPlugin(),
    ],
    axes: { y: { title: 't de CO₂ por persona, un valor por año' } },
  };
}
```

## Heatmap

```ts demo
import {
  categoryColumn,
  DataTable,
  numberColumn,
  pivot,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2, conDecada } from './datos';

/**
 * Heatmap: promedio de toneladas por persona por país y década. `pivot` con `agg: 'mean'` deja
 * una fila por década y una columna por país; luego se vuelve a formato largo (década, país,
 * media), que es lo que el heatmap consume.
 */
export default async function calor(): Promise<ChartConfig> {
  const ancho = pivot(conDecada(await co2()), {
    index: 'decada',
    columns: 'pais',
    values: 'co2_t_por_persona',
    agg: 'mean',
  });
  const col = ancho.column('decada');
  const etiquetas =
    col.kind === 'category' ? Array.from(col.codes, (c) => col.categories[c] ?? '') : [];
  const paises = ancho.names().filter((n) => n !== 'decada');
  const decada: string[] = [];
  const pais: string[] = [];
  const media: number[] = [];
  etiquetas.forEach((etiqueta, i) => {
    for (const p of paises) {
      decada.push(etiqueta);
      pais.push(p);
      media.push(ancho.numeric(p)[i] as number);
    }
  });
  return {
    type: 'heatmap',
    data: new DataTable({
      decada: categoryColumn(decada),
      pais: categoryColumn(pais),
      media: numberColumn(media),
    }),
    series: [{ id: 'm', name: 't por persona', x: 'decada', y: 'pais', value: 'media' }],
    plugins: [tooltipPlugin()],
  };
}
```

## Cada fila contra sí misma

Una celda por país y año; cada fila se colorea contra su propia mediana (azul por debajo,
naranja por encima), así India cuenta su subida tan claro como Alemania su bajada. A la derecha,
el año del máximo y la mediana.

```ts demo height=400
import {
  categoryColumn,
  DataTable,
  titlePlugin,
  tooltipPlugin,
  type ChartConfig,
  type Column,
} from 'xilaplot';
import { co2 } from './datos';

/**
 * Cada fila contra sí misma: `heatmap.scale: 'row'` colorea cada celda por su diferencia con la
 * mediana de su propio país (azul por debajo, naranja por encima) y `rowLabels: 'max'` escribe
 * el año del máximo y la mediana. Una fila por país y una columna por año, en formato largo.
 */
export default async function propia(): Promise<ChartConfig> {
  const tabla = await co2();
  const columnas: Record<string, Column> = {};
  for (const nombre of tabla.names()) columnas[nombre] = tabla.column(nombre);
  columnas['anio'] = categoryColumn(
    Array.from(tabla.numeric('fecha'), (ms) => String(new Date(ms).getUTCFullYear())),
  );
  return {
    type: 'heatmap',
    data: new DataTable(columnas),
    series: [{ id: 't', name: 't por persona', x: 'anio', y: 'pais', value: 'co2_t_por_persona' }],
    heatmap: { scale: 'row', rowLabels: 'max' },
    plugins: [
      titlePlugin({
        title:
          'Alemania y Estados Unidos ya bajaron de su mediana; China e India están en su máximo',
        subtitle: 'Cada fila contra su propia mediana',
      }),
      tooltipPlugin(),
    ],
  };
}
```

## Tabla con tono

El heatmap por década con la cifra en cada celda y un hueco entre ellas: la tabla manda y el
color solo guía el ojo. Es la forma que sobrevive a la impresión y al informe del cliente.

```ts demo height=400
import {
  categoryColumn,
  DataTable,
  numberColumn,
  pivot,
  titlePlugin,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2, conDecada } from './datos';

/**
 * Tabla con tono: el mismo heatmap por década que el ejemplo anterior, con la cifra en cada
 * celda (`values`) y un hueco entre ellas (`gap`). El color solo guía el ojo; el dominio se
 * estira para que la celda más oscura siga siendo legible.
 */
export default async function tabla(): Promise<ChartConfig> {
  const ancho = pivot(conDecada(await co2()), {
    index: 'decada',
    columns: 'pais',
    values: 'co2_t_por_persona',
    agg: 'mean',
  });
  const col = ancho.column('decada');
  const etiquetas =
    col.kind === 'category' ? Array.from(col.codes, (c) => col.categories[c] ?? '') : [];
  const paises = ancho.names().filter((n) => n !== 'decada');
  const decada: string[] = [];
  const pais: string[] = [];
  const media: number[] = [];
  etiquetas.forEach((etiqueta, i) => {
    for (const p of paises) {
      decada.push(etiqueta);
      pais.push(p);
      media.push(ancho.numeric(p)[i] as number);
    }
  });
  return {
    type: 'heatmap',
    data: new DataTable({
      decada: categoryColumn(decada),
      pais: categoryColumn(pais),
      media: numberColumn(media),
    }),
    series: [{ id: 'm', name: 't por persona', x: 'decada', y: 'pais', value: 'media' }],
    heatmap: { values: true, gap: 2, legend: false, domain: [0, 26] },
    plugins: [
      titlePlugin({
        title: 'Alemania pasó de 13,1 t en los setenta a 7,5 en los veinte',
        subtitle: 'Promedio por década',
      }),
      tooltipPlugin(),
    ],
  };
}
```

## Anotaciones

```ts demo
import { annotationsPlugin, tooltipPlugin, zoomPanPlugin, type ChartConfig } from 'xilaplot';
import { pais } from './datos';

/** Anotaciones en valores de datos: siguen al zoom y al cambio de tamaño sin recalcular nada. */
export default async function anotaciones(): Promise<ChartConfig> {
  return {
    type: 'line',
    data: await pais('China'),
    series: [{ id: 'cn', name: 'China', x: 'fecha', y: 'co2_mt' }],
    plugins: [
      tooltipPlugin(),
      zoomPanPlugin(),
      annotationsPlugin([
        {
          type: 'band',
          axis: 'x',
          from: new Date('2001-12-11'),
          to: new Date('2008-09-15'),
          label: 'OMC → crisis 2008',
          description: 'De la entrada a la OMC a la caída de Lehman Brothers',
        },
        { type: 'line', axis: 'x', value: new Date('2020-01-01'), label: 'COVID-19', dash: [4, 3] },
        { type: 'line', axis: 'y', value: 10_000, label: '10 000 Mt', color: '#b45309' },
      ]),
    ],
    axes: { y: { title: 'Mt de CO₂' } },
  };
}
```

## Plugin propio

El plugin está explicado paso a paso en [Crear un plugin](guia/plugin.md).

```ts demo
import {
  formatNumber,
  legendPlugin,
  pivot,
  tooltipPlugin,
  type ChartConfig,
  type ChartPlugin,
} from 'xilaplot';
import { co2 } from './datos';

/**
 * Plugin de ejemplo: escribe el último valor de cada serie visible a la derecha de su punto
 * final. Pide espacio a la derecha en `reserveSpace` y dibuja en `afterDraw`, sobre la capa
 * `overlay`, convirtiendo valores a píxeles con las escalas del dibujo actual.
 */
export function ultimoValorPlugin(): ChartPlugin {
  return {
    id: 'ultimo-valor',
    reserveSpace: () => ({ right: 56 }),
    afterDraw(ctx) {
      const scales = ctx.getScales();
      if (!scales) return;
      const sx = scales.x;
      if (sx.kind === 'band') return;
      const { theme } = ctx.config;
      ctx.getSeries().forEach((serie, i) => {
        if (ctx.hiddenSeries.has(serie.id) || serie.length === 0) return;
        const ultimo = serie.length - 1;
        const px = sx.toPixel(serie.x[ultimo] as number);
        const py = scales.y.toPixel(serie.y[ultimo] as number);
        ctx.renderer.drawText('overlay', formatNumber(serie.y[ultimo] as number), px + 6, py, {
          font: `600 ${theme.fontSize}px ${theme.fontFamily}`,
          fill: theme.palette[i % theme.palette.length] ?? theme.text,
          baseline: 'middle',
        });
      });
    },
  };
}

/** Plugin propio: `ultimoValorPlugin` (ver la guía "Crear un plugin") etiqueta el final de cada serie. */
export default async function plugin(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'co2_t_por_persona',
  });
  const paises = ['Estados Unidos', 'Alemania', 'China', 'México', 'India'];
  return {
    type: 'line',
    data: ancho,
    series: paises.map((p) => ({ id: p, name: p, x: 'fecha', y: p })),
    plugins: [tooltipPlugin(), legendPlugin(), ultimoValorPlugin()],
    axes: { y: { title: 't de CO₂ por persona' } },
  };
}
```

## Accesibilidad por teclado

```ts demo
import {
  accessibilityPlugin,
  legendPlugin,
  pivot,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2 } from './datos';

/**
 * Accesibilidad: haz clic en el gráfico y usa ← → para recorrer los datos, ↑ ↓ para cambiar de
 * serie. Un lector de pantalla recibe un resumen generado y una tabla oculta con los datos.
 */
export default async function accesible(): Promise<ChartConfig> {
  const ancho = pivot(await co2(), {
    index: 'fecha',
    columns: 'pais',
    values: 'porcentaje_global',
  });
  return {
    type: 'line',
    line: { area: true },
    data: ancho,
    series: [
      { id: 'us', name: 'Estados Unidos', x: 'fecha', y: 'Estados Unidos' },
      { id: 'cn', name: 'China', x: 'fecha', y: 'China' },
    ],
    plugins: [tooltipPlugin(), legendPlugin(), accessibilityPlugin()],
    axes: { y: { title: '% de las emisiones globales' } },
  };
}
```

## Nudos con camino

¿Cuándo y dónde se concentra? Cada celda es un nudo cuya área es el valor, así que se compara
a ojo el tamaño; al señalar uno, un hilo lo une con su fila y su columna. En reposo el hilo
descansa en el máximo.

```ts demo height=440
import {
  accessibilityPlugin,
  categoryColumn,
  DataTable,
  formatNumber,
  numberColumn,
  pivot,
  titlePlugin,
  tooltipPlugin,
  type ChartConfig,
} from 'xilaplot';
import { co2, conDecada } from './datos';

/**
 * Nudos con camino: `heatmap.mark: 'knot'` dibuja cada celda como un nudo cuya área es el valor
 * y `heatmap.path` une la celda señalada con su fila y su columna con un hilo. En reposo el
 * camino descansa en el máximo. Aquí, país por década con la media de t por persona.
 */
export default async function nudos(): Promise<ChartConfig> {
  const ancho = pivot(conDecada(await co2()), {
    index: 'decada',
    columns: 'pais',
    values: 'co2_t_por_persona',
    agg: 'mean',
  });
  const col = ancho.column('decada');
  const etiquetas =
    col.kind === 'category' ? Array.from(col.codes, (c) => col.categories[c] ?? '') : [];
  const paises = ancho.names().filter((n) => n !== 'decada');
  const decada: string[] = [];
  const pais: string[] = [];
  const media: number[] = [];
  etiquetas.forEach((etiqueta, i) => {
    for (const p of paises) {
      decada.push(etiqueta);
      pais.push(p);
      media.push(ancho.numeric(p)[i] as number);
    }
  });
  let max = 0;
  media.forEach((v, i) => {
    if (v > (media[max] as number)) max = i;
  });
  return {
    type: 'heatmap',
    data: new DataTable({
      decada: categoryColumn(decada),
      pais: categoryColumn(pais),
      media: numberColumn(media),
    }),
    series: [{ id: 'm', name: 't por persona', x: 'decada', y: 'pais', value: 'media' }],
    heatmap: { mark: 'knot', path: true },
    plugins: [
      titlePlugin({
        title: `${pais[max]} en los ${decada[max]} es el máximo: ${formatNumber(media[max] as number)} t por persona`,
        subtitle: 'Media de t de CO₂ por persona, por país y década',
      }),
      tooltipPlugin(),
      accessibilityPlugin(),
    ],
  };
}
```

## Ranura de estado

¿Dónde está hoy cada país respecto a su propia historia, y hacia dónde va? Cada país es una
fila: la banda es su rango típico desde 1950, el punto es 2024 y a la derecha se lee si sube,
está estable o baja frente a cinco años antes (con el relleno del punto como señal rápida).

```ts demo height=400
import {
  accessibilityPlugin,
  DataTable,
  statusGroups,
  statusLayout,
  titlePlugin,
  tooltipPlugin,
  numberColumn,
  type BoxChartConfig,
  type ChartConfig,
  type Column,
} from 'xilaplot';
import { co2 } from './datos';

/**
 * Ranura de estado: `box.orientation: 'horizontal'` pone una fila por país. La banda es su rango
 * típico desde 1950 (percentiles 10 a 90), el punto es 2024 y a la derecha el estado dice si
 * sube, está estable o baja frente a cinco años antes. El título sale del mismo cálculo.
 */
export default async function ranura(): Promise<ChartConfig> {
  const tabla = await co2();
  const columnas: Record<string, Column> = {};
  for (const nombre of tabla.names()) columnas[nombre] = tabla.column(nombre);
  columnas['anio'] = numberColumn(
    Array.from(tabla.numeric('fecha'), (ms) => new Date(ms).getUTCFullYear()),
  );
  const datos = new DataTable(columnas);
  const box = {
    orientation: 'horizontal',
    mark: 'range',
    now: 'last',
    period: 'anio',
    reference: 'history',
    status: 'direction',
    statusWindow: 5,
  } satisfies BoxChartConfig['box'];

  // Las filas se calculan fuera del gráfico para redactar el título con el hallazgo.
  const pais = datos.column('pais');
  const grupos = statusGroups(
    pais.kind === 'category' ? pais.codes : new Uint32Array(0),
    datos.numeric('co2_t_por_persona'),
    pais.kind === 'category' ? pais.categories : [],
    { periods: datos.numeric('anio') },
  );
  const filas = statusLayout(grupos, {
    reference: box.reference,
    status: box.status,
    threshold: 0.05,
    window: box.statusWindow,
    range: [0.1, 0.9],
    sort: 'status',
    maxRows: 12,
  }).rows;
  const bajan = filas.filter((f) => f.status === 'down').map((f) => f.name);

  return {
    type: 'box',
    data: datos,
    series: [{ id: 'tpp', name: 't por persona', x: 'pais', y: 'co2_t_por_persona' }],
    box,
    plugins: [
      titlePlugin({
        title: `${bajan.length} de ${filas.length} países emiten menos por persona que hace cinco años`,
        subtitle:
          '2024 frente a 2019; banda = rango típico 1950–2024; estable = cambio menor al 5 %',
      }),
      tooltipPlugin(),
      accessibilityPlugin(),
    ],
  };
}
```

## WebGL con un millón de puntos

No cabe en esta página sin descargar 16 MB, pero el repositorio trae la demo lista:
`pnpm dev` y abre `/webgl.html?n=1000000&renderer=webgl` (cambia `renderer=canvas` para
comparar). El código está en `examples/src/webgl.ts`.

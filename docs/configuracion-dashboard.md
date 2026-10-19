# Configuración declarativa del dashboard

El archivo que cambia por cliente: `dashboard.json`. Define tablas, filtros y paneles sin
escribir código. Se valida en dos pasos al cargar:

1. `parseDashboard(json)` revisa la forma (claves, tipos, valores permitidos) y lanza
   `DashboardConfigError` con **todos** los errores y su ruta (`paneles[2].y`).
2. `validateDashboard(config, tablas)` revisa contra los CSV ya cargados que cada columna
   exista y tenga el tipo que el panel necesita. Un error de dedo devuelve
   `la columna "mnto" no existe en ventas; ¿quisiste decir "monto"?`.

Decisión: JSON y no YAML, por ahora. JSON no necesita dependencia y se escribe directo
desde el notebook con `json.dump`. Si el YAML resulta más cómodo a mano, basta añadir un
parser y pasar el objeto a `parseDashboard`; el esquema no cambia.

## Ejemplo

```json
{
  "titulo": "Ventas 2026",
  "tema": "light",
  "datos": { "ventas": "data/ventas.csv" },
  "filtros": [
    { "tipo": "fechas", "datos": "ventas", "columna": "fecha", "etiqueta": "Periodo" },
    { "tipo": "categoria", "datos": "ventas", "columna": "region", "multiple": true }
  ],
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
    },
    {
      "tipo": "barras",
      "titulo": "Ventas por mes",
      "datos": "ventas",
      "x": "fecha",
      "y": "monto",
      "color": "region",
      "agregado": "sum",
      "periodo": "month",
      "apilado": true,
      "ancho": 6
    }
  ]
}
```

## Claves

| Clave     | Tipo                   | Notas                                                         |
| --------- | ---------------------- | ------------------------------------------------------------- |
| `titulo`  | texto                  | Obligatorio.                                                  |
| `tema`    | `light` \| `dark`      | Por defecto `light`.                                          |
| `datos`   | `{ nombre: ruta.csv }` | Al menos una tabla; la ruta es relativa al `index.html`.      |
| `filtros` | lista                  | `fechas` (columna `time`) o `categoria` (columna `category`). |

Un filtro lee sus opciones de la tabla `datos`. Con `"tambien": ["otra_tabla"]` se aplica
además a otras tablas que tienen la misma columna, por ejemplo una tabla diaria y su resumen
mensual (`examples/public/clima/dashboard.json`).
| `paneles` | lista | Al menos uno. Se colocan en un grid de 12 columnas. |

### Panel `kpi`

| Clave            | Tipo                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `valor.columna`  | columna numérica (o cualquiera con `count`)                                                   |
| `valor.agregado` | `sum` `mean` `count` `min` `max` `first` `last`                                               |
| `valor.formato`  | `numero` `entero` `moneda` `porcentaje` (defecto `numero`)                                    |
| `comparar`       | `{ columna: <tiempo>, periodo }`: muestra el último periodo y su variación contra el anterior |
| `ancho`          | 1 a 12 (defecto 3)                                                                            |

### Panel `linea`, `barras`, `dispersion`

| Clave      | Tipo                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| `x`        | columna                                                                      |
| `y`        | columna numérica o lista de columnas                                         |
| `color`    | columna categórica: una serie por categoría (usa solo la primera `y`)        |
| `agregado` | combina las filas con la misma `x` (y mismo `color`)                         |
| `periodo`  | `day` `week` `month` `quarter` `year` …; requiere `agregado` y `x` de tiempo |
| `apilado`  | barras apiladas en vez de agrupadas                                          |
| `ejes`     | `{ x: "título", y: "título" }`                                               |
| `ancho`    | 1 a 12 (defecto 12)                                                          |

Las barras necesitan una categoría por barra: si `x` es tiempo hay que dar `agregado` y
`periodo`, y cada periodo se vuelve una etiqueta (`ene 26`, `feb 26`).

### Panel `cajas`

Reparto de `y` por grupo `x` (box plot clásico, o una forma de "Qué es Xila hoy").

| Clave    | Tipo                                                           |
| -------- | -------------------------------------------------------------- |
| `x`      | columna categórica del grupo                                   |
| `y`      | columna numérica del valor                                     |
| `sombra` | columna numérica o de tiempo que da el tono en `forma: puntos` |
| `forma`  | `puntos` `franja` `hoy` (sin forma: box plot)                  |
| `ejes`   | `{ x, y }`                                                     |

### Panel `calor`

Una celda por `x` × `y` con `valor` agregado (promedio por defecto).

| Clave      | Tipo                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| `x`        | columna categórica, o de tiempo si se da `periodo`                     |
| `y`        | columna categórica (las filas)                                         |
| `valor`    | columna numérica                                                       |
| `agregado` | cómo combinar las filas de cada celda (defecto `mean`)                 |
| `periodo`  | `year` `decade` …: redondea `x` y la vuelve etiqueta (`1950`, `1950s`) |
| `forma`    | `filas` (cada fila contra su mediana) `tabla` (cifra en cada celda)    |

### `forma`: las alternativas de "Qué es Xila hoy"

Sin `forma`, cada panel es el gráfico clásico. Con `forma`, el mismo panel responde otra
pregunta y trae sus propias etiquetas y controles (el dashboard solo añade el tooltip):

| Panel        | `forma`        | Pregunta                                   | Claves extra                                              |
| ------------ | -------------- | ------------------------------------------ | --------------------------------------------------------- |
| `linea`      | `ahora`        | ¿Dónde está hoy y de dónde viene?          |                                                           |
| `linea`      | `protagonista` | ¿Cómo va este frente a los demás?          | `protagonista`: categoría de `color` que empieza en color |
| `barras`     | `puntos`       | ¿Cuánto más que el promedio o la meta?     | `referencia`: `mean` (defecto), `median` o un número      |
| `barras`     | `unidades`     | ¿Qué parte del total es de cada uno?       |                                                           |
| `dispersion` | `trayectorias` | ¿Por dónde ha pasado y hacia dónde va?     | `tiempo` (columna de tiempo), `color`, `protagonista`     |
| `dispersion` | `tendencia`    | ¿Quién se sale del patrón?                 |                                                           |
| `cajas`      | `puntos`       | ¿Dónde han estado y dónde están ahora?     | `sombra`                                                  |
| `cajas`      | `franja`       | ¿Dónde se concentra cada grupo?            |                                                           |
| `cajas`      | `hoy`          | ¿Dónde cae hoy dentro de su historia?      |                                                           |
| `calor`      | `filas`        | ¿Cuándo cambió cada uno?                   |                                                           |
| `calor`      | `tabla`        | ¿Cuánto exactamente, sin perder el patrón? |                                                           |

`examples/public/co2/muestra.json` es un dashboard de muestra con las once formas sobre el CSV
de CO₂ (`/dashboard.html?config=co2/muestra.json`).

## Mecanismo de los filtros

Los filtros viven en un estado compartido como lista de condiciones (`Condition` de
`xilaplot`). Cada panel deriva sus series con `buildChart(panel, tabla, condiciones)` o
`buildKpi(...)`; ningún panel conoce a los demás. Cambiar un filtro recalcula todos los
paneles desde la tabla original, que nunca se modifica.

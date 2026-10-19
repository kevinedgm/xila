# Dashboards desde CSV

El flujo para entregar un dashboard a un cliente sin escribir código de gráficos. La limpieza
vive en pandas; el navegador solo filtra y dibuja.

```
notebook ──exportar_xila(df)──▶ data/ventas.csv ──▶ dashboard.json ──pnpm build──▶ dist/
```

## 1. Exportar desde el notebook

`python/xila_export.py` escribe un CSV que cumple el [contrato](../referencia/contrato-csv):
formato largo, fechas ISO en UTC, números con punto, categorías tal cual (los ceros a la
izquierda se conservan y se leen como categoría).

```python
from xila_export import exportar_xila
exportar_xila(df, 'ventas')   # → data/ventas.csv
```

## 2. Crear el proyecto del cliente

```bash
pnpm nuevo-cliente acme       # copia plantilla/ a clientes/acme/
```

## 3. Declarar el dashboard

`public/dashboard.json` nombra las tablas, los filtros y los paneles. Un panel es un gráfico
con las mismas claves que `ChartConfig` (tipo, columnas, plugins) o un KPI con una agregación.

```json
{
  "titulo": "Ventas 2026",
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
      "valor": { "columna": "monto", "agregado": "sum", "formato": "moneda" }
    },
    { "tipo": "linea", "titulo": "Por día", "datos": "ventas", "x": "fecha", "y": "monto" },
    {
      "tipo": "linea",
      "forma": "ahora",
      "titulo": "¿Dónde está hoy cada región?",
      "datos": "ventas",
      "x": "fecha",
      "y": "monto",
      "color": "region"
    }
  ]
}
```

La clave `forma` convierte un panel clásico en una de las alternativas de "Qué es Xila hoy"
(`ahora`, `protagonista`, `puntos`, `unidades`, `trayectorias`, `tendencia`, y las de los
paneles `cajas` y `calor`) sin escribir código.

Se valida en dos pasos al cargar: la forma del JSON (todos los errores con su ruta, como
`paneles[2].y`) y después las columnas contra los CSV ya cargados, con sugerencia de nombre
cuando hay un error de dedo. Todas las claves están en
[Configuración de dashboards](../referencia/dashboard).

## 4. Construir y proteger

`pnpm build` deja un `dist/` estático. La protección con usuario y contraseña va en el servidor
(Caddy, nginx o Cloudflare Access), no en el JavaScript: lo que llega al navegador siempre es
legible. [Despliegue](../referencia/despliegue) tiene las configuraciones.

## Cómo filtra el navegador

Los filtros no vuelven a pedir datos: `filterRows(tabla, condiciones)` recorre las columnas
tipadas y devuelve una tabla nueva con los índices que pasan, y cada panel recibe esa tabla.
Para una tabla de cien mil filas esto tarda menos que un fotograma, por eso un filtro de fechas
se siente instantáneo. Las mismas funciones (`filterRows`, `groupBy`, `bucketTime`, `pivot`,
`splitBy`) están disponibles para usarlas a mano, como hace la [Galería](../galeria/).

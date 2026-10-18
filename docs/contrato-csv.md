# Contrato de CSV en formato largo

Reglas que cumplen los CSV que salen de los notebooks (pandas) y que lee `parseCsv` de
`xilaplot`. El lector es estricto a propósito: un archivo que rompe una regla falla con
número de fila y nombre de columna en vez de dibujar algo incorrecto en silencio.

## Reglas

| Regla        | Valor                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Codificación | UTF-8 sin BOM (si trae BOM se ignora).                                                                      |
| Separador    | Coma. Saltos de línea `\n` o `\r\n`.                                                                        |
| Encabezado   | Primera fila, nombres en `snake_case`, únicos y sin espacios.                                               |
| Forma        | Formato largo: una fila por observación, una columna por variable.                                          |
| Comillas     | RFC 4180: una celda con coma, comillas o salto de línea va entre `"…"`; una comilla dentro se escribe `""`. |
| Números      | Punto decimal, sin separador de miles, sin símbolo de moneda (`1250.5`, `-3`, `1e6`).                       |
| Fechas       | ISO 8601: `2026-10-18` o `2026-10-18T15:30:00Z`. Sin zona horaria se asume UTC.                             |
| Nulos        | Celda vacía. Nunca `0`, `-`, `NA` ni `null`.                                                                |
| Categorías   | Texto tal cual; se comparan con distinción de mayúsculas.                                                   |

## Ejemplo válido

```csv
fecha,region,monto
2026-01-01,Norte,1250.5
2026-01-01,Sur,980
2026-01-02,Norte,
2026-01-02,"Centro, Bajío",1100
```

La tercera fila tiene `monto` nulo (celda vacía) y la cuarta una categoría con coma, por eso
va entre comillas.

## Tipos de columna

El lector revisa las primeras 200 celdas no vacías de cada columna:

- todas son números → columna `number`;
- todas son fechas ISO → columna `time` (milisegundos UTC);
- cualquier otra cosa → columna `category`.

Un valor numérico con cero a la izquierda (`01000`) marca la columna como `category`: es un
código postal o una clave, no una cantidad. Una celda posterior que no cumpla el tipo inferido es un error, no una categoría nueva:
`fila 1204, columna "monto": "N/A" no es un número`. Para evitar sorpresas (por ejemplo
códigos postales que parecen números) el tipo se puede fijar por columna:

```ts
parseCsv(texto, { types: { codigo_postal: 'category' } });
```

## Por qué formato largo

El mismo archivo sirve para líneas por región, barras por mes o una tabla, cambiando solo
la configuración del gráfico (`splitBy('region')`, `groupBy('mes', 'sum', 'monto')`). En
formato ancho (una columna por región) añadir una región cambia la estructura del archivo y
rompe la configuración.

## Desde pandas

```python
df.to_csv("ventas.csv", index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
```

`index=False` evita una columna sin nombre; `date_format` fuerza ISO 8601 con zona UTC.
Los `NaN` de pandas salen como celda vacía, que es lo que el contrato pide.

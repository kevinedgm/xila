# Xila

Librería de gráficos en TypeScript para dashboards y datos científicos, con identidad inspirada en los textiles de Oaxaca.

> **Estado:** experimental (Etapa 1 · Fundación). La API cambiará sin aviso. "Xila" es un nombre provisional.

## Estructura

```
packages/
  core/      # @xila/core: motor, datos, escalas, renderer Canvas
  vue/       # @xila/vue: componente <XilaChart>
examples/    # app Vite para probar la librería a mano
```

## Cómo correrlo

Requiere Node 20 o superior y pnpm 10.

```bash
pnpm install
pnpm build      # construye core y vue
pnpm dev        # abre los ejemplos en http://localhost:5173
pnpm test       # tests con Vitest
pnpm lint       # ESLint
pnpm typecheck  # TypeScript estricto en todos los paquetes
```

### Tests visuales

Comparan capturas de cada ejemplo contra las referencias en `examples/tests/__capturas__`
(generadas en Linux; CI corre en Ubuntu). Si un cambio de dibujo es intencional, se
regeneran con `--update-snapshots` y se revisan en el diff del commit.

```bash
pnpm build && pnpm --filter examples build
pnpm --filter examples exec playwright install chromium   # una vez
pnpm --filter examples test:visual                         # o con CHROMIUM_PATH=/ruta/a/chrome
pnpm --filter examples test:visual --update-snapshots      # aceptar cambios
```

## Render diferido

Por defecto un gráfico no se dibuja hasta que su contenedor está a menos de 200 px de la
pantalla, y no redibuja mientras está fuera (`IntersectionObserver`). Una página con 30
gráficos solo paga los visibles: `examples/muchos.html` lo muestra con un contador. Para
dibujar siempre (por ejemplo, exportar sin mostrar) se pasa `lazy: false`.

## Plugins

Tooltip, leyenda, zoom/pan y anotaciones vienen en `@xila/core`; opciones y mecanismo en
[`docs/plugins.md`](docs/plugins.md).

## Dashboards para clientes

El flujo completo, sin escribir código de gráficos:

1. Notebook → `exportar_xila(df, 'ventas')` (`python/xila_export.py`) escribe `data/ventas.csv`
   según `docs/contrato-csv.md`.
2. `pnpm nuevo-cliente acme` copia `plantilla/` a `clientes/acme/`.
3. Se edita `public/dashboard.json` (`docs/configuracion-dashboard.md`): tablas, filtros y paneles.
4. `pnpm build` genera `dist/`; se sube y se protege en el servidor (`docs/despliegue.md`).

Ejemplos funcionando con `pnpm dev`: `/dashboard.html` (ventas sintéticas) y
`/dashboard.html?config=co2/dashboard.json` (emisiones de CO₂ de Our World in Data,
generado con `python3 python/ejemplo_co2.py`: descarga, limpia, exporta; el JSON no tiene código).

## Licencia

MIT

## Benchmark del prototipo

```bash
pnpm build && pnpm --filter examples build
CHROMIUM_PATH=/ruta/a/chrome pnpm --filter examples bench         # memoria, primer render y pan
CHROMIUM_PATH=/ruta/a/chrome pnpm --filter examples bench:visual  # compara píxel a píxel
pnpm --filter examples bench:check                                 # puerta de regresión (umbrales en bench/check.mjs)
```

CI corre el benchmark en un job aparte (solo el renderer decimado, 3 repeticiones) y falla si
1M puntos tardan más de 30 ms por frame, el primer render más de 200 ms o las columnas pesan
más de 25 MB. Son umbrales holgados: atrapan regresiones grandes, no variaciones del runner.

Resultados y decisiones en `docs/adr/`.

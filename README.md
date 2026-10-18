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

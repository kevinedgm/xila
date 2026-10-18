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

## Licencia

MIT

## Benchmark del prototipo

```bash
pnpm build && pnpm --filter examples build
CHROMIUM_PATH=/ruta/a/chrome pnpm --filter examples bench         # memoria, primer render y pan
CHROMIUM_PATH=/ruta/a/chrome pnpm --filter examples bench:visual  # compara píxel a píxel
```

Resultados y decisiones en `docs/adr/`.

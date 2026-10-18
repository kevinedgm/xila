# Contribuir a Xila

Gracias por el interés. Xila es un proyecto personal en fase experimental: la API cambia sin
aviso y el nombre es provisional. Aun así, los reportes de errores, las ideas y los parches son
bienvenidos. Este documento explica cómo hacer que una contribución sea fácil de revisar.

## Antes de empezar

- **Errores**: abre un issue con la plantilla "Reporte de error". Lo más útil es un CSV pequeño o
  un fragmento de código que reproduzca el problema.
- **Ideas**: abre un issue con la plantilla "Propuesta". Explica el problema que resuelve antes
  que la solución; muchas veces hay una forma de hacerlo con un plugin sin tocar el núcleo.
- **Cambios grandes** (un tipo de gráfico nuevo, un backend, cambiar el formato de datos):
  conviene discutirlos en un issue antes de escribir código. Las decisiones de diseño ya tomadas
  están en `docs/adr/`; una propuesta que contradiga una ADR tiene que explicar por qué.

## Preparar el entorno

Requiere Node 20 o superior y pnpm 10.

```bash
git clone https://github.com/kevinedgm/xila
cd xila
pnpm install
pnpm build        # construye @xila/core y @xila/vue
pnpm dev          # ejemplos en http://localhost:5173
```

## Antes de abrir un pull request

Todo esto corre en CI; correrlo antes ahorra una vuelta:

```bash
pnpm format       # Prettier
pnpm typecheck    # TypeScript estricto en todos los paquetes
pnpm lint         # ESLint
pnpm test         # Vitest
pnpm --filter examples build && pnpm --filter examples test:visual   # capturas (ver README)
```

Las pruebas visuales comparan capturas generadas con la fuente Inter 4.0 en Ubuntu; en otra
máquina pueden fallar por diferencias de texto sin que el cambio sea incorrecto. Si CI falla
solo por eso, dilo en el PR.

## Qué hace que un PR se acepte rápido

- Un cambio por PR. Un arreglo y una refactorización van en dos.
- Tests para lo que cambia: unitarios en `packages/core/src/**/*.test.ts` para datos, escalas y
  transformaciones; un caso en `examples/tests/visual.spec.ts` si cambia el dibujo.
- Comentarios en español, como el resto del código, que expliquen el **porqué** (una decisión,
  un límite del navegador), no el qué.
- Nada de dependencias nuevas en `@xila/core` sin discutirlo: el núcleo no tiene ninguna en
  tiempo de ejecución y queremos que siga así.
- Si cambias el dibujo a propósito, regenera las capturas con `--update-snapshots` y revisa el
  diff de las imágenes en el commit.

## Estilo

Prettier y ESLint deciden el formato, así que no hay nada que memorizar. Las convenciones que
no cubren las herramientas:

- TypeScript estricto con `noUncheckedIndexedAccess`: un acceso `arr[i]` es `T | undefined` y
  hay que tratarlo (normalmente `as number` en bucles calientes ya comprobados).
- Sin objetos por fila: los datos viven en columnas tipadas. Un bucle sobre un millón de puntos
  no debe crear basura.
- Los plugins no tocan el estado del núcleo; usan el `PluginContext`.

## Licencia

Al contribuir aceptas que tu aportación se publique bajo la licencia MIT del proyecto.

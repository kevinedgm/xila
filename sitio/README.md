# Sitio de documentación de Xila

Sitio estático con [VitePress](https://vitepress.dev) 1.6, en español, publicado en GitHub Pages en cada push a `main`
(`.github/workflows/docs.yml`): **https://kevinedgm.github.io/xila/**. El marco es propio y viste la marca (manta,
tinta, cobalto e hilo; Instrument Sans, JetBrains Mono y Fraunces): la página actual del índice y la sección activa
llevan la puntada en cobalto, como la última puntada de la greca.

```bash
pnpm --filter xilaplot --filter xilaplot-vue build   # los ejemplos importan los paquetes construidos
pnpm --filter sitio dev        # genera las páginas y abre el servidor de desarrollo (http://localhost:5173/xila/)
pnpm --filter sitio build      # genera, TypeDoc y construye en sitio/.vitepress/dist (falla con un enlace interno roto)
pnpm --filter sitio preview    # sirve el build en http://localhost:4300/xila/
pnpm --filter sitio test       # pruebas del generador (node --test)
pnpm --filter sitio typecheck  # TypeScript estricto sobre los ejemplos vivos y el tema
pnpm --filter sitio test:e2e   # Playwright (Chromium) sobre el build, puerto 4300
node sitio/scripts/comprobar-paginas.mjs --base http://localhost:4300/xila/   # recorrido de todas las páginas
```

## Una sola fuente de verdad

Nada del contenido se escribe en `sitio/`: `sitio/scripts/generar.mjs` lo genera en `sitio/src/` (ignorado por git) en
cada `dev`, `build` y `typecheck`, desde los documentos que ya se leen en GitHub.

| Página                                                                                                         | Fuente                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio                                                                                                         | `README.md`: descripción, aviso de estado y la sección «Qué es Xila hoy» (entradilla, tabla pregunta → forma → alternativa como tarjetas que llevan a la galería, y los párrafos `**Título.**` como ventajas); la muestra es `sitio/demos/portada.ts` |
| Empezar, Formas, Motor, Dashboards para clientes, Publicar y licencia                                          | Secciones `##` del `README.md` (plan `PAGINAS` en `generar.mjs`)                                                                                                                                                                                      |
| Guía (primer gráfico, tipos, plugin, dashboards, rendimiento)                                                  | `docs/guia/*.md`                                                                                                                                                                                                                                      |
| Galería                                                                                                        | `docs/galeria.md`: cada `##` recibe un número estable (`01`…), que se ve en el título y en «En esta página»                                                                                                                                           |
| Configuración del gráfico, plugins, dashboards, contrato de CSV, despliegue, documentación técnica, benchmarks | `docs/*.md`                                                                                                                                                                                                                                           |
| Plantilla, `xilaplot`, `xilaplot-vue`, marca, contribuir                                                       | `plantilla/README.md`, `packages/*/README.md`, `marca/README.md`, `CONTRIBUTING.md`                                                                                                                                                                   |
| Decisiones                                                                                                     | Índice generado de `docs/adr/*.md` (número, título y estado) y una página por ADR                                                                                                                                                                     |
| API                                                                                                            | TypeDoc sobre `packages/core/src/index.ts` y `packages/vue/src/index.ts`, en `/api/`                                                                                                                                                                  |

Los enlaces se reescriben solos: a otro documento con página → su página (con el ancla de VitePress); a cualquier otro
archivo del repositorio → GitHub. El texto va en `<div v-pre>`: `{{ }}` y etiquetas se muestran tal cual.

La prueba `sitio/scripts/generar.test.mjs` falla si una página del plan no se genera, si una valla `ts demo` no llega a
su módulo, si queda un enlace relativo sin resolver, si una alternativa de la tabla del README no tiene sección en la
galería, si el índice no cubre todas las páginas o si un control enumerado de la ficha no coincide con la unión de
tipos de `packages/core/src/config.ts`.

## Convenciones para quien documenta

### Ejemplo vivo: ` ```ts demo `

Un bloque de código de primer nivel con la información `ts demo` (opcional `height=520`, 320 por defecto) se pinta en
vivo con `xilaplot` real y el tema del sitio, y su código queda debajo, plegado. En GitHub se ve como un bloque `ts`.
Es un módulo completo que exporta por defecto una función que devuelve `ChartConfig | Promise<ChartConfig>`; solo
importa de `xilaplot`, `xilaplot-vue`, `vue` y `./datos` (los ayudantes del CSV de CO₂, `sitio/demos/datos.ts`).
El generador lo escribe en `sitio/src/.demos/<página>-<n>.ts`, que `typecheck` compila con TypeScript estricto.

### Ficha interactiva: `<!-- ficha: line -->`

El comentario, en su propia línea, pinta la **prueba en vivo** del tipo (`line`, `bar`, `scatter`, `box`, `heatmap`,
`dots`, `waffle`): el gráfico real y su configuración como código donde cada valor enumerado es un botón que cicla
(Mayús + clic o las flechas, hacia atrás) y cada booleano una casilla; «Copiar» omite lo que está por defecto; tema de
la vista (página, claro, oscuro) y ancho (libre, teléfono); y qué lee del tema (paleta, superficie, tinta, letra). Los
controles salen de `sitio/live/controles.ts` y la base de cada tipo de `sitio/live/<tipo>.ts`; los valores por defecto,
de `DEFAULTS` de xilaplot. Hoy la lleva `docs/guia/tipos.md`.

## Marco

`sitio/.vitepress/theme/Layout.vue` con la API pública de VitePress (`Content`, `useData`, `useRoute`, `useRouter`,
`onContentUpdated`, `withBase`) y el módulo del índice de búsqueda local (`@localSearchIndex`, vigilado por la prueba del
generador). Sin `DefaultTheme`: de VitePress solo quedan los estilos de documento (`.vp-doc`).

- **Banda** de 64 px: marca (`marca/xila.svg` en línea, la última puntada en cobalto o hilo según el tema), secciones
  (Guía, Galería, Dashboards, Referencia, GitHub), «Buscar ⌘K», tema de dos estados (`data-theme` + la clase `dark` de
  VitePress; la preferencia es la de VitePress) y, bajo 48rem, la hamburguesa con la pantalla de menú.
- **Índice** (`Indice.vue`, 272 px desde 60rem; cajón `<dialog>` por debajo, abierto desde «Menú»): grupos Guía,
  Formas, Dashboards, Referencia y Proyecto; filtro con `/`; números al final de la fila en galería y decisiones.
- **Barra local** (bajo 80rem): «Menú» y «En esta página» plegada. **Columna** derecha desde 80rem; la activa se mide
  una sola vez para las dos instancias y la columna se sigue sola.
- **Búsqueda** (`Busqueda.vue`): `<dialog>` con MiniSearch sobre el índice de VitePress, 20 resultados con la ruta de
  títulos, ↑↓ ↵ esc, Ctrl/⌘ + ↵ en otra pestaña.
- **Foco:** al cambiar de ruta, al `h1`; «Saltar al contenido»; `/` al filtro (en la portada, a la búsqueda).
- **Cortes:** 320 px sin desplazamiento horizontal; ≥ 44 px lo pulsable con puntero grueso; `prefers-reduced-motion`
  apaga las transiciones; `forced-colors` subraya lo actual.

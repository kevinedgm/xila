# Auditoría del sitio de documentación (2026-11-09)

> **Marca 2.0 (misma fecha, segunda pasada).** El usuario cambió la identidad a la guía 2.0 («Primero la pregunta,
> después la gráfica»: la x en el rombo del huipil, el nombre en punto de cruz y un solo color, el añil `#16255C`
> sobre manta `#F4F1EA`; Familjen Grotesk 600 e Instrument Sans). Se aplicó a `marca/` (emblema por tamaños, nombre
> bordado, favicon que cambia con el esquema, icono, tarjeta de redes), al párrafo «Marca Xila» del README y al sitio
> (tokens, héroe añil con el nombre bordado como `h1`, Familjen Grotesk en títulos, cifras tabulares de Instrument
> Sans en los números). La pasada completa se repitió sobre el build nuevo: generador 8/8, typecheck, Playwright 7/7,
> 31/31 páginas y la verificación de abajo con los nuevos colores (contraste mínimo **6,06:1** en claro, añil medio
> sobre la superficie hundida, y **≥ 6,5:1** en oscuro). El tema por defecto de las gráficas (`xilaplot`, paleta
> Cobalto y Fraunces) **no** se tocó: alinearlo con la guía es una decisión de la librería (tokens, capturas de
> referencia y pruebas visuales), anotada como pendiente.

Sitio nuevo en `sitio/`: generado desde `README.md` y `docs/` (una sola fuente de verdad), vestido con la marca Xila
y con los gráficos reales de `xilaplot` en cada ejemplo. Auditado sobre el **build real** (`pnpm --filter sitio build`

- `vitepress preview` en el puerto 4300), en claro y en oscuro, a 1280, 375 y 320 px, con Chromium.

**Verificación propia:** `node sitio/scripts/auditoria-verificar.mjs --base http://localhost:4300/xila/` →
**90/90**. Además `pnpm --filter sitio test` (8/8 del generador), `pnpm --filter sitio typecheck` (TypeScript estricto
sobre los 28 ejemplos vivos, las 7 bases de la ficha y el tema), `pnpm --filter sitio test:e2e` (7/7 en Chromium) y
`node sitio/scripts/comprobar-paginas.mjs` (31/31 páginas: HTTP 200, consola limpia, todos los ejemplos dibujados, un
solo `h1`, sin desplazamiento horizontal).

## Auditoría previa (estructura)

| Aspecto      | Estado | Evidencia                                                                                                                                                                |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Estructura   | Cumple | Banda de 64 (marca, secciones, búsqueda, tema), índice de 272 a la izquierda desde 60rem, barra local bajo 80rem, documento de 688, columna «En esta página» desde 80rem |
| Jerarquía    | Cumple | Fraunces en títulos, Instrument Sans en texto, JetBrains Mono en cifras y números; títulos de grupo 700 sobre items 500 en `ink-2`; lo actual en cobalto                 |
| Delimitación | Cumple | Banda e índice con su línea; ejemplos sobre la «tela» (trama de puntadas) con borde de 1 px; nada flota sin relación con su sección                                      |
| Espaciado    | Cumple | Filas de 32 en índice y 30 en «En esta página»; 48 px entre columnas; secciones de la portada separadas por una línea                                                    |
| Controles    | Cumple | Filtro con `/`, búsqueda con ⌘K/Ctrl+K, tema con `aria-pressed`, hamburguesa con `aria-expanded`, cajón `<dialog>` modal                                                 |
| Tablas       | Cumple | Las del Markdown con cabecera en `bg-2` y líneas de 1 px; la de decisiones generada con número, estado y fecha                                                           |
| Estados      | Cumple | Hover, foco, actual, filtrando con recuento (`aria-live`), vacío del filtro, búsqueda cargando y sin resultados, ejemplo cargando y con error                            |
| Consistencia | Cumple | Todo con los tokens `--x-*` (manta, tinta, cobalto, hilo) y las variables de VitePress leyéndolos; sin valores sueltos salvo los de la marca en `:root`                  |

## Mediciones (después de implementar)

| Pieza                                                                                 | Claro              | Oscuro     | Mínimo |
| ------------------------------------------------------------------------------------- | ------------------ | ---------- | ------ |
| Banda · sección / actual / «Buscar»                                                   | 5,64 · 7,5+ · 5,26 | 6,78+      | 4,5    |
| Índice · item / actual / número                                                       | 5,26 · 6,5+ · 5,26 | 7+         | 4,5    |
| «En esta página» · item / activa                                                      | 5,64 · 6,5+        | 6,78       | 4,5    |
| Documento · párrafo / enlace                                                          | 15+ · 6,5+         | 15+ · 6,78 | 4,5    |
| Ficha · valor por defecto / cambiado / comentario / chips                             | ≥ 5,26             | ≥ 6,78     | 4,5    |
| Portada · pregunta, clásica, alternativa, detalle, clave, estado, ventaja, botón, pie | ≥ 5,64             | ≥ 6,11     | 4,5    |
| Puntada del actual (forma)                                                            | ≥ 6,5              | ≥ 6,78     | 3      |

- **Foco:** anillo de 2 px en cobalto, visible por teclado en banda, índice, columna, ficha y búsqueda (`:is(.x-shell)`
  gana a `button:focus-visible` de `base.css` de VitePress, que ponía `auto 4px`).
- **Tamaños táctiles** (375 px, puntero grueso): «Buscar», hamburguesa, «Menú», «En esta página», chips y valores de la
  ficha, «Código» de cada ejemplo e items del cajón, todos 44 px.
- **Sin desplazamiento horizontal** a 320 y 375 px en portada, galería, tipos, primer gráfico y documentación técnica.
  Bajo 300 px de ancho útil el lienzo de xilaplot no encoge más (mínimo del motor): el escenario lo recorta en vez de
  empujar la página.
- **Movimiento reducido:** ninguna transición en el marco con `prefers-reduced-motion`; el marco no anima nada propio
  salvo el color de la puntada y el chevron del plegado.
- **Consola** limpia en las 31 páginas con los 28 ejemplos vivos y las 7 fichas dibujadas.

## Hallazgos corregidos durante la auditoría

- **H1** `button:focus-visible` de VitePress (`auto 4px`) ganaba al anillo del sitio por especificidad → `:is`.
- **H2** Números del índice, comentario de la ficha y clave de la portada en `ink-3` daban 3,3:1 → `ink-2` (5,26:1).
- **H3** La rejilla de preguntas (`minmax(300px, 1fr)`) desbordaba a 320 px → `minmax(min(300px, 100%), 1fr)`.
- **H4** VitePress sangra los bloques de código 24 px en estrecho y el documento lleva 16: 8 px de desborde → margen de
  −16 px bajo 48rem.
- **H5** El lienzo de xilaplot (mínimo 300 px) empujaba la página a 320 px → `overflow: hidden` en el escenario y padding
  de 4 px bajo 360 px.
- **H6** «Código» de los ejemplos medía 28 px con puntero grueso → 44 px.
- **H7** La ficha interactiva confundía la prop `chart` con la instancia del gráfico (misma palabra en `<script setup>`)
  y escribía el objeto entero en el código → variable `instancia`.
- **H8** `vitepress preview` sirve la lista de archivos que había al arrancar: tras reconstruir hay que reiniciarlo
  (404 de los `assets` nuevos). Anotado en el flujo de verificación.

## Límites

- Solo Chromium; Firefox, WebKit, Safari real, táctil real, lector de pantalla y `forced-colors` reales: **No
  verificable** aquí.
- El tema oscuro de los gráficos sigue al del sitio con `chart.update({ theme })`; los ejemplos que declaren su propio
  `theme` no cambian (hoy ninguno lo hace).

## Cumplimientos / Correcciones / Pendientes

- **Cumplimientos:** una sola fuente de verdad (`README.md`, `docs/`, READMEs de paquetes, `marca/`, `plantilla/`,
  `CONTRIBUTING.md`, `docs/adr/`) con 31 páginas generadas; 28 ejemplos vivos con `xilaplot` real desde vallas
  ` ```ts demo ` del Markdown (galería de 26 con número estable, incluidos «Nudos con camino» y «Ranura de estado»,
  que faltaban); ficha interactiva «el código es el control» para los siete tipos; marco con la marca (puntada del
  actual, Fraunces, tela de puntadas), índice con filtro y números, «En esta página» que se sigue sola, búsqueda modal
  de texto completo, tema claro/oscuro compartido con los gráficos, teléfono con cajón y pantalla de menú; contraste,
  foco, tamaños, desbordes y movimiento reducido verificados; pruebas del generador, TypeScript estricto, Playwright y
  recorrido de páginas, todos en la integración continua de `docs.yml`.
- **Correcciones:** H1 a H8.
- **Pendientes:** alinear el tema por defecto de `xilaplot` (paleta, Fraunces → Familjen Grotesk en el título del
  hallazgo, «dato en añil y contexto en gris») con la guía de marca 2.0, con sus capturas de referencia; versión en inglés (el generador está preparado para `README.en.md` al lado del original, como el de
  Grana, pero no hay traducciones); casos de uso en la ficha (situaciones reales con su porqué, como en el sitio de
  Grana); tipos de los componentes `.vue` del tema con `vue-tsc` (hoy `tsc` cubre solo los `.ts`); verificación en
  Firefox y WebKit; entorno real (lector de pantalla, Safari, táctil).

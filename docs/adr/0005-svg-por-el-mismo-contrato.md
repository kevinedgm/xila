# ADR 0005 · SVG como backend de exportación, sobre el mismo contrato

**Estado:** aceptada · **Fecha:** 2026-10-19

## Contexto

Un PNG a 2x sirve para diapositivas, pero un informe impreso, una figura editable en Illustrator
o una web que escala el gráfico piden vectores. Un diseño externo proponía un "render tree"
intermedio (`Scene`) entre el gráfico y los backends, y un exportador que lo recorriera: 3 a 5
días solo para esa capa.

## Decisión

No hay capa nueva. El contrato `Renderer` (ADR 0002) ya es esa abstracción: el gráfico y los
plugins describen el dibujo en primitivas por lotes con la geometría resuelta. `SvgRenderer`
implementa ese contrato acumulando elementos en vez de pintar, y `Chart.toSvg()` dibuja una vez
sobre él (mismo `draw()`, mismos plugins) y restaura la pantalla. `chartToSvg` añade título,
leyenda y, si se pide, las fuentes de la marca incrustadas.

Dos excepciones van como `<image>` dentro del SVG: el heatmap de imagen (1 px por celda, sería un
rectángulo por celda) y las series de más de 5 000 puntos (un millón de círculos pesa decenas de
megas); ambas con `<desc>` para quien lea el archivo.

## Consecuencias

- Ninguna serie ni plugin cambió para exportar: lo que dibuja en pantalla sale en el SVG.
- La geometría es la misma que en Canvas (redondeo de reglas, esquinas de barra), así que el SVG
  rasterizado coincide con la captura del canvas salvo el antialias del texto (< 3 % de píxeles;
  `examples/tests/svg.spec.ts` lo comprueba por tipo).
- Las partes en HTML (tooltip, leyenda interactiva, controles de un plugin) no son canvas y
  tampoco salen en el SVG; igual que en el PNG, la leyenda se dibuja a mano encima.
- PDF y PNG vía SVG quedan fuera: el PNG ya sale del canvas y un PDF se hace con el SVG o el PNG.

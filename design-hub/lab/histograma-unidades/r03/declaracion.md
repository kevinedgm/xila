# Kiwi · histograma-unidades · r03 (enmienda estructural sobre F2 r02)

Fuente: `../r02/index.html` (F2 neutral, "Casos como unidades"). r03 no redibuja el F2: congela la
estructura de r02 y corrige solo defectos estructurales detectados en la revisión del 2026-10-18.
Los defectos de implementación (rendimiento, código muerto) no son de Kiwi y pasan a Coco.

## Estructura congelada (de r02)

- Encabezado: título + subtítulo (unidad · n · "cada punto es un caso") a la izquierda; control
  segmentado de 2 opciones (Casos sueltos / Agrupados) a la derecha. En compact (<600) se apila.
- Lectura viva sobre la gráfica: en reposo "n casos en total"; con selección "c casos (p %) entre a y b".
- Área de gráfica: un punto por caso. Sueltos = posición X por valor, Y con dispersión. Agrupados =
  cada punto se apila en la columna de su bin (la barra es una pila de casos).
- Cambio de modo = transición continua de cada punto (explica qué es una barra).
- Arrastrar sobre el área = seleccionar un rango en X y contar. Clic sin arrastre = limpiar.
- Pista de teclado bajo la gráfica.

## Enmiendas r03

| Id | Defecto en r02 | Decisión r03 |
|---|---|---|
| K-01 | ←/→ sin tope; la selección sale del rango de datos | La selección siempre queda dentro del dominio de datos; al llegar al borde se detiene |
| K-02 | Shift solo mueve el borde derecho; el izquierdo no es ajustable | ←/→ mueven; Shift+←/→ ajustan el borde derecho; Alt+←/→ ajustan el borde izquierdo; Esc limpia; Home/End llevan la selección al inicio/fin |
| K-03 | El control de rango vive dentro de un `svg role="img"` y queda oculto al lector | El control de rango es un elemento propio fuera de la imagen; la imagen conserva su descripción y la lectura viva es región `aria-live="polite"` |
| K-04 | En compact la columna más alta se sale del área en modo agrupado | La columna más alta siempre cabe: si no cabe con el tamaño mínimo de punto, cada punto pasa a representar k casos y la leyenda lo dice ("cada punto = k casos") |
| K-05 | En Agrupados la selección no respeta los bins (columnas a medias) | En Agrupados la selección se ajusta a bordes de bin; en Sueltos es continua |
| K-06 | Estado vacío / un solo valor no definidos | Vacío: "Sin casos para mostrar" y control deshabilitado. Un solo valor distinto: una sola columna centrada |

## Adaptación (layout modes del contrato adaptativo)

- compact <600: encabezado apilado; alto de gráfica 220; pista de teclado oculta (táctil); objetivo táctil del segmentado ≥44 px.
- medium 600–1023: encabezado en fila; alto 280.
- expanded ≥1024: alto 340.

## Estados requeridos

reposo · seleccionando (arrastre) · selección fija · modo sueltos · modo agrupados · transición · vacío · reduced-motion (sin transición, cambio instantáneo).

Siguiente dueño: lima.

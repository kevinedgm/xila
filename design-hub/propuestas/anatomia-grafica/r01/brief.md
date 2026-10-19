# Brief funcional · anatomia-grafica · r01

**Ruta:** R2 (rediseño A/B/C) · **Fidelidad:** F2 · **Fecha:** 2026-10-18
**Fuentes leídas:** objetivo del proyecto (topic), `examples/index.html` (13 gráficas), `examples/dashboard.html?config=co2/dashboard.json`, `packages/core/src/{chart,config,theme,plugin}.ts`, plugins (tooltip, legend, zoom-pan, annotations, accessibility, sync, brush), perfil lima `xila.md` (design_system NEW), F2 r02 "Casos como unidades", conversación con Kevin ("rediseñar los gráficos para hacerlos más modernos").

## Enunciado
Un científico o desarrollador que integra xilaplot necesita que cada gráfica comunique su hallazgo y permita explorarlo sin configuración extra, porque hoy las gráficas son correctas pero genéricas: leyenda en caja, rejilla completa, título descriptivo, controles fuera de la gráfica y ninguna lectura del valor actual (captura `actual/`).

## Pregunta de diseño
¿Qué **anatomía** de gráfica (qué piezas la rodean, en qué orden y con qué peso) permite **leer el hallazgo principal en ≤ 5 s** y **explorar sin perder el contexto**, igual en teléfono que en escritorio?

- **Verbo principal:** leer (y en segundo lugar, comparar/explorar).
- **Resultado verificable:** sin tocar nada, el lector puede decir cuál serie domina y cuánto vale hoy; con una interacción, puede obtener el valor exacto de un punto o un rango.
- **Dato dominante:** la forma de la serie principal y su último valor.

## Usuarios y permisos
| Usuario | Necesita | Permiso |
|---|---|---|
| Lector (paper, informe, panel) | Entender el hallazgo de un vistazo | Solo lectura |
| Analista (explora) | Valor exacto, rango, comparar series, zoom | Interactúa, no modifica datos |
| Desarrollador (integra) | Anatomía configurable sin CSS propio | Configura vía API |

## Estados
Carga (primer dibujo diferido) · vacío (sin filas / todas las series ocultas) · error (CSV inválido) · sin conexión (datos remotos) · contenido largo (títulos y nombres de serie largos, 7+ series) · serie con hueco · dato único.

## Flujo anterior / posterior
Anterior: el dashboard o la página cargan datos (CSV/JSON). Posterior: exportar PNG/CSV, compartir, citar la fuente.

## Riesgo por acción
| Acción | Tipo | Confirmación |
|---|---|---|
| Ocultar/mostrar serie | Reversible | Ninguna; el estado se ve en la leyenda |
| Zoom / pan / seleccionar rango | Reversible | Ninguna; "Restablecer" visible mientras hay zoom |
| Exportar PNG/CSV | Reversible | Ninguna; feedback de descarga |

## Continuidad
| Situación | Comportamiento |
|---|---|
| Conexión lenta | Esqueleto con la misma huella (título, área, eje) |
| Sin conexión | Datos ya cargados siguen operativos; aviso si son de caché |
| Error | Mensaje en el área de la gráfica con causa + Reintentar |
| Sesión reanudada | Conserva series ocultas y rango (si el integrador lo persiste) |
| Cambio de tamaño | Conserva selección, zoom y foco; recalcula etiquetas |

## Alcance MoSCoW
- **Must:** título, lectura del valor, identificación de series, ejes legibles, interacción de detalle, estados vacío/error/carga, compact/medium/expanded.
- **Should:** anotaciones, restablecer zoom, exportar, fuente de datos.
- **Could:** resumen numérico (KPI), mini-mapa de contexto, panel de estadísticos.
- **Won't (r01):** paleta, tipografía y movimiento definitivos (dependen de foundations, B-01); edición de datos.

## Hechos · Supuestos · Incógnitas
**Hechos:** xilaplot ya tiene tooltip, leyenda HTML, zoom/pan, anotaciones, accesibilidad, sincronía y brush; dibuja en Canvas/WebGL; el tema solo define palette/background/text/axis/grid/font.
**Supuestos (declarados):** el lector dominante varía por contexto (publicación, panel, exploración), por eso A/B/C representan una anatomía por contexto; contenido de ejemplo = emisiones de CO₂ (Our World in Data, ya en `examples/public/co2`).
**Incógnitas:** ¿cuál es el contexto primario de Xila (publicación científica, paneles, exploración)? Lo decide Kevin al elegir A/B/C. ¿Se espera un modo por defecto o los tres como "presets"?

# Declaración de cumplimiento · anatomia-grafica · r01

| Campo | Valor |
|---|---|
| Ruta | R2 (rediseño A/B/C) |
| Fidelidad | F2 (wireframe mid-fi, kit neutral) |
| Pregunta de diseño | ¿Qué anatomía de gráfica permite leer el hallazgo en ≤ 5 s y explorar sin perder contexto, igual en teléfono que en escritorio? |
| Artefactos | brief.md · index.html · declaracion.md · actual/*.png · capturas/*.png |
| Modifica producción | No |

## Estándares leídos
- Protocolo gobernanza-interfaz (SKILL.md).
- Kiwi: `references/brief-funcional.md`, `fidelidad.md`, `wireframing.md`, `validacion.md`; plantillas `brief.md`, `declaracion.md`; `assets/wireframe-kit.css`, `wireframe-base.html`.
- Perfil lima `xila.md` (design_system NEW → sin F3), breakpoints del contrato adaptativo (compact < 600, medium 600–1023, expanded ≥ 1024).
- WCAG 2.2 AA (foco, teclado, objetivos, no depender del color).
- `references/hig-web-pwa.md`: **no leído en esta ronda** (ver desviaciones).

## Desviaciones del protocolo
- Sin preguntas funcionales previas: la incógnita principal (contexto primario de Xila: publicación, panel o exploración) es justamente lo que A/B/C ponen a decidir; se declaró como supuesto en el brief.
- No se usó el shell con navegación lateral de `wireframe-base.html`: la superficie es un componente (la gráfica), no una pantalla con destinos.
- `hig-web-pwa.md` no se consultó; la ronda no define navegación ni controles de plataforma. Debe leerse antes de F3.

## Comprobaciones ejecutadas
- check_artifact.py: ✔ 0 errores · 0 avisos.
- Navegador (Chromium headless; 1440 / 834 / 393): 0 errores JS · 0 desborde horizontal del marco, en default, detalle, carga, vacío, error, sin conexión y contenido largo (63 combinaciones: 3 propuestas × 3 anchos × 7 estados).
- Una sola acción primaria visible por vista: ✔ en todos los estados.
- Objetivos ≥ 44 px en compact: ✔ en los estados carga/vacío/error/sin conexión/largo (automático); default revisado en captura.
- Teclado/foco: chips de B operables con Enter (automático); foco visible por el kit.
- Estados representados: default, detalle (cursor/toque), carga, vacío, error, sin conexión, contenido largo.

## Matriz de adaptación
| Elemento | compact | medium | expanded | Motivo | Técnica | Foco/estado |
|---|---|---|---|---|---|---|
| A · etiquetas directas | 3 mayores + resto al pie | todas | todas | evitar choque | recorte + pie | n/a |
| A · anotación | oculta | visible | visible | sin espacio | condición de ancho | n/a |
| B · chips de series | una fila con scroll horizontal | envuelven | envuelven | conservar orden | overflow-x | aria-pressed se conserva |
| B · rango rápido | ancho completo, 44 px | en línea | en línea | objetivo táctil | flex | se conserva |
| C · panel de estadísticos | hoja inferior (botón con resumen) | debajo de la gráfica | columna lateral 300 px | ancho útil del área | grid + container query | rango seleccionado se conserva |
| C · minimapa | visible (56 px) | visible | visible | contexto | — | ventana se conserva |

## Comprobaciones NO ejecutadas
- Lector de pantalla real (VoiceOver/NVDA).
- Texto ampliado al 200 % y tema oscuro (no aplica tema en F2; el zoom sí debió probarse).
- Datos de 7+ series y series con hueco (la galería real los tiene; aquí solo 5 series sin huecos).
- Localización a otro idioma (+30 % de texto) y RTL.
- Verificación en dispositivo táctil físico.
- Prueba con usuarios de la regla de "5 s".

## Hallazgos
| # | Severidad | Hallazgo | Decisión | Responsable | Siguiente acción |
|---|---|---|---|---|---|
| H1 | Media | En A compact, la etiqueta del eje "4,000" queda bajo la línea de EE. UU. | Aceptar en F2; en F3 el eje interno necesita halo/fondo | coco | Resolver en F3 |
| H2 | Media | xilaplot no tiene hoy: etiquetas directas (A), chips de leyenda que filtran con rango rápido (B), minimapa overview+detalle (C) | Son las piezas nuevas que implica cada alternativa | lima | Clasificar al elegir |
| H3 | Baja | B usa ⋯ para exportar: descubribilidad menor | Aceptar; exportar es secundario en un panel | kiwi | Revisar si se elige B |
| H4 | Alta | Sin foundations aprobados no hay F3 (B-01) | Detenerse en F2 | lima / Kevin | Aprobar foundations |

## Traspaso
- **→ coco:** nada hasta elegir dirección y aprobar foundations.
- **→ lima:** al elegir, clasificar piezas: A → plugin `directLabels` + anotaciones existentes; B → `legendPlugin` modo chips + rangos rápidos + KPI; C → plugin `overview` (reutiliza brush/zoom-pan) + panel de estadísticos.
- **→ mora:** nada.

## Siguiente paso del usuario
Elegir A, B o C (o una combinación explícita por contexto: p. ej. A como predeterminado y C como preset de exploración) · aprobar foundations para pasar a F3.

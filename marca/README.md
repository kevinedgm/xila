# Marca Xila

Guía de marca 2.0 (2026-11-09). **Primero la pregunta, después la gráfica.** Xila borda los datos: el emblema es
la x de Xila dentro del rombo del huipil, y el centro, en otro tono, es el dato, la misma regla que siguen sus
gráficas, donde solo lo que importa va en color. El nombre se escribe en punto de cruz y el punto de la i también
es el dato. Fuente de verdad: la guía de identidad; aquí viven los archivos que usan el README, el sitio y la
plantilla.

## Archivos

| Archivo                                    | Uso                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `emblema.svg`                              | Emblema grande (9 × 9 puntadas), desde 64 px, sobre fondos claros: tableta añil con la x en manta |
| `emblema-mediano.svg`, `emblema-chico.svg` | Los mismos elementos con menos puntadas y más gruesas: de 32 a 48 px y de 20 a 28 px              |
| `*-oscuro.svg`                             | Las versiones para fondos oscuros o de color: tableta manta con la x en añil                      |
| `favicon.svg`                              | A 16 px: una sola x gruesa con el dato en el centro; cambia solo con `prefers-color-scheme`       |
| `xila-claro.svg`, `xila-oscuro.svg`        | Nombre bordado con el emblema, colores fijos, para `<img>` y `<picture>` (claro = sobre manta)    |
| `xila.svg`                                 | El mismo nombre con el texto en `currentColor` y el dato en `--xila-dato`, para ir en línea       |
| `icono.svg`, `avatar.svg`                  | Icono de app (512) y avatar (GitHub, npm): el emblema grande en su tableta                        |
| `tarjeta-redes.png`                        | Vista previa para enlaces y redes, 1200 × 630                                                     |

## Un dibujo por tamaño

Un emblema de 9 × 9 puntadas no se lee a 16 px: cada puntada mediría 1,5 px. Por eso hay cuatro dibujos con las
mismas piezas; conforme baja el tamaño quedan menos puntadas y más gruesas, y cada uno se usa solo en su rango:
grande desde 64 px, mediano de 32 a 48, chico de 20 a 28 y el favicon a 16. Sobre fondos oscuros o de color va la
versión `-oscuro` (tableta manta).

## El nombre

«xila» siempre va bordado en punto de cruz; nunca se escribe con una fuente. Desde 24 px de alto; más chico, se usa
el emblema con «xila» en Familjen Grotesk al lado.

## Color: añil

Un solo tinte en varias intensidades sobre manta. Contrastes medidos con la fórmula WCAG.

| Nombre     | Valor     | Uso                                                                    |
| ---------- | --------- | ---------------------------------------------------------------------- |
| Añil       | `#16255C` | marca, fondo del emblema, el dato en las gráficas; 12,8:1 sobre manta  |
| Añil medio | `#2F4FA8` | rombo del emblema claro, enlaces, cambios positivos; 6,6:1 sobre manta |
| Añil claro | `#7FA0E0` | rombo del emblema y punto de la i sobre añil; 5,5:1 sobre añil         |
| Añil bruma | `#C9D6F2` | texto secundario sobre añil; 9,9:1                                     |
| Manta      | `#F4F1EA` | fondo claro y la x del emblema                                         |
| Texto 2    | `#4A5274` | texto secundario sobre manta; 6,8:1                                    |
| Contexto   | `#C4C6CF` | series de contexto en las gráficas (gris)                              |

En las gráficas, el dato que importa va en añil y el resto en gris: la misma regla que el centro del emblema.

## Tipografía

- **Primaria · Familjen Grotesk 600:** el lema, los títulos de sección y el título de cada gráfica, que dice el
  hallazgo.
- **Secundaria · Instrument Sans 400 y 600:** texto, ejes, etiquetas, tablas y botones, con cifras tabulares.

## Reglas

- Desde 64 px el emblema grande; de 32 a 48 el mediano; de 20 a 28 el chico; a 16 px el favicon. No se escala el
  grande a 16 px.
- El rombo no cambia de color; el emblema añil no va sobre añil (ahí va el claro, de manta).
- El nombre no se escribe con una fuente.
- La metáfora textil va en la marca; los botones y mensajes hablan claro («Quitar filtros»).

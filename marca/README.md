# Marca Xila 2.0

La x de Xila bordada dentro del rombo del huipil; el centro, en añil claro, es el dato. Es la misma
regla que siguen las gráficas: solo lo que importa va en color. El nombre se escribe en punto de cruz
y el punto de la i también es el dato. Color: añil. Letra: Familjen Grotesk (lema y títulos) e
Instrument Sans (texto). Aprobada el 2026-11-09; reemplaza a la greca de Mitla.

## Un dibujo por tamaño

Un emblema de 9 × 9 puntadas no se lee a 16 px (cada puntada mediría 1.5 px). Hay cuatro dibujos con
las mismas piezas; cada uno se usa solo en su rango.

| Archivo                               | Tamaño      |
| ------------------------------------- | ----------- |
| `simbolo.svg` (y `simbolo-claro.svg`) | 64 px o más |
| `simbolo-mediano.svg`                 | 32 a 48 px  |
| `simbolo-chico.svg`                   | 20 a 28 px  |
| `simbolo-favicon.svg`, `favicon.svg`  | 16 px       |

Las versiones `-oscuro` son el emblema claro (manta), para fondos oscuros o de color.

## Otros archivos

| Archivo                                  | Uso                                                       |
| ---------------------------------------- | --------------------------------------------------------- |
| `xila-claro.svg`, `xila-oscuro.svg`      | Emblema + nombre bordado, para `<img>` y `<picture>`      |
| `xila.svg`                               | Igual que `xila-claro.svg` (colores fijos)                |
| `nombre.svg`, `nombre-oscuro.svg`        | Solo el nombre bordado                                    |
| `favicon.svg`                            | Favicon de 16 px; cambia solo con el tema del sistema     |
| `icono.svg`, `avatar.svg`                | Icono de app y avatar redondo (GitHub, npm)               |
| `tarjeta-redes.svg`, `tarjeta-redes.png` | Vista previa de enlaces, 1200 × 630                       |
| `tema.json`                              | Colores con su contraste, tipografía y reglas de la marca |

## Reglas

- El nombre siempre va bordado; nunca se escribe «xila» con una fuente como logotipo. Desde 24 px de
  alto; más chico, el símbolo con el texto al lado.
- Cada dibujo del símbolo solo en su rango; no se escala uno para cubrir otro.
- Sobre fondos oscuros o de color se usa el emblema claro.
- Añil `#16255C`, añil medio `#2F4FA8` (6.6:1 sobre manta), añil claro `#7FA0E0` (5.5:1 sobre añil),
  manta `#F4F1EA`.

La paleta de las gráficas (`packages/core/src/theme.ts`, `.fruti/tokens.json`) no cambia con esta
marca: el cobalto sigue siendo el color por defecto de la librería.

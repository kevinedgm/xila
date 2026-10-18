# ADR 0003 · Coordenadas relativas en float64 para la GPU

**Estado:** aceptada · **Fecha:** 2026-10-18

## Contexto

El renderer WebGL (E6.08) recibirá los datos en buffers float32: 24 bits de mantisa. Un
timestamp de hoy en milisegundos (≈1.7×10¹²) solo se representa en saltos de 2¹⁷ = 131 072 ms,
unos dos minutos. Una señal medida cada milisegundo colapsa en un solo valor: 5 000 lecturas a
1 kHz convertidas a float32 dan **un único** número (`relative.test.ts`), y la línea se vería
como escalones de dos minutos. En Canvas no pasa porque `applyMap` corre en la CPU en float64.

## Decisión

1. Las escalas siguen trabajando en float64 en la CPU. `LinearMap` ya tiene la forma
   `base + (value − offset) · scale`: `offset` es el origen.
2. Al subir datos a la GPU se envía `value − origin` (`toRelativeFloat32`), con `origin` el
   inicio del dominio visible. Las diferencias son pequeñas y caben en float32 sin error
   apreciable: para una ventana de 1 s en ms, el error es menor a 10⁻⁴ ms.
3. El origen no se recalcula en cada fotograma, solo cuando `originNeedsReset` dice que el
   error de float32 en los extremos de la ventana supera la tolerancia (medio ULP de la
   distancia al origen, comparado con la resolución de los datos). Con pan corto, el buffer se
   reutiliza; con pan largo, se vuelve a subir.
4. Lo mismo aplica a Y cuando los valores son grandes y parecidos (10⁹ ± 1).

## Consecuencias

- El shader recibe `offset` y `scale` como uniformes y los datos relativos como atributos; la
  multiplicación en float32 es exacta de sobra porque los relativos son pequeños.
- Cambiar de origen cuesta volver a llenar el buffer (una pasada sobre los puntos visibles), lo
  cual es raro: solo tras un desplazamiento mayor al rango que float32 representa con
  precisión.
- El criterio de aceptación (serie a 1 kHz sin escalones con zoom máximo) se verifica con el
  test visual de WebGL en E6.08; aquí queda el mecanismo y sus pruebas numéricas.

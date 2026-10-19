"""Datos de la ranura de estado: canciones por género y ganancia de una panadería.

    python3 python/ejemplo_ranura.py    # escribe examples/public/ranura/*.csv

Los dos conjuntos son sintéticos con semilla fija (el CSV real de Spotify todavía no está
disponible) y tienen la forma que la ranura necesita: formato largo, una fila por grupo y
periodo, y el margen de evidencia calculado aquí, no en el componente.

- canciones.csv: `genero`, `anio`, `segundos` (duración media), `low`/`high` (intervalo del
  95 % con σ y n) y `n` (canciones de ese año). 2026 llega hasta junio: es el año parcial.
- panaderia.csv: `tienda`, `anio`, `ganancia` (2023 y 2024), `low`/`high` (bootstrap de los
  pedidos de 2024), `pedidos` y `por_pedido` (ganancia media por pedido), para descomponer la
  causa. La fila "Total" suma las tres tiendas.
- panaderia-meses.csv: `mes`, `ventaja` (ventaja acumulada de 2024 sobre 2023 en %), la tira
  que acompaña a la ranura cuando la meta es acumulativa.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DESTINO = Path(__file__).resolve().parent.parent / "examples" / "public" / "ranura"


def canciones(rng: np.random.Generator) -> pd.DataFrame:
    # Duración típica por género (segundos) y cuánto se ha ido acortando por año.
    generos = {
        "Pop": (215, -2.5),
        "Hip hop": (205, -3.0),
        "R&B": (228, -1.5),
        "Rock": (235, -0.5),
        "Electrónica": (210, -1.0),
        "Latina": (222, -2.0),
        "Country": (218, 0.5),
        "Indie": (226, -1.0),
    }
    filas = []
    for genero, (base, pendiente) in generos.items():
        # Rock, Country e Indie todavía no tienen datos de 2026: su "hoy" es 2025, completo.
        ultimo = 2025 if genero in ("Rock", "Country", "Indie") else 2026
        for anio in range(2018, ultimo + 1):
            n = int(rng.integers(90, 240)) if anio < 2026 else int(rng.integers(35, 60))
            media = base + pendiente * (anio - 2018) + rng.normal(0, 3)
            # R&B se acortó de golpe en 2026 (sale con claridad); Pop toca el borde (posible).
            if genero == "R&B" and anio == 2026:
                media -= 28
            if genero == "Pop" and anio == 2026:
                media -= 9
            muestra = rng.normal(media, 38, n)
            m = muestra.mean()
            err = 1.96 * muestra.std(ddof=1) / np.sqrt(n)
            filas.append(
                {
                    "genero": genero,
                    "anio": anio,
                    "segundos": round(float(m), 1),
                    "low": round(float(m - err), 1),
                    "high": round(float(m + err), 1),
                    "n": n,
                }
            )
    return pd.DataFrame(filas)


def panaderia(rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame]:
    tiendas = {"Centro": (1.06, 1.03), "Norte": (1.0, 1.0), "Sur": (1.12, 0.99)}
    base_pedidos = {"Centro": 4200, "Norte": 2600, "Sur": 1900}
    filas = []
    pedidos_por_mes: dict[int, list[np.ndarray]] = {2023: [], 2024: []}
    total = {2023: 0.0, 2024: 0.0}
    total_pedidos = {2023: 0, 2024: 0}
    for tienda, (f_pedidos, f_margen) in tiendas.items():
        por_anio = {}
        for anio in (2023, 2024):
            n = int(base_pedidos[tienda] * (f_pedidos if anio == 2024 else 1.0))
            margen = 38.0 * (f_margen if anio == 2024 else 1.0)
            # Ganancia por pedido: lognormal con media `margen`; por mes, para la tira acumulada.
            mes = rng.integers(1, 13, n)
            ganancia = rng.lognormal(np.log(margen) - 0.08, 0.4, n)
            por_anio[anio] = (ganancia, mes)
            pedidos_por_mes[anio].append(np.bincount(mes, weights=ganancia, minlength=13))
            total[anio] += float(ganancia.sum())
            total_pedidos[anio] += n
        g23, _ = por_anio[2023]
        g24, _ = por_anio[2024]
        if tienda == "Norte":
            # Norte quedó casi igual que 2023: su margen cruza el 0 y la ranura dice "no concluyente".
            g24 = g24 * (0.995 * g23.sum() / g24.sum())
            por_anio[2024] = (g24, por_anio[2024][1])
        # Bootstrap de los pedidos de 2024: incertidumbre de la ganancia anual.
        boots = [rng.choice(g24, len(g24), replace=True).sum() for _ in range(400)]
        lo, hi = np.percentile(boots, [2.5, 97.5])
        for anio, g in ((2023, g23), (2024, g24)):
            filas.append(
                {
                    "tienda": tienda,
                    "anio": anio,
                    "ganancia": round(float(g.sum())),
                    "low": round(float(lo)) if anio == 2024 else None,
                    "high": round(float(hi)) if anio == 2024 else None,
                    "pedidos": len(g),
                    "por_pedido": round(float(g.mean()), 2),
                }
            )
    # Total: suma de tiendas; su margen, la suma de los márgenes (aproximación conservadora).
    low = sum(f["low"] for f in filas if f["anio"] == 2024)
    high = sum(f["high"] for f in filas if f["anio"] == 2024)
    for anio in (2023, 2024):
        filas.append(
            {
                "tienda": "Total",
                "anio": anio,
                "ganancia": round(total[anio]),
                "low": low if anio == 2024 else None,
                "high": high if anio == 2024 else None,
                "pedidos": total_pedidos[anio],
                "por_pedido": round(total[anio] / total_pedidos[anio], 2),
            }
        )
    df = pd.DataFrame(filas)
    df = pd.concat([df[df.tienda == "Total"], df[df.tienda != "Total"]], ignore_index=True)
    # Ventaja acumulada mes a mes: 2024 contra 2023 hasta ese mes, en %.
    m23 = np.sum(pedidos_por_mes[2023], axis=0)[1:].cumsum()
    m24 = np.sum(pedidos_por_mes[2024], axis=0)[1:].cumsum()
    meses = pd.DataFrame(
        {
            "mes": [f"2024-{m:02d}-01" for m in range(1, 13)],
            "ventaja": np.round((m24 / m23 - 1) * 100, 1),
        }
    )
    return df, meses


def main() -> None:
    rng = np.random.default_rng(7)
    DESTINO.mkdir(parents=True, exist_ok=True)
    canciones(rng).to_csv(DESTINO / "canciones.csv", index=False)
    df, meses = panaderia(rng)
    df.to_csv(DESTINO / "panaderia.csv", index=False)
    meses.to_csv(DESTINO / "panaderia-meses.csv", index=False)
    print(f"Escritos en {DESTINO}")


if __name__ == "__main__":
    main()

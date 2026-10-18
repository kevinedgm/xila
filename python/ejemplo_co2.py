"""Ejemplo de punta a punta con datos públicos reales: emisiones de CO₂ (Our World in Data).

    python3 python/ejemplo_co2.py          # escribe examples/public/co2/data/co2.csv

Hace lo que haría el notebook de un cliente: descarga, limpia en pandas, deja la tabla en
formato largo y la exporta con ``exportar_xila``. El ``dashboard.json`` que la consume está
en ``examples/public/co2/`` y no tiene una línea de código.

Fuente: https://github.com/owid/co2-data (CC BY 4.0).
"""

from __future__ import annotations

import sys
import tempfile
import urllib.request
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from xila_export import exportar_xila  # noqa: E402

URL = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv"
PAISES = ["Mexico", "Brazil", "United States", "China", "Germany", "India", "Spain"]
DESDE = 1950
DESTINO = Path(__file__).resolve().parents[1] / "examples" / "public" / "co2" / "data"


def descargar() -> Path:
    cache = Path(tempfile.gettempdir()) / "owid-co2-data.csv"
    if not cache.exists():
        print(f"Descargando {URL} …")
        urllib.request.urlretrieve(URL, cache)
    return cache


def limpiar(ruta: Path) -> pd.DataFrame:
    usar = ["country", "year", "co2", "co2_per_capita", "population", "gdp", "share_global_co2"]
    df = pd.read_csv(ruta, usecols=usar)
    df = df[df["country"].isin(PAISES) & (df["year"] >= DESDE)].copy()
    # Un eje de tiempo necesita fechas: el año se vuelve el 1 de enero.
    df["fecha"] = pd.to_datetime(df["year"].astype(str) + "-01-01")
    df["pib_per_capita"] = df["gdp"] / df["population"]
    df = df.rename(
        columns={
            "country": "pais",
            "co2": "co2_mt",
            "co2_per_capita": "co2_t_por_persona",
            "population": "poblacion",
            "share_global_co2": "porcentaje_global",
        }
    )
    traducir = {"Mexico": "México", "Brazil": "Brasil", "United States": "Estados Unidos",
                "Germany": "Alemania", "Spain": "España"}
    df["pais"] = df["pais"].replace(traducir)
    columnas = ["fecha", "pais", "co2_mt", "co2_t_por_persona", "porcentaje_global", "poblacion", "pib_per_capita"]
    return df[columnas].sort_values(["pais", "fecha"]).reset_index(drop=True)


if __name__ == "__main__":
    tabla = limpiar(descargar())
    print(tabla.head())
    exportar_xila(tabla, "co2", carpeta=DESTINO)

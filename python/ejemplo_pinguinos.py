"""Ejemplo sin eje de tiempo: pingüinos del archipiélago Palmer (Antártida), 2007–2009.

    python3 python/ejemplo_pinguinos.py    # escribe examples/public/pinguinos/data/pinguinos.csv

Otra forma de datos que el CO₂ y el clima: 333 individuos medidos, cada uno con especie,
isla y sexo (categorías) y cuatro medidas. Sirve para comparar grupos y ver relaciones
entre medidas, no evolución en el tiempo.

Fuente: palmerpenguins (Gorman, Williams y Fraser 2014; CC0):
https://github.com/allisonhorst/palmerpenguins
"""

from __future__ import annotations

import sys
import tempfile
import urllib.request
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from xila_export import exportar_xila  # noqa: E402

URL = "https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv"
DESTINO = Path(__file__).resolve().parents[1] / "examples" / "public" / "pinguinos" / "data"


def descargar() -> Path:
    cache = Path(tempfile.gettempdir()) / "palmerpenguins.csv"
    if not cache.exists():
        print(f"Descargando {URL} …")
        urllib.request.urlretrieve(URL, cache)
    return cache


def limpiar(ruta: Path) -> pd.DataFrame:
    df = pd.read_csv(ruta)
    # 11 individuos sin sexo o sin medidas: fuera, para que el filtro de sexo no tenga un hueco.
    df = df.dropna().copy()
    df = df.rename(
        columns={
            "species": "especie",
            "island": "isla",
            "bill_length_mm": "pico_largo_mm",
            "bill_depth_mm": "pico_alto_mm",
            "flipper_length_mm": "aleta_mm",
            "body_mass_g": "masa_g",
            "sex": "sexo",
        }
    )
    df["especie"] = df["especie"].replace({"Adelie": "Adelia", "Chinstrap": "Barbijo", "Gentoo": "Papúa"})
    df["sexo"] = df["sexo"].replace({"male": "macho", "female": "hembra"})
    columnas = ["especie", "isla", "sexo", "pico_largo_mm", "pico_alto_mm", "aleta_mm", "masa_g"]
    return df[columnas].sort_values(["especie", "isla"]).reset_index(drop=True)


if __name__ == "__main__":
    tabla = limpiar(descargar())
    print(tabla.head())
    exportar_xila(tabla, "pinguinos", carpeta=DESTINO)

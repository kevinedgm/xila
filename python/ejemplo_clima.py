"""Ejemplo con datos diarios públicos: clima de Seattle y Nueva York, 2012–2015.

    python3 python/ejemplo_clima.py        # escribe examples/public/clima/data/*.csv

Otra forma de datos que la muestra de CO₂: una fila por ciudad y día (2,922 filas), con una
categoría de tipo de día (sol, lluvia, niebla…). Se exportan dos tablas:

- ``clima.csv``: diaria, para distribuciones y series.
- ``clima_mensual.csv``: promedio y total por ciudad y mes, para las trayectorias y la tabla
  mensual (con datos diarios el camino de cada ciudad sería una maraña).

Fuente: vega-datasets ``weather.csv`` (NOAA, dominio público):
https://github.com/vega/vega-datasets
"""

from __future__ import annotations

import sys
import tempfile
import urllib.request
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from xila_export import exportar_xila  # noqa: E402

URL = "https://raw.githubusercontent.com/vega/vega-datasets/main/data/weather.csv"
DESTINO = Path(__file__).resolve().parents[1] / "examples" / "public" / "clima" / "data"
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
TIEMPO = {"sun": "sol", "rain": "lluvia", "drizzle": "llovizna", "fog": "niebla", "snow": "nieve"}


def descargar() -> Path:
    cache = Path(tempfile.gettempdir()) / "vega-weather.csv"
    if not cache.exists():
        print(f"Descargando {URL} …")
        urllib.request.urlretrieve(URL, cache)
    return cache


def limpiar(ruta: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(ruta, parse_dates=["date"])
    df = df.rename(
        columns={
            "location": "ciudad",
            "date": "fecha",
            "precipitation": "lluvia_mm",
            "temp_max": "temp_max_c",
            "temp_min": "temp_min_c",
            "wind": "viento_ms",
            "weather": "tiempo",
        }
    )
    df["ciudad"] = df["ciudad"].replace({"New York": "Nueva York"})
    df["tiempo"] = df["tiempo"].map(TIEMPO)
    df["oscilacion_c"] = (df["temp_max_c"] - df["temp_min_c"]).round(1)
    # Mes como categoría, en orden de calendario: el CSV va ordenado por fecha y el lector
    # conserva el orden de aparición.
    df["mes"] = df["fecha"].dt.month.map(lambda m: MESES[m - 1])
    df = df.sort_values(["fecha", "ciudad"]).reset_index(drop=True)
    diario = df[
        ["fecha", "ciudad", "mes", "tiempo", "temp_max_c", "temp_min_c", "oscilacion_c", "lluvia_mm", "viento_ms"]
    ]

    mensual = (
        df.groupby(["ciudad", pd.Grouper(key="fecha", freq="MS")])
        .agg(
            temp_max_c=("temp_max_c", "mean"),
            lluvia_mm=("lluvia_mm", "sum"),
            dias_con_lluvia=("lluvia_mm", lambda s: int((s > 0).sum())),
        )
        .reset_index()
        .sort_values(["fecha", "ciudad"])
    )
    mensual[["temp_max_c", "lluvia_mm"]] = mensual[["temp_max_c", "lluvia_mm"]].round(1)
    mensual["mes"] = mensual["fecha"].dt.month.map(lambda m: MESES[m - 1])
    mensual = mensual[["fecha", "ciudad", "mes", "temp_max_c", "lluvia_mm", "dias_con_lluvia"]]
    return diario, mensual.reset_index(drop=True)


if __name__ == "__main__":
    diario, mensual = limpiar(descargar())
    print(diario.head())
    exportar_xila(diario, "clima", carpeta=DESTINO)
    exportar_xila(mensual, "clima_mensual", carpeta=DESTINO)

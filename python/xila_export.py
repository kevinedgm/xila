"""El lado Python del contrato de CSV (docs/contrato-csv.md).

Se usa al final de cada notebook de limpieza:

    from xila_export import exportar_xila
    exportar_xila(df, "ventas")            # escribe data/ventas.csv

Valida antes de escribir, para que los errores salgan en tu máquina y no frente al cliente:
nombres en snake_case y únicos, fechas que se puedan convertir a ISO 8601, columnas sin
tipos mezclados (números con texto) y sin índices sueltos. Lo que no cumpla lanza
``ContratoError`` con el nombre de la columna y ejemplos de los valores que fallan.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import pandas as pd

__all__ = ["ContratoError", "a_snake_case", "validar_xila", "exportar_xila"]


class ContratoError(ValueError):
    """El DataFrame no cumple el contrato de CSV de Xila."""


_SNAKE = re.compile(r"^[a-z][a-z0-9_]*$")


def a_snake_case(nombre: str) -> str:
    """'Monto Total (MXN)' -> 'monto_total_mxn'; quita acentos y símbolos."""
    s = unicodedata.normalize("NFKD", str(nombre)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^0-9a-zA-Z]+", "_", s).strip("_").lower()
    s = re.sub(r"_+", "_", s)
    if not s:
        raise ContratoError(f"La columna {nombre!r} queda vacía al pasarla a snake_case")
    if s[0].isdigit():
        s = f"c_{s}"
    return s


def _ejemplos(serie: pd.Series, mascara: pd.Series, n: int = 3) -> str:
    malos = serie[mascara]
    muestra = ", ".join(repr(v) for v in malos.head(n).tolist())
    extra = f" y {len(malos) - n} más" if len(malos) > n else ""
    return f"{muestra}{extra} (filas {', '.join(str(i) for i in malos.index[:n])})"


def validar_xila(df: pd.DataFrame, fechas: list[str] | None = None) -> pd.DataFrame:
    """Devuelve una copia lista para escribir, o lanza ``ContratoError``.

    ``fechas``: columnas que deben tratarse como fecha aunque vengan como texto.
    Las columnas ya ``datetime`` se detectan solas.
    """
    if df.empty:
        raise ContratoError("El DataFrame está vacío")
    out = df.reset_index(drop=True).copy()

    # 1. Nombres: snake_case, únicos y sin columnas sin nombre (típico de `index=True`).
    nuevos = [a_snake_case(c) for c in out.columns]
    if any(c.startswith("unnamed") for c in nuevos):
        raise ContratoError("Hay columnas 'Unnamed': quita el índice antes de exportar")
    repetidos = {c for c in nuevos if nuevos.count(c) > 1}
    if repetidos:
        raise ContratoError(f"Nombres repetidos tras pasar a snake_case: {sorted(repetidos)}")
    out.columns = nuevos
    fechas = [a_snake_case(f) for f in (fechas or [])]

    for col in out.columns:
        serie = out[col]
        # 2. Fechas: a ISO 8601 en UTC. Texto que no parsea es error, no NaT silencioso.
        if col in fechas or pd.api.types.is_datetime64_any_dtype(serie):
            if not pd.api.types.is_datetime64_any_dtype(serie):
                convertida = pd.to_datetime(serie, errors="coerce", utc=True)
                mal = convertida.isna() & serie.notna() & (serie.astype(str).str.strip() != "")
                if mal.any():
                    raise ContratoError(
                        f'La columna "{col}" tiene fechas que no se entienden: {_ejemplos(serie, mal)}'
                    )
                serie = convertida
            elif getattr(serie.dt, "tz", None) is not None:
                serie = serie.dt.tz_convert("UTC")
            else:
                # Sin zona: se asume UTC, igual que hace el lector de Xila.
                serie = serie.dt.tz_localize("UTC")
            solo_fecha = ((serie.dt.hour == 0) & (serie.dt.minute == 0) & (serie.dt.second == 0)).all()
            fmt = "%Y-%m-%d" if solo_fecha else "%Y-%m-%dT%H:%M:%SZ"
            out[col] = serie.dt.strftime(fmt)
            continue

        # 3. Números: no se mezclan con texto. Un '$1,200' o 'N/A' colado es error.
        if pd.api.types.is_numeric_dtype(serie) or pd.api.types.is_bool_dtype(serie):
            if pd.api.types.is_bool_dtype(serie):
                out[col] = serie.astype("float")
            continue
        if serie.dtype == object or pd.api.types.is_string_dtype(serie):
            texto = serie.dropna().astype(str).str.strip()
            texto = texto[texto != ""]
            if texto.empty:
                continue
            como_num = pd.to_numeric(texto, errors="coerce")
            parece_numero = como_num.notna()
            if parece_numero.any() and not parece_numero.all():
                mal = pd.Series(False, index=serie.index)
                mal.loc[texto.index[~parece_numero]] = True
                raise ContratoError(
                    f'La columna "{col}" mezcla números y texto: {_ejemplos(serie, mal)}. '
                    "Limpia los valores o conviértela toda a texto con .astype(str)."
                )
            # Un cero a la izquierda ("01000") delata un código postal o clave: se queda como texto.
            if parece_numero.all() and not texto.str.match(r"^-?0\d").any():
                out[col] = pd.to_numeric(serie, errors="coerce")
            else:
                # Categoría: sin espacios alrededor, que el lector compara texto exacto.
                out[col] = serie.where(serie.isna(), serie.astype(str).str.strip())
            continue
        if isinstance(serie.dtype, pd.CategoricalDtype):
            out[col] = serie.astype(str).where(serie.notna(), None)
            continue
        raise ContratoError(f'La columna "{col}" tiene un tipo que el contrato no cubre: {serie.dtype}')

    return out


def exportar_xila(
    df: pd.DataFrame,
    nombre: str,
    carpeta: str | Path = "data",
    fechas: list[str] | None = None,
) -> Path:
    """Valida y escribe ``carpeta/nombre.csv`` según el contrato. Devuelve la ruta."""
    limpio = validar_xila(df, fechas=fechas)
    ruta = Path(carpeta) / f"{a_snake_case(nombre)}.csv"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    # Sin índice, UTF-8 sin BOM, NaN como celda vacía, saltos \n: exactamente el contrato.
    limpio.to_csv(ruta, index=False, encoding="utf-8", na_rep="", lineterminator="\n")
    print(f"{ruta}: {len(limpio):,} filas × {len(limpio.columns)} columnas ({', '.join(limpio.columns)})")
    return ruta

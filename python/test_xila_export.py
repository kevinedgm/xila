"""Correr con: python3 -m pytest python/  (o python3 python/test_xila_export.py)."""

import io
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from xila_export import ContratoError, a_snake_case, exportar_xila, validar_xila  # noqa: E402


def test_snake_case():
    assert a_snake_case("Monto Total (MXN)") == "monto_total_mxn"
    assert a_snake_case("Región") == "region"
    assert a_snake_case("2024 ventas") == "c_2024_ventas"


def test_exporta_segun_contrato(tmp_path):
    df = pd.DataFrame(
        {
            "Fecha": pd.to_datetime(["2026-01-01", "2026-01-02"]),
            "Región": ["Norte", "Centro, Bajío"],
            "Monto": [1250.5, None],
        }
    )
    ruta = exportar_xila(df, "Ventas", carpeta=tmp_path)
    assert ruta.name == "ventas.csv"
    texto = ruta.read_text(encoding="utf-8")
    assert texto == 'fecha,region,monto\n2026-01-01,Norte,1250.5\n2026-01-02,"Centro, Bajío",\n'


def test_fecha_mal_formada_falla_antes_de_escribir(tmp_path):
    df = pd.DataFrame({"fecha": ["2026-01-01", "ayer"], "monto": [1, 2]})
    try:
        exportar_xila(df, "x", carpeta=tmp_path, fechas=["fecha"])
    except ContratoError as e:
        assert '"fecha"' in str(e) and "'ayer'" in str(e)
    else:
        raise AssertionError("debió fallar")
    assert not (tmp_path / "x.csv").exists()


def test_numeros_mezclados_con_texto():
    df = pd.DataFrame({"monto": ["10", "N/A", "12"]})
    try:
        validar_xila(df)
    except ContratoError as e:
        assert "N/A" in str(e)
    else:
        raise AssertionError("debió fallar")


def test_fecha_hora_con_zona_va_a_utc():
    df = pd.DataFrame({"t": pd.to_datetime(["2026-01-01T10:00:00-06:00"])})
    out = validar_xila(df)
    assert out["t"].iloc[0] == "2026-01-01T16:00:00Z"


def test_el_csv_lo_lee_pandas_igual(tmp_path):
    df = pd.DataFrame({"fecha": pd.to_datetime(["2026-03-01"]), "cp": ["01000"], "v": [1.5]})
    ruta = exportar_xila(df, "t", carpeta=tmp_path)
    back = pd.read_csv(io.StringIO(ruta.read_text()), dtype={"cp": str})
    assert back["cp"].iloc[0] == "01000"
    assert back["v"].iloc[0] == 1.5


if __name__ == "__main__":
    import tempfile

    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            with tempfile.TemporaryDirectory() as d:
                fn(Path(d)) if fn.__code__.co_argcount else fn()
            print("ok", name)

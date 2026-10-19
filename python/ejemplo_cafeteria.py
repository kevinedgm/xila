"""Dashboard demo con datos SIMULADOS: una cafetería con tres sucursales en Oaxaca.

    python3 python/ejemplo_cafeteria.py    # escribe examples/public/cafeteria/data/*.csv

Es el prototipo que se enseña en una propuesta (Workana, Upwork…): el tipo de tablero que pide
un negocio pequeño con ventas por sucursal, canal y categoría. Los números son inventados con
una semilla fija, pero con patrones que un cliente reconoce y que el dashboard debe encontrar:

- de enero de 2024 a agosto de 2025, con crecimiento de ~12 % anual; Jalatlaco (la sucursal más nueva) crece el doble;
- la app de entrega gana participación mes a mes frente al mostrador;
- picos a las 9 h y a las 17 h, fines de semana más llenos;
- diciembre y julio (Guelaguetza) arriba, Semana Santa abajo;
- cuando la espera pasa de ~8 minutos la calificación cae.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from xila_export import exportar_xila

DESTINO = Path(__file__).resolve().parents[1] / "examples" / "public" / "cafeteria" / "data"
INICIO, FIN = "2024-01-01", "2025-08-31"  # domingo y fin de mes: sin semana ni mes a medias

SUCURSALES = {"Centro": 1.0, "Reforma": 0.8, "Jalatlaco": 0.55}
CRECE = {"Centro": 0.10, "Reforma": 0.08, "Jalatlaco": 0.24}  # anual
CANALES = ["Mostrador", "Para llevar", "App de entrega"]
CATEGORIAS = {"Café": (0.42, 58.0), "Panadería": (0.26, 34.0), "Desayunos": (0.20, 118.0), "Bebidas frías": (0.12, 72.0)}
DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
HORAS = list(range(7, 22))
# Forma del día: desayuno a las 9 h, bajón a media tarde, merienda a las 17 h.
PERFIL_HORA = np.array([0.35, 0.8, 1.0, 0.75, 0.5, 0.45, 0.4, 0.35, 0.4, 0.55, 0.85, 0.6, 0.4, 0.18, 0.08])
PESO_DIA = np.array([0.88, 0.85, 0.9, 0.92, 1.0, 1.25, 1.3])


def estacion(fechas: pd.DatetimeIndex) -> np.ndarray:
    """Multiplicador por fecha: diciembre y julio arriba, Semana Santa abajo."""
    m = np.ones(len(fechas))
    m[fechas.month == 12] *= 1.22
    m[fechas.month == 7] *= 1.15
    santa = ((fechas >= "2024-03-24") & (fechas <= "2024-03-31")) | (
        (fechas >= "2025-04-13") & (fechas <= "2025-04-20")
    )
    m[santa] *= 0.72
    return m


def simular(rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    fechas = pd.date_range(INICIO, FIN, freq="D")
    anios = (fechas - fechas[0]).days.to_numpy() / 365.25
    base_dia = PESO_DIA[fechas.dayofweek.to_numpy()] * estacion(fechas)
    filas, diario = [], []
    for suc, tam in SUCURSALES.items():
        nivel = 260 * tam * base_dia * (1 + CRECE[suc]) ** anios
        tickets_dia = rng.poisson(nivel)
        # Participación de la app: de 12 % a 30 % en el periodo; mostrador cede.
        app = 0.12 + 0.18 * anios / anios[-1]
        llevar = np.full_like(app, 0.28)
        mostrador = 1 - app - llevar
        for canal, parte in zip(CANALES, [mostrador, llevar, app]):
            t_canal = rng.binomial(tickets_dia, parte)
            for cat, (peso, precio) in CATEGORIAS.items():
                t = rng.binomial(t_canal, peso)
                recargo = 1.12 if canal == "App de entrega" else 1.0
                ventas = t * precio * recargo * rng.normal(1, 0.05, len(t)) * (1.05 ** anios)
                filas.append(
                    pd.DataFrame(
                        {
                            "fecha": fechas,
                            "sucursal": suc,
                            "canal": canal,
                            "categoria": cat,
                            "tickets": t,
                            "ventas_mxn": ventas.round(2),
                        }
                    )
                )
        # Espera y calificación del día: más gente, más espera; la calificación cae pasando 8 min.
        espera = np.clip(3 + 5.5 * tickets_dia / nivel.mean() + rng.normal(0, 1.2, len(fechas)), 1.5, None)
        califica = np.clip(4.75 - 0.09 * np.maximum(espera - 8, 0) ** 1.4 + rng.normal(0, 0.08, len(fechas)), 1, 5)
        diario.append(
            pd.DataFrame(
                {
                    "fecha": fechas,
                    "sucursal": suc,
                    "tickets": tickets_dia,
                    "espera_min": espera.round(1),
                    "calificacion": califica.round(2),
                }
            )
        )
    ventas = pd.concat(filas, ignore_index=True)
    diario = pd.concat(diario, ignore_index=True)
    por_dia = ventas.groupby(["fecha", "sucursal"], as_index=False)["ventas_mxn"].sum()
    diario = diario.merge(por_dia, on=["fecha", "sucursal"])
    diario["ventas_mxn"] = diario["ventas_mxn"].round(2)
    diario["ticket_promedio"] = (diario["ventas_mxn"] / diario["tickets"]).round(2)

    # Pedidos por día de la semana y hora, sumados en todo el periodo. Las filas van de domingo a
    # lunes para que el lunes quede arriba en la rejilla (Xila ordena por primera aparición).
    horas = []
    for suc in SUCURSALES:
        d = diario[diario["sucursal"] == suc]
        por_semana = d.groupby(d["fecha"].dt.dayofweek)["tickets"].sum()
        for i in reversed(range(7)):
            reparto = rng.multinomial(int(por_semana[i]), PERFIL_HORA / PERFIL_HORA.sum())
            for h, n in zip(HORAS, reparto):
                horas.append({"sucursal": suc, "dia": DIAS[i], "hora": f"{h} h", "pedidos": int(n)})
    return ventas, diario, pd.DataFrame(horas)


def main() -> None:
    ventas, diario, horas = simular(np.random.default_rng(2025))
    ventas["mes"] = ventas["fecha"].dt.month.map(
        dict(enumerate(["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"], 1))
    )
    exportar_xila(ventas, "ventas", DESTINO, fechas=["fecha"])
    exportar_xila(diario, "diario", DESTINO, fechas=["fecha"])
    exportar_xila(horas, "pedidos_hora", DESTINO)


if __name__ == "__main__":
    main()

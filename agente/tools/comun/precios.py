"""Lectura de presentaciones y cálculos de precios."""
import re
from datetime import date

from .texto import normalizar

# Cada unidad se lleva a una unidad base: g, ml o un.
UNIDADES = {
    "g": ("g", 1), "gr": ("g", 1), "grs": ("g", 1), "gramo": ("g", 1), "gramos": ("g", 1),
    "kg": ("g", 1000), "kilo": ("g", 1000), "kilos": ("g", 1000),
    "ml": ("ml", 1), "cc": ("ml", 1),
    "l": ("ml", 1000), "lt": ("ml", 1000), "lts": ("ml", 1000), "litro": ("ml", 1000), "litros": ("ml", 1000),
    "un": ("un", 1), "u": ("un", 1), "unidad": ("un", 1), "unidades": ("un", 1),
    "rollo": ("un", 1), "rollos": ("un", 1),
}
_NOMBRES_UNIDAD = "|".join(sorted(UNIDADES, key=len, reverse=True))
RE_PACK = re.compile(rf"(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*({_NOMBRES_UNIDAD})\b")
RE_SIMPLE = re.compile(rf"(\d+(?:[.,]\d+)?)\s*({_NOMBRES_UNIDAD})\b")


def _a_base(cantidad: float, unidad: str):
    if unidad not in UNIDADES or cantidad <= 0:
        return None
    base, factor = UNIDADES[unidad]
    return {"contenido": round(cantidad * factor, 3), "unidad": base}


def leer_presentacion(titulo: str):
    """Extrae el contenido de un título: "Leche x 1,5 L" -> 1500 ml. None si no lo informa."""
    texto = normalizar(titulo)
    pack = RE_PACK.search(texto)
    if pack:
        base = _a_base(float(pack[2].replace(",", ".")), pack[3])
        if base:
            return {"contenido": base["contenido"] * int(pack[1]), "unidad": base["unidad"]}
    simple = RE_SIMPLE.search(texto)
    return _a_base(float(simple[1].replace(",", ".")), simple[2]) if simple else None


def etiqueta_referencia(unidad: str) -> str:
    return {"g": "kg", "ml": "litro"}.get(unidad, "unidad")


def precio_por_referencia(precio: float, contenido: float, unidad: str) -> float:
    divisor = 1 if unidad == "un" else 1000
    return round(precio / contenido * divisor, 2)


def calcular_diferencias(ragnar: float, competidor: float) -> dict:
    """Positiva = Ragnar está MÁS CARO que el competidor."""
    return {
        "absoluta": round(ragnar - competidor, 2),
        "porcentual": round((ragnar - competidor) / competidor * 100, 1),
    }


def promocion_vigente(pub: dict):
    """Precio unitario efectivo de la promoción. None si no hay, venció o no se puede calcular."""
    promo = pub.get("promocion")
    if not promo:
        return None
    vigencia = promo.get("vigencia_hasta")
    if vigencia and vigencia < date.today().isoformat():
        return None

    regular = pub["precio_regular"]
    tipo = promo.get("tipo")
    precio, condicion = None, None
    if pub.get("precio_promocional"):
        precio = pub["precio_promocional"]
    elif tipo == "porcentaje" and promo.get("porcentaje"):
        precio = round(regular * (1 - promo["porcentaje"] / 100), 2)
    elif tipo == "nxm" and promo.get("lleva") and promo.get("paga"):
        precio = round(regular * promo["paga"] / promo["lleva"], 2)
        condicion = f"Llevando {promo['lleva']} unidades"
    elif tipo == "segunda_unidad" and promo.get("porcentaje"):
        precio = round(regular * (2 - promo["porcentaje"] / 100) / 2, 2)
        condicion = "Llevando 2 unidades"
    if precio is None:
        return None
    return {
        "precio": precio,
        "descripcion": promo.get("descripcion"),
        "condicion": condicion,
        "vigencia_hasta": vigencia,
    }

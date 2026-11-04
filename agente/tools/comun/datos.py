"""Acceso al catálogo, las fuentes simuladas y los tipos de cambio."""
import csv
import json
from functools import lru_cache
from pathlib import Path

from .precios import etiqueta_referencia, precio_por_referencia

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@lru_cache(maxsize=1)
def leer_catalogo() -> tuple:
    with open(DATA_DIR / "catalogo_ragnar.csv", encoding="utf-8", newline="") as archivo:
        filas = list(csv.DictReader(archivo))
    for fila in filas:
        fila["precio"] = float(fila["precio"])
        fila["contenido"] = float(fila["contenido"])
    return tuple(filas)


@lru_cache(maxsize=1)
def leer_fuentes() -> dict:
    fuentes = {}
    for ruta in sorted((DATA_DIR / "fuentes").glob("*.json")):
        fuente = json.loads(ruta.read_text(encoding="utf-8"))
        fuentes[fuente["competidor"]["id"]] = fuente
    return fuentes


@lru_cache(maxsize=1)
def leer_tipos_cambio() -> dict:
    return json.loads((DATA_DIR / "tipos_cambio.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def leer_marcas() -> tuple:
    return tuple(sorted({p["marca"] for p in leer_catalogo()}))


def buscar_producto(producto_id: str):
    return next((p for p in leer_catalogo() if p["producto_id"] == producto_id), None)


def buscar_publicacion(competidor_id: str, sku: str):
    fuente = leer_fuentes().get(competidor_id)
    if not fuente or not fuente["competidor"]["permite_consulta_automatizada"]:
        return None
    return next((p for p in fuente["productos"] if p["sku"] == sku), None)


def convertir(monto: float, desde: str, hacia: str):
    if desde == hacia:
        return monto
    tasas = leer_tipos_cambio()["tasas"]
    if desde not in tasas or hacia not in tasas:
        return None
    return round(monto * tasas[desde] / tasas[hacia], 2)


def _clave_articulo(producto: dict) -> tuple:
    return producto["producto"], producto["marca"], producto["contenido"], producto["unidad_medida"]


@lru_cache(maxsize=1)
def _ids_por_articulo() -> dict:
    grupos = {}
    for producto in leer_catalogo():
        grupos.setdefault(_clave_articulo(producto), []).append(producto["producto_id"])
    return grupos


def ids_mismo_articulo(producto: dict) -> list:
    """IDs con el mismo nombre, marca y contenido. Vacío si el artículo no está repetido."""
    ids = _ids_por_articulo()[_clave_articulo(producto)]
    return ids if len(ids) > 1 else []


def producto_publico(producto: dict) -> dict:
    """Forma del producto que consumen la API y el frontend."""
    unidad = producto["unidad_medida"]
    return {
        "id": producto["producto_id"],
        "producto": producto["producto"],
        "marca": producto["marca"],
        "categoria": producto["categoria"],
        "presentacion": producto["presentacion"],
        "contenido": producto["contenido"],
        "unidad": unidad,
        "precio": producto["precio"],
        "moneda": producto["moneda"],
        "pais": producto["pais"],
        "precioPorReferencia": precio_por_referencia(producto["precio"], producto["contenido"], unidad),
        "unidadReferencia": etiqueta_referencia(unidad),
        "idsMismoArticulo": ids_mismo_articulo(producto),
    }

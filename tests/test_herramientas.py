"""Pruebas de las herramientas contra el catálogo y las fuentes reales."""
import pytest

from agente.tools import (
    analizar_posicionamiento,
    buscar_precios_competencia,
    comparar_precios,
    consultar_catalogo,
    verificar_equivalencia,
)
from agente.tools.comun.analisis import clasificar
from agente.tools.comun.datos import buscar_producto, convertir
from agente.tools.comun.precios import leer_presentacion, promocion_vigente
from agente.tools.verificar_equivalencia import evaluar


def publicacion(**cambios) -> dict:
    base = {"sku": "T-1", "titulo": "Galletitas dulces Terrabusi 900 g", "marca": "Terrabusi",
            "categoria": "Alimentos", "precio_regular": 100.0, "precio_promocional": None, "promocion": None,
            "moneda": "ARS", "disponible": True, "regiones": ["AMBA"], "url": "https://x.example/1", "publicado": "2026-11-02"}
    return {**base, **cambios}


@pytest.fixture
def galletitas() -> dict:
    return buscar_producto("RAG-00001")


@pytest.mark.parametrize("titulo, contenido, unidad", [
    ("Leche 1,5 L", 1500, "ml"),
    ("Cerveza pack 6 x 500 ml", 3000, "ml"),
    ("Galletitas x 900 grs", 900, "g"),
    ("Yerba 1 kg", 1000, "g"),
    ("Servilletas 6 u", 6, "un"),
])
def test_lee_presentaciones(titulo, contenido, unidad):
    assert leer_presentacion(titulo) == {"contenido": contenido, "unidad": unidad}


def test_presentacion_ausente():
    assert leer_presentacion("Galletitas dulces") is None


def test_catalogo_filtra_por_categoria():
    assert consultar_catalogo(categoria="limpieza")["total"] == 101


def test_catalogo_no_inventa_productos():
    assert consultar_catalogo(texto="xyzabc") == {"total": 0, "mostrados": 0, "productos": []}


def test_misma_presentacion_es_equivalente(galletitas):
    assert evaluar(galletitas, publicacion())["estado"] == "equivalente"


def test_otro_tamano_se_marca_para_normalizar(galletitas):
    pub = publicacion(titulo="Galletitas dulces Terrabusi 1 kg")
    assert evaluar(galletitas, pub)["estado"] == "equivalente_otra_presentacion"


@pytest.mark.parametrize("cambios", [
    {"marca": "Oreo", "titulo": "Galletitas dulces Oreo 900 g"},
    {"titulo": "Galletitas dulces Terrabusi light 900 g"},
    {"titulo": "Galletitas dulces Terrabusi 900 ml"},
    {"categoria": "Bebidas"},
])
def test_diferencia_relevante_se_descarta(galletitas, cambios):
    assert evaluar(galletitas, publicacion(**cambios))["estado"] == "descartado"


@pytest.mark.parametrize("cambios", [
    {"marca": None, "titulo": "Galletitas dulces 900 g"},
    {"titulo": "Galletitas dulces Terrabusi"},
])
def test_dato_faltante_no_es_confiable(galletitas, cambios):
    assert evaluar(galletitas, publicacion(**cambios))["estado"] == "no_confiable"


def test_compara_por_kilo_si_cambia_la_presentacion():
    comparacion = comparar_precios("RAG-00001", "almacen-pampa", "ALM-00016")
    assert comparacion["base_comparacion"] == "precio por kg"
    assert comparacion["ragnar"]["precio_por_referencia"] == 13020.37
    assert comparacion["diferencia_regular"] == {"absoluta": 6010.16, "porcentual": 85.7}
    assert comparacion["competidor"]["url"].startswith("https://")
    assert comparacion["fecha_consulta"]


def test_no_compara_sin_equivalencia():
    candidatos = buscar_precios_competencia("RAG-00001", competidor="Almacén Pampa")["candidatos"]
    oreo = next(c for c in candidatos if "Oreo" in c["titulo"])
    resultado = comparar_precios("RAG-00001", oreo["competidor_id"], oreo["sku"])
    assert resultado["comparable"] is False
    assert "diferencia_regular" not in resultado


def test_no_acepta_un_sku_inventado():
    assert "error" in verificar_equivalencia("RAG-00001", "almacen-pampa", "Galletitas Oreo")
    assert comparar_precios("RAG-00001", "almacen-pampa", "NO-EXISTE")["comparable"] is False


def test_no_consulta_fuentes_que_lo_prohiben():
    resultado = buscar_precios_competencia("RAG-00001", competidor="Grupo Vértice")
    assert resultado["candidatos"] == []
    assert resultado["fuentes_omitidas"][0]["nombre"] == "Grupo Vértice"
    assert "error" in verificar_equivalencia("RAG-00001", "grupo-vertice", "x")


def test_otro_pais_solo_si_se_pide():
    assert "Tienda Oriental" not in buscar_precios_competencia("RAG-00001")["competidores_consultados"]
    assert buscar_precios_competencia("RAG-00001", competidor="Tienda Oriental")["competidores_consultados"] == ["Tienda Oriental"]


def test_region_limita_competidores():
    assert buscar_precios_competencia("RAG-00001", region="mendoza")["competidores_consultados"] == ["Almacén Pampa", "SuperCiudad"]


def test_convierte_moneda():
    assert convertir(329.33, "UYU", "ARS") == 9879.9
    assert convertir(100, "BRL", "ARS") is None


@pytest.mark.parametrize("promocion, esperado", [
    ({"tipo": "nxm", "lleva": 2, "paga": 1}, 50),
    ({"tipo": "segunda_unidad", "porcentaje": 70}, 65),
])
def test_calcula_promociones_condicionadas(promocion, esperado):
    assert promocion_vigente(publicacion(promocion=promocion))["precio"] == esperado


def test_ignora_promocion_vencida():
    assert promocion_vigente(publicacion(promocion={"tipo": "nxm", "lleva": 2, "paga": 1, "vigencia_hasta": "2020-01-01"})) is None


@pytest.mark.parametrize("porcentajes, hubo_candidatos, clasificacion", [
    ([20, 15, -5], True, "mas_caro"),
    ([-20, -15, 5], True, "mas_barato"),
    ([0.5, -0.5], True, "en_linea"),
    ([], True, "no_confiable"),
    ([], False, "sin_coincidencias"),
])
def test_clasifica_contra_la_mediana(porcentajes, hubo_candidatos, clasificacion):
    assert clasificar(porcentajes, hubo_candidatos, 10)["clasificacion"] == clasificacion


def test_analisis_masivo_cuadra():
    resultado = analizar_posicionamiento(categoria="Limpieza", limite=200)
    resumen = resultado["resumen"]
    clasificados = sum(v for k, v in resumen.items() if k != "significativas")
    assert resultado["analizados"] == 101
    assert clasificados == 101

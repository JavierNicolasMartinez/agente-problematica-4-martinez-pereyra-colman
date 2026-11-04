"""Pruebas de la API con el contrato del frontend. El modelo se reemplaza por una respuesta fija."""
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from agente.tools.generar_informe import _respuesta, construir_informe, generar_informe, retirar_informe
from api import rutas, servicio_agente
from api.exportador import a_csv, a_markdown
from api.main import app

ALCANCE = {
    "ids": [], "productos": [], "marcas": [], "categorias": ["Limpieza"], "competidores": [], "regiones": ["AMBA"],
    "competidoresExcluidos": [], "filtros": {}, "todoElCatalogo": False, "limite": 10, "esContinuacion": False,
}


def contexto_tool(mensaje: str = "Limpieza en AMBA", estado: dict | None = None):
    return SimpleNamespace(
        state=estado if estado is not None else {},
        actions=SimpleNamespace(skip_summarization=False),
        user_content=SimpleNamespace(parts=[SimpleNamespace(text=mensaje)]),
    )


@pytest.fixture
def cliente(monkeypatch):
    """El agente simulado llama a la tool real generar_informe, igual que haría el modelo."""
    async def correr(sesion, mensaje):
        if "hola" in mensaje:
            return None, "Decime qué producto querés investigar."
        return generar_informe(contexto_tool(mensaje), categorias=["Limpieza"], regiones=["AMBA"], limite=5)["informe_id"], ""

    async def preparar(sesion, nuevo_analisis):
        sesion.id_adk = "simulada"

    monkeypatch.setattr(servicio_agente, "_correr_agente", correr)
    monkeypatch.setattr(servicio_agente, "_preparar_sesion_adk", preparar)
    rutas._consultas_recientes.clear()
    return TestClient(app, raise_server_exceptions=False)


def consultar(cliente, mensaje="Limpieza en AMBA", **extra):
    return cliente.post("/api/agente/consultas", json={"mensaje": mensaje, **extra})


def test_informe_tiene_el_contrato_del_frontend():
    informe = construir_informe(ALCANCE, "Limpieza en AMBA")
    assert informe["solicitud"] == "Limpieza en AMBA"
    assert informe["resumen"]["totalProductos"] == 10
    assert [p["id"] for p in informe["pasos"]] == ["interpretar", "rag", "catalogo", "competidores", "buscar", "emparejar", "analizar", "informe"]
    assert {c["nombre"] for c in informe["competidores"]["consultados"]} == {"Hiper Delta", "Mercado Austral", "SuperCiudad"}
    assert "Grupo Vértice" in [o["nombre"] for o in informe["competidores"]["omitidos"]]

    claves = {"competidorId", "competidor", "consulta", "consultadoEn", "candidatosEvaluados", "estado", "confianza",
              "criterios", "publicacion", "comparacion", "descartes"}
    for item in informe["items"]:
        assert item["analisis"]["clasificacion"] in {"mas_caro", "mas_barato", "en_linea", "sin_coincidencias", "no_confiable"}
        for resultado in item["competidores"]:
            assert set(resultado) == claves
            if resultado["comparacion"]:
                assert resultado["publicacion"]["url"].startswith("https://")
                assert {"base", "diferenciaRegular", "precioRegular", "unidadReferencia"} <= set(resultado["comparacion"])


def test_cada_precio_tiene_fuente_y_fecha():
    informe = construir_informe(ALCANCE, "x")
    comparados = sum(1 for i in informe["items"] for r in i["competidores"] if r["comparacion"])
    assert len(informe["fuentes"]) == comparados
    assert all(f["url"] and f["consultadoEn"] and f["sku"] for f in informe["fuentes"])


def test_producto_inexistente_no_inventa_resultados():
    informe = construir_informe({**ALCANCE, "categorias": [], "productos": ["Producto que no existe"]}, "x")
    assert informe["items"] == []
    assert informe["conclusiones"] == ["No se encontraron productos del catálogo para la solicitud."]


def test_marca_pasada_como_producto_igual_se_encuentra():
    informe = construir_informe({**ALCANCE, "categorias": [], "regiones": [], "productos": ["Coca-Cola"]}, "x")
    assert informe["items"]
    assert {i["producto"]["marca"] for i in informe["items"]} == {"Coca-Cola"}


def test_filtra_por_clasificacion():
    alcance = {**ALCANCE, "limite": None, "filtros": {"clasificacion": "mas_caro"}}
    informe = construir_informe(alcance, "x")
    assert informe["items"]
    assert informe["resumen"]["mas_caro"] == informe["resumen"]["totalProductos"]


def test_tool_pide_alcance_si_falta():
    assert "error" in generar_informe(contexto_tool())


def test_tool_devuelve_resumen_sin_el_detalle_de_precios():
    resultado = generar_informe(contexto_tool(), categorias=["Limpieza"], limite=3)
    assert set(resultado) == {"informe_id", "resumen", "conclusiones", "advertencias"}
    assert retirar_informe(resultado["informe_id"])["resumen"]["totalProductos"] == 3


def test_tool_continua_el_analisis_anterior():
    estado = {}
    generar_informe(contexto_tool(estado=estado), categorias=["Limpieza"], regiones=["AMBA"], limite=3)
    resultado = generar_informe(contexto_tool(estado=estado), marcas=["Ala"], continuar_analisis=True)
    informe = retirar_informe(resultado["informe_id"])
    assert informe["interpretacion"]["categorias"] == ["Limpieza"]
    assert informe["interpretacion"]["regiones"] == ["AMBA"]
    assert {i["producto"]["marca"] for i in informe["items"]} == {"Ala"}


def test_producto_nuevo_cambia_de_tema():
    estado = {}
    generar_informe(contexto_tool(estado=estado), categorias=["Limpieza"], clasificacion="mas_caro", regiones=["AMBA"], limite=3)
    resultado = generar_informe(contexto_tool(estado=estado), productos=["café"], continuar_analisis=True)
    informe = retirar_informe(resultado["informe_id"])
    assert informe["items"]
    assert informe["interpretacion"]["categorias"] == []
    assert informe["interpretacion"]["filtros"] == {}
    assert informe["interpretacion"]["regiones"] == ["AMBA"]


def test_marca_incompatible_con_la_categoria_anterior_no_da_cero():
    estado = {}
    generar_informe(contexto_tool(estado=estado), categorias=["Bebidas"], limite=3)
    resultado = generar_informe(contexto_tool(estado=estado), marcas=["Oral-B"], continuar_analisis=True)
    informe = retirar_informe(resultado["informe_id"])
    assert {i["producto"]["marca"] for i in informe["items"]} == {"Oral-B"}


@pytest.mark.parametrize("continuar", [True, False])
def test_modelo_que_repite_la_categoria_anterior_no_da_cero(continuar):
    estado = {}
    generar_informe(contexto_tool(estado=estado), categorias=["Bebidas"], umbral_pct=15, regiones=["AMBA"], limite=3)
    resultado = generar_informe(contexto_tool(estado=estado), productos=["café"], categorias=["Bebidas"],
                                umbral_pct=15, regiones=["AMBA"], continuar_analisis=continuar)
    informe = retirar_informe(resultado["informe_id"])
    assert informe["interpretacion"]["categorias"] == []
    assert informe["interpretacion"]["filtros"] == {}
    assert informe["items"]


def test_modelo_que_repite_todo_y_cambia_la_region_conserva_el_alcance():
    estado = {}
    generar_informe(contexto_tool(estado=estado), productos=["Yerba mate"], limite=3)
    resultado = generar_informe(contexto_tool(estado=estado), productos=["Yerba mate"], regiones=["Córdoba"], continuar_analisis=True)
    informe = retirar_informe(resultado["informe_id"])
    assert informe["interpretacion"]["productos"] == ["Yerba mate"]
    assert informe["interpretacion"]["regiones"] == ["Córdoba"]


def test_pedido_valido_sin_continuar_no_se_altera():
    estado = {}
    generar_informe(contexto_tool(estado=estado), categorias=["Bebidas"], limite=3)
    resultado = generar_informe(contexto_tool(estado=estado), categorias=["Bebidas"], clasificacion="mas_caro", limite=3)
    informe = retirar_informe(resultado["informe_id"])
    assert informe["interpretacion"]["categorias"] == ["Bebidas"]
    assert informe["interpretacion"]["filtros"] == {"clasificacion": "mas_caro"}


def test_respuesta_resume_el_resultado():
    informe = construir_informe({**ALCANCE, "limite": None, "filtros": {"clasificacion": "mas_caro"}}, "x")
    total = informe["totalAnalizados"]
    filtrados = informe["resumen"]["totalProductos"]
    assert informe["respuesta"] == f"De {total} productos revisados, {filtrados} cumplen lo pedido: {filtrados} están más caros que la competencia."


def test_respuesta_concuerda_en_singular():
    resumen = {"mas_caro": 1, "mas_barato": 0, "en_linea": 0, "sin_coincidencias": 0, "no_confiable": 0}
    frase = _respuesta([{}], resumen, 4)
    assert frase == "De 4 productos revisados, 1 cumple lo pedido: 1 está más caro que la competencia."


def test_respuesta_cuando_el_filtro_deja_todo_afuera():
    alcance = {**ALCANCE, "categorias": [], "regiones": [], "ids": ["RAG-00001"], "filtros": {"clasificacion": "no_confiable"}}
    informe = construir_informe(alcance, "x")
    assert informe["items"] == []
    assert informe["totalEncontrados"] == 1
    assert informe["respuesta"] == "El producto revisado no cumple lo pedido."


def test_respuesta_sin_productos():
    informe = construir_informe({**ALCANCE, "categorias": [], "productos": ["Producto que no existe"]}, "x")
    assert informe["respuesta"] == "No encontramos productos del catálogo para este pedido."


def test_ignora_clasificacion_desconocida():
    resultado = generar_informe(contexto_tool(), categorias=["Limpieza"], clasificacion="carisimo", limite=3)
    assert retirar_informe(resultado["informe_id"])["interpretacion"]["filtros"] == {}


def test_consulta_devuelve_informe(cliente):
    cuerpo = consultar(cliente).json()
    assert cuerpo["tipo"] == "informe"
    assert cuerpo["sesionId"]
    assert cuerpo["informe"]["pasos"][0]["id"] == "interpretar"


def test_consulta_sin_alcance_pide_aclaracion(cliente):
    cuerpo = consultar(cliente, "hola").json()
    assert cuerpo["tipo"] == "aclaracion"
    assert cuerpo["mensaje"] == "Decime qué producto querés investigar."
    assert "informe" not in cuerpo


def test_sesion_vencida_devuelve_404(cliente):
    respuesta = consultar(cliente, sesionId=str(uuid4()))
    assert respuesta.status_code == 404
    assert respuesta.json() == {"error": "La sesión no existe o venció. Empezá una nueva."}


@pytest.mark.parametrize("cuerpo", [
    {"mensaje": "a"},
    {"mensaje": "a" * 501},
    {"mensaje": "hola que tal", "extra": 1},
    {"mensaje": "hola que tal", "sesionId": "no-es-uuid"},
])
def test_valida_el_cuerpo(cliente, cuerpo):
    respuesta = cliente.post("/api/agente/consultas", json=cuerpo)
    assert respuesta.status_code == 400
    assert respuesta.json()["detalles"][0]["problema"]


def test_mensaje_de_validacion_para_el_usuario(cliente):
    assert consultar(cliente, "a").json()["detalles"][0]["problema"] == "Escribí al menos 3 caracteres."


def test_json_mal_formado(cliente):
    respuesta = cliente.post("/api/agente/consultas", content="{", headers={"Content-Type": "application/json"})
    assert respuesta.status_code == 400
    assert respuesta.json() == {"error": "JSON mal formado."}


def test_cuerpo_demasiado_grande(cliente):
    assert cliente.post("/api/agente/consultas", content="x" * 11000).status_code == 413


def test_limita_consultas_por_minuto(cliente, monkeypatch):
    monkeypatch.setattr(rutas, "CONSULTAS_POR_MINUTO", 1)
    assert consultar(cliente, "hola").status_code == 200
    assert consultar(cliente, "hola").status_code == 429


def test_modelo_caido_devuelve_503(cliente, monkeypatch):
    async def fallar(*_):
        raise ConnectionError("sin ollama")

    monkeypatch.setattr(servicio_agente, "_correr_agente", fallar)
    respuesta = consultar(cliente)
    assert respuesta.status_code == 503
    assert "Ollama" in respuesta.json()["error"]


def test_catalogo_paginado(cliente):
    cuerpo = cliente.get("/api/catalogo", params={"categoria": "Limpieza", "limite": 25}).json()
    assert cuerpo["total"] == 101
    assert len(cuerpo["productos"]) == 25
    assert {"precioPorReferencia", "unidadReferencia", "idsMismoArticulo"} <= set(cuerpo["productos"][0])


def test_facetas(cliente):
    cuerpo = cliente.get("/api/catalogo/facetas").json()
    assert cuerpo["total"] == 500
    assert {"nombre": "Limpieza", "cantidad": 101} in cuerpo["categorias"]


def test_competidores(cliente):
    cuerpo = cliente.get("/api/competidores").json()
    assert len(cuerpo["competidores"]) == 6
    assert cuerpo["tiposCambio"]["tasas"]["UYU"] == 30


def test_ruta_inexistente(cliente):
    respuesta = cliente.get("/api/no-existe")
    assert respuesta.status_code == 404
    assert respuesta.json() == {"error": "Recurso no encontrado."}


def test_exporta_csv_y_markdown(cliente):
    cuerpo = consultar(cliente).json()
    base = f"/api/sesiones/{cuerpo['sesionId']}/informes/{cuerpo['informe']['id']}/exportar"

    csv = cliente.get(base, params={"formato": "csv"})
    assert csv.headers["content-type"].startswith("text/csv")
    assert 'filename="informe-precios-' in csv.headers["content-disposition"]
    assert csv.text.startswith("﻿producto_id,producto,marca")

    markdown = cliente.get(base, params={"formato": "md"})
    assert markdown.text.startswith("# Informe de posicionamiento de precios")
    assert "Fuentes simuladas" in markdown.text


def test_exportar_formato_invalido(cliente):
    cuerpo = consultar(cliente).json()
    base = f"/api/sesiones/{cuerpo['sesionId']}/informes/{cuerpo['informe']['id']}/exportar"
    assert cliente.get(base, params={"formato": "pdf"}).status_code == 400


def test_informe_de_otra_sesion_no_se_expone(cliente):
    cuerpo = consultar(cliente).json()
    otra = consultar(cliente).json()["sesionId"]
    assert cliente.get(f"/api/sesiones/{otra}/informes/{cuerpo['informe']['id']}/exportar").status_code == 404


def test_csv_neutraliza_formulas():
    informe = construir_informe(ALCANCE, "x")
    informe["items"][0]["producto"]["producto"] = "=SUMA(A1)"
    assert "'=SUMA(A1)" in a_csv(informe)


def test_markdown_escapa_la_solicitud():
    informe = construir_informe(ALCANCE, "*negrita* | tabla")
    assert "\\*negrita\\* \\| tabla" in a_markdown(informe)

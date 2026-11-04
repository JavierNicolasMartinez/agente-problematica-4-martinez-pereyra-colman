"""Herramienta F08 y F09: genera el informe comparativo que muestra el frontend.

El informe se calcula entero en Python a partir del alcance que pidió el modelo.
El modelo solo recibe un resumen: nunca redacta ni transcribe los precios del informe.
"""
from time import perf_counter
from typing import Optional
from uuid import uuid4

from google.adk.tools import ToolContext

from .buscar_precios_competencia import resolver_fuentes
from .comun.analisis import UMBRAL_SIGNIFICATIVO_PCT
from .comun.investigacion import ahora_iso, buscar_en_fuentes, investigar_producto
from .consultar_catalogo import seleccionar_productos
from .verificar_equivalencia import ESTADOS_COMPARABLES

MAX_PRODUCTOS_POR_INFORME = 120
MAX_INFORMES_PENDIENTES = 50
CLASIFICACIONES = ("mas_caro", "mas_barato", "sin_coincidencias", "no_confiable")
LISTAS_ALCANCE = ("ids", "productos", "marcas", "categorias", "competidores", "regiones", "competidoresExcluidos")
CLAVE_ULTIMO_ALCANCE = "ultimo_alcance"

# Informes generados a la espera de que la API los retire. El modelo solo conoce su id.
informes_pendientes = {}


def retirar_informe(informe_id: str):
    return informes_pendientes.pop(informe_id, None)


def _guardar_pendiente(informe: dict) -> None:
    while len(informes_pendientes) >= MAX_INFORMES_PENDIENTES:
        informes_pendientes.pop(next(iter(informes_pendientes)))
    informes_pendientes[informe["id"]] = informe


class _Traza:
    """Registra cada paso con su duración, para mostrarlo en el frontend."""

    def __init__(self):
        self.pasos = []
        self._inicio = perf_counter()

    def paso(self, id_paso: str, titulo: str, detalle: str) -> None:
        duracion = round((perf_counter() - self._inicio) * 1000)
        self.pasos.append({"id": id_paso, "titulo": titulo, "detalle": detalle, "duracionMs": duracion})
        self._inicio = perf_counter()


def _detalle_interpretacion(alcance: dict) -> str:
    partes = [
        f"{etiqueta}: {', '.join(alcance[clave])}"
        for clave, etiqueta in (("productos", "productos"), ("marcas", "marcas"), ("categorias", "categorías"),
                                ("ids", "IDs"), ("regiones", "regiones"))
        if alcance[clave]
    ]
    if alcance["todoElCatalogo"]:
        partes.append("todo el catálogo")
    return f"Detectado {' · '.join(partes)}"


def _combinar_alcance(anterior: dict, nuevo: dict) -> dict:
    """Continúa un análisis: lo que el pedido no menciona se toma del alcance anterior."""
    combinado = dict(nuevo)
    for clave in LISTAS_ALCANCE:
        combinado[clave] = nuevo[clave] or anterior.get(clave, [])
    combinado["filtros"] = {**anterior.get("filtros", {}), **nuevo["filtros"]}
    combinado["todoElCatalogo"] = nuevo["todoElCatalogo"] or anterior.get("todoElCatalogo", False)
    combinado["limite"] = nuevo["limite"] or anterior.get("limite")
    return combinado


def _aplicar_filtros(items: list, filtros: dict) -> list:
    resultado = items
    if filtros.get("clasificacion"):
        resultado = [i for i in resultado if i["analisis"]["clasificacion"] == filtros["clasificacion"]]
    if filtros.get("soloSignificativas"):
        resultado = [i for i in resultado if i["analisis"]["significativa"]]
    if filtros.get("soloPromociones"):
        resultado = [i for i in resultado if i["analisis"].get("tienePromociones")]
    return resultado


def _resumir(items: list) -> dict:
    resumen = {"totalProductos": len(items), "mas_caro": 0, "mas_barato": 0, "en_linea": 0,
               "sin_coincidencias": 0, "no_confiable": 0, "significativas": 0, "conPromociones": 0}
    for item in items:
        analisis = item["analisis"]
        resumen[analisis["clasificacion"]] += 1
        resumen["significativas"] += analisis["significativa"]
        resumen["conPromociones"] += bool(analisis.get("tienePromociones"))
    return resumen


def _formato_pct(numero: float) -> str:
    return f"{'+' if numero > 0 else ''}{numero:g} %".replace(".", ",")


def _conclusiones(items: list, resumen: dict, competidores: dict, umbral: float) -> list:
    """Redacta las conclusiones SOLO con datos calculados."""
    if not items:
        return ["No se encontraron productos del catálogo para la solicitud."]
    comparados = sum(i["analisis"]["competidoresComparados"] > 0 for i in items)
    conclusiones = [
        f"Se analizaron {len(items)} productos de Ragnar contra {len(competidores['consultados'])} competidores; "
        f"{comparados} pudieron compararse con al menos una fuente verificable."
    ]
    if resumen["mas_caro"]:
        conclusiones.append(f"{resumen['mas_caro']} productos están más caros que la mediana de la competencia.")
    if resumen["mas_barato"]:
        conclusiones.append(f"{resumen['mas_barato']} productos están más baratos que la mediana de la competencia.")
    significativas = [i for i in items if i["analisis"]["significativa"]]
    if significativas:
        peor = max(significativas, key=lambda i: i["analisis"]["diferenciaMedianaPct"])
        producto = peor["producto"]
        conclusiones.append(
            f"{len(significativas)} productos tienen diferencias de {umbral:g} % o más. La mayor brecha es "
            f"{producto['producto']} {producto['marca']} {producto['presentacion']} "
            f"({_formato_pct(peor['analisis']['diferenciaMedianaPct'])})."
        )
    if resumen["sin_coincidencias"]:
        conclusiones.append(f"{resumen['sin_coincidencias']} productos no se encontraron en los competidores consultados.")
    if resumen["no_confiable"]:
        conclusiones.append(
            f"{resumen['no_confiable']} productos tienen publicaciones parecidas, pero no se pudo confirmar "
            "que sean el mismo artículo; no se compararon."
        )
    if resumen["conPromociones"]:
        conclusiones.append(
            f"{resumen['conPromociones']} productos tienen promociones vigentes en la competencia "
            "(se informan aparte del precio regular)."
        )
    if competidores["omitidos"]:
        detalle = "; ".join(f"{o['nombre']} ({o['motivo']})" for o in competidores["omitidos"])
        conclusiones.append(f"No se consultó: {detalle}")
    return conclusiones


def _fuentes_utilizadas(items: list) -> list:
    """F09: cada precio mostrado queda asociado a una url y una fecha de consulta."""
    return [
        {"competidorId": r["competidorId"], "url": r["publicacion"]["url"], "sku": r["publicacion"]["sku"],
         "consultadoEn": r["consultadoEn"], "publicado": r["publicacion"]["publicado"]}
        for item in items for r in item["competidores"] if r["comparacion"]
    ]


def construir_informe(alcance: dict, solicitud: str) -> dict:
    """Ejecuta la investigación completa para un alcance ya interpretado."""
    traza = _Traza()
    traza.paso("interpretar", "Interpretar la solicitud", _detalle_interpretacion(alcance))
    traza.paso("rag", "Recuperar contexto (RAG)", "Módulo RAG no configurado todavía.")

    filtros = alcance["filtros"]
    umbral = filtros.get("umbralPct", UMBRAL_SIGNIFICATIVO_PCT)
    encontrados = seleccionar_productos(alcance["ids"], alcance["productos"], alcance["marcas"], alcance["categorias"])
    tope = min(alcance["limite"] or MAX_PRODUCTOS_POR_INFORME, MAX_PRODUCTOS_POR_INFORME)
    seleccion = encontrados[:tope]
    recortado = len(seleccion) < len(encontrados)
    sufijo = f", se analizan {len(seleccion)}" if recortado else ""
    traza.paso("catalogo", "Consultar el catálogo de Ragnar", f"{len(encontrados)} productos encontrados{sufijo}.")

    pais = seleccion[0]["pais"] if seleccion else "Argentina"
    fuentes, omitidos = resolver_fuentes(pais, alcance["competidores"], alcance["regiones"], alcance["competidoresExcluidos"])
    competidores = {
        "consultados": [
            {"id": f["competidor"]["id"], "nombre": f["competidor"]["nombre"],
             "tipoFuente": "simulado", "sitio": f["competidor"]["sitio"]}
            for f in fuentes
        ],
        "omitidos": omitidos,
    }
    nombres = ", ".join(c["nombre"] for c in competidores["consultados"]) or "ninguno"
    detalle_omitidos = f" Omitidos: {', '.join(o['nombre'] for o in omitidos)}." if omitidos else ""
    traza.paso("competidores", "Elegir competidores", f"Consultar: {nombres}.{detalle_omitidos}")

    busquedas = [(p, buscar_en_fuentes(p, fuentes, alcance["regiones"])) for p in seleccion]
    traza.paso("buscar", "Buscar precios en la competencia", f"{len(seleccion) * len(fuentes)} búsquedas realizadas.")

    todos = [investigar_producto(p, b, umbral) for p, b in busquedas]
    verificados = sum(r["estado"] in ESTADOS_COMPARABLES for i in todos for r in i["competidores"])
    descartados = sum(r.pop("descartados") for i in todos for r in i["competidores"])
    traza.paso("emparejar", "Verificar coincidencias y comparar",
               f"{verificados} coincidencias verificadas, {descartados} publicaciones descartadas.")

    items = _aplicar_filtros(todos, filtros)
    detalle = (f"{len(items)} productos clasificados." if len(items) == len(todos)
               else f"{len(items)} de {len(todos)} productos cumplen el filtro pedido.")
    traza.paso("analizar", "Analizar resultados", detalle)

    advertencias = []
    if recortado:
        advertencias.append(f"La consulta encontró {len(encontrados)} productos; se analizaron los primeros {len(seleccion)}.")
    repetidos = sum(i["repetidoEnCatalogo"] for i in items)
    if repetidos:
        advertencias.append(f"{repetidos} productos aparecen repetidos en el catálogo (mismo artículo con distinto ID y precio). Conviene revisarlos.")
    if any(r["comparacion"] and r["comparacion"]["tipoCambio"] for i in items for r in i["competidores"]):
        advertencias.append("Hay precios en otra moneda convertidos con un tipo de cambio de demostración.")

    resumen = _resumir(items)
    conclusiones = _conclusiones(items, resumen, competidores, umbral)
    fuentes_usadas = _fuentes_utilizadas(items)
    traza.paso("informe", "Generar informe", f"{len(conclusiones)} conclusiones, {len(fuentes_usadas)} precios con fuente.")

    return {
        "id": str(uuid4()),
        "fecha": ahora_iso(),
        "solicitud": solicitud,
        "interpretacion": {**alcance, "mensaje": solicitud, "intencion": "investigar", "notas": [], "palabrasClave": []},
        "umbralSignificativoPct": umbral,
        "competidores": competidores,
        "resumen": resumen,
        "conclusiones": conclusiones,
        "items": items,
        "fuentes": fuentes_usadas,
        "contextoRag": {"habilitado": False, "fragmentos": [], "sugerencias": None},
        "advertencias": advertencias,
        "pasos": traza.pasos,
    }


def _texto_solicitud(tool_context: ToolContext) -> str:
    contenido = tool_context.user_content
    partes = contenido.parts if contenido and contenido.parts else []
    return " ".join(p.text for p in partes if p.text).strip()


def generar_informe(
    tool_context: ToolContext,
    productos: Optional[list[str]] = None,
    marcas: Optional[list[str]] = None,
    categorias: Optional[list[str]] = None,
    ids: Optional[list[str]] = None,
    competidores: Optional[list[str]] = None,
    regiones: Optional[list[str]] = None,
    competidores_excluidos: Optional[list[str]] = None,
    todo_el_catalogo: bool = False,
    clasificacion: str = "",
    solo_significativas: bool = False,
    solo_promociones: bool = False,
    umbral_pct: Optional[float] = None,
    limite: Optional[int] = None,
    continuar_analisis: bool = False,
) -> dict:
    """Investiga precios y genera el informe comparativo que ve el empleado en pantalla.

    Úsala para todo pedido de investigar, comparar o analizar precios. Pasa solo lo que el
    empleado pidió. Tiene que indicar al menos productos, marcas, categorias, ids o
    todo_el_catalogo, salvo que continuar_analisis sea true.

    Args:
        productos: Nombres de productos, por ejemplo ["Yerba mate"].
        marcas: Marcas, por ejemplo ["Dove"].
        categorias: Entre Alimentos, Bebidas, Limpieza, Higiene personal y Hogar.
        ids: Identificadores del catálogo, por ejemplo ["RAG-00001"].
        competidores: Competidores pedidos. Vacío consulta los del país del producto.
        regiones: Regiones pedidas, por ejemplo ["AMBA"].
        competidores_excluidos: Competidores que el empleado pidió dejar afuera.
        todo_el_catalogo: true solo si pidió analizar todo el catálogo.
        clasificacion: Filtra el resultado: mas_caro, mas_barato, sin_coincidencias o no_confiable. Vacío si no pidió filtrar.
        solo_significativas: true si pidió solo diferencias significativas.
        solo_promociones: true si pidió solo productos con promociones.
        umbral_pct: Diferencia porcentual pedida, por ejemplo 15 para "mayores al 15 %".
        limite: Cantidad máxima de productos, si la pidió.
        continuar_analisis: true si el pedido ajusta el análisis anterior, por ejemplo "y en AMBA?".

    Returns:
        informe_id, resumen, conclusiones y advertencias. Si falta alcance, devuelve error.
    """
    filtros = {}
    if clasificacion in CLASIFICACIONES:
        filtros["clasificacion"] = clasificacion
    if solo_significativas:
        filtros["soloSignificativas"] = True
    if solo_promociones:
        filtros["soloPromociones"] = True
    if umbral_pct is not None and umbral_pct > 0:
        filtros["umbralPct"] = umbral_pct
        filtros["soloSignificativas"] = True

    alcance = {
        "ids": ids or [], "productos": productos or [], "marcas": marcas or [], "categorias": categorias or [],
        "competidores": competidores or [], "regiones": regiones or [],
        "competidoresExcluidos": competidores_excluidos or [], "filtros": filtros,
        "todoElCatalogo": todo_el_catalogo, "limite": limite if limite and limite > 0 else None,
        "esContinuacion": continuar_analisis,
    }
    anterior = tool_context.state.get(CLAVE_ULTIMO_ALCANCE)
    if continuar_analisis and anterior:
        alcance = _combinar_alcance(anterior, alcance)

    sin_alcance = not (alcance["ids"] or alcance["productos"] or alcance["marcas"]
                       or alcance["categorias"] or alcance["todoElCatalogo"])
    if sin_alcance:
        return {"error": "Falta indicar qué productos investigar. Pedile al empleado un producto, marca, categoría o ID."}

    informe = construir_informe(alcance, _texto_solicitud(tool_context))
    _guardar_pendiente(informe)
    tool_context.state[CLAVE_ULTIMO_ALCANCE] = alcance
    # El informe ya está completo: no hace falta otra llamada al modelo para resumirlo.
    tool_context.actions.skip_summarization = True
    return {"informe_id": informe["id"], "resumen": informe["resumen"],
            "conclusiones": informe["conclusiones"], "advertencias": informe["advertencias"]}

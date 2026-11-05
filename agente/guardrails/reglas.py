"""Reglas de los guardrails, como funciones puras. No dependen de ADK ni del modelo.

Los patrones de entrada y de documentos son una primera capa: se pueden esquivar reformulando
el texto. Lo que garantiza que no se alteren precios es que las herramientas los leen de los datos.
"""
import re

from agente.tools.comun.datos import leer_catalogo, leer_fuentes
from agente.tools.comun.texto import normalizar

MENSAJE_ENTRADA_BLOQUEADA = (
    "Solo puedo ayudarte con la investigación de precios de Ragnar y con sus documentos cargados. "
    "Indicá un producto, marca, categoría o una pregunta sobre un documento."
)
MENSAJE_SALIDA_BLOQUEADA = (
    "No puedo mostrar esa respuesta porque no pasó los controles de seguridad. "
    "Reformulá el pedido o revisá el informe."
)
TEXTO_RETIRADO = "[texto retirado por seguridad]"

MAX_LLAMADAS_POR_CONSULTA = 15
MAX_ELEMENTOS_LISTA = 50
MAX_LARGO_TEXTO = 500
MAX_LIMITE = 500
MAX_K = 10
NUMERO_SIN_CONTROL = 31  # Listas numeradas, días y cantidades chicas no son datos que se puedan inventar.

RE_PRODUCTO_ID = re.compile(r"^RAG-\d{5}$")
RE_SKU = re.compile(r"^[A-Z]{3}-\d{5}$")
RE_NUMERO = re.compile(r"(?<!\w)\d+(?:[.,]\d+)*")
RE_UUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)
RE_CODIGO_SALIDA = re.compile(r"```|^\s*(?:def |class |import |from \S+ import )|\bprint\(", re.M)
RE_ORACION = re.compile(r"(?<=[.!?])\s+")

PATRONES_INYECCION = [re.compile(p) for p in (
    r"\b(ignora|olvida|omite|desobedece|saltea)\w*\b.{0,40}\b(instrucciones|reglas|indicaciones|restricciones)\b",
    r"\b(ignore|disregard|forget)\b.{0,30}\b(instructions|rules)\b",
    r"\b(ahora|desde ahora)\b.{0,20}\b(sos|eres)\b",
    r"\b(actua|comportate|finge|simula)\b.{0,30}\b(como|que)\b.{0,20}\b(asistente|programador|desarrollador|administrador)\b",
    r"\bmodo (desarrollador|developer|sin restricciones)\b",
    r"\b(instrucciones|prompt|mensaje) (de |del )?(sistema|system)\b",
    r"\bsystem prompt\b",
    r"\btus instrucciones\b",
)]
PATRONES_CODIGO = [re.compile(p) for p in (
    r"\b(python|javascript|typescript|java|sql|bash|powershell|html)\b",
    r"\bscript\b",
    r"\b(escrib|gener|crea|hace|hac|dame|mostra)\w*\b.{0,40}\b(codigo|funcion|clase)\b",
)]
PATRONES_INVENTAR = [re.compile(r"\b(invent|fabric|falsific)\w*\b.{0,30}\b(precios?|datos?|fuentes?)\b")]
PATRONES_DOCUMENTO = PATRONES_INYECCION + PATRONES_CODIGO + [re.compile(p) for p in (
    r"\bpara el (asistente|agente|modelo)\b",
    r"\b(responde|di|deci|decile) (que|con|siempre)\b",
)]
FRASES_INTERNAS = ("elige una de estas acciones", "eres el agente de inteligencia", "secuencia obligatoria")


def _coincide(patrones: list, texto: str) -> bool:
    limpio = normalizar(texto)
    return any(p.search(limpio) for p in patrones)


def evaluar_entrada(texto: str) -> str | None:
    """Devuelve el motivo de bloqueo de un pedido, o None si puede llegar al modelo."""
    if _coincide(PATRONES_INYECCION, texto):
        return "inyeccion_de_instrucciones"
    if _coincide(PATRONES_CODIGO, texto):
        return "pedido_de_codigo"
    if _coincide(PATRONES_INVENTAR, texto):
        return "pedido_de_datos_falsos"
    return None


def _nombres_competidores() -> set:
    nombres = set()
    for fuente in leer_fuentes().values():
        competidor = fuente["competidor"]
        nombres.update((normalizar(competidor["id"]), normalizar(competidor["nombre"])))
    return nombres


def _regiones() -> set:
    return {normalizar(r) for f in leer_fuentes().values() for r in f["competidor"]["regiones"]}


def _categorias() -> set:
    return {normalizar(p["categoria"]) for p in leer_catalogo()}


def _como_lista(valor) -> list:
    if valor is None or valor == "":
        return []
    return valor if isinstance(valor, list) else [valor]


def _error_de_valores(nombre: str, valores: list, permitidos: set) -> str | None:
    desconocidos = [v for v in valores if normalizar(v) not in permitidos]
    if desconocidos:
        return f"{nombre} desconocido: {desconocidos[0]}. Valores posibles: {', '.join(sorted(permitidos))}."
    return None


def validar_argumentos(args: dict) -> str | None:
    """Valida lo que el modelo le pasa a una herramienta. Devuelve el error, o None si es válido."""
    for nombre, valor in args.items():
        if isinstance(valor, list) and len(valor) > MAX_ELEMENTOS_LISTA:
            return f"{nombre} tiene demasiados elementos."
        if any(isinstance(v, str) and len(v) > MAX_LARGO_TEXTO for v in _como_lista(valor)):
            return f"{nombre} es demasiado largo."

    identificadores = _como_lista(args.get("ids")) + _como_lista(args.get("producto_id"))
    if any(not RE_PRODUCTO_ID.match(str(i)) for i in identificadores):
        return "Identificador de producto inválido: usa el formato RAG-00000 que devuelve consultar_catalogo."
    if args.get("sku") and not RE_SKU.match(str(args["sku"])):
        return "sku inválido: usa el valor exacto que devuelve buscar_precios_competencia."

    if args.get("competidor_id") and args["competidor_id"] not in leer_fuentes():
        return "competidor_id inválido: usa el valor exacto que devuelve buscar_precios_competencia."

    competidores = [*_como_lista(args.get("competidor")), *_como_lista(args.get("competidores")),
                    *_como_lista(args.get("competidores_excluidos"))]
    regiones = _como_lista(args.get("region")) + _como_lista(args.get("regiones"))
    categorias = _como_lista(args.get("categoria")) + _como_lista(args.get("categorias"))
    error = (_error_de_valores("Competidor", competidores, _nombres_competidores())
             or _error_de_valores("Región", regiones, _regiones())
             or _error_de_valores("Categoría", categorias, _categorias()))
    if error:
        return error

    limite = args.get("limite")
    if limite is not None and not 1 <= limite <= MAX_LIMITE:
        return f"limite debe estar entre 1 y {MAX_LIMITE}."
    if args.get("k") is not None and not 1 <= args["k"] <= MAX_K:
        return f"k debe estar entre 1 y {MAX_K}."
    for clave in ("umbral_pct", "umbral_significativo"):
        if args.get(clave) is not None and args[clave] <= 0:
            return f"{clave} debe ser mayor que cero."
    return None


def _valores(token: str) -> set:
    """Lee un número en formato argentino o inglés. Si es ambiguo, devuelve ambas lecturas."""
    if "," in token and "." in token:
        decimal = max(token.rfind(","), token.rfind("."))
        entero = re.sub(r"[.,]", "", token[:decimal])
        return {round(float(f"{entero}.{token[decimal + 1:]}"), 2)}
    valores = set()
    separado = token.replace(",", ".")
    if separado.count(".") <= 1:
        valores.add(round(float(separado), 2))
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", token):
        valores.add(float(re.sub(r"[.,]", "", token)))
    return valores


def numeros_de(texto: str) -> set:
    numeros = set()
    for token in RE_NUMERO.findall(texto):
        numeros |= _valores(token)
    return numeros


def numeros_sin_respaldo(texto: str, permitidos: set) -> list:
    """Números del texto que no salieron de ninguna herramienta ni del pedido."""
    sin_respaldo = []
    for token in RE_NUMERO.findall(texto):
        valores = _valores(token)
        if valores and not valores & permitidos and max(valores) > NUMERO_SIN_CONTROL:
            sin_respaldo.append(token)
    return sin_respaldo


def revisar_salida(texto: str, permitidos: set) -> str | None:
    """Devuelve el motivo por el que una respuesta no puede mostrarse, o None si es segura."""
    if RE_CODIGO_SALIDA.search(texto):
        return "codigo_en_la_respuesta"
    if RE_UUID.search(texto) or "informe_id" in texto:
        return "identificador_interno"
    if any(frase in normalizar(texto) for frase in FRASES_INTERNAS):
        return "filtracion_de_instrucciones"
    if numeros_sin_respaldo(texto, permitidos):
        return "numero_sin_respaldo"
    return None


def depurar_fragmentos(fragmentos: list) -> tuple:
    """Retira de cada fragmento las oraciones que intentan darle órdenes al modelo."""
    depurados, retiradas = [], 0
    for fragmento in fragmentos:
        oraciones = []
        for oracion in RE_ORACION.split(fragmento["texto"]):
            if _coincide(PATRONES_DOCUMENTO, oracion):
                retiradas += 1
                oraciones.append(TEXTO_RETIRADO)
            else:
                oraciones.append(oracion)
        depurados.append({**fragmento, "texto": " ".join(oraciones)})
    return depurados, retiradas

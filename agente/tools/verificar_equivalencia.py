"""Herramienta F04: decide si una publicación es el mismo artículo que vende Ragnar."""
from math import log

from .comun.datos import buscar_producto, buscar_publicacion, leer_marcas
from .comun.precios import leer_presentacion
from .comun.texto import contiene_frase, normalizar, tokens

# Palabras que cambian el producto: si están en la publicación y no en Ragnar, no es el mismo.
VARIANTES = [
    "light", "zero", "diet", "sin azucar", "sin tacc", "sin sal", "integral", "descremada",
    "semidescremada", "deslactosada", "organico", "sabor", "aroma", "for men", "sensitive",
    "repuesto", "recarga", "concentrado", "gel", "reforzada", "jumbo", "perfumado",
    "doble hoja", "mini", "extra", "clinical",
]
TOLERANCIA_CONTENIDO = 0.01  # 1 %
PRIORIDAD = {"equivalente": 0, "equivalente_otra_presentacion": 1, "no_confiable": 2, "descartado": 3}
ESTADOS_COMPARABLES = ("equivalente", "equivalente_otra_presentacion")
PESOS = {"nombre": 0.3, "marca": 0.3, "categoria": 0.1, "variante": 0.15, "presentacion": 0.15}
VALOR_RESULTADO = {"ok": 1, "duda": 0.5, "falla": 0}
PUBLICACION_INEXISTENTE = (
    "No existe ese producto o publicación, o la fuente no permite consultarla. "
    "Usa buscar_precios_competencia para obtener el competidor_id y el sku reales, y vuelve a intentarlo."
)


def _evaluar_marca(producto: dict, pub: dict) -> dict:
    marca = normalizar(producto["marca"])
    if pub.get("marca"):
        if normalizar(pub["marca"]) == marca:
            return {"criterio": "marca", "resultado": "ok", "detalle": f"Marca {producto['marca']}."}
        return {"criterio": "marca", "resultado": "falla", "detalle": f"Otra marca: {pub['marca']}."}
    if contiene_frase(pub["titulo"], producto["marca"]):
        return {"criterio": "marca", "resultado": "ok", "detalle": f"Marca {producto['marca']} (leída del título)."}
    otra = next((m for m in leer_marcas() if normalizar(m) != marca and contiene_frase(pub["titulo"], m)), None)
    if otra:
        return {"criterio": "marca", "resultado": "falla", "detalle": f"El título menciona otra marca: {otra}."}
    return {"criterio": "marca", "resultado": "duda", "detalle": "La publicación no informa la marca."}


def _evaluar_presentacion(producto: dict, leida):
    if not leida:
        return {"criterio": "presentacion", "resultado": "duda", "detalle": "No informa contenido neto."}, False
    if leida["unidad"] != producto["unidad_medida"]:
        detalle = f"Unidad incompatible ({leida['unidad']} vs {producto['unidad_medida']})."
        return {"criterio": "presentacion", "resultado": "falla", "detalle": detalle}, False
    if abs(leida["contenido"] - producto["contenido"]) / producto["contenido"] <= TOLERANCIA_CONTENIDO:
        detalle = f"Misma presentación ({producto['presentacion']})."
        return {"criterio": "presentacion", "resultado": "ok", "detalle": detalle}, True
    detalle = f"Otra presentación: {leida['contenido']:g} {leida['unidad']} (se normaliza por unidad)."
    return {"criterio": "presentacion", "resultado": "ok", "detalle": detalle}, False


def evaluar(producto: dict, pub: dict) -> dict:
    titulo = pub["titulo"]
    buscados = tokens(producto["producto"])
    presentes = set(tokens(titulo))
    cobertura = sum(t in presentes for t in buscados) / len(buscados)
    if cobertura == 1:
        nombre = {"criterio": "nombre", "resultado": "ok", "detalle": "El nombre coincide."}
    elif cobertura >= 0.5:
        nombre = {"criterio": "nombre", "resultado": "duda", "detalle": f"Coincide parcialmente ({cobertura:.0%})."}
    else:
        nombre = {"criterio": "nombre", "resultado": "falla", "detalle": "El nombre no coincide."}

    if not pub.get("categoria"):
        categoria = {"criterio": "categoria", "resultado": "ok", "detalle": "Sin categoría informada (no bloquea)."}
    elif normalizar(pub["categoria"]) == normalizar(producto["categoria"]):
        categoria = {"criterio": "categoria", "resultado": "ok", "detalle": producto["categoria"]}
    else:
        categoria = {"criterio": "categoria", "resultado": "falla", "detalle": f"Otra categoría: {pub['categoria']}."}

    base = f"{producto['producto']} {producto['marca']}"
    extra = next((v for v in VARIANTES if contiene_frase(titulo, v) and not contiene_frase(base, v)), None)
    if extra:
        variante = {"criterio": "variante", "resultado": "falla", "detalle": f'Variante distinta: "{extra}".'}
    else:
        variante = {"criterio": "variante", "resultado": "ok", "detalle": "Sin variantes distintas."}

    leida = leer_presentacion(titulo)
    presentacion, misma = _evaluar_presentacion(producto, leida)

    criterios = [nombre, _evaluar_marca(producto, pub), categoria, variante, presentacion]
    resultados = [c["resultado"] for c in criterios]
    if "falla" in resultados:
        estado = "descartado"
    elif "duda" in resultados:
        estado = "no_confiable"
    else:
        estado = "equivalente" if misma else "equivalente_otra_presentacion"
    confianza = sum(PESOS[c["criterio"]] * VALOR_RESULTADO[c["resultado"]] for c in criterios)
    return {"estado": estado, "confianza": round(confianza, 2), "criterios": criterios, "presentacion_leida": leida}


def evaluar_candidatos(producto: dict, candidatos: list) -> list:
    """Evalúa los candidatos y los ordena del mejor al peor, con el tamaño más cercano primero."""
    evaluados = [(pub, evaluar(producto, pub)) for pub in candidatos]

    def orden(par):
        evaluacion = par[1]
        leida = evaluacion["presentacion_leida"]
        distancia = abs(log(leida["contenido"] / producto["contenido"])) if leida else float("inf")
        return PRIORIDAD[evaluacion["estado"]], distancia, -evaluacion["confianza"]

    return sorted(evaluados, key=orden)


def verificar_equivalencia(producto_id: str, competidor_id: str, sku: str) -> dict:
    """Verifica si una publicación es el mismo artículo que vende Ragnar.

    Args:
        producto_id: Identificador del catálogo de Ragnar.
        competidor_id: Valor competidor_id que devolvió buscar_precios_competencia.
        sku: Valor sku que devolvió buscar_precios_competencia.

    Returns:
        estado y el detalle de cada criterio. Estados: equivalente (misma presentación),
        equivalente_otra_presentacion (se compara por kg, litro o unidad), no_confiable (faltan
        datos, comunícalo así) y descartado (no es el mismo artículo).
    """
    producto, pub = buscar_producto(producto_id), buscar_publicacion(competidor_id, sku)
    if not producto or not pub:
        return {"error": PUBLICACION_INEXISTENTE}
    return {"producto_id": producto_id, "competidor_id": competidor_id, "sku": sku, **evaluar(producto, pub)}

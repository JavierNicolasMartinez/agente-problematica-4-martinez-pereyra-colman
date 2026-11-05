"""Herramienta F03: búsqueda de publicaciones en las fuentes de la competencia."""
from datetime import date

from .comun.datos import buscar_producto, leer_fuentes
from .comun.precios import promocion_vigente
from .comun.texto import normalizar, tokens


def _opera_en(regiones_fuente: list, regiones: list) -> bool:
    pedidas = {normalizar(r) for r in regiones}
    return any(normalizar(r) in pedidas for r in regiones_fuente)


def resolver_fuentes(pais: str, competidores: list, regiones: list, excluidos: list = ()):
    """Decide qué fuentes se consultan y cuáles se omiten, y por qué.

    Sin competidor ni región pedidos, solo se consultan fuentes del país del producto.
    Las que prohíben la consulta automatizada no se tocan nunca.
    """
    pedidos = {normalizar(c) for c in competidores}
    fuera = {normalizar(c) for c in excluidos}
    aplicables, omitidas = [], []
    for fuente in leer_fuentes().values():
        c = fuente["competidor"]
        nombres = {normalizar(c["id"]), normalizar(c["nombre"])}
        if nombres & fuera or (pedidos and not nombres & pedidos):
            continue
        omitida = {"id": c["id"], "nombre": c["nombre"]}
        if not c["permite_consulta_automatizada"]:
            omitidas.append({**omitida, "motivo": c["condiciones"]})
        elif regiones and not _opera_en(c["regiones"], regiones):
            omitidas.append({**omitida, "motivo": f"No opera en {', '.join(regiones)}."})
        elif not pedidos and not regiones and c["pais"] != pais:
            omitidas.append({**omitida, "motivo": f"Opera en {c['pais']}, otro país."})
        else:
            aplicables.append(fuente)
    return aplicables, omitidas


def buscar_candidatos(fuente: dict, texto: str, regiones: list, limite: int = 8) -> list:
    consulta = tokens(texto)
    puntuados = []
    for pub in fuente["productos"]:
        if regiones and not _opera_en(pub["regiones"], regiones):
            continue
        presentes = set(tokens(f"{pub['titulo']} {pub.get('marca') or ''}"))
        puntos = sum(t in presentes for t in consulta) / len(consulta)
        if puntos >= 0.5:
            puntuados.append((puntos, pub))
    puntuados.sort(key=lambda par: par[0], reverse=True)
    return [pub for _, pub in puntuados[:limite]]


def buscar_precios_competencia(producto_id: str, competidor: str = "", region: str = "") -> dict:
    """Busca publicaciones de un producto de Ragnar en los supermercados competidores.

    Los resultados son candidatos sin verificar: pueden ser otra marca, otro tamaño u otra
    variante. Para confirmar uno usa verificar_equivalencia.

    Args:
        producto_id: Identificador del catálogo, por ejemplo "RAG-00001".
        competidor: Nombre o id de un competidor. Vacío consulta todos los del país del producto.
        region: Región a consultar, por ejemplo "AMBA". Vacío para no filtrar.

    Returns:
        candidatos con competidor_id, sku, precios, url y fecha; y fuentes_omitidas con el motivo.
    """
    producto = buscar_producto(producto_id)
    if not producto:
        return {"error": f"No existe el producto {producto_id}."}

    regiones = [region] if region else []
    fuentes, omitidas = resolver_fuentes(producto["pais"], [competidor] if competidor else [], regiones)
    candidatos = []
    for fuente in fuentes:
        c = fuente["competidor"]
        for pub in buscar_candidatos(fuente, f"{producto['producto']} {producto['marca']}", regiones):
            promo = promocion_vigente(pub)
            candidatos.append({
                "competidor_id": c["id"], "competidor": c["nombre"], "sku": pub["sku"], "titulo": pub["titulo"],
                "marca": pub.get("marca"), "precio_regular": pub["precio_regular"], "moneda": pub["moneda"],
                "promocion": promo, "disponible": pub["disponible"], "url": pub["url"],
                "publicado": pub["publicado"],
            })
    return {
        "producto_id": producto_id,
        "competidores_consultados": [f["competidor"]["nombre"] for f in fuentes],
        "fuentes_omitidas": omitidas,
        "candidatos": candidatos,
        "fecha_consulta": date.today().isoformat(),
    }

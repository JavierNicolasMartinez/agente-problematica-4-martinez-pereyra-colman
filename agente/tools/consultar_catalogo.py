"""Herramienta F02: consulta del catálogo de Ragnar."""
from .comun.datos import leer_catalogo
from .comun.precios import RE_PACK, RE_SIMPLE, leer_presentacion
from .comun.texto import normalizar, tokens


def filtrar_catalogo(texto: str, categoria: str, marca: str, pais: str) -> list:
    buscados, presentacion = _separar_presentacion(texto)
    resultado = []
    for p in leer_catalogo():
        if categoria and normalizar(p["categoria"]) != normalizar(categoria):
            continue
        if marca and normalizar(p["marca"]) != normalizar(marca):
            continue
        if pais and normalizar(p["pais"]) != normalizar(pais):
            continue
        presentes = set(tokens(f"{p['producto']} {p['marca']} {p['categoria']}"))
        if all(t in presentes for t in buscados):
            resultado.append(p)
    exactos = [p for p in resultado if presentacion and _misma_presentacion(p, presentacion)]
    return exactos or resultado


def _separar_presentacion(nombre: str) -> tuple:
    """Separa "Yerba mate 500 g" en las palabras del nombre y su presentación."""
    sin_tamano = RE_SIMPLE.sub(" ", RE_PACK.sub(" ", normalizar(nombre)))
    return set(tokens(sin_tamano)), leer_presentacion(nombre)


def _misma_presentacion(producto: dict, presentacion: dict) -> bool:
    return (producto["unidad_medida"] == presentacion["unidad"]
            and producto["contenido"] == presentacion["contenido"])


def seleccionar_productos(ids: list, productos: list, marcas: list, categorias: list) -> list:
    """Selecciona el alcance de un informe: sin ids, combina nombre, marca y categoría."""
    if ids:
        pedidos = set(ids)
        return [p for p in leer_catalogo() if p["producto_id"] in pedidos]

    marcas_pedidas = {normalizar(m) for m in marcas}
    categorias_pedidas = {normalizar(c) for c in categorias}
    candidatos = [
        p for p in leer_catalogo()
        if (not marcas_pedidas or normalizar(p["marca"]) in marcas_pedidas)
        and (not categorias_pedidas or normalizar(p["categoria"]) in categorias_pedidas)
    ]
    if not productos:
        return candidatos

    elegidos = set()
    for pedido in productos:
        nombre, presentacion = _separar_presentacion(pedido)
        # El modelo a veces pasa una marca como producto: "Coca-Cola" también tiene que coincidir.
        por_nombre = [p for p in candidatos if nombre <= set(tokens(f"{p['producto']} {p['marca']}"))]
        exactos = [p for p in por_nombre if presentacion and _misma_presentacion(p, presentacion)]
        elegidos.update(p["producto_id"] for p in exactos or por_nombre)
    return [p for p in candidatos if p["producto_id"] in elegidos]


def consultar_catalogo(texto: str = "", categoria: str = "", marca: str = "", pais: str = "", limite: int = 20) -> dict:
    """Busca productos en el catálogo de Ragnar. Úsala siempre primero para obtener los producto_id.

    Args:
        texto: Palabras clave del nombre o la marca, por ejemplo "leche entera". Vacío para no filtrar.
        categoria: Una de: Alimentos, Bebidas, Limpieza, Higiene personal, Hogar. Vacío para no filtrar.
        marca: Marca exacta, por ejemplo "Dove". Vacío para no filtrar.
        pais: País de comercialización, por ejemplo "Argentina". Vacío para no filtrar.
        limite: Máximo de productos a devolver.

    Returns:
        total (productos que coinciden), mostrados y productos con su id, precio y presentación.
        Si total es 0, el producto no existe en el catálogo: no lo inventes.
    """
    encontrados = filtrar_catalogo(texto, categoria, marca, pais)
    return {"total": len(encontrados), "mostrados": min(len(encontrados), limite), "productos": encontrados[:limite]}

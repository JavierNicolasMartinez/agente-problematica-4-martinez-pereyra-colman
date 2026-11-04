"""Herramienta F02: consulta del catálogo de Ragnar."""
from .comun.datos import leer_catalogo
from .comun.texto import normalizar, tokens


def filtrar_catalogo(texto: str, categoria: str, marca: str, pais: str) -> list:
    buscados = tokens(texto)
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
    return resultado


def seleccionar_productos(ids: list, productos: list, marcas: list, categorias: list) -> list:
    """Selecciona el alcance de un informe: sin ids, combina nombre, marca y categoría."""
    if ids:
        pedidos = set(ids)
        return [p for p in leer_catalogo() if p["producto_id"] in pedidos]

    nombres = [set(tokens(n)) for n in productos]
    marcas_pedidas = {normalizar(m) for m in marcas}
    categorias_pedidas = {normalizar(c) for c in categorias}
    seleccion = []
    for p in leer_catalogo():
        # El modelo a veces pasa una marca como producto: "Coca-Cola" también tiene que coincidir.
        if nombres and not any(n <= set(tokens(f"{p['producto']} {p['marca']}")) for n in nombres):
            continue
        if marcas_pedidas and normalizar(p["marca"]) not in marcas_pedidas:
            continue
        if categorias_pedidas and normalizar(p["categoria"]) not in categorias_pedidas:
            continue
        seleccion.append(p)
    return seleccion


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

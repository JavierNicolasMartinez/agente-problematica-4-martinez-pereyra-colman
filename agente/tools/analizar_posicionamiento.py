"""Herramienta F07: analiza varios productos de una vez y clasifica cada uno."""
from datetime import date

from .buscar_precios_competencia import resolver_fuentes
from .comun.analisis import UMBRAL_SIGNIFICATIVO_PCT
from .comun.investigacion import buscar_en_fuentes, investigar_producto
from .consultar_catalogo import filtrar_catalogo


def _comparacion_breve(resultado: dict) -> dict:
    """Versión corta para análisis masivos: conserva precio y fuente sin saturar al modelo."""
    comparacion = resultado["comparacion"]
    breve = {
        "competidor": resultado["competidor"],
        "sku": resultado["publicacion"]["sku"],
        "titulo": resultado["publicacion"]["titulo"],
        "precio_regular": comparacion["precioRegular"],
        "base_comparacion": comparacion["base"],
        "diferencia_pct": comparacion["diferenciaRegular"]["porcentual"],
        "url": resultado["publicacion"]["url"],
    }
    if comparacion["promocion"]:
        breve["promocion"] = {
            "descripcion": comparacion["promocion"]["descripcion"],
            "precio_efectivo": comparacion["promocion"]["precioEfectivo"],
            "diferencia_pct": comparacion["diferenciaPromocional"]["porcentual"],
        }
    if comparacion["advertencias"]:
        breve["advertencias"] = comparacion["advertencias"]
    return breve


def analizar_posicionamiento(
    texto: str = "",
    categoria: str = "",
    marca: str = "",
    competidor: str = "",
    region: str = "",
    umbral_significativo: float = UMBRAL_SIGNIFICATIVO_PCT,
    limite: int = 30,
) -> dict:
    """Analiza varios productos de una vez: busca, verifica y compara cada uno.

    Úsala para responder preguntas amplias en texto, sin generar un informe.

    Args:
        texto: Palabras clave del nombre o la marca. Vacío para no filtrar.
        categoria: Una de: Alimentos, Bebidas, Limpieza, Higiene personal, Hogar. Vacío para no filtrar.
        marca: Marca exacta. Vacío para no filtrar.
        competidor: Nombre o id de un competidor. Vacío consulta todos los del país del producto.
        region: Región a consultar, por ejemplo "AMBA". Vacío para no filtrar.
        umbral_significativo: Diferencia porcentual mediana desde la que se marca como significativa.
        limite: Máximo de productos a analizar. El resumen solo cuenta los analizados.

    Returns:
        resumen con cantidades por clasificación y productos con sus comparaciones. Clasificaciones:
        mas_caro, mas_barato, en_linea, sin_coincidencias y no_confiable.
    """
    seleccion = filtrar_catalogo(texto, categoria, marca, "")
    competidores = [competidor] if competidor else []
    regiones = [region] if region else []
    resumen = {"mas_caro": 0, "mas_barato": 0, "en_linea": 0, "sin_coincidencias": 0,
               "no_confiable": 0, "significativas": 0}
    productos, consultados, omitidas = [], set(), {}

    for producto in seleccion[:limite]:
        fuentes, omitidas_producto = resolver_fuentes(producto["pais"], competidores, regiones)
        omitidas.update({o["id"]: o for o in omitidas_producto})
        consultados.update(f["competidor"]["nombre"] for f in fuentes)

        item = investigar_producto(producto, buscar_en_fuentes(producto, fuentes, regiones), umbral_significativo)
        analisis = item["analisis"]
        resumen[analisis["clasificacion"]] += 1
        resumen["significativas"] += analisis["significativa"]
        productos.append({
            "producto_id": producto["producto_id"], "producto": producto["producto"], "marca": producto["marca"],
            "presentacion": producto["presentacion"], "precio_ragnar": producto["precio"],
            "clasificacion": analisis["clasificacion"], "diferencia_mediana_pct": analisis["diferenciaMedianaPct"],
            "diferencia_significativa": analisis["significativa"],
            "comparaciones": [_comparacion_breve(r) for r in item["competidores"] if r["comparacion"]],
        })

    return {
        "total_coincidencias": len(seleccion),
        "analizados": len(productos),
        "competidores_consultados": sorted(consultados),
        "fuentes_omitidas": list(omitidas.values()),
        "resumen": resumen,
        "productos": productos,
        "fecha_consulta": date.today().isoformat(),
    }

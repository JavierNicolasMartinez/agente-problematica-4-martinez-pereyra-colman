"""Herramienta F05 y F06: diferencias de precio, regulares y promocionales."""
from datetime import date

from .comun.datos import buscar_producto, buscar_publicacion, convertir, leer_fuentes, leer_tipos_cambio
from .comun.precios import calcular_diferencias, etiqueta_referencia, precio_por_referencia, promocion_vigente
from .verificar_equivalencia import ESTADOS_COMPARABLES, PUBLICACION_INEXISTENTE, evaluar


def comparar(producto: dict, pub: dict, evaluacion: dict, competidor: dict) -> dict:
    moneda = producto["moneda"]
    regular = convertir(pub["precio_regular"], pub["moneda"], moneda)
    if regular is None:
        return {"comparable": False, "motivo": f"Sin tipo de cambio para {pub['moneda']}."}

    advertencias = []
    tipo_cambio = None
    if pub["moneda"] != moneda:
        datos = leer_tipos_cambio()
        tipo_cambio = {"desde": pub["moneda"], "hacia": moneda, "tasa": datos["tasas"][pub["moneda"]],
                       "fecha": datos["fecha"], "fuente": datos["fuente"]}
        advertencias.append(f"Precio convertido de {pub['moneda']} a {moneda}: {datos['aviso']}")
    if not pub["disponible"]:
        advertencias.append("La publicación figura sin stock.")

    promo = promocion_vigente(pub)
    promo_precio = convertir(promo["precio"], pub["moneda"], moneda) if promo else None

    unidad = producto["unidad_medida"]
    contenido = evaluacion["presentacion_leida"]["contenido"]
    ref_ragnar = precio_por_referencia(producto["precio"], producto["contenido"], unidad)
    ref_regular = precio_por_referencia(regular, contenido, unidad)
    ref_promo = precio_por_referencia(promo_precio, contenido, unidad) if promo else None

    # Misma presentación: se compara el envase. Distinta: el precio por kg, litro o unidad.
    misma = evaluacion["estado"] == "equivalente"
    base_ragnar = producto["precio"] if misma else ref_ragnar
    base_regular = regular if misma else ref_regular
    base_promo = promo_precio if misma else ref_promo

    return {
        "comparable": True,
        "base_comparacion": "envase" if misma else f"precio por {etiqueta_referencia(unidad)}",
        "ragnar": {"producto_id": producto["producto_id"], "precio": producto["precio"], "moneda": moneda,
                   "presentacion": producto["presentacion"], "precio_por_referencia": ref_ragnar},
        "competidor": {"id": competidor["id"], "nombre": competidor["nombre"], "sku": pub["sku"],
                       "titulo": pub["titulo"], "precio_regular": regular,
                       "precio_regular_original": pub["precio_regular"], "moneda_original": pub["moneda"],
                       "precio_por_referencia": ref_regular, "url": pub["url"], "publicado": pub["publicado"]},
        "unidad_referencia": etiqueta_referencia(unidad),
        "promocion": {**promo, "precio_efectivo": promo_precio, "precio_por_referencia": ref_promo} if promo else None,
        "diferencia_regular": calcular_diferencias(base_ragnar, base_regular),
        "diferencia_promocional": calcular_diferencias(base_ragnar, base_promo) if promo else None,
        "tipo_cambio": tipo_cambio,
        "advertencias": advertencias,
        "fecha_consulta": date.today().isoformat(),
    }


def comparar_precios(producto_id: str, competidor_id: str, sku: str) -> dict:
    """Calcula la diferencia de precio entre Ragnar y una publicación equivalente.

    La equivalencia se vuelve a verificar acá: si la publicación no es equivalente, no se
    compara. Una diferencia positiva significa que Ragnar está más caro que el competidor.

    Args:
        producto_id: Identificador del catálogo de Ragnar.
        competidor_id: Identificador del competidor.
        sku: Identificador de la publicación del competidor.

    Returns:
        Diferencias absoluta y porcentual, con precio regular y promocional por separado, más la
        fuente y la fecha de consulta. Si comparable es false, informa el motivo sin dar precios.
    """
    producto, pub = buscar_producto(producto_id), buscar_publicacion(competidor_id, sku)
    if not producto or not pub:
        return {"comparable": False, "motivo": PUBLICACION_INEXISTENTE}
    evaluacion = evaluar(producto, pub)
    if evaluacion["estado"] not in ESTADOS_COMPARABLES:
        return {"comparable": False, "motivo": f"Estado {evaluacion['estado']}.", "criterios": evaluacion["criterios"]}
    return comparar(producto, pub, evaluacion, leer_fuentes()[competidor_id]["competidor"])

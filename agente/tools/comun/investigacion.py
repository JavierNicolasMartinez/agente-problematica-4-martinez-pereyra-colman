"""Investigación de un producto en varias fuentes: búsqueda, verificación y comparación.

La usan analizar_posicionamiento y generar_informe, para que ambas lleguen al mismo resultado.
"""
from datetime import datetime, timezone

from ..buscar_precios_competencia import buscar_candidatos
from ..comparar_precios import comparar
from ..verificar_equivalencia import ESTADOS_COMPARABLES, evaluar_candidatos
from .analisis import clasificar
from .datos import ids_mismo_articulo, producto_publico


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def buscar_en_fuentes(producto: dict, fuentes: list, regiones: list) -> list:
    consulta = f"{producto['producto']} {producto['marca']}"
    return [
        {"fuente": fuente, "consulta": consulta, "consultado_en": ahora_iso(),
         "candidatos": buscar_candidatos(fuente, consulta, regiones)}
        for fuente in fuentes
    ]


def _comparacion_publica(comparacion: dict, pub: dict) -> dict:
    """Pasa una comparación a la forma que consume el frontend."""
    promo = comparacion["promocion"]
    competidor = comparacion["competidor"]
    return {
        "comparable": True,
        "base": "envase" if comparacion["base_comparacion"] == "envase" else "unidad_referencia",
        "unidadReferencia": comparacion["unidad_referencia"],
        "precioRegular": competidor["precio_regular"],
        "precioRegularOriginal": competidor["precio_regular_original"],
        "monedaOriginal": competidor["moneda_original"],
        "precioPorReferencia": competidor["precio_por_referencia"],
        "promocion": promo and {
            **pub["promocion"],
            "precioEfectivo": promo["precio_efectivo"],
            "precioEfectivoPorReferencia": promo["precio_por_referencia"],
            "condicion": promo["condicion"],
        },
        "diferenciaRegular": comparacion["diferencia_regular"],
        "diferenciaPromocional": comparacion["diferencia_promocional"],
        "tipoCambio": comparacion["tipo_cambio"],
        "advertencias": comparacion["advertencias"],
    }


def _resultado_competidor(producto: dict, busqueda: dict) -> dict:
    competidor = busqueda["fuente"]["competidor"]
    evaluados = evaluar_candidatos(producto, busqueda["candidatos"])
    mejor = evaluados[0] if evaluados else None
    pub, evaluacion = mejor if mejor else (None, None)

    comparacion = None
    if mejor and evaluacion["estado"] in ESTADOS_COMPARABLES:
        calculada = comparar(producto, pub, evaluacion, competidor)
        if calculada["comparable"]:
            comparacion = _comparacion_publica(calculada, pub)

    return {
        "competidorId": competidor["id"],
        "competidor": competidor["nombre"],
        "consulta": busqueda["consulta"],
        "consultadoEn": busqueda["consultado_en"],
        "candidatosEvaluados": sum(e["estado"] != "descartado" for _, e in evaluados),
        "descartados": sum(e["estado"] == "descartado" for _, e in evaluados),
        "estado": evaluacion["estado"] if mejor else "sin_resultados",
        "confianza": evaluacion["confianza"] if mejor else None,
        "criterios": evaluacion["criterios"] if mejor else [],
        "publicacion": pub,
        "comparacion": comparacion,
        "descartes": [
            {"titulo": p["titulo"], "estado": e["estado"], "url": p["url"],
             "motivo": next((c["detalle"] for c in e["criterios"] if c["resultado"] != "ok"), None)}
            for p, e in evaluados[1:5]
        ],
    }


def investigar_producto(producto: dict, busquedas: list, umbral_pct: float) -> dict:
    """Arma el resultado de un producto: una fila por competidor y su clasificación."""
    resultados = [_resultado_competidor(producto, b) for b in busquedas]
    comparados = [r for r in resultados if r["comparacion"]]
    porcentajes = [r["comparacion"]["diferenciaRegular"]["porcentual"] for r in comparados]
    hubo_candidatos = any(r["candidatosEvaluados"] for r in resultados)

    analisis = clasificar(porcentajes, hubo_candidatos, umbral_pct)
    if comparados:
        mas_barato = max(comparados, key=lambda r: r["comparacion"]["diferenciaRegular"]["porcentual"])
        analisis["competidorMasBarato"] = (
            mas_barato["competidorId"] if mas_barato["comparacion"]["diferenciaRegular"]["porcentual"] > 0 else None
        )
        analisis["tienePromociones"] = any(r["comparacion"]["promocion"] for r in comparados)

    return {
        "producto": producto_publico(producto),
        "repetidoEnCatalogo": bool(ids_mismo_articulo(producto)),
        "competidores": resultados,
        "analisis": analisis,
    }

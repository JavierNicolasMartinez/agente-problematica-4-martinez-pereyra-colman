"""Clasificación de un producto frente a la competencia (F07)."""
from statistics import median

UMBRAL_SIGNIFICATIVO_PCT = 10.0
TOLERANCIA_EN_LINEA_PCT = 1.0


def clasificar(porcentajes: list, hubo_candidatos: bool, umbral_pct: float) -> dict:
    """Clasifica contra la MEDIANA de las diferencias, para que un solo precio raro no decida."""
    if not porcentajes:
        return {
            "clasificacion": "no_confiable" if hubo_candidatos else "sin_coincidencias",
            "significativa": False,
            "diferenciaMedianaPct": None,
            "competidoresComparados": 0,
        }
    diferencia = round(median(porcentajes), 1)
    if diferencia > TOLERANCIA_EN_LINEA_PCT:
        clasificacion = "mas_caro"
    elif diferencia < -TOLERANCIA_EN_LINEA_PCT:
        clasificacion = "mas_barato"
    else:
        clasificacion = "en_linea"
    return {
        "clasificacion": clasificacion,
        "significativa": abs(diferencia) >= umbral_pct,
        "diferenciaMedianaPct": diferencia,
        "rango": {"minPct": min(porcentajes), "maxPct": max(porcentajes)},
        "competidoresComparados": len(porcentajes),
    }

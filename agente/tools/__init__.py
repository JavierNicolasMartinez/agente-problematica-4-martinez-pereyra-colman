"""Herramientas del agente de precios de Ragnar.

Regla de diseño: el modelo nunca le pasa precios a una herramienta. Solo pasa
identificadores (producto_id, competidor_id, sku) y los precios se leen siempre
de los datos. Así el agente no puede inventar ni alterar un precio.
"""
from .analizar_posicionamiento import analizar_posicionamiento
from .buscar_precios_competencia import buscar_precios_competencia
from .comparar_precios import comparar_precios
from .consultar_catalogo import consultar_catalogo
from .consultar_documentos import consultar_documentos
from .generar_informe import generar_informe
from .verificar_equivalencia import verificar_equivalencia

__all__ = [
    "analizar_posicionamiento",
    "buscar_precios_competencia",
    "comparar_precios",
    "consultar_catalogo",
    "consultar_documentos",
    "generar_informe",
    "verificar_equivalencia",
]

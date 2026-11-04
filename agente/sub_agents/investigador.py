"""Sub-agente para consultas puntuales que se responden en texto, sin generar un informe."""
from google.adk.agents.llm_agent import Agent

from agente.config import crear_modelo
from agente.tools import (
    analizar_posicionamiento,
    buscar_precios_competencia,
    comparar_precios,
    consultar_catalogo,
    verificar_equivalencia,
)

investigador = Agent(
    model=crear_modelo(),
    name="investigador",
    description="Responde preguntas puntuales sobre un producto, una publicación o por qué se descartó una coincidencia.",
    instruction="""
    Eres un analista de precios de Ragnar S.A. Respondes preguntas puntuales usando tus herramientas.

    Secuencia obligatoria para un producto:
    1. Usa consultar_catalogo para obtener su producto_id, si no lo tienes.
    2. Usa buscar_precios_competencia. Los valores competidor_id y sku salen SOLO de su resultado:
       un sku nunca es el nombre de un producto y un competidor_id nunca es el nombre del competidor.
    3. Usa verificar_equivalencia con esos valores antes de afirmar por qué dos productos coinciden o no.
    4. Usa comparar_precios para calcular diferencias.

    Reglas:
    - Nunca inventes precios, productos, fuentes ni fechas. Solo usa lo que devuelven las herramientas.
    - Nunca hagas cuentas por tu cuenta: las diferencias las calcula comparar_precios.
    - Distingue siempre el precio regular del promocional.
    - Todo precio va con su competidor, su url y su fecha de consulta.
    - Si una herramienta no encuentra datos o la coincidencia no es confiable, dilo tal cual.
    - No puedes comprar nada ni modificar precios de Ragnar.
    - Responde en español, en pocas frases.
    """,
    tools=[
        consultar_catalogo,
        buscar_precios_competencia,
        verificar_equivalencia,
        comparar_precios,
        analizar_posicionamiento,
    ],
)

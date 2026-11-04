"""Ejecuta el agente ADK y traduce su resultado a la respuesta que espera el frontend."""
import asyncio
import json
import logging
import re
from time import perf_counter

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agente.agent import root_agent
from agente.tools.generar_informe import datos_para_comentar, retirar_informe

from .sesiones import Sesion

logger = logging.getLogger(__name__)

NOMBRE_APP = "agente_precios"
USUARIO = "empleado"
TIEMPO_MAXIMO_SEGUNDOS = 180

MENSAJE_ACLARACION = "No identifiqué qué productos investigar. Indicá un producto, marca, categoría o ID del catálogo."
SUGERENCIAS = [
    "Compará la yerba mate en todos los competidores",
    "Productos de limpieza más caros que la competencia en AMBA",
    "Bebidas con diferencias mayores al 15 %",
    "Precios de Coca-Cola en Hiper Delta y SuperCiudad",
]

_sesiones_adk = InMemorySessionService()
_runner = Runner(app_name=NOMBRE_APP, agent=root_agent, session_service=_sesiones_adk)


class ModeloNoDisponible(Exception):
    """El modelo no respondió: Ollama apagado, sin sesión iniciada o sin conexión."""


def _interpretacion_vacia(mensaje: str) -> dict:
    return {
        "ids": [], "productos": [], "marcas": [], "categorias": [], "competidores": [], "regiones": [],
        "filtros": {}, "competidoresExcluidos": [], "todoElCatalogo": False, "limite": None,
        "mensaje": mensaje, "esContinuacion": False, "intencion": "aclarar", "notas": [], "palabrasClave": [],
    }


async def _preparar_sesion_adk(sesion: Sesion, nuevo_analisis: bool) -> None:
    """Un análisis nuevo abre otra conversación: el modelo no arrastra el contexto anterior."""
    if nuevo_analisis or not sesion.id_adk:
        adk = await _sesiones_adk.create_session(app_name=NOMBRE_APP, user_id=USUARIO)
        sesion.id_adk = adk.id


async def _correr_agente(sesion: Sesion, mensaje: str) -> tuple:
    contenido = types.Content(role="user", parts=[types.Part(text=mensaje)])
    informe_id, texto = None, ""
    eventos = _runner.run_async(user_id=USUARIO, session_id=sesion.id_adk, new_message=contenido)
    try:
        async for evento in eventos:
            for respuesta in evento.get_function_responses():
                if respuesta.name == "generar_informe" and "informe_id" in (respuesta.response or {}):
                    informe_id = respuesta.response["informe_id"]
            if evento.is_final_response() and evento.content and evento.content.parts:
                texto = " ".join(p.text for p in evento.content.parts if p.text and not p.thought).strip()
    except Exception:
        # El informe ya está calculado: si falla el comentario, se entrega igual.
        if not informe_id:
            raise
        logger.exception("Falló el comentario del informe")
    return informe_id, texto


def _numeros(texto: str) -> set:
    return {float(n.replace(".", "").replace(",", ".")) if "," in n else float(n)
            for n in re.findall(r"\d+(?:[.,]\d+)?", texto)}


def _comentario_seguro(texto: str, informe: dict, mensaje: str) -> str | None:
    """Descarta el comentario si cita un número que no salió de los datos calculados."""
    if not texto:
        return None
    permitidos = _numeros(json.dumps(datos_para_comentar(informe), ensure_ascii=False) + mensaje)
    if _numeros(texto) <= permitidos:
        return texto
    logger.warning("Se descartó un comentario con números que no figuran en el informe")
    return None


async def ejecutar_consulta(mensaje: str, sesion: Sesion, nuevo_analisis: bool) -> dict:
    async with sesion.bloqueo:
        await _preparar_sesion_adk(sesion, nuevo_analisis)
        inicio = perf_counter()
        try:
            async with asyncio.timeout(TIEMPO_MAXIMO_SEGUNDOS):
                informe_id, texto = await _correr_agente(sesion, mensaje)
        except Exception as error:
            logger.exception("Falló la ejecución del agente")
            raise ModeloNoDisponible from error
        duracion_total = round((perf_counter() - inicio) * 1000)

    informe = retirar_informe(informe_id) if informe_id else None
    if informe:
        # La interpretación es la llamada al modelo: es casi todo el tiempo de la consulta.
        pasos = informe["pasos"]
        pasos[0]["duracionMs"] = max(duracion_total - sum(p["duracionMs"] for p in pasos[1:]), 0)
        informe["comentarioAgente"] = _comentario_seguro(texto, informe, mensaje)
        sesion.guardar_informe(informe)
        return {"tipo": "informe", "interpretacion": informe["interpretacion"], "informe": informe}

    return {
        "tipo": "aclaracion",
        "interpretacion": _interpretacion_vacia(mensaje),
        "mensaje": texto or MENSAJE_ACLARACION,
        "sugerencias": SUGERENCIAS,
        "pasos": [{"id": "interpretar", "titulo": "Interpretar la solicitud",
                   "detalle": "El agente respondió sin generar un informe.", "duracionMs": duracion_total}],
    }

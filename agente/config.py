"""Configuración del modelo del agente."""
import os

from google.adk.models.lite_llm import LiteLlm

MODELO = os.environ.get("MODELO_AGENTE", "ollama_chat/gemma4:31b-cloud")
os.environ.setdefault("OLLAMA_API_BASE", "http://localhost:11434")


def crear_modelo() -> LiteLlm:
    return LiteLlm(MODELO)

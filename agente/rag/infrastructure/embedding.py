import os

from langchain_ollama import OllamaEmbeddings

MODELO_EMBEDDING = os.environ.get("MODELO_EMBEDDING", "nomic-embed-text")


class EmbeddingModel:
    @staticmethod
    def get_model_embedding() -> OllamaEmbeddings:
        return OllamaEmbeddings(
            model=MODELO_EMBEDDING,
            base_url=os.environ.get("OLLAMA_API_BASE", "http://localhost:11434"),
        )

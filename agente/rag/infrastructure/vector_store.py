from pathlib import Path

from langchain_chroma import Chroma

from .embedding import EmbeddingModel

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
PERSIST_DIRECTORY = DATA_DIR / "vector_store"


class VectorStore:
    def __init__(self) -> None:
        self.embedding = EmbeddingModel.get_model_embedding()

    def _get_vector_store(self, collection_name: str) -> Chroma:
        return Chroma(
            collection_name=collection_name,
            embedding_function=self.embedding,
            persist_directory=str(PERSIST_DIRECTORY),
            collection_metadata={"hnsw:space": "cosine"},
        )

    def add_documents(self, collection_name: str, docs: list) -> list:
        vector_store = self._get_vector_store(collection_name=collection_name)
        return vector_store.add_documents(documents=docs)

    def search_documents(self, collection_name: str, query: str, k: int = 5) -> list:
        """Devuelve pares (documento, similitud), del más parecido al menos parecido."""
        vector_store = self._get_vector_store(collection_name=collection_name)
        return vector_store.similarity_search_with_relevance_scores(query=query, k=k)

    def delete_source(self, collection_name: str, source: str) -> None:
        vector_store = self._get_vector_store(collection_name=collection_name)
        vector_store.delete(where={"source": source})

    def list_metadatas(self, collection_name: str) -> list:
        vector_store = self._get_vector_store(collection_name=collection_name)
        return vector_store.get(include=["metadatas"])["metadatas"]

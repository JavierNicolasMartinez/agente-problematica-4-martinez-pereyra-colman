import re
from collections import Counter

from langchain_community.document_loaders import PyPDFLoader
from langchain_experimental.text_splitter import SemanticChunker

from agente.rag.infrastructure import EmbeddingModel, VectorStore
from agente.rag.schemas import DocumentSchema, RetrieveSchema

COLECCION_DOCUMENTOS = "documentos"


class DocumentService:
    def __init__(self) -> None:
        self.vector_store = VectorStore()
        self.embedding = EmbeddingModel.get_model_embedding()

    def add_documents(self, data: DocumentSchema) -> list:
        try:
            paginas = PyPDFLoader(str(data.path)).load()
        except Exception as error:
            raise ValueError("El PDF está dañado o protegido y no se puede leer.") from error
        for pagina in paginas:
            # Algunos PDF salen con un salto de línea por palabra: el chunker necesita las oraciones enteras.
            pagina.page_content = re.sub(r"\s+", " ", pagina.page_content).strip()
            pagina.metadata["source"] = data.path.name

        splitter = SemanticChunker(embeddings=self.embedding)
        chunks = splitter.split_documents([p for p in paginas if p.page_content])
        if not chunks:
            raise ValueError("El PDF no tiene texto para indexar.")

        # Volver a subir un archivo lo reemplaza, en lugar de duplicar sus fragmentos.
        self.vector_store.delete_source(data.collection_name, data.path.name)
        return self.vector_store.add_documents(collection_name=data.collection_name, docs=chunks)

    def retrieve(self, data: RetrieveSchema) -> list:
        resultados = self.vector_store.search_documents(
            collection_name=data.collection_name, query=data.query, k=data.k
        )
        return [
            {
                "texto": documento.page_content,
                "fuente": documento.metadata["source"],
                "pagina": documento.metadata.get("page", 0) + 1,
                "puntaje": round(puntaje, 3),
            }
            for documento, puntaje in resultados
        ]

    def list_documents(self, collection_name: str) -> list:
        fragmentos = Counter(m["source"] for m in self.vector_store.list_metadatas(collection_name))
        return [{"nombre": nombre, "fragmentos": cantidad} for nombre, cantidad in sorted(fragmentos.items())]

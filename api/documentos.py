"""Rutas para cargar y listar los documentos PDF del RAG."""
import logging
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from agente.rag.infrastructure.vector_store import DATA_DIR
from agente.rag.schemas import DocumentSchema
from agente.rag.services import COLECCION_DOCUMENTOS, DocumentService

logger = logging.getLogger(__name__)

DOCUMENT_DIR = DATA_DIR / "documentos"
MAX_BYTES_PDF = 20 * 1024 * 1024

router = APIRouter(prefix="/api/documentos")


def _nombre_seguro(archivo: UploadFile) -> str:
    nombre = Path((archivo.filename or "").replace("\\", "/")).name
    if not nombre.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se pueden cargar archivos PDF.")
    if archivo.file.read(5) != b"%PDF-":
        raise HTTPException(400, "El archivo no es un PDF válido.")
    archivo.file.seek(0)
    return nombre


@router.get("")
def listar() -> dict:
    return {"documentos": DocumentService().list_documents(COLECCION_DOCUMENTOS)}


@router.post("")
def cargar(archivo: UploadFile = File(...)) -> dict:
    nombre = _nombre_seguro(archivo)
    with tempfile.TemporaryDirectory() as carpeta:
        # Se guarda aparte hasta indexarlo: si falla, el documento anterior queda intacto.
        temporal = Path(carpeta) / nombre
        with open(temporal, "wb") as destino:
            shutil.copyfileobj(archivo.file, destino)
        servicio = DocumentService()
        try:
            ids = servicio.add_documents(DocumentSchema(collection_name=COLECCION_DOCUMENTOS, path=temporal))
        except ValueError as error:
            raise HTTPException(400, str(error)) from error
        except Exception as error:
            logger.exception("Falló la indexación del documento")
            mensaje = "No se pudo indexar el documento. Verificá que Ollama esté corriendo y tenga nomic-embed-text."
            raise HTTPException(503, mensaje) from error
        DOCUMENT_DIR.mkdir(exist_ok=True)
        shutil.move(temporal, DOCUMENT_DIR / nombre)
    return {"nombre": nombre, "fragmentos": len(ids)}

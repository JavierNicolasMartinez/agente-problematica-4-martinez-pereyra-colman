from pathlib import Path

from pydantic import BaseModel, Field


class DocumentSchema(BaseModel):
    collection_name: str = Field(description="Nombre de la colección")
    path: Path = Field(description="Dirección donde está el documento")


class RetrieveSchema(BaseModel):
    collection_name: str
    query: str
    k: int = 5

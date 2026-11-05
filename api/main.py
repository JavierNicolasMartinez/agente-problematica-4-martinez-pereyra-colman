"""Servidor de la aplicación: expone el agente al frontend y, si está compilado, lo sirve."""
import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException

from .documentos import MAX_BYTES_PDF
from .documentos import router as router_documentos
from .rutas import router
from .servicio_agente import ModeloNoDisponible

DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
MAX_BYTES_CUERPO = 10 * 1024
RUTA_DOCUMENTOS = "/api/documentos"
ORIGENES = os.environ.get("ORIGENES_PERMITIDOS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
CABECERAS_SEGURIDAD = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:",
}
DETALLES_GENERICOS = {"Not Found", "Method Not Allowed"}

app = FastAPI(title="Agente de precios de Ragnar", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ORIGENES, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.middleware("http")
async def proteger(request: Request, call_next):
    limite = MAX_BYTES_PDF if request.url.path == RUTA_DOCUMENTOS else MAX_BYTES_CUERPO
    if int(request.headers.get("content-length") or 0) > limite:
        return JSONResponse({"error": "La solicitud es demasiado grande."}, status_code=413)
    respuesta = await call_next(request)
    respuesta.headers.update(CABECERAS_SEGURIDAD)
    return respuesta


@app.exception_handler(RequestValidationError)
async def error_validacion(_: Request, error: RequestValidationError) -> JSONResponse:
    errores = error.errors()
    if any(e["type"] == "json_invalid" for e in errores):
        return JSONResponse({"error": "JSON mal formado."}, status_code=400)
    detalles = [
        {"campo": ".".join(str(parte) for parte in e["loc"][1:]), "problema": e["msg"].removeprefix("Value error, ")}
        for e in errores
    ]
    return JSONResponse({"error": "Datos inválidos.", "detalles": detalles}, status_code=400)


@app.exception_handler(HTTPException)
async def error_http(_: Request, error: HTTPException) -> JSONResponse:
    mensaje = "Recurso no encontrado." if error.detail in DETALLES_GENERICOS else error.detail
    return JSONResponse({"error": mensaje}, status_code=error.status_code)


@app.exception_handler(ModeloNoDisponible)
async def error_modelo(_: Request, __: ModeloNoDisponible) -> JSONResponse:
    mensaje = "El modelo no respondió. Verificá que Ollama esté corriendo y que hayas iniciado sesión con ollama signin."
    return JSONResponse({"error": mensaje}, status_code=503)


@app.exception_handler(Exception)
async def error_interno(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse({"error": "Error interno del servidor."}, status_code=500)


app.include_router(router)
app.include_router(router_documentos)


@app.get("/{ruta:path}", include_in_schema=False)
def frontend(ruta: str) -> FileResponse:
    if ruta.startswith("api/") or not DIST.is_dir():
        raise HTTPException(404)
    archivo = (DIST / ruta).resolve()
    if archivo.is_file() and archivo.is_relative_to(DIST):
        return FileResponse(archivo)
    return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    uvicorn.run("api.main:app", host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", "3001")))

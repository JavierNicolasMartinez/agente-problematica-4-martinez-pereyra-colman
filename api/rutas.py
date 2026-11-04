"""Rutas /api que consume el frontend."""
from collections import Counter, deque
from datetime import date
from time import monotonic
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, field_validator

from agente.tools.comun.datos import buscar_producto, leer_catalogo, leer_fuentes, leer_tipos_cambio, producto_publico
from agente.tools.comun.texto import normalizar, tokens

from .exportador import a_csv, a_markdown
from .servicio_agente import SUGERENCIAS, ejecutar_consulta
from .sesiones import almacen

MIN_LARGO_MENSAJE = 3
MAX_LARGO_MENSAJE = 500
CONSULTAS_POR_MINUTO = 30

router = APIRouter(prefix="/api")
_consultas_recientes = {}


class Consulta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mensaje: str
    sesionId: UUID | None = None
    nuevoAnalisis: bool = False

    @field_validator("mensaje")
    @classmethod
    def validar_mensaje(cls, valor: str) -> str:
        valor = valor.strip()
        if len(valor) < MIN_LARGO_MENSAJE:
            raise ValueError("Escribí al menos 3 caracteres.")
        if len(valor) > MAX_LARGO_MENSAJE:
            raise ValueError(f"Escribí como máximo {MAX_LARGO_MENSAJE} caracteres.")
        return valor


def _controlar_frecuencia(cliente: str) -> None:
    """Cada consulta consume el modelo en la nube: limita cuántas puede hacer cada cliente."""
    ahora = monotonic()
    recientes = _consultas_recientes.setdefault(cliente, deque())
    while recientes and ahora - recientes[0] > 60:
        recientes.popleft()
    if len(recientes) >= CONSULTAS_POR_MINUTO:
        raise HTTPException(429, "Demasiadas consultas. Esperá un minuto.")
    recientes.append(ahora)


@router.get("/salud")
def salud() -> dict:
    return {"estado": "ok", "productosCatalogo": len(leer_catalogo()), "fuentes": len(leer_fuentes()),
            "fecha": date.today().isoformat()}


@router.get("/agente/sugerencias")
def sugerencias() -> dict:
    return {"sugerencias": SUGERENCIAS}


@router.post("/agente/consultas")
async def consultar(consulta: Consulta, request: Request) -> dict:
    _controlar_frecuencia(request.client.host if request.client else "desconocido")
    if consulta.sesionId:
        sesion = almacen.obtener(str(consulta.sesionId))
        if not sesion:
            raise HTTPException(404, "La sesión no existe o venció. Empezá una nueva.")
    else:
        sesion = almacen.crear()
    resultado = await ejecutar_consulta(consulta.mensaje, sesion, consulta.nuevoAnalisis)
    return {"sesionId": sesion.id, **resultado}


@router.get("/catalogo")
def catalogo(
    q: str = Query("", max_length=80),
    categoria: str = Query("", max_length=40),
    marca: str = Query("", max_length=40),
    pagina: int = Query(1, ge=1, le=1000),
    limite: int = Query(25, ge=1, le=100),
) -> dict:
    buscados = tokens(q.strip())
    productos = []
    for p in leer_catalogo():
        if categoria and normalizar(p["categoria"]) != normalizar(categoria):
            continue
        if marca and normalizar(p["marca"]) != normalizar(marca):
            continue
        texto = " ".join(tokens(f"{p['producto']} {p['marca']} {p['categoria']} {p['presentacion']} {p['producto_id']}"))
        if all(t in texto for t in buscados):
            productos.append(p)
    inicio = (pagina - 1) * limite
    return {"total": len(productos), "pagina": pagina, "limite": limite,
            "productos": [producto_publico(p) for p in productos[inicio:inicio + limite]]}


@router.get("/catalogo/facetas")
def facetas() -> dict:
    def contar(campo: str) -> list:
        cantidades = Counter(p[campo] for p in leer_catalogo())
        return [{"nombre": n, "cantidad": c} for n, c in sorted(cantidades.items(), key=lambda par: normalizar(par[0]))]

    return {"total": len(leer_catalogo()), "categorias": contar("categoria"), "marcas": contar("marca"),
            "productos": contar("producto"), "paises": contar("pais")}


@router.get("/catalogo/{producto_id}")
def producto(producto_id: str) -> dict:
    encontrado = buscar_producto(producto_id)
    if not encontrado:
        raise HTTPException(404, "Producto no encontrado.")
    return producto_publico(encontrado)


@router.get("/competidores")
def competidores() -> dict:
    lista = [
        {"id": c["id"], "nombre": c["nombre"], "sitio": c["sitio"], "pais": c["pais"], "moneda": c["moneda"],
         "regiones": c["regiones"], "permiteConsulta": c["permite_consulta_automatizada"],
         "condiciones": c["condiciones"], "tipoFuente": "simulado"}
        for c in (f["competidor"] for f in leer_fuentes().values())
    ]
    return {"competidores": lista, "tiposCambio": leer_tipos_cambio()}


def _buscar_informe(sesion_id: UUID, informe_id: UUID) -> dict:
    sesion = almacen.obtener(str(sesion_id))
    informe = sesion.informes.get(str(informe_id)) if sesion else None
    if not informe:
        raise HTTPException(404, "Informe no encontrado.")
    return informe


@router.get("/sesiones/{sesion_id}/informes/{informe_id}")
def informe(sesion_id: UUID, informe_id: UUID) -> dict:
    return _buscar_informe(sesion_id, informe_id)


@router.get("/sesiones/{sesion_id}/informes/{informe_id}/exportar")
def exportar(sesion_id: UUID, informe_id: UUID, formato: Literal["csv", "md"] = "csv") -> Response:
    encontrado = _buscar_informe(sesion_id, informe_id)
    contenido, tipo = (a_csv(encontrado), "text/csv") if formato == "csv" else (a_markdown(encontrado), "text/markdown")
    nombre = f"informe-precios-{encontrado['fecha'][:10]}.{formato}"
    return Response(contenido, media_type=f"{tipo}; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}"'})

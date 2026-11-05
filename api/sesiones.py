"""Sesiones en memoria: guardan los informes de cada empleado para exportarlos y continuar (F10)."""
import asyncio
from collections import OrderedDict
from dataclasses import dataclass, field
from time import monotonic
from uuid import uuid4

MAX_SESIONES = 500
MAX_INFORMES_POR_SESION = 25
DURACION_SESION_SEGUNDOS = 2 * 60 * 60


@dataclass
class Sesion:
    id: str = field(default_factory=lambda: str(uuid4()))
    id_adk: str | None = None
    informes: OrderedDict = field(default_factory=OrderedDict)
    ultimo_uso: float = field(default_factory=monotonic)
    bloqueo: asyncio.Lock = field(default_factory=asyncio.Lock)

    def guardar_informe(self, informe: dict) -> None:
        self.informes[informe["id"]] = informe
        while len(self.informes) > MAX_INFORMES_POR_SESION:
            self.informes.popitem(last=False)


class AlmacenSesiones:
    def __init__(self):
        self._sesiones = OrderedDict()

    def _limpiar_vencidas(self) -> None:
        limite = monotonic() - DURACION_SESION_SEGUNDOS
        for sesion in [s for s in self._sesiones.values() if s.ultimo_uso < limite]:
            del self._sesiones[sesion.id]

    def crear(self) -> Sesion:
        self._limpiar_vencidas()
        while len(self._sesiones) >= MAX_SESIONES:
            self._sesiones.popitem(last=False)
        sesion = Sesion()
        self._sesiones[sesion.id] = sesion
        return sesion

    def obtener(self, sesion_id: str) -> Sesion | None:
        self._limpiar_vencidas()
        sesion = self._sesiones.get(sesion_id)
        if sesion:
            sesion.ultimo_uso = monotonic()
            self._sesiones.move_to_end(sesion_id)
        return sesion


almacen = AlmacenSesiones()

/**
 * Cliente de la API. Todas las llamadas pasan por acá para manejar errores en un solo lugar.
 */
async function pedir(ruta, opciones = {}) {
  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo el backend?');
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(datos.detalles?.[0]?.problema || datos.error || `Error ${res.status}`);
    error.estado = res.status;
    throw error;
  }
  return datos;
}

export const api = {
  consultar: (mensaje, sesionId, nuevoAnalisis = false) => pedir('/agente/consultas', {
    method: 'POST',
    body: JSON.stringify({ mensaje, nuevoAnalisis, ...(sesionId ? { sesionId } : {}) }),
  }),
  sugerencias: () => pedir('/agente/sugerencias'),
  catalogo: (params) => pedir(`/catalogo?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))}`),
  facetas: () => pedir('/catalogo/facetas'),
  competidores: () => pedir('/competidores'),
  documentos: () => pedir('/documentos'),
  subirDocumento: async (archivo) => {
    const datos = new FormData();
    datos.append('archivo', archivo);
    const res = await fetch('/api/documentos', { method: 'POST', body: datos }).catch(() => null);
    if (!res) throw new Error('No se pudo conectar con el servidor. ¿Está corriendo el backend?');
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
    return cuerpo;
  },
  informe: (sesionId, informeId) => pedir(`/sesiones/${encodeURIComponent(sesionId)}/informes/${encodeURIComponent(informeId)}`),
  urlExportar: (sesionId, informeId, formato) => `/api/sesiones/${encodeURIComponent(sesionId)}/informes/${encodeURIComponent(informeId)}/exportar?formato=${formato}`,
};

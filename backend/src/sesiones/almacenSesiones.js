/**
 * F10 — Gestión de consultas.
 * Guarda en memoria cada sesión de trabajo con su historial de consultas e informes,
 * para poder continuar un análisis ("ahora solo en Córdoba").
 *
 * Límites para evitar abuso de memoria: cantidad máxima de sesiones, de informes por
 * sesión y vencimiento por inactividad. Al reiniciar el servidor se pierde todo
 * (reemplazable por una base de datos sin cambiar la interfaz).
 */
import crypto from 'node:crypto';
import { config } from '../config.js';

const sesiones = new Map();
const informes = new Map(); // idInforme -> { sesionId, informe }

function limpiarVencidas(ahora = Date.now()) {
  for (const [id, s] of sesiones) {
    if (ahora - s.ultimaActividad > config.vidaSesionMs) borrar(id);
  }
}

function borrar(id) {
  const s = sesiones.get(id);
  if (!s) return;
  for (const i of s.informes) informes.delete(i);
  sesiones.delete(id);
}

export const almacen = {
  crear() {
    limpiarVencidas();
    if (sesiones.size >= config.maxSesiones) {
      // Se descarta la sesión con más tiempo sin uso.
      const masVieja = [...sesiones.values()].sort((a, b) => a.ultimaActividad - b.ultimaActividad)[0];
      borrar(masVieja.id);
    }
    const s = { id: crypto.randomUUID(), creada: new Date().toISOString(), ultimaActividad: Date.now(), historial: [], informes: [], ultimaInterpretacion: null };
    sesiones.set(s.id, s);
    return s;
  },

  obtener(id) {
    const s = sesiones.get(id);
    if (!s) return null;
    if (Date.now() - s.ultimaActividad > config.vidaSesionMs) { borrar(id); return null; }
    return s;
  },

  registrar(sesion, { mensaje, interpretacion, informe }) {
    sesion.ultimaActividad = Date.now();
    sesion.historial.push({ mensaje, fecha: new Date().toISOString(), informeId: informe?.id ?? null, intencion: interpretacion.intencion });
    if (interpretacion.intencion === 'investigar') sesion.ultimaInterpretacion = interpretacion;
    if (informe) {
      informes.set(informe.id, { sesionId: sesion.id, informe });
      sesion.informes.push(informe.id);
      while (sesion.informes.length > config.maxInformesPorSesion) informes.delete(sesion.informes.shift());
    }
    if (sesion.historial.length > config.maxInformesPorSesion * 2) sesion.historial.shift();
  },

  /** Un informe solo se entrega a quien tiene el ID de su sesión. */
  informe(sesionId, informeId) {
    const r = informes.get(informeId);
    return r && r.sesionId === sesionId ? r.informe : null;
  },

  resumen(sesion) {
    return {
      id: sesion.id,
      creada: sesion.creada,
      historial: sesion.historial,
      informes: sesion.informes.map((id) => {
        const inf = informes.get(id)?.informe;
        return inf ? { id, fecha: inf.fecha, solicitud: inf.solicitud, totalProductos: inf.resumen.totalProductos } : null;
      }).filter(Boolean),
    };
  },
};

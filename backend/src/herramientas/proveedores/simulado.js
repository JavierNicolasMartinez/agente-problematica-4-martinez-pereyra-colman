/**
 * Proveedor SIMULADO: imita el buscador de un sitio de supermercado usando
 * los archivos de data/fuentes. Devuelve candidatos "crudos" (pueden ser de otra
 * marca, otro tamaño o una variante): decidir cuál es el mismo artículo es tarea
 * del emparejador, igual que pasaría con un buscador real.
 */
import { tokens } from '../../utils/texto.js';

export function crearProveedorSimulado(fuente) {
  const indice = fuente.productos.map((p) => ({ p, t: new Set(tokens(`${p.titulo} ${p.marca || ''}`)) }));
  return {
    id: fuente.competidor.id,
    nombre: fuente.competidor.nombre,
    tipo: 'simulado',
    competidor: fuente.competidor,

    /** Busca por texto libre. Devuelve las publicaciones con mejor coincidencia de palabras. */
    async buscar(texto, { limite = 8 } = {}) {
      const consulta = tokens(texto);
      if (!consulta.length) return [];
      return indice
        .map(({ p, t }) => ({ p, puntos: consulta.filter((c) => t.has(c)).length / consulta.length }))
        .filter((r) => r.puntos >= 0.5)
        .sort((a, b) => b.puntos - a.puntos)
        .slice(0, limite)
        .map((r) => r.p);
    },
  };
}

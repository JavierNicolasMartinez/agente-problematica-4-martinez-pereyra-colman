/**
 * Herramienta F03: busca un producto de Ragnar en los competidores elegidos.
 * Registra la fecha y hora de consulta de cada búsqueda (F09).
 */
import { proveedores } from './proveedores/index.js';

/** Decide qué competidores consultar y cuáles se omiten (y por qué). */
export function planificarCompetidores({ competidores = [], competidoresExcluidos = [], regiones = [] }, paisCatalogo = 'Argentina') {
  const consultar = [];
  const omitidos = [];
  const pedidosExplicitamente = new Set(competidores);
  for (const prov of proveedores) {
    const c = prov.competidor;
    if (pedidosExplicitamente.size && !pedidosExplicitamente.has(c.id)) continue;
    if (competidoresExcluidos.includes(c.id)) continue;
    if (!c.permite_consulta_automatizada) {
      omitidos.push({ id: c.id, nombre: c.nombre, motivo: c.condiciones });
      continue;
    }
    // Región: si se pidieron regiones, el competidor debe operar en alguna.
    if (regiones.length && !c.regiones.some((r) => regiones.includes(r))) {
      if (pedidosExplicitamente.has(c.id)) omitidos.push({ id: c.id, nombre: c.nombre, motivo: `No opera en ${regiones.join(', ')}.` });
      continue;
    }
    // País: sin pedido explícito, solo se compara con competidores del mismo país.
    if (!pedidosExplicitamente.has(c.id) && !regiones.length && c.pais !== paisCatalogo) continue;
    consultar.push(prov);
  }
  return { consultar, omitidos };
}

/** Arma el texto de búsqueda como lo haría una persona en el buscador del sitio. */
export function textoDeBusqueda(producto) {
  return `${producto.producto} ${producto.marca}`;
}

export async function buscarPrecios(producto, proveedor) {
  const consultadoEn = new Date().toISOString();
  const candidatos = await proveedor.buscar(textoDeBusqueda(producto));
  return {
    competidorId: proveedor.id,
    consulta: textoDeBusqueda(producto),
    consultadoEn,
    candidatos,
  };
}

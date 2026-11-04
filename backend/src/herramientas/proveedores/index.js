/**
 * Registro de proveedores de precios. Hoy todos son simulados.
 * Para sumar una fuente real, crear un proveedor con la misma forma
 * ({ id, nombre, tipo, competidor, buscar(texto) }) y agregarlo acá.
 */
import { fuentes } from '../../repositorios/fuentesRepositorio.js';
import { crearProveedorSimulado } from './simulado.js';

export const proveedores = fuentes.map(crearProveedorSimulado);

export function competidoresPublicos() {
  return proveedores.map(({ competidor: c, tipo }) => ({
    id: c.id,
    nombre: c.nombre,
    sitio: c.sitio,
    pais: c.pais,
    moneda: c.moneda,
    regiones: c.regiones,
    permiteConsulta: c.permite_consulta_automatizada,
    condiciones: c.condiciones,
    tipoFuente: tipo,
  }));
}

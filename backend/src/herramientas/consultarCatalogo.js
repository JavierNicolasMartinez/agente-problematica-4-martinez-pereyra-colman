/** Herramienta F02: consulta el catálogo de Ragnar según la interpretación de la solicitud. */
import { catalogo } from '../repositorios/catalogoRepositorio.js';
import { config } from '../config.js';

export function consultarCatalogo(interpretacion) {
  const { ids, productos, marcas, categorias, todoElCatalogo } = interpretacion;
  const hayFiltro = ids.length || productos.length || marcas.length || categorias.length;
  if (!hayFiltro && !todoElCatalogo) return { productos: [], recortado: false, totalEncontrado: 0 };
  const encontrados = catalogo.buscar({ ids, productos, marcas, categorias });
  const limite = Math.min(interpretacion.limite || config.maxProductosPorConsulta, config.maxProductosPorConsulta);
  return {
    productos: encontrados.slice(0, limite),
    recortado: encontrados.length > limite,
    totalEncontrado: encontrados.length,
  };
}

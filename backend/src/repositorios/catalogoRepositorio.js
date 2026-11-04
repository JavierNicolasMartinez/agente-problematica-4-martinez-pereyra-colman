/**
 * Repositorio del catálogo de Ragnar (F02).
 * Lee el CSV una sola vez al iniciar, valida cada fila y lo deja en memoria (solo lectura).
 * El agente NUNCA modifica precios de Ragnar: no existe ningún método de escritura.
 */
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { config } from '../config.js';
import { normalizar, tokens } from '../utils/texto.js';
import { precioPorReferencia, referenciaDe } from '../utils/unidades.js';

const esquemaFila = z.object({
  producto_id: z.string().regex(/^RAG-\d{5}$/),
  producto: z.string().min(1),
  marca: z.string().min(1),
  categoria: z.string().min(1),
  presentacion: z.string().min(1),
  contenido: z.coerce.number().positive(),
  unidad_medida: z.enum(['g', 'ml', 'un']),
  precio: z.coerce.number().positive(),
  moneda: z.string().length(3),
  pais: z.string().min(1),
});

function cargar(ruta) {
  const filas = parse(fs.readFileSync(ruta, 'utf8'), { columns: true, skip_empty_lines: true, trim: true });
  const productos = [];
  const invalidas = [];
  for (const [i, fila] of filas.entries()) {
    const r = esquemaFila.safeParse(fila);
    if (!r.success) { invalidas.push(i + 2); continue; }
    const p = r.data;
    productos.push(Object.freeze({
      id: p.producto_id,
      producto: p.producto,
      marca: p.marca,
      categoria: p.categoria,
      presentacion: p.presentacion,
      contenido: p.contenido,
      unidad: p.unidad_medida,
      precio: p.precio,
      moneda: p.moneda,
      pais: p.pais,
      precioPorReferencia: precioPorReferencia(p.precio, p.contenido, p.unidad_medida),
      unidadReferencia: referenciaDe(p.unidad_medida).etiqueta,
      // Clave del artículo: mismos producto + marca + presentación.
      claveArticulo: `${normalizar(p.producto)}|${normalizar(p.marca)}|${p.contenido}${p.unidad_medida}`,
      _busqueda: tokens(`${p.producto} ${p.marca} ${p.categoria} ${p.presentacion} ${p.producto_id}`).join(' '),
    }));
  }
  return { productos, invalidas };
}

const { productos, invalidas } = cargar(config.rutaCatalogo);
const porId = new Map(productos.map((p) => [p.id, p]));

// Artículos repetidos (mismo producto, marca y presentación con distinto ID).
const repetidos = new Map();
for (const p of productos) repetidos.set(p.claveArticulo, (repetidos.get(p.claveArticulo) || 0) + 1);

/** Vista pública de un producto (sin campos internos). */
export function aPublico(p) {
  const { _busqueda, claveArticulo, ...publico } = p;
  return { ...publico, idsMismoArticulo: repetidos.get(claveArticulo) > 1 ? idsDelArticulo(claveArticulo) : [] };
}

function idsDelArticulo(clave) {
  return productos.filter((p) => p.claveArticulo === clave).map((p) => p.id);
}

export const catalogo = {
  total: () => productos.length,
  filasInvalidas: () => [...invalidas],

  obtener: (id) => porId.get(id) || null,

  /** Listado paginado con filtros simples para la pantalla de catálogo. */
  listar({ q, categoria, marca, pagina = 1, limite = 25 } = {}) {
    const qTokens = q ? tokens(q) : [];
    let res = productos;
    if (categoria) res = res.filter((p) => normalizar(p.categoria) === normalizar(categoria));
    if (marca) res = res.filter((p) => normalizar(p.marca) === normalizar(marca));
    if (qTokens.length) res = res.filter((p) => qTokens.every((t) => p._busqueda.includes(t)));
    const total = res.length;
    const inicio = (pagina - 1) * limite;
    return { total, pagina, limite, productos: res.slice(inicio, inicio + limite).map(aPublico) };
  },

  /** Búsqueda estructurada usada por el agente a partir de la interpretación. */
  buscar({ ids = [], productos: nombres = [], marcas = [], categorias = [] }) {
    if (ids.length) return ids.map((id) => porId.get(id)).filter(Boolean);
    const nP = nombres.map(normalizar);
    const nM = marcas.map(normalizar);
    const nC = categorias.map(normalizar);
    return productos.filter((p) =>
      (!nP.length || nP.includes(normalizar(p.producto))) &&
      (!nM.length || nM.includes(normalizar(p.marca))) &&
      (!nC.length || nC.includes(normalizar(p.categoria))));
  },

  facetas() {
    const contar = (campo) => {
      const m = new Map();
      for (const p of productos) m.set(p[campo], (m.get(p[campo]) || 0) + 1);
      return [...m.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    };
    return { categorias: contar('categoria'), marcas: contar('marca'), productos: contar('producto'), paises: contar('pais') };
  },

  esRepetido: (p) => repetidos.get(p.claveArticulo) > 1,
  idsDelArticulo,
};

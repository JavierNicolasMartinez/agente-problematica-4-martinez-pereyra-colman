/**
 * F01 — Comprensión de solicitudes.
 *
 * Interpreta una solicitud en lenguaje natural con reglas y diccionarios armados
 * a partir del propio catálogo (productos, marcas y categorías reales).
 * Es determinístico y explicable: cada dato detectado se puede rastrear.
 *
 * PUNTO DE EXTENSIÓN: si más adelante se usa un LLM, debe devolver el MISMO objeto
 * que `interpretar()` para que el resto del agente no cambie.
 */
import { normalizar, tokens, contieneFrase } from '../utils/texto.js';
import { catalogo } from '../repositorios/catalogoRepositorio.js';
import { proveedores } from '../herramientas/proveedores/index.js';

const facetas = catalogo.facetas();

const SINONIMOS_CATEGORIA = {
  Alimentos: ['alimentos', 'alimento', 'comida', 'almacen', 'comestibles'],
  Bebidas: ['bebidas', 'bebida'],
  Limpieza: ['limpieza', 'productos de limpieza'],
  'Higiene personal': ['higiene', 'higiene personal', 'perfumeria', 'cuidado personal'],
  Hogar: ['hogar', 'bazar', 'articulos para el hogar'],
};

// Formas cortas que usan las personas -> producto del catálogo.
const ALIAS_PRODUCTO = {
  leche: ['Leche entera'], yerba: ['Yerba mate'], fideo: ['Fideos spaghetti'], spaghetti: ['Fideos spaghetti'],
  galletita: ['Galletitas dulces'], aceite: ['Aceite de girasol'], arroz: ['Arroz largo fino'],
  azucar: ['Azucar refinada'], cafe: ['Cafe molido'], harina: ['Harina de trigo'], mayonesa: ['Mayonesa'],
  agua: ['Agua mineral', 'Agua saborizada'], energizante: ['Bebida energizante'], gaseosa: ['Gaseosa cola'],
  jugo: ['Jugo de naranja'], acondicionador: ['Acondicionador'], desodorante: ['Desodorante'],
  jabon: ['Jabon de tocador', 'Jabon liquido para ropa'], 'papel higienico': ['Papel higienico'],
  'pasta dental': ['Pasta dental'], dentifrico: ['Pasta dental'], shampoo: ['Shampoo'], champu: ['Shampoo'],
  'bolsa de residuo': ['Bolsa de residuos'], bolsa: ['Bolsa de residuos'], esponja: ['Esponja de cocina'],
  'rollo de cocina': ['Rollo de cocina'], servilleta: ['Servilletas'], desinfectante: ['Desinfectante'],
  detergente: ['Detergente'], lavandina: ['Lavandina'], limpiador: ['Limpiador de pisos'], suavizante: ['Suavizante para ropa'],
};

const ALIAS_MARCA = { coca: 'Coca-Cola', serenisima: 'La Serenísima', hellmann: "Hellmann's", 'head and shoulder': 'Head & Shoulders' };

const REGIONES = {
  AMBA: ['amba', 'buenos aires', 'caba', 'capital federal', 'gba', 'conurbano'],
  Córdoba: ['cordoba'],
  Rosario: ['rosario', 'santa fe'],
  Mendoza: ['mendoza', 'cuyo'],
  Montevideo: ['montevideo', 'uruguay'],
};

const PISTAS_CONTINUACION = /^(y|ahora|tambien|ademas|pero|solo|solamente|agrega|suma|saca|quita|sin|compara|repeti|lo mismo|idem|mismo)\b/;
const PISTAS_AGREGAR = /\b(agrega|agregale|suma|sumale|tambien|ademas|incluye)\b/;
const PISTAS_QUITAR = /\b(saca|sacale|quita|quitale|excluye|sin)\b/;

function detectarProductos(texto) {
  const encontrados = new Set();
  // Primero nombres completos del catálogo ("jabon liquido para ropa").
  for (const { nombre } of facetas.productos) if (contieneFrase(texto, nombre)) encontrados.add(nombre);
  // Luego alias, solo si no quedan cubiertos por un nombre completo.
  for (const [alias, nombres] of Object.entries(ALIAS_PRODUCTO)) {
    if (!contieneFrase(texto, alias)) continue;
    const yaCubierto = nombres.some((n) => encontrados.has(n));
    if (!yaCubierto) nombres.forEach((n) => encontrados.add(n));
  }
  // "jabon" sin más genera dos productos; si aparece "ropa" o "tocador" se desambigua.
  if (encontrados.has('Jabon de tocador') && encontrados.has('Jabon liquido para ropa')) {
    if (contieneFrase(texto, 'ropa')) encontrados.delete('Jabon de tocador');
    else if (contieneFrase(texto, 'tocador')) encontrados.delete('Jabon liquido para ropa');
  }
  if (encontrados.has('Agua mineral') && encontrados.has('Agua saborizada')) {
    if (contieneFrase(texto, 'saborizada')) encontrados.delete('Agua mineral');
    else if (contieneFrase(texto, 'mineral')) encontrados.delete('Agua saborizada');
  }
  return [...encontrados];
}

function detectarMarcas(texto) {
  const marcas = new Set();
  for (const { nombre } of facetas.marcas) if (contieneFrase(texto, nombre)) marcas.add(nombre);
  for (const [alias, marca] of Object.entries(ALIAS_MARCA)) if (contieneFrase(texto, alias)) marcas.add(marca);
  return [...marcas];
}

function detectarCategorias(texto) {
  return Object.entries(SINONIMOS_CATEGORIA)
    .filter(([, sinonimos]) => sinonimos.some((s) => contieneFrase(texto, s)))
    .map(([categoria]) => categoria);
}

function detectarCompetidores(texto) {
  return proveedores.filter((p) => contieneFrase(texto, p.nombre)).map((p) => p.id);
}

function detectarRegiones(texto) {
  return Object.entries(REGIONES).filter(([, alias]) => alias.some((a) => contieneFrase(texto, a))).map(([r]) => r);
}

function detectarFiltros(n, original) {
  const filtros = {};
  if (/\bmas car[oa]s?\b|\bpor encima\b|\bsuperiores?\b/.test(n)) filtros.clasificacion = 'mas_caro';
  else if (/\bmas barat[oa]s?\b|\bpor debajo\b|\binferiores?\b/.test(n)) filtros.clasificacion = 'mas_barato';
  else if (/\bsin coincidencia|\bno encontrad|\bno se encontr/.test(n)) filtros.clasificacion = 'sin_coincidencias';
  else if (/\bno confiable|\bdudos/.test(n)) filtros.clasificacion = 'no_confiable';
  if (/\bsignificativ|\bimportantes?\b|\bgrandes? diferencia/.test(n)) filtros.soloSignificativas = true;
  if (/\bsolo (las )?(promo|oferta|descuento)/.test(n)) filtros.soloPromociones = true;
  const umbral = original.toLowerCase().match(/(\d{1,2})\s*(%|por ?ciento)/);
  if (umbral) {
    filtros.umbralPct = Number(umbral[1]);
    filtros.soloSignificativas = true;
  }
  return filtros;
}

/**
 * Devuelve la interpretación estructurada del mensaje.
 * @param {string} mensaje
 * @param {object|null} anterior  interpretación previa de la misma sesión (F10)
 */
export function interpretar(mensaje, anterior = null) {
  const n = normalizar(mensaje);
  const ids = [...new Set((mensaje.match(/RAG-\d{5}/gi) || []).map((id) => id.toUpperCase()))];
  const detectado = {
    ids,
    productos: detectarProductos(mensaje),
    marcas: detectarMarcas(mensaje),
    categorias: detectarCategorias(mensaje),
    competidores: detectarCompetidores(mensaje),
    regiones: detectarRegiones(mensaje),
    filtros: detectarFiltros(n, mensaje),
    competidoresExcluidos: [],
    todoElCatalogo: /\btodo (el )?catalogo\b|\btodos los productos\b/.test(n),
  };
  const limite = n.match(/\btop ?(\d{1,3})\b|\b(\d{1,3}) productos\b/);
  detectado.limite = limite ? Number(limite[1] || limite[2]) : null;

  const tieneAlcance = ids.length || detectado.productos.length || detectado.marcas.length || detectado.categorias.length || detectado.todoElCatalogo;
  const esContinuacion = Boolean(anterior) && (PISTAS_CONTINUACION.test(n) || !tieneAlcance);

  let resultado = detectado;
  const notas = [];
  if (esContinuacion) {
    resultado = combinar(anterior, detectado, n);
    notas.push('Se tomó el contexto de la consulta anterior.');
  }

  const alcanceFinal = resultado.ids.length || resultado.productos.length || resultado.marcas.length || resultado.categorias.length || resultado.todoElCatalogo;
  return {
    ...resultado,
    mensaje,
    esContinuacion,
    intencion: alcanceFinal ? 'investigar' : 'aclarar',
    notas,
    palabrasClave: tokens(mensaje).slice(0, 20),
  };
}

/** Mezcla la consulta anterior con lo nuevo: lo nuevo reemplaza, salvo "agregá" (suma) o "sacá" (resta). */
function combinar(anterior, nuevo, n) {
  const agregar = PISTAS_AGREGAR.test(n);
  const quitar = PISTAS_QUITAR.test(n);
  const campos = ['ids', 'productos', 'marcas', 'categorias', 'competidores', 'regiones'];
  const r = { ...anterior, filtros: { ...anterior.filtros, ...nuevo.filtros } };
  for (const c of campos) {
    if (!nuevo[c].length) continue;
    if (quitar) r[c] = anterior[c].filter((v) => !nuevo[c].includes(v));
    else if (agregar) r[c] = [...new Set([...anterior[c], ...nuevo[c]])];
    else r[c] = nuevo[c];
  }
  // Si se sacan competidores sin lista previa, se guardan como excluidos (se consulta el resto habitual).
  r.competidoresExcluidos = [...(anterior.competidoresExcluidos || [])];
  if (quitar && nuevo.competidores.length && !anterior.competidores.length) {
    r.competidoresExcluidos = [...new Set([...r.competidoresExcluidos, ...nuevo.competidores])];
  }
  // Si cambia el producto/categoría, no tiene sentido mantener IDs viejos.
  if ((nuevo.productos.length || nuevo.categorias.length || nuevo.marcas.length) && !nuevo.ids.length && !agregar) r.ids = [];
  r.todoElCatalogo = nuevo.todoElCatalogo || (anterior.todoElCatalogo && !nuevo.productos.length && !nuevo.categorias.length);
  r.limite = nuevo.limite ?? anterior.limite;
  return r;
}

export const SUGERENCIAS = [
  'Compará la yerba mate en todos los competidores',
  'Productos de limpieza más caros que la competencia en AMBA',
  'Bebidas con diferencias mayores al 15 %',
  'Precios de Coca-Cola en Hiper Delta y SuperCiudad',
];

/**
 * F04 — Identificación y coincidencia de productos.
 *
 * Decide si una publicación de un competidor es el MISMO artículo que vende Ragnar.
 * Revisa: nombre, marca, categoría, presentación (contenido + unidad) y variantes.
 *
 * Estados posibles:
 *  - equivalente                    → mismo artículo y misma presentación.
 *  - equivalente_otra_presentacion  → mismo artículo, distinto tamaño (se compara por kg/l/unidad).
 *  - no_confiable                   → faltan datos para asegurarlo (no se usa en la comparación).
 *  - descartado                     → diferencia relevante (otra marca, variante, unidad...).
 */
import { normalizar, tokens, contieneFrase } from '../utils/texto.js';
import { leerPresentacion } from '../utils/unidades.js';
import { catalogo } from '../repositorios/catalogoRepositorio.js';

// Palabras que cambian el producto: si aparecen en la publicación y no en Ragnar, no es el mismo.
const VARIANTES = [
  'light', 'zero', 'diet', 'sin azucar', 'sin tacc', 'sin sal', 'integral', 'descremada', 'semidescremada',
  'deslactosada', 'organico', 'sabor', 'aroma', 'for men', 'sensitive', 'repuesto', 'recarga', 'concentrado',
  'gel', 'reforzada', 'jumbo', 'perfumado', 'doble hoja', 'mini', 'extra', 'clinical',
];

const TOLERANCIA_CONTENIDO = 0.01; // 1 %

const marcasConocidas = catalogo.facetas().marcas.map((m) => m.nombre);

function evaluarNombre(producto, titulo) {
  const buscados = tokens(producto.producto);
  const presentes = new Set(tokens(titulo));
  const cobertura = buscados.filter((t) => presentes.has(t)).length / buscados.length;
  if (cobertura === 1) return { criterio: 'nombre', resultado: 'ok', detalle: 'El nombre coincide.' };
  if (cobertura >= 0.5) return { criterio: 'nombre', resultado: 'duda', detalle: `Coincide parcialmente (${Math.round(cobertura * 100)} %).` };
  return { criterio: 'nombre', resultado: 'falla', detalle: 'El nombre no coincide.' };
}

function evaluarMarca(producto, pub) {
  const marca = normalizar(producto.marca);
  if (pub.marca) {
    return normalizar(pub.marca) === marca
      ? { criterio: 'marca', resultado: 'ok', detalle: `Marca ${producto.marca}.` }
      : { criterio: 'marca', resultado: 'falla', detalle: `Otra marca: ${pub.marca}.` };
  }
  if (contieneFrase(pub.titulo, producto.marca)) return { criterio: 'marca', resultado: 'ok', detalle: `Marca ${producto.marca} (leída del título).` };
  const otra = marcasConocidas.find((m) => normalizar(m) !== marca && contieneFrase(pub.titulo, m));
  if (otra) return { criterio: 'marca', resultado: 'falla', detalle: `El título menciona otra marca: ${otra}.` };
  return { criterio: 'marca', resultado: 'duda', detalle: 'La publicación no informa la marca.' };
}

function evaluarCategoria(producto, pub) {
  if (!pub.categoria) return { criterio: 'categoria', resultado: 'ok', detalle: 'Sin categoría informada (no bloquea).' };
  return normalizar(pub.categoria) === normalizar(producto.categoria)
    ? { criterio: 'categoria', resultado: 'ok', detalle: producto.categoria }
    : { criterio: 'categoria', resultado: 'falla', detalle: `Otra categoría: ${pub.categoria}.` };
}

function evaluarVariante(producto, titulo) {
  const base = `${producto.producto} ${producto.marca}`;
  const extra = VARIANTES.find((v) => contieneFrase(titulo, v) && !contieneFrase(base, v));
  return extra
    ? { criterio: 'variante', resultado: 'falla', detalle: `Variante distinta: "${extra}".` }
    : { criterio: 'variante', resultado: 'ok', detalle: 'Sin variantes distintas.' };
}

function evaluarPresentacion(producto, titulo) {
  const leida = leerPresentacion(titulo);
  if (!leida) return { evaluacion: { criterio: 'presentacion', resultado: 'duda', detalle: 'No informa contenido neto.' }, leida: null };
  if (leida.unidad !== producto.unidad) {
    return { evaluacion: { criterio: 'presentacion', resultado: 'falla', detalle: `Unidad incompatible (${leida.unidad} vs ${producto.unidad}).` }, leida };
  }
  const diferencia = Math.abs(leida.contenido - producto.contenido) / producto.contenido;
  if (diferencia <= TOLERANCIA_CONTENIDO) {
    return { evaluacion: { criterio: 'presentacion', resultado: 'ok', detalle: `Misma presentación (${producto.presentacion}).` }, leida, misma: true };
  }
  return {
    evaluacion: { criterio: 'presentacion', resultado: 'ok', detalle: `Otra presentación: ${leida.contenido} ${leida.unidad} (se normaliza por unidad).` },
    leida,
    misma: false,
  };
}

const PESOS = { nombre: 0.3, marca: 0.3, categoria: 0.1, variante: 0.15, presentacion: 0.15 };
const VALOR = { ok: 1, duda: 0.5, falla: 0 };

/** Evalúa una publicación contra un producto de Ragnar. */
export function emparejar(producto, pub) {
  const pres = evaluarPresentacion(producto, pub.titulo);
  const criterios = [
    evaluarNombre(producto, pub.titulo),
    evaluarMarca(producto, pub),
    evaluarCategoria(producto, pub),
    evaluarVariante(producto, pub.titulo),
    pres.evaluacion,
  ];
  const confianza = Math.round(criterios.reduce((s, c) => s + PESOS[c.criterio] * VALOR[c.resultado], 0) * 100) / 100;
  let estado;
  if (criterios.some((c) => c.resultado === 'falla')) estado = 'descartado';
  else if (criterios.some((c) => c.resultado === 'duda')) estado = 'no_confiable';
  else estado = pres.misma ? 'equivalente' : 'equivalente_otra_presentacion';
  return { estado, confianza, criterios, presentacionLeida: pres.leida };
}

/** Qué tan lejos está el tamaño de la publicación del de Ragnar (0 = igual). */
function distanciaTamano(producto, evaluado) {
  const c = evaluado.presentacionLeida?.contenido;
  return c ? Math.abs(Math.log(c / producto.contenido)) : Infinity;
}

const PRIORIDAD = { equivalente: 0, equivalente_otra_presentacion: 1, no_confiable: 2, descartado: 3 };

/** De todos los candidatos de un competidor, elige el mejor y conserva el resto para auditoría. */
export function elegirMejor(producto, candidatos) {
  const evaluados = candidatos
    .map((pub) => ({ publicacion: pub, ...emparejar(producto, pub) }))
    .sort((a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado]
      || distanciaTamano(producto, a) - distanciaTamano(producto, b)
      || b.confianza - a.confianza);
  return { mejor: evaluados[0] || null, evaluados };
}

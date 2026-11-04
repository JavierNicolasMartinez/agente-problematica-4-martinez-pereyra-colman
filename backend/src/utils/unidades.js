/**
 * Unidades de medida: lectura de presentaciones ("1,5 L", "900 gr", "pack 6 x 500 ml")
 * y normalización de precios por unidad de referencia (kg, litro o unidad).
 */
import { normalizar } from './texto.js';

// Cada unidad se lleva a una unidad base: g, ml o un.
const UNIDADES = {
  g: { base: 'g', factor: 1 }, gr: { base: 'g', factor: 1 }, grs: { base: 'g', factor: 1 },
  gramo: { base: 'g', factor: 1 }, gramos: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 }, kilo: { base: 'g', factor: 1000 }, kilos: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 }, cc: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 }, lt: { base: 'ml', factor: 1000 }, lts: { base: 'ml', factor: 1000 },
  litro: { base: 'ml', factor: 1000 }, litros: { base: 'ml', factor: 1000 },
  un: { base: 'un', factor: 1 }, u: { base: 'un', factor: 1 }, unidad: { base: 'un', factor: 1 },
  unidades: { base: 'un', factor: 1 }, rollo: { base: 'un', factor: 1 }, rollos: { base: 'un', factor: 1 },
};

const NOMBRES_UNIDAD = Object.keys(UNIDADES).sort((a, b) => b.length - a.length).join('|');
const RE_PACK = new RegExp(`(\\d+)\\s*x\\s*(\\d+(?:[.,]\\d+)?)\\s*(${NOMBRES_UNIDAD})\\b`);
const RE_SIMPLE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${NOMBRES_UNIDAD})\\b`);

function aNumero(texto) {
  return Number(String(texto).replace(',', '.'));
}

/** Convierte cantidad + unidad a la unidad base. (1.5, "l") -> { contenido: 1500, unidad: "ml" } */
export function aUnidadBase(cantidad, unidad) {
  const u = UNIDADES[normalizar(unidad)];
  const n = Number(cantidad);
  if (!u || !Number.isFinite(n) || n <= 0) return null;
  return { contenido: Math.round(n * u.factor * 1000) / 1000, unidad: u.base };
}

/** Extrae la presentación desde un título libre. Devuelve null si no la encuentra. */
export function leerPresentacion(titulo) {
  const t = normalizar(titulo);
  const pack = t.match(RE_PACK);
  if (pack) {
    const base = aUnidadBase(aNumero(pack[2]), pack[3]);
    if (base) return { contenido: base.contenido * Number(pack[1]), unidad: base.unidad, pack: Number(pack[1]) };
  }
  const simple = t.match(RE_SIMPLE);
  if (simple) return aUnidadBase(aNumero(simple[1]), simple[2]);
  return null;
}

/** Unidad de referencia para mostrar precios normalizados. */
export function referenciaDe(unidadBase) {
  if (unidadBase === 'g') return { divisor: 1000, etiqueta: 'kg' };
  if (unidadBase === 'ml') return { divisor: 1000, etiqueta: 'litro' };
  return { divisor: 1, etiqueta: 'unidad' };
}

/** Precio por kg / litro / unidad. */
export function precioPorReferencia(precio, contenido, unidadBase) {
  if (!Number.isFinite(precio) || !Number.isFinite(contenido) || contenido <= 0) return null;
  const { divisor } = referenciaDe(unidadBase);
  return redondear((precio / contenido) * divisor);
}

export function redondear(n, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

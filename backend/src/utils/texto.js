/**
 * Utilidades de texto: normalización para comparar nombres sin importar
 * mayúsculas, acentos, signos ni plurales simples.
 */

const PALABRAS_VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'en', 'y', 'x', 'por', 'un', 'una',
]);

/** Pasa a minúsculas, quita acentos y signos. "Azúcar Ledesma!" -> "azucar ledesma" */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9.,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Singular simple en español: "galletitas" -> "galletita", "dulces" -> "dulce". */
export function singular(palabra) {
  if (palabra.length > 3 && palabra.endsWith('s')) return palabra.slice(0, -1);
  return palabra;
}

/** Lista de palabras significativas (sin palabras vacías, en singular). */
export function tokens(texto) {
  return normalizar(texto)
    .replace(/[.,]/g, ' ')
    .split(' ')
    .filter((t) => t && !PALABRAS_VACIAS.has(t))
    .map(singular);
}

/** ¿El texto contiene la frase completa (como palabras enteras)? */
export function contieneFrase(texto, frase) {
  const t = ` ${tokens(texto).join(' ')} `;
  const f = tokens(frase).join(' ');
  return f.length > 0 && t.includes(` ${f} `);
}

/** Texto apto para URLs: "Leche entera" -> "leche-entera" */
export function slug(texto) {
  return normalizar(texto).replace(/[.,]/g, '').replace(/\s+/g, '-');
}

/**
 * Carga las fuentes de competidores y los tipos de cambio.
 * Cada fuente declara si permite la consulta automatizada: si no la permite,
 * el agente la informa como "omitida" y no la consulta (restricción del enunciado).
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';

// Solo se aceptan enlaces http(s): evita URLs "javascript:" o "data:" que serían un riesgo en el navegador.
const urlSegura = z.string().url().refine((u) => /^https?:$/.test(new URL(u).protocol), 'Solo se aceptan URLs http(s).');

const esquemaPublicacion = z.object({
  sku: z.string(),
  titulo: z.string(),
  marca: z.string().nullable(),
  categoria: z.string().nullable().optional(),
  precio_regular: z.number().positive(),
  precio_promocional: z.number().positive().nullable().optional(),
  promocion: z.object({
    tipo: z.enum(['porcentaje', 'nxm', 'segunda_unidad']),
    descripcion: z.string(),
    vigencia_hasta: z.string().optional(),
    lleva: z.number().int().positive().optional(),
    paga: z.number().int().positive().optional(),
    porcentaje: z.number().positive().max(100).optional(),
  }).nullable().optional(),
  moneda: z.string().length(3),
  disponible: z.boolean(),
  regiones: z.array(z.string()),
  url: urlSegura,
  publicado: z.string(),
});

const esquemaFuente = z.object({
  aviso: z.string().optional(),
  competidor: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    nombre: z.string(),
    sitio: urlSegura,
    pais: z.string(),
    moneda: z.string().length(3),
    regiones: z.array(z.string()),
    permite_consulta_automatizada: z.boolean(),
    condiciones: z.string(),
  }),
  productos: z.array(esquemaPublicacion),
});

function cargarFuentes(dir) {
  const fuentes = [];
  for (const archivo of fs.readdirSync(dir).filter((a) => a.endsWith('.json')).sort()) {
    const datos = esquemaFuente.parse(JSON.parse(fs.readFileSync(path.join(dir, archivo), 'utf8')));
    fuentes.push(datos);
  }
  return fuentes;
}

export const fuentes = cargarFuentes(config.rutaFuentes);
export const tiposCambio = JSON.parse(fs.readFileSync(config.rutaTiposCambio, 'utf8'));

/** Convierte un monto a ARS (moneda del catálogo). Devuelve null si no hay tasa. */
export function convertir(monto, desde, hacia = 'ARS') {
  if (desde === hacia) return monto;
  const tDesde = tiposCambio.tasas[desde];
  const tHacia = tiposCambio.tasas[hacia];
  if (!tDesde || !tHacia) return null;
  return Math.round(((monto * tDesde) / tHacia) * 100) / 100;
}

/**
 * Genera las FUENTES SIMULADAS de competidores (data/fuentes/*.json).
 *
 * Por qué existe: el trabajo pide investigar precios en supermercados competidores,
 * pero no contamos con acceso autorizado a sitios reales. Este script crea, de forma
 * determinística (misma semilla = mismos datos), "sitios" ficticios con publicaciones
 * que imitan problemas reales: títulos desordenados, otras presentaciones, variantes,
 * marcas faltantes y promociones.
 *
 * Los competidores y dominios (.example) son FICTICIOS. Los precios son de demostración.
 * Para usar datos reales, se reemplaza el proveedor simulado por uno real
 * (ver src/herramientas/proveedores/README.md).
 *
 * Uso: npm run generar-fuentes
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEMILLA = 20261103;
const FECHA_PUBLICACION = '2026-11-02';

// Generador pseudoaleatorio con semilla (mulberry32).
function crearAzar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = crearAzar(SEMILLA);
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
const entre = (min, max) => min + azar() * (max - min);
const redondear = (n) => Math.round(n * 100) / 100;

const COMPETIDORES = [
  { id: 'mercado-austral', nombre: 'Mercado Austral', sitio: 'https://mercado-austral.example', pais: 'Argentina', moneda: 'ARS', regiones: ['AMBA', 'Córdoba'], permite_consulta_automatizada: true, sesgo: 0.97 },
  { id: 'hiper-delta', nombre: 'Hiper Delta', sitio: 'https://hiperdelta.example', pais: 'Argentina', moneda: 'ARS', regiones: ['AMBA', 'Rosario'], permite_consulta_automatizada: true, sesgo: 1.04 },
  { id: 'superciudad', nombre: 'SuperCiudad', sitio: 'https://superciudad.example', pais: 'Argentina', moneda: 'ARS', regiones: ['AMBA', 'Mendoza'], permite_consulta_automatizada: true, sesgo: 1.0 },
  { id: 'almacen-pampa', nombre: 'Almacén Pampa', sitio: 'https://almacenpampa.example', pais: 'Argentina', moneda: 'ARS', regiones: ['Córdoba', 'Rosario', 'Mendoza'], permite_consulta_automatizada: true, sesgo: 0.93 },
  { id: 'grupo-vertice', nombre: 'Grupo Vértice', sitio: 'https://grupovertice.example', pais: 'Argentina', moneda: 'ARS', regiones: ['AMBA'], permite_consulta_automatizada: false, condiciones: 'Los términos de uso del sitio prohíben la consulta automatizada de precios.', sesgo: 1.02 },
  { id: 'tienda-oriental', nombre: 'Tienda Oriental', sitio: 'https://tiendaoriental.example', pais: 'Uruguay', moneda: 'UYU', regiones: ['Montevideo'], permite_consulta_automatizada: true, sesgo: 1.08 },
];

// Tipo de cambio de demostración usado para generar los precios en UYU.
const ARS_POR_UYU = 30;

const VARIANTES = {
  Alimentos: ['light', 'sin TACC', 'integral', 'descremada', 'orgánico'],
  Bebidas: ['zero', 'light', 'sin azúcar', 'sabor pomelo'],
  'Higiene personal': ['aroma lavanda', 'for men', 'sensitive', 'repuesto'],
  Limpieza: ['aroma lavanda', 'repuesto', 'concentrado', 'gel'],
  Hogar: ['reforzada', 'jumbo', 'perfumado', 'doble hoja'],
};

function formatoPresentacion(contenido, unidad) {
  if (unidad === 'g') {
    if (contenido >= 1000 && azar() < 0.6) return `${String(contenido / 1000).replace('.', ',')} kg`;
    return `${contenido} ${elegir(['g', 'gr', 'grs'])}`;
  }
  if (unidad === 'ml') {
    if (contenido >= 1000 && azar() < 0.6) return `${String(contenido / 1000).replace('.', ',')} ${elegir(['L', 'lt', 'litros'])}`;
    return `${contenido} ${elegir(['ml', 'cc'])}`;
  }
  return `${contenido} ${elegir(['un', 'unidades', 'u'])}`;
}

function titulo(producto, marca, presentacion, variante) {
  const partes = [producto, marca, variante, presentacion].filter(Boolean);
  const forma = azar();
  if (forma < 0.4) return partes.join(' ');
  if (forma < 0.7) return [marca, producto, variante, presentacion].filter(Boolean).join(' ');
  return `${[producto, variante].filter(Boolean).join(' ')} ${marca} x ${presentacion}`;
}

function promocionAleatoria(precio) {
  const r = azar();
  if (r < 0.45) {
    const pct = elegir([10, 15, 20, 25, 30]);
    return { precio_promocional: redondear(precio * (1 - pct / 100)), promocion: { tipo: 'porcentaje', descripcion: `${pct}% de descuento`, vigencia_hasta: '2026-11-15' } };
  }
  if (r < 0.7) return { precio_promocional: null, promocion: { tipo: 'nxm', lleva: 2, paga: 1, descripcion: '2x1', vigencia_hasta: '2026-11-10' } };
  if (r < 0.85) return { precio_promocional: null, promocion: { tipo: 'nxm', lleva: 3, paga: 2, descripcion: '3x2', vigencia_hasta: '2026-11-20' } };
  return { precio_promocional: null, promocion: { tipo: 'segunda_unidad', porcentaje: 70, descripcion: '70% off en la segunda unidad', vigencia_hasta: '2026-11-12' } };
}

// 1. Catálogo agrupado por artículo (producto + marca + contenido).
const filas = parse(fs.readFileSync(path.join(raiz, 'data', 'catalogo_ragnar.csv'), 'utf8'), { columns: true, skip_empty_lines: true });
const articulos = new Map();
for (const f of filas) {
  const clave = `${f.producto}|${f.marca}|${f.contenido}|${f.unidad_medida}`;
  if (!articulos.has(clave)) articulos.set(clave, f);
}

// 2. Publicaciones por competidor.
for (const comp of COMPETIDORES) {
  const productos = [];
  let n = 0;
  for (const art of articulos.values()) {
    if (azar() > 0.78) continue; // el competidor no vende este artículo
    const contenidoRagnar = Number(art.contenido);
    const precioUnitarioRagnar = Number(art.precio) / contenidoRagnar;
    let contenido = contenidoRagnar;
    let variante = null;
    let marca = art.marca;
    const caso = azar();
    if (caso < 0.12) contenido = azar() < 0.5 ? contenidoRagnar * 2 : Math.max(1, Math.round(contenidoRagnar / 2));
    else if (caso < 0.2) variante = elegir(VARIANTES[art.categoria] || ['especial']);
    else if (caso < 0.25) marca = null; // la publicación no informa la marca

    const factor = Math.min(1.35, Math.max(0.72, comp.sesgo + (azar() + azar() + azar() - 1.5) * 0.18));
    let precio = precioUnitarioRagnar * contenido * factor;
    if (comp.moneda === 'UYU') precio /= ARS_POR_UYU;
    precio = redondear(precio);

    n += 1;
    const sku = `${comp.id.slice(0, 3).toUpperCase()}-${String(n).padStart(5, '0')}`;
    const presentacion = formatoPresentacion(contenido, art.unidad_medida);
    const tit = titulo(art.producto, marca, presentacion, variante);
    const promo = azar() < 0.18 ? promocionAleatoria(precio) : { precio_promocional: null, promocion: null };
    productos.push({
      sku,
      titulo: tit,
      marca,
      categoria: art.categoria,
      precio_regular: precio,
      ...promo,
      moneda: comp.moneda,
      disponible: azar() > 0.05,
      regiones: comp.regiones,
      url: `${comp.sitio}/p/${tit.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sku.toLowerCase()}`,
      publicado: FECHA_PUBLICACION,
    });
  }
  const { sesgo, ...publico } = comp;
  const salida = {
    aviso: 'FUENTE SIMULADA con fines académicos. Competidor, dominio y precios ficticios.',
    competidor: { ...publico, condiciones: publico.condiciones || 'Consulta automatizada permitida (simulado).' },
    generado: FECHA_PUBLICACION,
    productos: comp.permite_consulta_automatizada ? productos : [],
  };
  fs.writeFileSync(path.join(raiz, 'data', 'fuentes', `${comp.id}.json`), JSON.stringify(salida, null, 1));
  console.log(`${comp.nombre}: ${productos.length} publicaciones`);
}

fs.writeFileSync(path.join(raiz, 'data', 'tipos_cambio.json'), JSON.stringify({
  aviso: 'Tipos de cambio de DEMOSTRACIÓN. Reemplazar por una fuente oficial antes de usar en producción.',
  base: 'ARS',
  fecha: FECHA_PUBLICACION,
  fuente: 'Configuración manual del proyecto (valor de demostración)',
  tasas: { ARS: 1, UYU: ARS_POR_UYU },
}, null, 2));

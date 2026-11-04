/**
 * Exporta un informe a CSV (planillas) o Markdown (documentos).
 * Seguridad: en CSV se neutralizan celdas que empiezan con = + - @ (inyección de fórmulas).
 */
const CLASIF = {
  mas_caro: 'Más caro', mas_barato: 'Más barato', en_linea: 'En línea', sin_coincidencias: 'Sin coincidencias', no_confiable: 'Sin coincidencia confiable',
};

function celda(valor) {
  if (valor == null) return '';
  let t = String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function aCsv(inf) {
  const cab = ['producto_id', 'producto', 'marca', 'presentacion', 'precio_ragnar', 'competidor', 'estado_coincidencia', 'titulo_competidor', 'precio_regular', 'precio_promocional', 'promocion', 'base_comparacion', 'dif_absoluta', 'dif_pct', 'clasificacion', 'url_fuente', 'consultado_en'];
  const filas = [cab];
  for (const i of inf.items) {
    for (const c of i.competidores) {
      const cmp = c.comparacion;
      filas.push([
        i.producto.id, i.producto.producto, i.producto.marca, i.producto.presentacion, i.producto.precio,
        c.competidor, c.estado, c.publicacion?.titulo, cmp?.precioRegular, cmp?.promocion?.precioEfectivo, cmp?.promocion?.descripcion,
        cmp?.base, cmp?.diferenciaRegular?.absoluta, cmp?.diferenciaRegular?.porcentual, CLASIF[i.analisis.clasificacion],
        cmp ? c.publicacion.url : '', c.consultadoEn,
      ]);
    }
  }
  return `﻿${filas.map((f) => f.map(celda).join(',')).join('\n')}\n`;
}

/** Escapa caracteres con significado en Markdown para que el texto se muestre tal cual. */
function md(t) {
  return String(t ?? '').replace(/([\\`*_{}[\]()#+!|<>])/g, '\\$1');
}

const pct = (n) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n} %`);
const pesos = (n) => (n == null ? '—' : `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export function aMarkdown(inf) {
  const l = [];
  l.push('# Informe de posicionamiento de precios — Ragnar S.A.', '');
  l.push(`- **Fecha:** ${inf.fecha}`, `- **Solicitud:** ${md(inf.solicitud)}`, `- **Competidores consultados:** ${inf.competidores.consultados.map((c) => md(c.nombre)).join(', ') || '—'}`);
  if (inf.competidores.omitidos.length) l.push(`- **Omitidos:** ${inf.competidores.omitidos.map((o) => `${md(o.nombre)} (${md(o.motivo)})`).join('; ')}`);
  l.push('', '## Conclusiones', '', ...inf.conclusiones.map((c) => `- ${md(c)}`), '');
  if (inf.advertencias.length) l.push('## Advertencias', '', ...inf.advertencias.map((a) => `- ${md(a)}`), '');
  l.push('## Productos', '', '| ID | Producto | Precio Ragnar | Dif. mediana | Clasificación |', '|---|---|---:|---:|---|');
  for (const i of inf.items) {
    l.push(`| ${i.producto.id} | ${md(`${i.producto.producto} ${i.producto.marca} ${i.producto.presentacion}`)} | ${pesos(i.producto.precio)} | ${pct(i.analisis.diferenciaMedianaPct)} | ${CLASIF[i.analisis.clasificacion]}${i.analisis.significativa ? ' (significativa)' : ''} |`);
  }
  l.push('', '## Fuentes', '', '| Competidor | SKU | URL | Consultado |', '|---|---|---|---|');
  for (const f of inf.fuentes) l.push(`| ${md(f.competidorId)} | ${md(f.sku)} | <${f.url}> | ${f.consultadoEn} |`);
  l.push('', '> Fuentes simuladas con fines académicos: competidores, dominios y precios ficticios.');
  return `${l.join('\n')}\n`;
}

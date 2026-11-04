/**
 * F08 y F09 — Generación de informes con fundamentación.
 * Las conclusiones se redactan SOLO con datos calculados; no se agrega información
 * que no provenga del catálogo o de una fuente consultada.
 */
import crypto from 'node:crypto';

const ETIQUETAS = {
  mas_caro: 'más caros que la competencia',
  mas_barato: 'más baratos que la competencia',
  en_linea: 'en línea con la competencia',
  sin_coincidencias: 'sin coincidencias en otros supermercados',
  no_confiable: 'sin coincidencia confiable',
};

const fmtPct = (n) => `${n > 0 ? '+' : ''}${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

function conclusiones(items, resumen, competidores, umbral) {
  const c = [];
  const total = items.length;
  if (!total) return ['No se encontraron productos del catálogo para la solicitud.'];
  const comparados = items.filter((i) => i.analisis.competidoresComparados > 0);
  c.push(`Se analizaron ${total} productos de Ragnar contra ${competidores.consultados.length} competidores; ${comparados.length} pudieron compararse con al menos una fuente verificable.`);
  if (resumen.mas_caro) c.push(`${resumen.mas_caro} productos están más caros que la mediana de la competencia.`);
  if (resumen.mas_barato) c.push(`${resumen.mas_barato} productos están más baratos que la mediana de la competencia.`);
  const signif = items.filter((i) => i.analisis.significativa);
  if (signif.length) {
    const peor = [...signif].sort((a, b) => b.analisis.diferenciaMedianaPct - a.analisis.diferenciaMedianaPct)[0];
    c.push(`${signif.length} productos tienen diferencias de ${umbral} % o más. La mayor brecha es ${peor.producto.producto} ${peor.producto.marca} ${peor.producto.presentacion} (${fmtPct(peor.analisis.diferenciaMedianaPct)}).`);
  }
  if (resumen.sin_coincidencias) c.push(`${resumen.sin_coincidencias} productos no se encontraron en los competidores consultados.`);
  if (resumen.no_confiable) c.push(`${resumen.no_confiable} productos tienen publicaciones parecidas, pero no se pudo confirmar que sean el mismo artículo; no se compararon.`);
  const promos = items.filter((i) => i.analisis.tienePromociones).length;
  if (promos) c.push(`${promos} productos tienen promociones vigentes en la competencia (se informan aparte del precio regular).`);
  if (competidores.omitidos.length) c.push(`No se consultó: ${competidores.omitidos.map((o) => `${o.nombre} (${o.motivo})`).join('; ')}`);
  return c;
}

export function generarInforme({ interpretacion, items, competidores, rag, pasos, advertencias, umbral, recortado, totalEncontrado }) {
  const resumen = { totalProductos: items.length, mas_caro: 0, mas_barato: 0, en_linea: 0, sin_coincidencias: 0, no_confiable: 0, significativas: 0, conPromociones: 0 };
  for (const i of items) {
    resumen[i.analisis.clasificacion] += 1;
    if (i.analisis.significativa) resumen.significativas += 1;
    if (i.analisis.tienePromociones) resumen.conPromociones += 1;
  }
  // Fuentes únicas utilizadas (F09): cada precio mostrado tiene url y fecha de consulta.
  const fuentes = [];
  for (const i of items) {
    for (const r of i.competidores) {
      if (r.comparacion?.comparable) fuentes.push({ competidorId: r.competidorId, url: r.publicacion.url, sku: r.publicacion.sku, consultadoEn: r.consultadoEn, publicado: r.publicacion.publicado });
    }
  }
  return {
    id: crypto.randomUUID(),
    fecha: new Date().toISOString(),
    solicitud: interpretacion.mensaje,
    interpretacion,
    umbralSignificativoPct: umbral,
    competidores,
    resumen,
    conclusiones: conclusiones(items, resumen, competidores, umbral),
    items,
    fuentes,
    contextoRag: rag,
    advertencias: [
      ...(recortado ? [`La consulta encontró ${totalEncontrado} productos; se analizaron los primeros ${items.length}.`] : []),
      ...advertencias,
    ],
    pasos,
    etiquetas: ETIQUETAS,
  };
}

/**
 * F05 y F06 — Comparación de precios y promociones.
 *
 * Convención de signos: diferencia POSITIVA = Ragnar está MÁS CARO que el competidor.
 *   diferenciaAbsoluta  = precioRagnar - precioCompetidor
 *   diferenciaPct       = (precioRagnar - precioCompetidor) / precioCompetidor * 100
 *
 * Si las presentaciones son distintas, se compara el precio por kg / litro / unidad.
 * El precio regular y el promocional se informan SIEMPRE por separado.
 */
import { convertir, tiposCambio } from '../repositorios/fuentesRepositorio.js';
import { precioPorReferencia, redondear } from '../utils/unidades.js';

/** Precio unitario efectivo de una promoción (null si no se puede calcular). */
export function precioPromocional(pub) {
  const p = pub.promocion;
  if (!p) return null;
  if (pub.precio_promocional) return { precio: pub.precio_promocional, condicion: null };
  if (p.tipo === 'nxm' && p.lleva && p.paga) {
    return { precio: redondear((pub.precio_regular * p.paga) / p.lleva), condicion: `Llevando ${p.lleva} unidades` };
  }
  if (p.tipo === 'segunda_unidad' && p.porcentaje) {
    return { precio: redondear((pub.precio_regular * (2 - p.porcentaje / 100)) / 2), condicion: 'Llevando 2 unidades' };
  }
  return null;
}

function diferencias(ragnar, competidor) {
  if (!Number.isFinite(ragnar) || !Number.isFinite(competidor) || competidor <= 0) return null;
  return {
    absoluta: redondear(ragnar - competidor),
    porcentual: redondear(((ragnar - competidor) / competidor) * 100, 1),
  };
}

/**
 * Compara un producto de Ragnar con la publicación elegida de un competidor.
 * Solo se llama con estados "equivalente" o "equivalente_otra_presentacion".
 */
export function comparar(producto, emparejamiento, competidor) {
  const pub = emparejamiento.publicacion;
  const monedaCatalogo = producto.moneda;
  const advertencias = [];

  let regular = pub.precio_regular;
  const promo = precioPromocional(pub);
  let promoPrecio = promo?.precio ?? null;
  let tipoCambio = null;
  if (pub.moneda !== monedaCatalogo) {
    regular = convertir(pub.precio_regular, pub.moneda, monedaCatalogo);
    promoPrecio = promoPrecio != null ? convertir(promoPrecio, pub.moneda, monedaCatalogo) : null;
    if (regular == null) return { comparable: false, motivo: `Sin tipo de cambio para ${pub.moneda}.` };
    tipoCambio = { desde: pub.moneda, hacia: monedaCatalogo, tasa: tiposCambio.tasas[pub.moneda], fecha: tiposCambio.fecha, fuente: tiposCambio.fuente };
    advertencias.push(`Precio convertido de ${pub.moneda} a ${monedaCatalogo} con un tipo de cambio de demostración.`);
  }

  const mismaPresentacion = emparejamiento.estado === 'equivalente';
  const contenidoComp = emparejamiento.presentacionLeida.contenido;
  const refRagnar = producto.precioPorReferencia;
  const refComp = precioPorReferencia(regular, contenidoComp, producto.unidad);
  const refPromo = promoPrecio != null ? precioPorReferencia(promoPrecio, contenidoComp, producto.unidad) : null;

  // Base de comparación: precio del envase si es la misma presentación; si no, por unidad de referencia.
  const base = mismaPresentacion ? 'envase' : 'unidad_referencia';
  const ragnarBase = mismaPresentacion ? producto.precio : refRagnar;
  const compRegularBase = mismaPresentacion ? regular : refComp;
  const compPromoBase = mismaPresentacion ? promoPrecio : refPromo;

  if (!pub.disponible) advertencias.push('La publicación figura sin stock.');

  return {
    comparable: true,
    base,
    unidadReferencia: producto.unidadReferencia,
    precioRegular: regular,
    precioRegularOriginal: pub.precio_regular,
    monedaOriginal: pub.moneda,
    precioPorReferencia: refComp,
    promocion: pub.promocion
      ? { ...pub.promocion, precioEfectivo: promoPrecio, precioEfectivoPorReferencia: refPromo, condicion: promo?.condicion ?? null }
      : null,
    diferenciaRegular: diferencias(ragnarBase, compRegularBase),
    diferenciaPromocional: compPromoBase != null ? diferencias(ragnarBase, compPromoBase) : null,
    tipoCambio,
    advertencias,
  };
}

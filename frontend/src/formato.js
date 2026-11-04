const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

export const fmtPesos = (n) => (n == null ? '—' : pesos.format(n));
export const fmtPct = (n) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${numero.format(Math.abs(n))} %`);
export const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const fmtHora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '');

export const CLASIFICACIONES = {
  mas_caro: { etiqueta: 'Más caro', corto: 'Más caros', clase: 'caro' },
  mas_barato: { etiqueta: 'Más barato', corto: 'Más baratos', clase: 'barato' },
  en_linea: { etiqueta: 'En línea', corto: 'En línea', clase: 'linea' },
  no_confiable: { etiqueta: 'Sin coincidencia confiable', corto: 'No confiables', clase: 'duda' },
  sin_coincidencias: { etiqueta: 'No encontrado', corto: 'No encontrados', clase: 'nada' },
};

export const ESTADOS = {
  equivalente: { etiqueta: 'Mismo artículo', clase: 'ok' },
  equivalente_otra_presentacion: { etiqueta: 'Otra presentación', clase: 'ok' },
  no_confiable: { etiqueta: 'No confiable', clase: 'duda' },
  descartado: { etiqueta: 'Descartado', clase: 'falla' },
  sin_resultados: { etiqueta: 'Sin resultados', clase: 'nada' },
};

/** Iniciales para marcar competidores en la regla: "Hiper Delta" -> "HD" */
export const iniciales = (nombre) => nombre.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

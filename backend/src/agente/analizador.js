/**
 * F07 — Análisis de resultados.
 * Clasifica cada producto según su posición frente a la competencia:
 *  - mas_caro / mas_barato / en_linea  (comparado contra la MEDIANA de los precios regulares)
 *  - sin_coincidencias                 (ningún competidor publica algo parecido)
 *  - no_confiable                      (hay candidatos, pero ninguno se pudo verificar)
 * y marca si la diferencia es significativa (umbral configurable).
 */
import { config } from '../config.js';
import { redondear } from '../utils/unidades.js';

function mediana(valores) {
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function clasificar(resultadosPorCompetidor, umbralPct = config.umbralSignificativoPct) {
  const comparados = resultadosPorCompetidor.filter((r) => r.comparacion?.comparable);
  const huboCandidatos = resultadosPorCompetidor.some((r) => r.candidatosEvaluados > 0);

  if (!comparados.length) {
    return {
      clasificacion: huboCandidatos ? 'no_confiable' : 'sin_coincidencias',
      significativa: false,
      diferenciaMedianaPct: null,
      competidoresComparados: 0,
    };
  }
  const pcts = comparados.map((r) => r.comparacion.diferenciaRegular.porcentual);
  const dif = redondear(mediana(pcts), 1);
  let clasificacion = 'en_linea';
  if (dif > config.toleranciaEnLineaPct) clasificacion = 'mas_caro';
  else if (dif < -config.toleranciaEnLineaPct) clasificacion = 'mas_barato';

  const masBarato = comparados.reduce((a, b) => (a.comparacion.diferenciaRegular.porcentual > b.comparacion.diferenciaRegular.porcentual ? a : b));
  return {
    clasificacion,
    significativa: Math.abs(dif) >= umbralPct,
    diferenciaMedianaPct: dif,
    rango: { minPct: Math.min(...pcts), maxPct: Math.max(...pcts) },
    competidorMasBarato: masBarato.comparacion.diferenciaRegular.porcentual > 0 ? masBarato.competidorId : null,
    competidoresComparados: comparados.length,
    tienePromociones: comparados.some((r) => r.comparacion.promocion),
  };
}

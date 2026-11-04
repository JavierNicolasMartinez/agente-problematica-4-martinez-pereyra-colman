import { SearchX } from 'lucide-react';
import { iniciales, fmtPct } from '../formato.js';

/**
 * Regla de góndola: Ragnar en el centro (fleje amarillo) y cada competidor
 * ubicado según cuánto más barato (izquierda) o más caro (derecha) vende el mismo artículo.
 */
export function posiciones(competidores) {
  const datos = competidores
    .filter((c) => c.comparacion?.comparable)
    .map((c) => {
      const p = c.comparacion.diferenciaRegular.porcentual; // + = Ragnar más caro
      const rel = (1 / (1 + p / 100) - 1) * 100; // precio del competidor relativo a Ragnar
      return { id: c.competidorId, nombre: c.competidor, p, rel, promo: Boolean(c.comparacion.promocion) };
    });
  const mayor = Math.max(0, ...datos.map((d) => Math.abs(d.rel)));
  const limite = Math.min(60, Math.max(20, Math.ceil(mayor / 10) * 10));
  return { datos, limite };
}

export default function ReglaGondola({ competidores, analisis, conEscala = false }) {
  const { datos, limite } = posiciones(competidores);
  if (!datos.length) {
    return (
      <div className="regla-sin-datos">
        <SearchX aria-hidden="true" />
        {analisis.clasificacion === 'no_confiable' ? 'Hay publicaciones parecidas, sin verificar' : 'No aparece en la competencia'}
      </div>
    );
  }
  const x = (rel) => 50 + (Math.max(-limite, Math.min(limite, rel)) / limite) * 50;
  const minX = Math.min(50, ...datos.map((d) => x(d.rel)));
  const maxX = Math.max(50, ...datos.map((d) => x(d.rel)));
  // Ubicación de iniciales para que no se pisen: abajo, si no entra arriba (lejos del fleje de Ragnar), si no se ocultan (quedan en el tooltip).
  const ordenados = [...datos].sort((a, b) => x(a.rel) - x(b.rel));
  const lugar = new Map();
  let ultAbajo = -Infinity;
  let ultArriba = -Infinity;
  for (const d of ordenados) {
    const pos = x(d.rel);
    if (pos - ultAbajo >= 7) { lugar.set(d.id, ''); ultAbajo = pos; }
    else if (pos - ultArriba >= 7 && Math.abs(pos - 50) > 7) { lugar.set(d.id, 'arriba'); ultArriba = pos; }
    else lugar.set(d.id, 'sin-ini');
  }
  const descripcion = datos.map((d) => `${d.nombre}: Ragnar ${fmtPct(d.p)}`).join('; ');

  return (
    <div>
      <div className="regla" role="img" aria-label={`Posición de precio. ${descripcion}`}>
        <div className="regla-eje" />
        {minX < 50 && <div className="regla-zona caro" style={{ left: `${minX}%`, width: `${50 - minX}%` }} />}
        {maxX > 50 && <div className="regla-zona barato" style={{ left: '50%', width: `${maxX - 50}%` }} />}
        <div className="regla-ragnar"><span className="etiqueta-r">R</span><span className="poste" /></div>
        {datos.map((d, i) => (
          <span
            key={d.id}
            className={`marcador ${d.p > 0 ? 'caro' : d.p < 0 ? 'barato' : ''} ${d.promo ? 'promo' : ''} ${Math.abs(d.rel) > limite ? 'fuera' : ''} ${lugar.get(d.id)}`}
            style={{ left: `${x(d.rel)}%`, '--i': i }}
            title={`${d.nombre}: Ragnar ${fmtPct(d.p)}${d.promo ? ' · tiene promoción' : ''}`}
          >
            <span className="pin" />
            <span className="ini">{iniciales(d.nombre)}</span>
          </span>
        ))}
      </div>
      {conEscala && (
        <div className="regla-escala" aria-hidden="true">
          <span>−{limite} % más barato</span><span>mismo precio</span><span>+{limite} % más caro</span>
        </div>
      )}
    </div>
  );
}

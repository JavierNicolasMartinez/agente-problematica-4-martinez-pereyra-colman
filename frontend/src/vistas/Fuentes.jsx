import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { api } from '../api.js';

export default function Fuentes() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.competidores().then(setDatos).catch((e) => setError(e.message)); }, []);

  return (
    <div className="contenedor">
      <h1 className="titulo-vista">Fuentes de precios</h1>
      <p className="bajada">Competidores que el agente puede consultar. Son fuentes simuladas para el trabajo académico: nombres, sitios y precios son ficticios. Una fuente que prohíbe la consulta automatizada se omite y se informa.</p>
      {error && <p className="aviso error">{error}</p>}
      <div className="fuentes-grilla">
        {datos?.competidores.map((c) => (
          <article key={c.id} className="tarjeta-fuente" data-bloqueada={!c.permiteConsulta}>
            <h2>{c.nombre}</h2>
            <span className={`estado ${c.permiteConsulta ? 'ok' : 'falla'}`}>
              {c.permiteConsulta ? <ShieldCheck aria-hidden="true" /> : <ShieldOff aria-hidden="true" />}
              {c.permiteConsulta ? 'Consulta permitida' : 'Consulta no permitida'}
            </span>
            <dl>
              <dt>Sitio</dt><dd>{c.sitio.replace('https://', '')}</dd>
              <dt>País</dt><dd>{c.pais}</dd>
              <dt>Regiones</dt><dd>{c.regiones.join(', ')}</dd>
              <dt>Moneda</dt><dd>{c.moneda}</dd>
              <dt>Tipo</dt><dd>{c.tipoFuente === 'simulado' ? 'Fuente simulada' : c.tipoFuente}</dd>
            </dl>
            <p>{c.condiciones}</p>
          </article>
        ))}
      </div>
      {datos && (
        <p className="bajada" style={{ marginTop: 24 }}>
          Tipo de cambio para otras monedas: 1 UYU = {datos.tiposCambio.tasas.UYU} ARS ({datos.tiposCambio.fuente}, {datos.tiposCambio.fecha}).
        </p>
      )}
    </div>
  );
}

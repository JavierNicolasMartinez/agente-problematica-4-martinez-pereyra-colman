import { Check, Minus, Ban } from 'lucide-react';
import { fmtFecha } from '../formato.js';

export default function Lateral({ informe }) {
  const { pasos, competidores, contextoRag, fuentes } = informe;
  return (
    <aside className="lateral" aria-label="Cómo se resolvió">
      <section className="bloque-lateral">
        <h2>Cómo lo resolvió el agente</h2>
        <ol className="traza">
          {pasos.map((p) => {
            const apagado = p.id === 'rag' && !contextoRag?.habilitado;
            return (
              <li key={p.id}>
                <span className={`nodo ${apagado ? 'apagado' : ''}`}>{apagado ? <Minus aria-hidden="true" /> : <Check aria-hidden="true" />}</span>
                <div>
                  <strong>{p.titulo} <small>{p.duracionMs} ms</small></strong>
                  <p>{p.detalle}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="bloque-lateral">
        <h2>Fuentes</h2>
        <ul className="lista-simple">
          {competidores.consultados.map((c) => (
            <li key={c.id}><Check className="ok" aria-hidden="true" /><span>{c.nombre} · {fuentes.filter((f) => f.competidorId === c.id).length} precios</span></li>
          ))}
          {competidores.omitidos.map((o) => (
            <li key={o.id}><Ban className="no" aria-hidden="true" /><span>{o.nombre}: {o.motivo}</span></li>
          ))}
        </ul>
        <p className="prod-meta">Informe generado {fmtFecha(informe.fecha)}</p>
      </section>

      {contextoRag?.habilitado && contextoRag.fragmentos.length > 0 && (
        <section className="bloque-lateral">
          <h2>Contexto recuperado</h2>
          <ul className="lista-simple">
            {contextoRag.fragmentos.map((f) => <li key={f.fuente + f.texto.slice(0, 20)}><Check className="ok" aria-hidden="true" /><span>{f.texto} <em>({f.fuente})</em></span></li>)}
          </ul>
        </section>
      )}
    </aside>
  );
}

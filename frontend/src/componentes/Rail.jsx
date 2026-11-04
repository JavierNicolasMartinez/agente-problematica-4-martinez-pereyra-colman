import { Search, Boxes, Store, Plus } from 'lucide-react';
import { fmtHora } from '../formato.js';

const VISTAS = [
  { id: 'investigar', nombre: 'Investigar', icono: Search },
  { id: 'catalogo', nombre: 'Catálogo', icono: Boxes },
  { id: 'fuentes', nombre: 'Fuentes', icono: Store },
];

export function Logo() {
  return (
    <svg className="marca-logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="oklch(0.41 0.06 163)" />
      <rect x="6" y="20" width="20" height="2.5" rx="1.25" fill="oklch(0.85 0.03 163)" />
      <rect x="10.5" y="9" width="11" height="8.5" rx="2" fill="oklch(0.885 0.165 95)" />
      <rect x="15" y="17.5" width="2" height="2.5" fill="oklch(0.885 0.165 95)" />
    </svg>
  );
}

export default function Rail({ vista, cambiarVista, historial, informeActual, abrirInforme, nuevaSesion }) {
  return (
    <aside className="rail">
      <a className="marca" href="/" onClick={(e) => { e.preventDefault(); cambiarVista('investigar'); }}>
        <Logo />
        <span className="marca-nombre">Ragnar<span className="marca-sub">Inteligencia de precios</span></span>
      </a>

      <nav className="nav" aria-label="Secciones">
        {VISTAS.map(({ id, nombre, icono: Icono }) => (
          <button key={id} type="button" aria-current={vista === id ? 'page' : undefined} onClick={() => cambiarVista(id)} title={nombre}>
            <Icono aria-hidden="true" /> <span>{nombre}</span>
          </button>
        ))}
      </nav>

      <section className="historial" aria-label="Consultas de esta sesión">
        <h2>Consultas de esta sesión</h2>
        {historial.length === 0 ? (
          <p className="historial-vacio">Todavía no hiciste consultas.</p>
        ) : (
          <ol>
            {[...historial].reverse().map((h) => (
              <li key={h.informeId}>
                <button type="button" aria-current={h.informeId === informeActual ? 'true' : undefined} onClick={() => abrirInforme(h.informeId)}>
                  <span>{h.mensaje}</span>
                  <small>{fmtHora(h.fecha)} · {h.total} productos</small>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="rail-pie">
        <button type="button" className="boton-rail" onClick={nuevaSesion}><Plus aria-hidden="true" /> Nueva sesión</button>
        <p className="aviso-simulado">Precios de competidores desde fuentes simuladas, con fines académicos.</p>
      </div>
    </aside>
  );
}

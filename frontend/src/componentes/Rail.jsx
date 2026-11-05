import { Search, Boxes, Store, Swords, Plus } from 'lucide-react';
import { fmtHora } from '../formato.js';

const VISTAS = [
  { id: 'investigar', nombre: 'Investigar', icono: Search },
  { id: 'catalogo', nombre: 'Catálogo', icono: Boxes },
  { id: 'fuentes', nombre: 'Fuentes', icono: Store },
  { id: 'valhalla', nombre: 'Valhalla', icono: Swords },
];

export function Logo() {
  return (
    <svg className="marca-logo" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#c79a3e" />
      <circle cx="16" cy="16" r="13" fill="#8f2a24" />
      <path fill="#e3d6b8" d="M16 3a13 13 0 0 1 13 13H16Zm0 13v13A13 13 0 0 1 3 16Z" />
      <circle cx="16" cy="16" r="7.5" fill="#101a29" stroke="#c79a3e" strokeWidth="1.4" />
      <path fill="none" stroke="#e2bd63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5v11m0-11 5 3.2-5 3 5 4.8" />
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
        <p className="rail-runas" aria-hidden="true">ᚱᚨᚷᚾᚨᚱ ᛚᛟᚦᛒᚱᛟᚲ</p>
        <p className="aviso-simulado">Precios de competidores desde fuentes simuladas, con fines académicos.</p>
      </div>
    </aside>
  );
}

import { useEffect, useState } from 'react';
import { Search, ScanSearch, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import { fmtPesos } from '../formato.js';

const LIMITE = 25;

export default function Catalogo({ investigar }) {
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [facetas, setFacetas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.facetas().then(setFacetas).catch(() => {}); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.catalogo({ q: q.trim(), categoria, pagina, limite: LIMITE })
        .then((d) => { setDatos(d); setError(''); })
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [q, categoria, pagina]);

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / LIMITE)) : 1;

  return (
    <div className="contenedor">
      <h1 className="titulo-vista">Catálogo de Ragnar</h1>
      <p className="bajada">{facetas ? `${facetas.total} artículos en ${facetas.categorias.length} categorías.` : 'Cargando…'} Solo lectura: el agente nunca modifica precios.</p>

      <div className="filtros-catalogo">
        <div className="buscador">
          <Search aria-hidden="true" />
          <label htmlFor="buscar" className="solo-lectores">Buscar en el catálogo</label>
          <input id="buscar" type="search" placeholder="Producto, marca o ID" maxLength={80} value={q} onChange={(e) => { setQ(e.target.value); setPagina(1); }} />
        </div>
        <div className="segmentos" role="group" aria-label="Categoría">
          <button type="button" aria-pressed={categoria === ''} onClick={() => { setCategoria(''); setPagina(1); }}>Todas</button>
          {facetas?.categorias.map((c) => (
            <button key={c.nombre} type="button" aria-pressed={categoria === c.nombre} onClick={() => { setCategoria(c.nombre); setPagina(1); }}>{c.nombre} <small>{c.cantidad}</small></button>
          ))}
        </div>
      </div>

      {error && <p className="aviso error">{error}</p>}

      <div className="envoltura-tabla">
        <table className="tabla">
          <thead>
            <tr><th>ID</th><th>Producto</th><th>Marca</th><th>Categoría</th><th>Presentación</th><th className="der">Precio</th><th className="der">Por unidad</th><th /></tr>
          </thead>
          <tbody>
            {datos?.productos.map((p) => (
              <tr key={p.id}>
                <td className="num">{p.id}</td>
                <td>{p.producto}{p.idsMismoArticulo.length > 0 && <span className="marca-repetido" title={`Mismo artículo: ${p.idsMismoArticulo.join(', ')}`}>repetido</span>}</td>
                <td>{p.marca}</td>
                <td>{p.categoria}</td>
                <td>{p.presentacion}</td>
                <td className="der"><span className="precio">{fmtPesos(p.precio)}</span></td>
                <td className="der num">{fmtPesos(p.precioPorReferencia)} / {p.unidadReferencia}</td>
                <td className="der"><button type="button" className="boton-secundario" onClick={() => investigar(`Compará ${p.id} en todos los competidores`)}><ScanSearch aria-hidden="true" /> Investigar</button></td>
              </tr>
            ))}
            {datos && datos.productos.length === 0 && <tr><td colSpan={8}>No hay artículos con esa búsqueda.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="paginacion">
        <span className="num">{datos ? `${datos.total} resultados · página ${pagina} de ${paginas}` : ''}</span>
        <div>
          <button type="button" className="boton-secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}><ChevronLeft aria-hidden="true" /> Anterior</button>
          <button type="button" className="boton-secundario" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente <ChevronRight aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  );
}

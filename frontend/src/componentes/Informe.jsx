import { useMemo, useState } from 'react';
import { Download, FileText, SearchX } from 'lucide-react';
import FilaProducto from './FilaProducto.jsx';
import Lateral from './Lateral.jsx';
import { CLASIFICACIONES } from '../formato.js';
import { api } from '../api.js';

const ORDEN_CLASIF = ['mas_caro', 'mas_barato', 'en_linea', 'no_confiable', 'sin_coincidencias'];

function Entidades({ interpretacion, competidores }) {
  const i = interpretacion;
  const lista = [
    i.productos.length && ['Productos', i.productos.join(', ')],
    i.marcas.length && ['Marcas', i.marcas.join(', ')],
    i.categorias.length && ['Categorías', i.categorias.join(', ')],
    i.ids.length && ['IDs', i.ids.join(', ')],
    i.todoElCatalogo && ['Alcance', 'Todo el catálogo'],
    ['Competidores', competidores.consultados.map((c) => c.nombre).join(', ') || 'Ninguno'],
    i.regiones.length && ['Región', i.regiones.join(', ')],
    i.filtros.clasificacion && ['Filtro', CLASIFICACIONES[i.filtros.clasificacion].corto],
    i.filtros.soloSignificativas && ['Umbral', `${i.filtros.umbralPct ?? 'Desde el umbral'}${i.filtros.umbralPct ? ' %' : ''}`],
    i.filtros.soloPromociones && ['Filtro', 'Con promociones'],
  ].filter(Boolean);
  return (
    <div className="entidades" aria-label="Lo que entendió el agente">
      {lista.map(([k, v]) => <span key={k + v} className="entidad"><span>{k}</span><strong>{v}</strong></span>)}
    </div>
  );
}

function Panorama({ resumen, filtro, setFiltro, conclusiones }) {
  const total = resumen.totalProductos || 1;
  return (
    <section className="panorama" aria-label="Posicionamiento general">
      <div className="distribucion" aria-hidden="true">
        {ORDEN_CLASIF.filter((k) => resumen[k]).map((k) => (
          <span key={k} className={`c-${CLASIFICACIONES[k].clase}`} style={{ width: `${(resumen[k] / total) * 100}%` }} />
        ))}
      </div>
      <div className="leyenda">
        {ORDEN_CLASIF.map((k) => (
          <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(filtro === k ? 'todos' : k)} disabled={!resumen[k]}>
            <span className={`punto c-${CLASIFICACIONES[k].clase}`} aria-hidden="true" />
            <b>{resumen[k]}</b> {CLASIFICACIONES[k].corto.toLowerCase()}
          </button>
        ))}
      </div>
      <ul className="conclusiones">{conclusiones.map((c) => <li key={c}>{c}</li>)}</ul>
    </section>
  );
}

const ORDENES = {
  brecha: { nombre: 'Mayor brecha', fn: (a, b) => Math.abs(b.analisis.diferenciaMedianaPct ?? -1) - Math.abs(a.analisis.diferenciaMedianaPct ?? -1) },
  caros: { nombre: 'Más caros primero', fn: (a, b) => (b.analisis.diferenciaMedianaPct ?? -999) - (a.analisis.diferenciaMedianaPct ?? -999) },
  baratos: { nombre: 'Más baratos primero', fn: (a, b) => (a.analisis.diferenciaMedianaPct ?? 999) - (b.analisis.diferenciaMedianaPct ?? 999) },
  nombre: { nombre: 'Nombre', fn: (a, b) => `${a.producto.producto} ${a.producto.marca}`.localeCompare(`${b.producto.producto} ${b.producto.marca}`, 'es') },
};

export default function Informe({ informe, sesionId }) {
  const [filtro, setFiltro] = useState('todos');
  const [soloSignif, setSoloSignif] = useState(false);
  const [orden, setOrden] = useState('brecha');
  const [abierta, setAbierta] = useState(null);

  const visibles = useMemo(() => {
    let r = informe.items;
    if (filtro !== 'todos') r = r.filter((i) => i.analisis.clasificacion === filtro);
    if (soloSignif) r = r.filter((i) => i.analisis.significativa);
    return [...r].sort(ORDENES[orden].fn);
  }, [informe, filtro, soloSignif, orden]);

  const { resumen } = informe;

  return (
    <div className="informe">
      <div className="informe-cuerpo">
        <header className="informe-cabeza">
          <h1 className="solicitud"><q>{informe.solicitud}</q></h1>
          <Entidades interpretacion={informe.interpretacion} competidores={informe.competidores} />
        </header>

        <Panorama resumen={resumen} filtro={filtro} setFiltro={setFiltro} conclusiones={informe.conclusiones} />

        <div className="herramientas">
          <div className="segmentos" role="group" aria-label="Filtrar por resultado">
            <button type="button" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos <small>{resumen.totalProductos}</small></button>
            {ORDEN_CLASIF.filter((k) => resumen[k]).map((k) => (
              <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{CLASIFICACIONES[k].corto} <small>{resumen[k]}</small></button>
            ))}
          </div>
          <div className="acciones">
            <label className="interruptor"><input type="checkbox" checked={soloSignif} onChange={(e) => setSoloSignif(e.target.checked)} /> Solo diferencias ≥ {informe.umbralSignificativoPct} %</label>
            <label className="solo-lectores" htmlFor="orden">Ordenar</label>
            <select id="orden" className="selector" value={orden} onChange={(e) => setOrden(e.target.value)}>
              {Object.entries(ORDENES).map(([k, o]) => <option key={k} value={k}>{o.nombre}</option>)}
            </select>
            <a className="boton-secundario" href={api.urlExportar(sesionId, informe.id, 'csv')} download><Download aria-hidden="true" /> CSV</a>
            <a className="boton-secundario" href={api.urlExportar(sesionId, informe.id, 'md')} download><FileText aria-hidden="true" /> Informe .md</a>
          </div>
        </div>

        <div className="lista" role="list" aria-label="Productos analizados">
          <div className="lista-cabeza" aria-hidden="true">
            <span>Producto</span>
            <span>Posición frente a la competencia</span>
            <span className="der">Precio Ragnar</span>
            <span className="der">Vs. mediana</span>
            <span />
          </div>
          {visibles.length === 0 ? (
            <div className="vacio-lista"><SearchX aria-hidden="true" /><p>Ningún producto cumple estos filtros.</p></div>
          ) : (
            visibles.map((item) => (
              <div role="listitem" key={item.producto.id}>
                <FilaProducto item={item} abierta={abierta === item.producto.id} alternar={() => setAbierta(abierta === item.producto.id ? null : item.producto.id)} />
              </div>
            ))
          )}
        </div>
      </div>
      <Lateral informe={informe} />
    </div>
  );
}

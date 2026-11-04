import { useMemo, useState } from 'react';
import { ChevronRight, Download, FileText, SearchX, TriangleAlert } from 'lucide-react';
import FilaProducto from './FilaProducto.jsx';
import Lateral from './Lateral.jsx';
import { CLASIFICACIONES, fmtPct } from '../formato.js';
import { api } from '../api.js';

const ORDEN_CLASIF = ['mas_caro', 'mas_barato', 'en_linea', 'no_confiable', 'sin_coincidencias'];
const MAX_PRIORITARIOS = 5;

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

function describirFiltros({ filtros }, umbral) {
  return [
    filtros.clasificacion && CLASIFICACIONES[filtros.clasificacion].corto.toLowerCase(),
    filtros.soloSignificativas && `diferencia de ${umbral} % o más`,
    filtros.soloPromociones && 'con promociones',
  ].filter(Boolean).join(' · ');
}

function Panorama({ respuesta, resumen, filtro, setFiltro }) {
  const total = resumen.totalProductos || 1;
  return (
    <section className="panorama" aria-label="Respuesta">
      <p className="respuesta">{respuesta}</p>
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
    </section>
  );
}

const ORDENES = {
  brecha: { nombre: 'Mayor brecha', fn: (a, b) => Math.abs(b.analisis.diferenciaMedianaPct ?? -1) - Math.abs(a.analisis.diferenciaMedianaPct ?? -1) },
  caros: { nombre: 'Más caros primero', fn: (a, b) => (b.analisis.diferenciaMedianaPct ?? -999) - (a.analisis.diferenciaMedianaPct ?? -999) },
  baratos: { nombre: 'Más baratos primero', fn: (a, b) => (a.analisis.diferenciaMedianaPct ?? 999) - (b.analisis.diferenciaMedianaPct ?? 999) },
  nombre: { nombre: 'Nombre', fn: (a, b) => `${a.producto.producto} ${a.producto.marca}`.localeCompare(`${b.producto.producto} ${b.producto.marca}`, 'es') },
};

/** Los productos con mayor diferencia, para no tener que recorrer toda la lista. */
function Prioritarios({ items, abrir }) {
  const prioritarios = items.filter((i) => i.analisis.significativa).sort(ORDENES.brecha.fn).slice(0, MAX_PRIORITARIOS);
  if (items.length <= MAX_PRIORITARIOS || !prioritarios.length) return null;
  return (
    <section className="prioritarios" aria-labelledby="titulo-prioritarios">
      <h2 id="titulo-prioritarios">Para mirar primero</h2>
      <ol>
        {prioritarios.map(({ producto, analisis }) => (
          <li key={producto.id}>
            <button type="button" onClick={() => abrir(producto.id)}>
              <span className="prioritario-nombre">{producto.producto} {producto.marca} <small>{producto.presentacion}</small></span>
              <span className={`insignia ${CLASIFICACIONES[analisis.clasificacion].clase}`}>{fmtPct(analisis.diferenciaMedianaPct)}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SinResultados({ informe, investigar, verCatalogo }) {
  const { interpretacion: i, totalEncontrados } = informe;
  const terminos = [...i.productos, ...i.marcas, ...i.categorias, ...i.ids].join(', ');
  const excluidoPorFiltros = totalEncontrados > 0;
  return (
    <section className="sin-resultados">
      <SearchX aria-hidden="true" />
      <h2>{informe.respuesta}</h2>
      <p>
        {excluidoPorFiltros
          ? `Encontramos ${terminos} en el catálogo, pero ningún producto pasó los filtros del pedido.`
          : `Buscamos “${terminos}” en el catálogo de Ragnar y no aparece con ese nombre.`}
      </p>
      {excluidoPorFiltros ? (
        <button type="button" className="boton-secundario" onClick={() => investigar(`Compará ${terminos}`)}>Ver sin filtros</button>
      ) : (
        <button type="button" className="boton-secundario" onClick={verCatalogo}>Buscar en el catálogo</button>
      )}
    </section>
  );
}

function Detalle({ informe }) {
  return (
    <details className="plegable">
      <summary>Ver conclusiones, fuentes y cómo se calculó</summary>
      <div className="plegable-contenido">
        <ul className="conclusiones">{informe.conclusiones.map((c) => <li key={c}>{c}</li>)}</ul>
        <Lateral informe={informe} />
      </div>
    </details>
  );
}

export default function Informe({ informe, sesionId, investigar, verCatalogo }) {
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

  const abrirProducto = (id) => {
    setFiltro('todos');
    setSoloSignif(false);
    setAbierta(id);
    requestAnimationFrame(() => document.getElementById(`producto-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const { resumen, advertencias } = informe;
  const filtrosPedidos = describirFiltros(informe.interpretacion, informe.umbralSignificativoPct);

  return (
    <div className="informe">
      <header className="informe-cabeza">
        <h1 className="solicitud"><q>{informe.solicitud}</q></h1>
        <Entidades interpretacion={informe.interpretacion} competidores={informe.competidores} />
      </header>

      {informe.items.length === 0 ? (
        <>
          <SinResultados informe={informe} investigar={investigar} verCatalogo={verCatalogo} />
          <Detalle informe={informe} />
        </>
      ) : (
        <>
          <div className="resumen-informe">
            <Panorama respuesta={informe.respuesta} resumen={resumen} filtro={filtro} setFiltro={setFiltro} />
            <Prioritarios items={informe.items} abrir={abrirProducto} />
          </div>

          {advertencias.map((a) => <p key={a} className="aviso"><TriangleAlert aria-hidden="true" />{a}</p>)}

          <Detalle informe={informe} />

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

          <p className="conteo" role="status">
            Mostrando {visibles.length} de {informe.totalAnalizados} productos revisados{filtrosPedidos && ` · pedido: ${filtrosPedidos}`}
          </p>

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
                <div role="listitem" id={`producto-${item.producto.id}`} key={item.producto.id}>
                  <FilaProducto item={item} abierta={abierta === item.producto.id} alternar={() => setAbierta(abierta === item.producto.id ? null : item.producto.id)} />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

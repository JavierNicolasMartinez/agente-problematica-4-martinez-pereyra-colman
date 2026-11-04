import { ChevronDown, TrendingUp, TrendingDown, Check, CircleHelp, X, ExternalLink, Info, Copy } from 'lucide-react';
import ReglaGondola from './ReglaGondola.jsx';
import { CLASIFICACIONES, ESTADOS, fmtPesos, fmtPct, fmtFecha } from '../formato.js';

// Defensa extra en el navegador: solo se enlazan URLs http(s).
const esUrlSegura = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };

const ICONO_CRITERIO = { ok: Check, duda: CircleHelp, falla: X };
const NOMBRE_CRITERIO = { nombre: 'Nombre', marca: 'Marca', categoria: 'Categoría', variante: 'Variante', presentacion: 'Presentación' };

function Insignia({ analisis }) {
  const c = CLASIFICACIONES[analisis.clasificacion];
  if (analisis.diferenciaMedianaPct == null) return <span className={`insignia ${c.clase}`}>{c.etiqueta}</span>;
  return <span className={`insignia ${c.clase}`} title="Diferencia contra la mediana de la competencia (precio regular)">{fmtPct(analisis.diferenciaMedianaPct)}</span>;
}

function EstadoCoincidencia({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.sin_resultados;
  const Icono = e.clase === 'ok' ? Check : e.clase === 'falla' ? X : CircleHelp;
  return <span className={`estado ${e.clase}`}><Icono aria-hidden="true" />{e.etiqueta}</span>;
}

function FilaCompetidor({ c, producto }) {
  const cmp = c.comparacion;
  const porUnidad = cmp?.base === 'unidad_referencia';
  return (
    <tr>
      <td>
        <div className="comp-nombre">{c.competidor}</div>
        {c.publicacion ? <div className="comp-titulo">{c.publicacion.titulo}</div> : <div className="comp-titulo">Búsqueda: “{c.consulta}”</div>}
        {c.criterios.length > 0 && (
          <div className="criterios">
            {c.criterios.map((k) => {
              const Icono = ICONO_CRITERIO[k.resultado];
              return <span key={k.criterio} className={`criterio ${k.resultado === 'ok' ? '' : k.resultado}`} title={k.detalle}><Icono aria-hidden="true" />{NOMBRE_CRITERIO[k.criterio]}</span>;
            })}
          </div>
        )}
        {c.descartes.length > 0 && (
          <details className="descartes">
            <summary>{c.descartes.length} {c.descartes.length === 1 ? 'publicación revisada' : 'publicaciones revisadas'} y no usadas</summary>
            <ul>{c.descartes.map((d) => <li key={d.url}>{d.titulo} — {ESTADOS[d.estado]?.etiqueta}{d.motivo ? `: ${d.motivo}` : ''}</li>)}</ul>
          </details>
        )}
      </td>
      <td><EstadoCoincidencia estado={c.estado} />{c.confianza != null && <div className="prod-meta">Confianza {Math.round(c.confianza * 100)} %</div>}</td>
      <td className="der precio-celda">
        {cmp ? (
          <>
            <span className="precio">{fmtPesos(cmp.precioRegular)}</span>
            {porUnidad && <small>{fmtPesos(cmp.precioPorReferencia)} / {cmp.unidadReferencia}</small>}
            {cmp.tipoCambio && <small>Original: {cmp.monedaOriginal} {cmp.precioRegularOriginal}</small>}
            {cmp.promocion && (
              <span className="fleje-promo">
                <b>{cmp.promocion.descripcion}</b>
                <span>{cmp.promocion.precioEfectivo != null ? `${fmtPesos(cmp.promocion.precioEfectivo)} c/u` : 'Sin precio efectivo'}{cmp.promocion.condicion ? ` · ${cmp.promocion.condicion.toLowerCase()}` : ''}</span>
              </span>
            )}
          </>
        ) : '—'}
      </td>
      <td className="der">
        {cmp ? (
          <>
            <span className={`insignia ${cmp.diferenciaRegular.porcentual > 0 ? 'caro' : cmp.diferenciaRegular.porcentual < 0 ? 'barato' : 'linea'}`}>{fmtPct(cmp.diferenciaRegular.porcentual)}</span>
            <div className="prod-meta a-derecha">{fmtPesos(cmp.diferenciaRegular.absoluta)}{porUnidad ? ` / ${producto.unidadReferencia}` : ''}</div>
            {cmp.diferenciaPromocional && <div className="prod-meta a-derecha">vs. promo {fmtPct(cmp.diferenciaPromocional.porcentual)}</div>}
          </>
        ) : '—'}
      </td>
      <td>
        <div className="fuente">
          {cmp && esUrlSegura(c.publicacion.url) ? <a href={c.publicacion.url} target="_blank" rel="noopener noreferrer nofollow">Ver fuente <ExternalLink aria-hidden="true" /></a> : <span>Sin precio usado</span>}
          <span>Consultado {fmtFecha(c.consultadoEn)}</span>
          {c.publicacion && <span>SKU {c.publicacion.sku}</span>}
        </div>
      </td>
    </tr>
  );
}

export default function FilaProducto({ item, abierta, alternar }) {
  const { producto, analisis } = item;
  const idDetalle = `detalle-${producto.id}`;
  const signif = analisis.significativa;
  return (
    <div className="fila" data-abierta={abierta}>
      <button type="button" className="fila-resumen" aria-expanded={abierta} aria-controls={idDetalle} onClick={alternar}>
        <div className="c-prod">
          <div className="prod-nombre">{producto.producto} {producto.marca}</div>
          <div className="prod-meta">
            <span>{producto.presentacion}</span>
            <span className="id">{producto.id}</span>
            <span>{producto.categoria}</span>
            {item.repetidoEnCatalogo && <span className="marca-repetido">repetido en catálogo</span>}
          </div>
        </div>
        <div className="c-regla"><ReglaGondola competidores={item.competidores} analisis={analisis} /></div>
        <div className="precio-ragnar">
          <span className="precio">{fmtPesos(producto.precio)}</span>
          <small>{fmtPesos(producto.precioPorReferencia)} / {producto.unidadReferencia}</small>
        </div>
        <div className="dif">
          <Insignia analisis={analisis} />
          {signif && (
            <span className={`signif ${analisis.clasificacion === 'mas_barato' ? 'barato' : ''}`}>
              {analisis.clasificacion === 'mas_barato' ? <TrendingDown aria-hidden="true" /> : <TrendingUp aria-hidden="true" />} significativa
            </span>
          )}
        </div>
        <ChevronDown className="chevron" aria-hidden="true" />
      </button>
      {abierta && (
        <div className="detalle" id={idDetalle}>
          {item.repetidoEnCatalogo && (
            <p className="detalle-aviso"><Copy aria-hidden="true" /> Este artículo figura con varios IDs en el catálogo: {producto.idsMismoArticulo.join(', ')}.</p>
          )}
          <p className="detalle-aviso"><Info aria-hidden="true" /> Diferencia = (precio Ragnar − precio competidor) ÷ precio competidor. Si la presentación es distinta, se compara por {producto.unidadReferencia}.</p>
          <div className="envoltura-tabla">
            <table className="tabla-comp">
              <thead>
                <tr><th>Competidor y publicación</th><th>Coincidencia</th><th className="der">Precio</th><th className="der">Ragnar vs. competidor</th><th>Fuente</th></tr>
              </thead>
              <tbody>
                {item.competidores.map((c) => <FilaCompetidor key={c.competidorId} c={c} producto={producto} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

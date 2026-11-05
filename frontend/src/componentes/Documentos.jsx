import { useEffect, useRef, useState } from 'react';
import { FileText, TriangleAlert, Upload } from 'lucide-react';
import { api } from '../api.js';

/** Documentos PDF que el agente puede consultar (RAG). */
export default function Documentos() {
  const [documentos, setDocumentos] = useState(null);
  const [subiendo, setSubiendo] = useState('');
  const [error, setError] = useState('');
  const entrada = useRef(null);

  const cargarLista = () => api.documentos().then((r) => setDocumentos(r.documentos)).catch((e) => setError(e.message));
  useEffect(() => { cargarLista(); }, []);

  const subir = async (archivo) => {
    if (!archivo) return;
    setSubiendo(archivo.name);
    setError('');
    try {
      await api.subirDocumento(archivo);
      await cargarLista();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubiendo('');
      entrada.current.value = '';
    }
  };

  return (
    <section className="documentos" aria-labelledby="titulo-documentos">
      <div className="documentos-cabeza">
        <div>
          <h2 id="titulo-documentos">Documentos del agente</h2>
          <p>PDF con políticas o reglas. Después podés preguntar sobre ellos en Investigar. Los precios siguen saliendo solo de las fuentes.</p>
        </div>
        <label className={`boton-secundario ${subiendo ? 'ocupado' : ''}`}>
          <Upload aria-hidden="true" /> {subiendo ? 'Indexando…' : 'Cargar PDF'}
          <input ref={entrada} type="file" accept="application/pdf,.pdf" className="solo-lectores" disabled={Boolean(subiendo)} onChange={(e) => subir(e.target.files[0])} />
        </label>
      </div>
      {error && <p className="aviso error" role="alert"><TriangleAlert aria-hidden="true" />{error}</p>}
      {subiendo && <p className="prod-meta" role="status">Indexando {subiendo}. Puede tardar según el tamaño del archivo.</p>}
      {documentos?.length === 0 && !subiendo && <p className="prod-meta">Todavía no hay documentos cargados.</p>}
      {documentos?.length > 0 && (
        <ul className="lista-documentos">
          {documentos.map((d) => (
            <li key={d.nombre}><FileText aria-hidden="true" /><span>{d.nombre}</span><small>{d.fragmentos} {d.fragmentos === 1 ? 'fragmento' : 'fragmentos'}</small></li>
          ))}
        </ul>
      )}
    </section>
  );
}

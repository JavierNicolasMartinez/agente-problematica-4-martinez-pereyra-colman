import { useCallback, useEffect, useState } from 'react';
import { TriangleAlert, MessageCircleQuestion } from 'lucide-react';
import Rail from './componentes/Rail.jsx';
import Compositor from './componentes/Compositor.jsx';
import Inicio from './componentes/Inicio.jsx';
import Cargando from './componentes/Cargando.jsx';
import Informe from './componentes/Informe.jsx';
import Catalogo from './vistas/Catalogo.jsx';
import Fuentes from './vistas/Fuentes.jsx';
import { api } from './api.js';

const CLAVE_SESION = 'ragnar.sesion';

// sessionStorage puede no estar disponible (modo privado, bloqueos): siempre con try/catch.
const leerSesion = () => { try { return sessionStorage.getItem(CLAVE_SESION); } catch { return null; } };
const guardarSesion = (id) => { try { id ? sessionStorage.setItem(CLAVE_SESION, id) : sessionStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento */ } };

function describirContexto(i) {
  if (!i) return null;
  const partes = [...i.productos, ...i.marcas, ...i.categorias, ...i.ids];
  if (i.todoElCatalogo) partes.push('todo el catálogo');
  if (i.regiones.length) partes.push(i.regiones.join(', '));
  return partes.slice(0, 4).join(' · ') || null;
}

export default function App() {
  const [vista, setVista] = useState('investigar');
  const [sesionId, setSesionId] = useState(leerSesion);
  const [historial, setHistorial] = useState([]);
  const [informes, setInformes] = useState({});
  const [actual, setActual] = useState(null);
  const [pendiente, setPendiente] = useState(null);
  const [error, setError] = useState('');
  const [aclaracion, setAclaracion] = useState(null);
  const [contexto, setContexto] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);

  useEffect(() => { api.sugerencias().then((r) => setSugerencias(r.sugerencias)).catch(() => {}); }, []);

  const consultar = useCallback(async (mensaje, { sinContexto = false } = {}) => {
    setVista('investigar');
    setPendiente(mensaje);
    setError('');
    setAclaracion(null);
    try {
      const r = await api.consultar(mensaje, sesionId, sinContexto);
      setSesionId(r.sesionId);
      guardarSesion(r.sesionId);
      if (r.tipo === 'aclaracion') {
        setAclaracion(r);
      } else {
        const inf = r.informe;
        setInformes((m) => ({ ...m, [inf.id]: inf }));
        setHistorial((h) => [...h, { informeId: inf.id, mensaje, fecha: inf.fecha, total: inf.resumen.totalProductos }]);
        setActual(inf.id);
        setContexto(describirContexto(inf.interpretacion));
      }
    } catch (e) {
      if (e.estado === 404 && sesionId) {
        // La sesión venció en el servidor: se empieza una nueva.
        guardarSesion(null);
        setSesionId(null);
        setContexto(null);
      }
      setError(e.message);
    } finally {
      setPendiente(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [sesionId]);

  const nuevaSesion = () => {
    guardarSesion(null);
    setSesionId(null);
    setHistorial([]);
    setInformes({});
    setActual(null);
    setContexto(null);
    setAclaracion(null);
    setError('');
    setVista('investigar');
  };

  const informe = actual ? informes[actual] : null;

  return (
    <div className="marco">
      <Rail
        vista={vista}
        cambiarVista={setVista}
        historial={historial}
        informeActual={actual}
        abrirInforme={(id) => { setActual(id); setVista('investigar'); setContexto(describirContexto(informes[id]?.interpretacion)); }}
        nuevaSesion={nuevaSesion}
      />
      <main className="principal">
        {vista === 'catalogo' && <Catalogo investigar={(m) => consultar(m, { sinContexto: true })} />}
        {vista === 'fuentes' && <Fuentes />}
        {vista === 'investigar' && (
          <div className="contenedor">
            {!informe && !pendiente ? (
              <Inicio>
                <Compositor alEnviar={consultar} ocupado={Boolean(pendiente)} contexto={null} sugerencias={sugerencias} autoFoco />
                {error && <p className="aviso error" role="alert"><TriangleAlert aria-hidden="true" />{error}</p>}
                {aclaracion && <p className="aviso aclaracion" role="status"><MessageCircleQuestion aria-hidden="true" />{aclaracion.mensaje}</p>}
              </Inicio>
            ) : (
              <>
                <Compositor
                  alEnviar={(m) => consultar(m, { sinContexto: !contexto })}
                  ocupado={Boolean(pendiente)}
                  contexto={contexto}
                  sugerencias={sugerencias}
                  olvidarContexto={() => setContexto(null)}
                />
                {error && <p className="aviso error" role="alert" style={{ marginTop: 16 }}><TriangleAlert aria-hidden="true" />{error}</p>}
                {aclaracion && <p className="aviso aclaracion" role="status" style={{ marginTop: 16 }}><MessageCircleQuestion aria-hidden="true" />{aclaracion.mensaje}</p>}
                {pendiente ? <Cargando mensaje={pendiente} /> : informe && <Informe key={informe.id} informe={informe} sesionId={sesionId} />}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

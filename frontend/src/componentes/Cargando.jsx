import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Circle } from 'lucide-react';

const PASOS = ['Interpretando la solicitud', 'Consultando el catálogo', 'Buscando en los competidores', 'Verificando coincidencias', 'Comparando precios', 'Armando el informe'];

/** Indicador de progreso mientras responde el backend (los pasos reales llegan con el informe). */
export default function Cargando({ mensaje }) {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 380);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="cargando" role="status" aria-live="polite">
      <h1 className="solicitud"><q>{mensaje}</q></h1>
      <ol className="cargando-pasos">
        {PASOS.map((p, i) => {
          const estado = i < paso ? 'hecho' : i === paso ? 'activo' : 'pendiente';
          const Icono = estado === 'hecho' ? Check : estado === 'activo' ? LoaderCircle : Circle;
          return <li key={p} data-estado={estado}><Icono className={estado === 'activo' ? 'girando' : ''} aria-hidden="true" />{p}</li>;
        })}
      </ol>
    </div>
  );
}

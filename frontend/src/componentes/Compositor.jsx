import { useEffect, useRef, useState } from 'react';
import { ArrowUp, CornerDownRight } from 'lucide-react';

const LARGO_MAXIMO = 500;

export default function Compositor({ alEnviar, ocupado, contexto, sugerencias, olvidarContexto, autoFoco }) {
  const [texto, setTexto] = useState('');
  const ref = useRef(null);

  useEffect(() => { if (autoFoco) ref.current?.focus(); }, [autoFoco]);

  // Ajusta la altura del cuadro al contenido.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [texto]);

  const valido = texto.trim().length >= 3 && !ocupado;
  const enviar = (valor = texto) => {
    const limpio = valor.trim();
    if (limpio.length < 3 || ocupado) return;
    alEnviar(limpio);
    setTexto('');
  };

  return (
    <form className="compositor" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
      <label htmlFor="solicitud" className="solo-lectores">Solicitud de investigación</label>
      <div className="compositor-caja">
        <textarea
          id="solicitud"
          ref={ref}
          rows={1}
          value={texto}
          maxLength={LARGO_MAXIMO}
          placeholder={contexto ? 'Seguí el análisis: “ahora solo en Córdoba”, “agregá el café”…' : 'Ej.: compará la yerba mate Playadito en todos los competidores'}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
        />
        <button className="boton-primario" type="submit" disabled={!valido} aria-label="Investigar">
          <span className="texto-boton">{ocupado ? 'Investigando…' : 'Investigar'}</span> <ArrowUp aria-hidden="true" />
        </button>
      </div>
      <div className="compositor-pie">
        {contexto ? (
          <span className="contexto-activo">
            <CornerDownRight aria-hidden="true" /> Continúa sobre: <strong>{contexto}</strong>
            <button type="button" onClick={olvidarContexto}>empezar de cero</button>
          </span>
        ) : (
          sugerencias.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => enviar(s)} disabled={ocupado}>{s}</button>
          ))
        )}
      </div>
    </form>
  );
}

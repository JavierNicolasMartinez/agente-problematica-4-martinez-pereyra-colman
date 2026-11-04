import { MessageSquareText, Boxes, Globe, ScanSearch, Scale, FileSpreadsheet } from 'lucide-react';
import ReglaGondola from './ReglaGondola.jsx';

// Ejemplo ilustrativo para enseñar a leer la regla (no son datos reales).
const EJEMPLO = [
  { competidorId: 'a', competidor: 'Mercado Austral', comparacion: { comparable: true, diferenciaRegular: { porcentual: 12 }, promocion: null } },
  { competidorId: 'b', competidor: 'Hiper Delta', comparacion: { comparable: true, diferenciaRegular: { porcentual: 4 }, promocion: { descripcion: '2x1' } } },
  { competidorId: 'c', competidor: 'SuperCiudad', comparacion: { comparable: true, diferenciaRegular: { porcentual: -9 }, promocion: null } },
];

const PASOS = [
  [MessageSquareText, 'Entiende el pedido', 'productos, marcas, categorías, competidores, región y filtros.'],
  [Boxes, 'Consulta el catálogo', 'los 500 artículos de Ragnar, sin modificarlos.'],
  [Globe, 'Busca en cada competidor', 'solo en fuentes que permiten la consulta automatizada.'],
  [ScanSearch, 'Verifica que sea el mismo artículo', 'marca, presentación, unidad y variante; si duda, lo dice.'],
  [Scale, 'Compara', 'precio regular y promocional por separado, por envase o por kg / litro.'],
  [FileSpreadsheet, 'Arma el informe', 'con fuente y hora de cada precio, exportable a CSV o Markdown.'],
];

export default function Inicio({ children }) {
  return (
    <div className="inicio">
      <div className="inicio-cabeza">
        <h1>¿Dónde está Ragnar frente a la góndola de al lado?</h1>
        <p className="bajada">Pedí una investigación en lenguaje natural. El agente busca los mismos artículos en los competidores, descarta lo que no coincide y te devuelve la comparación con sus fuentes.</p>
        {children}
      </div>
      <div className="inicio-lectura">
        <figure className="muestra-regla">
          <ReglaGondola competidores={EJEMPLO} analisis={{ clasificacion: 'mas_caro' }} conEscala />
          <figcaption>
            Cómo leer la regla: el fleje amarillo es Ragnar. Cada competidor se ubica según su precio para el mismo artículo:
            a la izquierda vende más barato, a la derecha más caro. El anillo amarillo indica que tiene una promoción. Ejemplo ilustrativo.
          </figcaption>
        </figure>
        <div>
          <h2>Qué hace en cada consulta</h2>
          <ul className="pasos-agente">
            {PASOS.map(([Icono, titulo, texto]) => (
              <li key={titulo}><Icono aria-hidden="true" /><span><strong>{titulo}:</strong> {texto}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

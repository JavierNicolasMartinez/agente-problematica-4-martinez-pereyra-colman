/**
 * Ilustración original del salón del Valhalla, en perspectiva hacia un punto de fuga central.
 * Sigue la descripción de los mitos nórdicos: techo de escudos dorados y vigas hechas de lanzas.
 */
const ANCHO = 1600;
const CENTRO = ANCHO / 2;
const ALTURA_PISO = 900;
const ESCALA_FONDO = 0.3;

const mezclar = (a, b, t) => a + (b - a) * t;
const escalaDe = (profundidad) => mezclar(1, ESCALA_FONDO, profundidad);
const techoY = (profundidad) => 250 * profundidad;
const pisoY = (profundidad) => mezclar(ALTURA_PISO, 640, profundidad);

const FILAS_TECHO = [0, 0.16, 0.31, 0.45, 0.58, 0.7, 0.81, 0.91];
const ESCUDOS_POR_FILA = 11;
const escudos = FILAS_TECHO.flatMap((profundidad, fila) => {
  const escala = escalaDe(profundidad);
  return Array.from({ length: ESCUDOS_POR_FILA }, (_, columna) => {
    const desfase = fila % 2 ? 0.5 : 0;
    const u = ((columna + desfase) / (ESCUDOS_POR_FILA - 1)) * 2 - 1;
    return { id: `${fila}-${columna}`, x: CENTRO + u * CENTRO * escala, y: techoY(profundidad) + 22 * escala, r: 62 * escala, oscuro: (fila + columna) % 2 === 0 };
  });
});

const LANZAS = [-0.8, -0.48, -0.16, 0.16, 0.48, 0.8].map((u) => ({
  id: u,
  x1: CENTRO + u * CENTRO, x2: CENTRO + u * CENTRO * ESCALA_FONDO, y2: techoY(1),
}));

const PILARES = [0.08, 0.4, 0.68].flatMap((profundidad) => {
  const escala = escalaDe(profundidad);
  const ancho = 66 * escala;
  const arriba = techoY(profundidad);
  const abajo = pisoY(profundidad);
  return [-1, 1].map((lado) => ({
    id: `${profundidad}${lado}`,
    x: CENTRO + lado * 690 * escala - ancho / 2, arriba, abajo, ancho, escala,
  }));
});

const ESTANDARTES = [0.24, 0.54].flatMap((profundidad) => {
  const escala = escalaDe(profundidad);
  return [-1, 1].map((lado) => ({ id: `${profundidad}${lado}`, x: CENTRO + lado * 690 * escala, y: techoY(profundidad) + 60 * escala, escala }));
});

function puntoMesa(u, profundidad, alto = 0) {
  const escala = escalaDe(profundidad);
  return [CENTRO + u * CENTRO * escala, pisoY(profundidad) - alto * escala];
}

function mesa(u1, u2) {
  const cerca = 0.02;
  const lejos = 0.86;
  const p = [puntoMesa(u1, cerca, 92), puntoMesa(u2, cerca, 92), puntoMesa(u2, lejos, 92), puntoMesa(u1, lejos, 92)];
  const q = [puntoMesa(u1, cerca, 66), puntoMesa(u2, cerca, 66)];
  const copas = [0.14, 0.3, 0.45, 0.58, 0.7, 0.8].map((d) => {
    const [x, y] = puntoMesa((u1 + u2) / 2, d, 92);
    return { id: d, x, y, escala: escalaDe(d) };
  });
  return { tapa: p.flat().join(' '), frente: [...q[0], ...q[1], ...p[1], ...p[0]].join(' '), copas };
}

const MESAS = [mesa(-0.86, -0.56), mesa(0.56, 0.86)];
const BRASAS = [[250, 610], [330, 660], [430, 600], [520, 680], [640, 640], [760, 700], [860, 640], [980, 690], [1090, 620], [1180, 660], [1280, 600], [1360, 650]];

function Brasero({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="150" fill="url(#vh-resplandor)" className="llama-brillo" />
      <path fill="#1c120c" d="M-4 26h8l10 118H-14Z" />
      <path fill="#2b1b10" stroke="#c79a3e" strokeWidth="3" d="M-46-6h92L30 30h-60Z" />
      <path className="llama llama-1" fill="#e8622a" d="M-34-6C-46-46-16-56-14-90-2-66 8-74 8-104c28 34 40 66 26 98Z" />
      <path className="llama llama-2" fill="#f7b23c" d="M-20-6c-8-26 12-34 14-54 10 16 16 12 18-8 14 24 20 42 8 62Z" />
    </g>
  );
}

export default function EscenaValhalla() {
  return (
    <svg className="escena-valhalla" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="vh-fuego" cx="50%" cy="66%" r="46%">
          <stop offset="0" stopColor="#ffb84d" stopOpacity="0.95" />
          <stop offset="0.38" stopColor="#d9571f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3a1408" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vh-resplandor">
          <stop offset="0" stopColor="#ffb84d" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffb84d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vh-techo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0605" stopOpacity="0.72" />
          <stop offset="1" stopColor="#0a0605" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="vh-pared-i" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#120a07" />
          <stop offset="1" stopColor="#3a2113" />
        </linearGradient>
        <linearGradient id="vh-pared-d" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#120a07" />
          <stop offset="1" stopColor="#3a2113" />
        </linearGradient>
        <linearGradient id="vh-piso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3218" />
          <stop offset="1" stopColor="#140c08" />
        </linearGradient>
        <linearGradient id="vh-puerta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d2238" />
          <stop offset="0.6" stopColor="#1b6a68" />
          <stop offset="1" stopColor="#ffb84d" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="#120a07" />

      {/* Paredes y piso */}
      <path fill="url(#vh-pared-i)" d="M0 0 560 250V640L0 900Z" />
      <path fill="url(#vh-pared-d)" d="M1600 0 1040 250V640L1600 900Z" />
      <path fill="#2c1a10" d="M560 250h480v390H560Z" />
      <path fill="url(#vh-piso)" d="M0 900 560 640h480l560 260Z" />
      <g stroke="#120a07" strokeWidth="2" opacity="0.6">
        {[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((u) => <path key={u} d={`M${CENTRO + u * CENTRO} 900L${CENTRO + u * 240} 640`} />)}
      </g>

      {/* Puerta del fondo */}
      <path fill="#1a0f09" stroke="#c79a3e" strokeWidth="4" d="M660 640V400c0-90 280-90 280 0v240Z" />
      <path fill="url(#vh-puerta)" d="M680 640V404c0-68 240-68 240 0v236Z" />
      <rect width="1600" height="900" fill="url(#vh-fuego)" />

      {/* Techo de escudos */}
      <path fill="#2a1a0e" d="M0 0h1600l-560 250H560Z" />
      <g stroke="#6b4c1a" strokeWidth="2">
        {escudos.map((e) => <circle key={e.id} cx={e.x} cy={e.y} r={e.r} fill={e.oscuro ? '#8f6a24' : '#c79a3e'} />)}
      </g>
      <g fill="#5c4214">{escudos.map((e) => <circle key={e.id} cx={e.x} cy={e.y} r={e.r * 0.26} />)}</g>
      <path fill="url(#vh-techo)" d="M0 0h1600l-560 250H560Z" />

      {/* Vigas de lanzas */}
      <g stroke="#2a1a0e" strokeLinecap="round">
        {LANZAS.map((l) => <path key={l.id} strokeWidth="9" d={`M${l.x1} 0L${l.x2} ${l.y2}`} />)}
      </g>
      <g fill="#d9dee0">
        {LANZAS.map((l) => <path key={l.id} d={`M${l.x2 - 7} ${l.y2}h14l-7 34Z`} />)}
      </g>

      {/* Mesas del banquete */}
      {MESAS.map((m) => (
        <g key={m.tapa}>
          <polygon fill="#1a0f09" points={m.frente} />
          <polygon fill="#6d4423" stroke="#2a1a0e" strokeWidth="2" points={m.tapa} />
          {m.copas.map((c) => (
            <g key={c.id} transform={`translate(${c.x} ${c.y}) scale(${c.escala})`}>
              <ellipse rx="44" ry="13" fill="#c79a3e" />
              <path fill="#3a2113" stroke="#c79a3e" strokeWidth="3" d="M-12-48h24l-4 46h-16Z" />
            </g>
          ))}
        </g>
      ))}

      {/* Pilares tallados y estandartes */}
      {PILARES.map((p) => (
        <g key={p.id}>
          <rect x={p.x} y={p.arriba} width={p.ancho} height={p.abajo - p.arriba} fill="#20130b" />
          <rect x={p.x} y={p.arriba + (p.abajo - p.arriba) * 0.28} width={p.ancho} height={18 * p.escala} fill="#c79a3e" />
          <rect x={p.x} y={p.arriba + (p.abajo - p.arriba) * 0.72} width={p.ancho} height={18 * p.escala} fill="#c79a3e" />
        </g>
      ))}
      {ESTANDARTES.map((e) => (
        <g key={e.id} transform={`translate(${e.x} ${e.y}) scale(${e.escala})`}>
          <path fill="#8f2a24" stroke="#c79a3e" strokeWidth="4" d="M-58 0H58V250L0 300-58 250Z" />
          <path fill="none" stroke="#e2bd63" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" d="M-18 60v150m0-150 38 26-38 26 38 54" />
        </g>
      ))}

      <Brasero x={250} y={520} />
      <Brasero x={1350} y={520} />

      <g fill="#ffb84d">
        {BRASAS.map(([x, y]) => <circle key={x} className="brasa" cx={x} cy={y} r="2.6" />)}
      </g>
    </svg>
  );
}

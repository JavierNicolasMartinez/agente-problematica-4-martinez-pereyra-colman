/** Ilustración original del encabezado: un drakkar navega el fiordo bajo la aurora, con dos cuervos. */
const ESTRELLAS = [[90, 40], [210, 92], [330, 28], [468, 70], [590, 34], [706, 86], [812, 26], [930, 62], [1040, 30], [1150, 84], [1262, 44], [1370, 74]];
const ESCUDOS = [870, 902, 934, 966, 998, 1030, 1062, 1094];
const REMOS = [886, 950, 1014, 1078];

function Cuervo({ x, y, escala = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${escala})`}
      d="M0 2C10-12 22-14 31-5c2 2 4 3 6 2l3-7 5 8c1 1 1 2 3 1 8-6 20-9 34-5-12 2-23 8-30 16l-6 7-4-1-9 9 2-11C27 8 13 2 0 2Z"
    />
  );
}

export default function EscenaFiordo() {
  return (
    <svg className="escena" viewBox="0 0 1400 340" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1524" />
          <stop offset="0.65" stopColor="#14304a" />
          <stop offset="1" stopColor="#2c5a66" />
        </linearGradient>
        <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3fd6a4" stopOpacity="0" />
          <stop offset="0.45" stopColor="#3fd6a4" stopOpacity="0.75" />
          <stop offset="0.8" stopColor="#6d8df0" stopOpacity="0.6" />
          <stop offset="1" stopColor="#a56df0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f4656" />
          <stop offset="1" stopColor="#081320" />
        </linearGradient>
        <filter id="difuso" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="14" /></filter>
      </defs>

      <rect width="1400" height="340" fill="url(#cielo)" />
      <g fill="#e8dfc8">
        {ESTRELLAS.map(([x, y]) => <circle key={x} cx={x} cy={y} r={x % 3 === 0 ? 1.6 : 1} opacity="0.75" />)}
      </g>

      <g filter="url(#difuso)" fill="none" stroke="url(#aurora)" strokeLinecap="round">
        <path className="aurora a1" strokeWidth="34" d="M320 120C520 40 640 170 840 92s300-20 520 26" />
        <path className="aurora a2" strokeWidth="22" d="M420 66C620 130 760 20 960 66s260 70 400 10" />
      </g>

      <path fill="#1a3448" d="M0 262 120 190l70 34 96-72 92 62 80-46 118 88 94-56 104 62 112-92 92 60 110-74 112 86 100-48v92H0Z" />
      <path fill="#dfe6e6" opacity="0.5" d="m286 152 28 19-14 2-13 11-9-9-14 3ZM786 168l40 26-20 1-16 13-14-11-22 2ZM988 154l32 22-16 2-14 10-12-9-18 2Z" />
      <path fill="#10233a" d="M0 290 90 244l84 34 110-50 116 58 96-34 120 42 130-54 120 46 124-58 120 50 90-34 100 36v60H0Z" />

      <rect y="282" width="1400" height="58" fill="url(#mar)" />
      <g stroke="#7fb4bd" strokeWidth="1.4" strokeLinecap="round" opacity="0.35">
        <path d="M640 300h90M770 316h60M1160 306h110M1220 324h70M560 322h60M1000 332h120" />
      </g>

      <g fill="#0a0f18">
        <Cuervo x={1236} y={96} escala={0.8} />
        <Cuervo x={1160} y={60} escala={0.55} />
      </g>

      {/* Drakkar: mira hacia la izquierda, al encuentro de los rivales */}
      <g>
        <path stroke="#2a1c12" strokeWidth="7" d="M976 288V96" />
        <path stroke="#2a1c12" strokeWidth="5" strokeLinecap="round" d="M880 112h192" />
        <path fill="#8f2a24" d="M884 114h184c10 44 12 92 4 140H888c-10-48-10-96-4-140Z" />
        <path fill="#e3d6b8" d="M918 114h34c-5 46-5 94 0 140h-36c-4-48-4-96 2-140ZM1000 114h34c5 46 5 94 2 140h-34c4-46 4-94-2-140Z" />
        <path fill="#8f2a24" d="M976 96 1012 76 976 62Z" stroke="#2a1c12" strokeWidth="2" />
        <g stroke="#2a1c12" strokeWidth="4" strokeLinecap="round">
          {REMOS.map((x) => <path key={x} d={`M${x} 292l-30 34`} />)}
        </g>
        <path fill="#2a1c12" d="M812 214c-10-26 8-52 34-44 16 5 18 26 4 30-9 3-15-6-9-12-14-2-20 12-14 24l24 64c14 12 34 14 56 14h190c28 0 50-14 66-52 8-18 22-30 40-28-10 8-14 18-18 32-14 52-44 80-92 80H890c-34 0-54-16-70-48Z" />
        <g stroke="#c79a3e" strokeWidth="2">
          {ESCUDOS.map((x, i) => (
            <circle key={x} cx={x} cy={276} r={13} fill={i % 2 ? '#e3d6b8' : '#8f2a24'} />
          ))}
        </g>
        <g fill="#c79a3e">{ESCUDOS.map((x) => <circle key={x} cx={x} cy={276} r={3.5} />)}</g>
      </g>
    </svg>
  );
}

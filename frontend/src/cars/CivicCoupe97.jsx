// Desenho lateral de um coupé compacto dos anos 90 (inspirado no Civic coupé 1996–2000),
// em estilo "raio X": a carroceria é a base e os componentes clicáveis ficam por cima.
// Para outro modelo, crie um arquivo com a mesma interface ({ regions, selected, onSelect }).

const BODY_COLOR = "#1e3a8a";

export const DRAWN_REGIONS = ["motor", "arrefecimento", "transmissao", "freios", "pneus"];

function Region({ id, regions, selected, onSelect, children }) {
  const r = regions[id];
  const pct = r?.minLife != null ? `${Math.round(r.minLife)}%` : "sem registro";
  return (
    <g
      className={`region ${selected === id ? "selected" : ""}`}
      fill={r?.color ?? "#64748b"}
      onClick={() => onSelect(selected === id ? null : id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(selected === id ? null : id)}
    >
      <title>{`${r?.label ?? id}: ${pct}`}</title>
      {children}
    </g>
  );
}

function Wheel({ cx, cy, ...props }) {
  return (
    <>
      {/* caixa de roda (só a metade de cima aparece dentro da carroceria) */}
      <path d={`M ${cx - 52} ${cy - 6} A 52 52 0 0 1 ${cx + 52} ${cy - 6} Z`} fill="#0b1120" pointerEvents="none" />
      <Region id="pneus" {...props}>
        <circle cx={cx} cy={cy} r={42} />
      </Region>
      {/* borracha escura; a faixa externa colorida é a banda de rodagem */}
      <circle cx={cx} cy={cy} r={36} fill="#111827" pointerEvents="none" />
      <circle cx={cx} cy={cy} r={30} fill="#374151" pointerEvents="none" />
      <Region id="freios" {...props}>
        <circle cx={cx} cy={cy} r={24} />
        {/* pinça */}
        <path d={`M ${cx - 9} ${cy - 27} a 28 28 0 0 1 22 4 l -4 8 a 19 19 0 0 0 -15 -3 Z`} />
      </Region>
      <g pointerEvents="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round">
        {[0, 72, 144, 216, 288].map((a) => {
          const rad = (a * Math.PI) / 180;
          return (
            <line
              key={a}
              x1={cx + 8 * Math.cos(rad)}
              y1={cy + 8 * Math.sin(rad)}
              x2={cx + 29 * Math.cos(rad)}
              y2={cy + 29 * Math.sin(rad)}
            />
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r={6} fill="#cbd5e1" pointerEvents="none" />
    </>
  );
}

export default function CivicCoupe97(props) {
  return (
    <svg viewBox="0 0 800 280" className="car-svg" aria-label="Diagrama do carro">
      {/* sombra no chão */}
      <ellipse cx="400" cy="262" rx="370" ry="10" fill="#000" opacity="0.12" />

      {/* carroceria */}
      <path
        fill={BODY_COLOR}
        stroke="#0f1f4d"
        strokeWidth="2"
        d="M 48 205 C 40 200 38 180 40 168 C 42 155 55 149 75 147 L 285 128
           C 320 108 360 88 392 76 C 405 71 420 69 440 69 L 515 70
           C 540 71 555 78 570 88 C 600 104 625 115 650 120 L 730 124
           C 748 126 754 135 755 150 L 757 196 C 757 208 750 212 740 212 L 652 212
           A 52 52 0 0 0 548 212 L 227 212 A 52 52 0 0 0 123 212 L 62 212
           C 54 212 50 210 48 205 Z"
      />
      <g pointerEvents="none">
        {/* vidros */}
        <path
          fill="#bfdbfe"
          opacity="0.85"
          d="M 300 128 C 330 112 365 93 393 82 C 405 77 420 76 438 76 L 478 76 L 478 128 Z"
        />
        <path fill="#bfdbfe" opacity="0.85" d="M 488 76 L 512 77 C 532 78 548 84 560 92 L 598 116 L 488 124 Z" />
        {/* porta, maçaneta, retrovisor, friso */}
        <path d="M 290 131 L 296 208 M 520 125 L 522 208" stroke="#0f1f4d" strokeWidth="2" fill="none" />
        <rect x="468" y="140" width="22" height="5" rx="2" fill="#93c5fd" />
        <path d="M 300 128 l -14 -7 l -8 1 l 0 8 l 18 2 Z" fill="#172554" />
        <path d="M 232 200 L 544 200" stroke="#0f1f4d" strokeWidth="2" />
        {/* farol e lanterna */}
        <path d="M 44 160 C 46 152 58 149 80 148 L 112 146 L 108 157 L 50 162 Z" fill="#fef9c3" />
        <path d="M 736 128 L 754 140 L 756 162 L 736 162 Z" fill="#dc2626" />
      </g>

      {/* componentes clicáveis */}
      <Region id="arrefecimento" {...props}>
        <rect x="52" y="164" width="22" height="40" rx="3" />
        <g stroke="#fff" strokeWidth="1" opacity="0.6" pointerEvents="none">
          {[170, 176, 182, 188, 194, 200].map((y) => (
            <line key={y} x1="54" x2="72" y1={y} y2={y} />
          ))}
        </g>
      </Region>

      <Wheel cx={175} cy={218} {...props} />
      <Wheel cx={600} cy={218} {...props} />

      <Region id="motor" {...props}>
        {/* bloco, cabeçote e tampa de válvulas */}
        <path d="M 104 166 L 222 166 L 222 190 L 204 198 L 124 198 L 104 190 Z" />
        <rect x="112" y="152" width="102" height="15" rx="5" />
        <rect x="100" y="158" width="10" height="20" rx="2" />
        <g fill="#fff" opacity="0.55" pointerEvents="none">
          {[128, 151, 174, 197].map((x) => (
            <circle key={x} cx={x} cy={159} r={3} />
          ))}
        </g>
      </Region>

      <Region id="transmissao" {...props}>
        <path d="M 226 168 L 282 172 L 284 198 L 240 204 L 226 194 Z" />
        <circle cx="254" cy="186" r="7" fill="none" stroke="#fff" strokeWidth="2" opacity="0.6" pointerEvents="none" />
      </Region>
    </svg>
  );
}

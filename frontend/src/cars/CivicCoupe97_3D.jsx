// Modelo 3D estilizado do Civic coupé 1996–2000, montado com geometria procedural
// (sem arquivo de modelo). Unidades em metros.
// Eixo x: frente (0) → traseira (4,45). y: para cima. z: largura (+z = lado direito na cena).
//
// O perfil lateral foi traçado de uma foto de lado do carro (escala 186,5 px/m):
// para-choque, capô até a base do para-brisa, teto alto e arredondado, vigia traseira
// com caimento até o porta-malas curto. A vista de cima é aproximada afinando a largura
// nas pontas e no alto (tumblehome).
//
// Regiões clicáveis: capô/motor, grade (arrefecimento), câmbio, freios (discos e pinças)
// e pneus. No modo raio X a carroceria fica translúcida e mostra as peças internas.

import { createContext, useContext, useMemo, useState } from "react";
import * as THREE from "three";

export const LENGTH = 4.45;
const AXLE_F = 0.82; // medidos na foto lateral
const AXLE_R = 3.53;
const WHEEL_R = 0.29;
const ARCH_R = 0.34; // raio visível da caixa de roda

// Carroceria: largura total 1,70 m = profundidade da extrusão + 2 × chanfro.
const BODY_BEVEL = 0.05;
const BODY_BT = 0.08;
const BODY_D = 1.7 - 2 * BODY_BT;
const BODY_HALF = BODY_D / 2 + BODY_BT; // z da face lateral
// Cabine (teto e colunas): mais estreita que a carroceria.
const CABIN_BEVEL = 0.04;
const CABIN_BT = 0.06;
const CABIN_D = 1.22;
const CABIN_HALF = CABIN_D / 2 + CABIN_BT;

export const PAINT = "#1f6fe0";

export const DRAWN_REGIONS = ["motor", "arrefecimento", "transmissao", "freios", "pneus"];

// Pontos (coordenadas do carro) onde ficam os marcadores de cada região.
export const PIN_ANCHORS = {
  motor: [0.65, 1.2, 0],
  arrefecimento: [-0.4, 0.5, 0],
  transmissao: [1.3, 0.5, 1.15],
  freios: [AXLE_F, -0.06, 1.15],
  pneus: [AXLE_R, -0.06, 1.15],
};

export const Ctx = createContext(null);

// ---------- formas ----------

/**
 * Fator de largura em (x, y). É linear em y de propósito: assim cada face lateral continua
 * plana (só inclina para dentro no alto, como a lateral do carro real). Fatores não lineares
 * entortam os triângulos grandes da lateral e criam faixas de luz na pintura.
 */
function widthFactor(_x, y, kind) {
  if (kind === "cabin") return 1 - 0.18 * ((y - 0.86) / 0.44); // teto mais estreito que a base
  return 1 - 0.045 * ((y - 0.5) / 0.4);
}

function taper(geometry, kind) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * widthFactor(p.getX(i), p.getY(i), kind));
  geometry.computeVertexNormals();
  return geometry;
}

/** z da superfície lateral da carroceria em (x, y). */
const sideZ = (x, y) => BODY_HALF * widthFactor(x, y, "body");

// Contornos já descontados do chanfro (o chanfro expande o contorno para fora).
function bodyShape() {
  const s = new THREE.Shape();
  const r = ARCH_R + BODY_BEVEL;
  const a = Math.asin(0.1 / r);
  const dx = r * Math.cos(a);
  s.moveTo(AXLE_F - dx, 0.2);
  s.lineTo(0.12, 0.2);
  s.quadraticCurveTo(0.05, 0.2, 0.05, 0.3); // para-choque dianteiro
  s.lineTo(0.05, 0.42);
  s.quadraticCurveTo(0.06, 0.55, 0.16, 0.57); // bico
  s.lineTo(0.22, 0.59);
  s.lineTo(1.23, 0.79); // capô até a base do para-brisa
  s.lineTo(3.54, 0.85); // linha de cintura
  s.lineTo(3.91, 0.93); // base da vigia traseira
  s.lineTo(4.25, 0.89); // tampa do porta-malas
  s.quadraticCurveTo(4.4, 0.87, 4.4, 0.72);
  s.lineTo(4.41, 0.3); // para-choque traseiro
  s.quadraticCurveTo(4.41, 0.2, 4.3, 0.2);
  s.lineTo(AXLE_R + dx, 0.2);
  s.absarc(AXLE_R, WHEEL_R + 0.01, r, -a, Math.PI + a, false);
  s.lineTo(AXLE_F + dx, 0.2);
  s.absarc(AXLE_F, WHEEL_R + 0.01, r, -a, Math.PI + a, false);
  return s;
}

function cabinShape() {
  const s = new THREE.Shape();
  s.moveTo(1.3, 0.8);
  s.lineTo(2.06, 1.19); // para-brisa
  s.quadraticCurveTo(2.2, 1.26, 2.45, 1.26); // teto alto e arredondado
  s.lineTo(2.95, 1.25);
  s.quadraticCurveTo(3.12, 1.25, 3.25, 1.19);
  s.lineTo(3.85, 0.92); // vigia traseira com caimento
  s.lineTo(3.85, 0.86);
  s.lineTo(1.3, 0.76);
  return s;
}

function extrude(shape, depth, bevel, thickness) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: thickness,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 40,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Vidro inclinado (para-brisa / vigia) seguindo a cabine, levemente para fora dela. */
function glassQuad(P, Q, endInset, widthScale) {
  const d = new THREE.Vector2(Q[0] - P[0], Q[1] - P[1]).normalize();
  const n = new THREE.Vector2(-d.y, d.x); // normal para fora
  const off = CABIN_BEVEL + 0.006;
  const a = [P[0] + d.x * endInset + n.x * off, P[1] + d.y * endInset + n.y * off];
  const b = [Q[0] - d.x * endInset + n.x * off, Q[1] - d.y * endInset + n.y * off];
  const w = (p) => CABIN_HALF * widthScale * widthFactor(p[0], p[1], "cabin");
  const v = [a[0], a[1], -w(a), a[0], a[1], w(a), b[0], b[1], w(b), b[0], b[1], -w(b)];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** Vidro lateral plano na face da cabine (um de cada lado). */
function sideGlass(points, side) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(shape);
  g.translate(0, 0, side * (CABIN_HALF + 0.004));
  return taper(g, "cabin");
}

/** Caixa posicionada no espaço do carro e afinada junto com a carroceria. */
function carBox(size, pos, rotZ = 0) {
  const g = new THREE.BoxGeometry(...size, 4, 1, 8);
  g.rotateZ(rotZ);
  g.translate(...pos);
  return taper(g, "body");
}

const DOOR_GLASS = [
  [1.45, 0.89],
  [1.98, 1.13],
  [2.12, 1.19],
  [2.7, 1.2],
  [2.7, 0.9],
];
const QUARTER_GLASS = [
  [2.8, 1.2],
  [3.08, 1.19],
  [3.5, 0.99],
  [3.45, 0.95],
  [2.8, 0.93],
];

// ---------- regiões ----------

export function Region({ id, children }) {
  const { onSelect, selected, setHover } = useContext(Ctx);
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selected === id ? null : id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(null);
        document.body.style.cursor = "";
      }}
    >
      {children}
    </group>
  );
}

/** Material com a cor do estado da região; brilha quando selecionada ou sob o mouse. */
export function RegionMaterial({ id, paint = false }) {
  const { regions, selected, hover } = useContext(Ctx);
  const color = regions[id]?.color ?? "#64748b";
  const glow = selected === id ? 0.9 : hover === id ? 0.45 : 0.12;
  return paint ? (
    <meshPhysicalMaterial
      color={color}
      emissive={color}
      emissiveIntensity={glow}
      metalness={0.5}
      roughness={0.25}
      clearcoat={1}
      clearcoatRoughness={0.05}
    />
  ) : (
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} metalness={0.4} roughness={0.35} />
  );
}

// ---------- rodas ----------

const SILVER = { color: "#d4d8de", metalness: 0.95, roughness: 0.22 };

function Wheel({ x, side }) {
  // Monta a roda com a face externa em +z e espelha para o lado esquerdo.
  const z = side * 0.75;
  // 6 pares de raios finos, no estilo da roda de referência.
  const spokes = [];
  for (let i = 0; i < 6; i++) for (const o of [-0.12, 0.12]) spokes.push((i * Math.PI) / 3 + o);
  const lugs = [0, 1, 2, 3, 4].map((i) => (i * 2 * Math.PI) / 5 + Math.PI / 2);

  return (
    <group position={[x, WHEEL_R, z]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
      <Region id="pneus">
        {/* banda de rodagem (cilindro aberto) + flancos: o centro fica livre para o aro */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.2, 56, 1, true]} />
          <meshStandardMaterial color="#0c0d10" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        {[0.1, -0.1].map((zz) => (
          <mesh key={zz} position={[0, 0, zz]} rotation={[0, zz > 0 ? 0 : Math.PI, 0]}>
            <ringGeometry args={[0.19, WHEEL_R, 56]} />
            <meshStandardMaterial color="#111318" roughness={0.8} />
          </mesh>
        ))}
        {/* faixa colorida no flanco = estado dos pneus */}
        <mesh position={[0, 0, 0.103]}>
          <ringGeometry args={[0.25, 0.272, 72]} />
          <RegionMaterial id="pneus" />
        </mesh>
      </Region>

      {/* aro: borda polida, tambor, raios duplos, cubo e porcas */}
      <mesh position={[0, 0, 0.101]}>
        <ringGeometry args={[0.172, 0.19, 64]} />
        <meshStandardMaterial {...SILVER} roughness={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.2, 48, 1, true]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.07]}>
        <circleGeometry args={[0.19, 40]} />
        <meshStandardMaterial color="#05060a" side={THREE.DoubleSide} />
      </mesh>
      {spokes.map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0.075]} rotation={[0, 0, a]}>
          <boxGeometry args={[0.125, 0.018, 0.03]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.058, 0.062, 0.035, 32]} />
        <meshStandardMaterial {...SILVER} />
      </mesh>
      {lugs.map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.036, Math.sin(a) * 0.036, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.015, 8]} />
          <meshStandardMaterial color="#6b7280" metalness={1} roughness={0.2} />
        </mesh>
      ))}

      <Region id="freios">
        <mesh position={[0, 0, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.155, 0.155, 0.022, 40]} />
          <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.35} />
        </mesh>
        {/* pinça */}
        <mesh position={[-0.1, 0.1, 0.045]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.12, 0.065, 0.06]} />
          <RegionMaterial id="freios" />
        </mesh>
      </Region>
    </group>
  );
}

// ---------- peças internas (raio X) ----------

export function Internals() {
  return (
    <>
      <Region id="motor">
        <mesh position={[0.65, 0.46, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.7]} />
          <RegionMaterial id="motor" />
        </mesh>
        <mesh position={[0.65, 0.65, 0]}>
          <boxGeometry args={[0.45, 0.07, 0.6]} />
          <RegionMaterial id="motor" />
        </mesh>
      </Region>
      <Region id="arrefecimento">
        <mesh position={[0.14, 0.42, 0]}>
          <boxGeometry args={[0.05, 0.28, 1.1]} />
          <RegionMaterial id="arrefecimento" />
        </mesh>
      </Region>
      <Region id="transmissao">
        <mesh position={[1.0, 0.36, 0.42]}>
          <boxGeometry args={[0.34, 0.24, 0.28]} />
          <RegionMaterial id="transmissao" />
        </mesh>
      </Region>
    </>
  );
}

// ---------- carro ----------

export default function CivicCoupe97_3D({ regions, selected, onSelect, xray = false }) {
  const [hover, setHover] = useState(null);
  const geo = useMemo(() => {
    const hoodAngle = Math.atan2(0.84 - 0.64, 1.23 - 0.19);
    const hoodX = 0.7;
    return {
      body: taper(extrude(bodyShape(), BODY_D, BODY_BEVEL, BODY_BT), "body"),
      cabin: taper(extrude(cabinShape(), CABIN_D, CABIN_BEVEL, CABIN_BT), "cabin"),
      windshield: glassQuad([1.3, 0.8], [2.06, 1.19], 0.05, 0.9),
      rearGlass: glassQuad([3.25, 1.19], [3.85, 0.92], 0.04, 0.88),
      sideGlass: [1, -1].flatMap((s) => [sideGlass(DOOR_GLASS, s), sideGlass(QUARTER_GLASS, s)]),
      hood: carBox([0.9, 0.012, 1.36], [hoodX, 0.64 + (hoodX - 0.19) * Math.tan(hoodAngle) + 0.007, 0], hoodAngle),
      grille: carBox([0.03, 0.065, 0.52], [0.04, 0.51, 0]),
      intake: carBox([0.03, 0.08, 0.95], [0.005, 0.3, 0]),
    };
  }, []);

  // No raio X a carroceria não intercepta cliques, para alcançar as peças internas.
  const shell = xray
    ? { raycast: () => null }
    : { onClick: (e) => e.stopPropagation(), onPointerOver: (e) => e.stopPropagation() };
  const see = { transparent: xray, opacity: xray ? 0.14 : 1, depthWrite: !xray };
  const dark = <meshStandardMaterial color="#0b0d12" metalness={0.5} roughness={0.45} />;

  return (
    <Ctx.Provider value={{ regions, selected, onSelect, hover, setHover }}>
      <group position={[-LENGTH / 2, 0, 0]}>
        <mesh geometry={geo.body} castShadow receiveShadow {...shell}>
          <meshPhysicalMaterial
            key={xray ? "x" : "s"}
            color={PAINT}
            metalness={0.6}
            roughness={0.22}
            clearcoat={1}
            clearcoatRoughness={0.04}
            {...see}
          />
        </mesh>
        <mesh geometry={geo.cabin} castShadow {...shell}>
          <meshPhysicalMaterial
            key={xray ? "x" : "s"}
            color={PAINT}
            metalness={0.6}
            roughness={0.22}
            clearcoat={1}
            clearcoatRoughness={0.04}
            {...see}
          />
        </mesh>

        {/* vidros */}
        {[geo.windshield, geo.rearGlass, ...geo.sideGlass].map((g, i) => (
          <mesh key={i} geometry={g} raycast={() => null}>
            <meshPhysicalMaterial
              key={xray ? "x" : "s"}
              color="#03060c"
              metalness={0.5}
              roughness={0.04}
              clearcoat={1}
              side={THREE.DoubleSide}
              transparent
              opacity={xray ? 0.1 : 0.92}
              depthWrite={!xray}
            />
          </mesh>
        ))}

        {/* capô = região do motor */}
        <Region id="motor">
          <mesh geometry={geo.hood} castShadow>
            {xray ? (
              <meshStandardMaterial transparent opacity={0.1} color="#94a3b8" depthWrite={false} />
            ) : (
              <RegionMaterial id="motor" paint />
            )}
          </mesh>
        </Region>

        {/* grade superior entre os faróis = arrefecimento; entrada de ar inferior escura */}
        <Region id="arrefecimento">
          <mesh geometry={geo.grille}>
            <RegionMaterial id="arrefecimento" />
          </mesh>
        </Region>
        <mesh geometry={geo.intake} raycast={() => null}>
          {dark}
        </mesh>

        {[-1, 1].map((s) => (
          <group key={s}>
            {/* faróis grandes, inclinados e contornando a quina */}
            <mesh position={[0.15, 0.575, s * 0.53]} rotation={[0, s * 0.22, 0.72]} raycast={() => null}>
              <boxGeometry args={[0.17, 0.035, 0.42]} />
              <meshStandardMaterial color="#e0f2fe" emissive="#bae6fd" emissiveIntensity={1.6} toneMapped={false} />
            </mesh>
            <mesh position={[0.24, 0.585, s * 0.76]} rotation={[0, s * 0.5, 0.72]} raycast={() => null}>
              <boxGeometry args={[0.12, 0.03, 0.08]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} toneMapped={false} />
            </mesh>
            {/* lanternas largas na traseira, com a parte âmbar por fora e dobrando na lateral */}
            <mesh position={[4.45, 0.71, s * 0.52]} raycast={() => null}>
              <boxGeometry args={[0.03, 0.11, 0.42]} />
              <meshStandardMaterial color="#7f1d1d" emissive="#ef4444" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            <mesh position={[4.43, 0.71, s * 0.77]} raycast={() => null}>
              <boxGeometry args={[0.05, 0.11, 0.1]} />
              <meshStandardMaterial color="#92400e" emissive="#f59e0b" emissiveIntensity={1.4} toneMapped={false} />
            </mesh>
            {/* frisos laterais, saia, juntas da porta, maçaneta e retrovisor */}
            <mesh position={[2.2, 0.46, s * (sideZ(2.2, 0.46) + 0.006)]} raycast={() => null}>
              <boxGeometry args={[1.85, 0.035, 0.012]} />
              <meshPhysicalMaterial color={PAINT} metalness={0.6} roughness={0.25} clearcoat={1} />
            </mesh>
            <mesh position={[2.18, 0.2, s * (sideZ(2.18, 0.2) + 0.01)]} raycast={() => null}>
              <boxGeometry args={[1.7, 0.06, 0.03]} />
              {dark}
            </mesh>
            {[1.3, 2.74].map((dx) => (
              <mesh key={dx} position={[dx, 0.55, s * (sideZ(dx, 0.55) + 0.002)]} raycast={() => null}>
                <boxGeometry args={[0.008, 0.62, 0.004]} />
                <meshStandardMaterial color="#0b1a3a" />
              </mesh>
            ))}
            <mesh position={[2.5, 0.76, s * (sideZ(2.5, 0.76) + 0.006)]} raycast={() => null}>
              <boxGeometry args={[0.12, 0.025, 0.012]} />
              <meshStandardMaterial color="#0b1a3a" metalness={0.6} />
            </mesh>
            <group position={[1.5, 0.94, s * 0.78]} raycast={() => null}>
              <mesh position={[0, 0, s * 0.06]}>
                <boxGeometry args={[0.13, 0.09, 0.1]} />
                <meshPhysicalMaterial color={PAINT} metalness={0.6} roughness={0.22} clearcoat={1} />
              </mesh>
            </group>
          </group>
        ))}

        {[AXLE_F, AXLE_R].map((x) => [1, -1].map((side) => <Wheel key={`${x}${side}`} x={x} side={side} />))}

        {xray && <Internals />}
      </group>
    </Ctx.Provider>
  );
}

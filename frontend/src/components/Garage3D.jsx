// Cena 3D: garagem noturna de tuning com piso molhado, neons e plataforma giratória.
// Visual original, sem nenhum asset de jogo. Nada é baixado em tempo de execução:
// a iluminação de reflexo vem de Lightformers locais, não de HDRs remotos.

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Grid, Lightformer, MeshReflectorMaterial, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { LENGTH } from "../cars/CivicCoupe97_3D.jsx";
import CivicCoupe97_3D, { MODEL_CREDIT, PIN_ANCHORS } from "../cars/CivicCoupe97_GLB.jsx";

const NEON_A = "#a855f7"; // roxo
const NEON_B = "#22d3ee"; // ciano

function Neon({ position, size, color, rotation }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/**
 * Projeta os pontos dos marcadores na tela a cada quadro e move os rótulos HTML
 * (renderizados fora do Canvas) direto pelo DOM, sem re-render do React.
 */
function PinTracker({ els }) {
  const anchors = useRef({});
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const [id, obj] of Object.entries(anchors.current)) {
      const el = els.current[id];
      if (!obj || !el) continue;
      v.setFromMatrixPosition(obj.matrixWorld).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.visibility = v.z < 1 ? "visible" : "hidden";
    }
  });
  return (
    <group position={[-LENGTH / 2, 0, 0]}>
      {Object.entries(PIN_ANCHORS).map(([id, pos]) => (
        <object3D key={id} position={pos} ref={(o) => (anchors.current[id] = o)} />
      ))}
    </group>
  );
}

function Turntable({ spinning, children }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (spinning && ref.current) ref.current.rotation.y += dt * 0.25;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[3.1, 3.2, 0.06, 96]} />
        <meshStandardMaterial color="#0d1018" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.0, 3.06, 128]} />
        <meshBasicMaterial color={NEON_B} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.55, 2.58, 128]} />
        <meshBasicMaterial color={NEON_A} toneMapped={false} />
      </mesh>
      <group position={[0, 0.06, 0]}>{children}</group>
    </group>
  );
}

function Garage() {
  return (
    <>
      {/* parede do fundo e teto escuros com tubos de neon */}
      <mesh position={[0, 4, -10]}>
        <planeGeometry args={[40, 10]} />
        <meshStandardMaterial color="#07080d" roughness={0.9} />
      </mesh>
      {[-7.5, -4.5, 4.5, 7.5].map((x, i) => (
        <Neon key={x} position={[x, 2.4, -9.8]} size={[0.06, 4.2, 0.06]} color={i % 2 ? NEON_B : NEON_A} />
      ))}
      <Neon position={[0, 5.2, -9.8]} size={[12, 0.06, 0.06]} color={NEON_A} />
      <Neon position={[0, 0.25, -9.8]} size={[18, 0.04, 0.04]} color={NEON_B} />
      {[-3, 0, 3].map((z) => (
        <Neon key={z} position={[0, 6, z]} size={[6, 0.05, 0.05]} color="#e0e7ff" />
      ))}

      {/* piso molhado com reflexo + grade sutil */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <MeshReflectorMaterial
          blur={[400, 120]}
          resolution={1024}
          mixBlur={1}
          mixStrength={18}
          roughness={0.85}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#0a0c12"
          metalness={0.6}
          mirror={0.6}
        />
      </mesh>
      <Grid
        position={[0, 0.002, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#3b2a63"
        fadeDistance={22}
        fadeStrength={1.5}
        infiniteGrid
      />
    </>
  );
}

export default function Garage3D({ regions, selected, onSelect, title }) {
  const [spinning, setSpinning] = useState(true);
  const [xray, setXray] = useState(false);
  const [pins, setPins] = useState(true);
  const controls = useRef();
  const pinEls = useRef({});

  const select = (id) => {
    onSelect(id);
    if (id) setSpinning(false); // para de girar para você ler o painel
  };

  return (
    <div className="garage">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [5.2, 2.1, 5.6], fov: 35 }}>
        <color attach="background" args={["#05060b"]} />
        <fog attach="fog" args={["#05060b", 12, 30]} />

        <ambientLight intensity={0.15} />
        <spotLight position={[0, 7, 0]} angle={0.55} penumbra={0.7} intensity={140} color="#e0e7ff" castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[-6, 2.5, -4]} intensity={18} color={NEON_A} />
        <pointLight position={[6, 2.5, -4]} intensity={18} color={NEON_B} />
        <pointLight position={[0, 1.5, 6]} intensity={5} color="#ffffff" />

        {/* reflexos na pintura: "softboxes" coloridas, sem download de HDR */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.5} color="#ffffff" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={2} color={NEON_A} position={[-6, 2, -2]} rotation={[0, Math.PI / 2, 0]} scale={[10, 0.6, 1]} />
          <Lightformer form="rect" intensity={2} color={NEON_B} position={[6, 2, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[10, 0.6, 1]} />
          <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 1.5, 7]} scale={[10, 2, 1]} />
        </Environment>

        <Garage />
        <Turntable spinning={spinning}>
          <CivicCoupe97_3D regions={regions} selected={selected} onSelect={select} xray={xray} />
          <PinTracker els={pinEls} />
          <ContactShadows position={[0, 0.005, 0]} opacity={0.8} scale={7} blur={2.2} far={1.6} />
        </Turntable>

        <OrbitControls
          ref={controls}
          makeDefault
          enablePan={false}
          minDistance={4.2}
          maxDistance={11}
          maxPolarAngle={Math.PI / 2.08}
          target={[0, 0.6, 0]}
          onStart={() => setSpinning(false)}
        />

        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.92} luminanceSmoothing={0.1} />
          <Vignette eskil={false} offset={0.25} darkness={0.75} />
        </EffectComposer>
      </Canvas>

      {pins && (
        <div className="pins-layer">
          {Object.keys(PIN_ANCHORS)
            .filter((id) => regions[id])
            .map((id) => {
              const r = regions[id];
              return (
                <button
                  key={id}
                  ref={(el) => (pinEls.current[id] = el)}
                  className={`pin ${selected === id ? "active" : ""}`}
                  style={{ visibility: "hidden" }}
                  onClick={() => select(selected === id ? null : id)}
                >
                  <span className="dot" style={{ background: r.color, color: r.color }} />
                  {r.label} <strong>{r.minLife != null ? `${Math.round(r.minLife)}%` : "?"}</strong>
                </button>
              );
            })}
        </div>
      )}

      <div className="garage-title">
        <span>{title}</span>
        <small>Clique numa região ou num marcador · arraste para girar · role para zoom</small>
      </div>
      <div className="garage-credit">
        Modelo 3D: “{MODEL_CREDIT.title}”
        {MODEL_CREDIT.author && <> por {MODEL_CREDIT.url ? <a href={MODEL_CREDIT.url} target="_blank" rel="noreferrer">{MODEL_CREDIT.author}</a> : MODEL_CREDIT.author}</>}
        {" · "}
        <a href={MODEL_CREDIT.licenseUrl} target="_blank" rel="noreferrer">{MODEL_CREDIT.license}</a> · cores e regiões modificadas
      </div>
      <div className="garage-controls">
        <button className={spinning ? "on" : ""} onClick={() => setSpinning((s) => !s)}>
          {spinning ? "⏸ Parar" : "⟳ Girar"}
        </button>
        <button className={xray ? "on" : ""} onClick={() => setXray((x) => !x)}>
          Raio X
        </button>
        <button className={pins ? "on" : ""} onClick={() => setPins((p) => !p)}>
          Marcadores
        </button>
        <button onClick={() => controls.current?.reset()}>Câmera inicial</button>
      </div>
    </div>
  );
}

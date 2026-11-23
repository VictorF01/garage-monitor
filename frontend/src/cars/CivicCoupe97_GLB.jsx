// Civic coupé 96–00 a partir de um modelo 3D (.glb), com as mesmas regiões clicáveis,
// cores por estado e raio X do modelo procedural.
//
// Modelo: "1999 Honda Civic Si" (Sketchfab), licença CC BY-NC-SA — ver MODEL_CREDIT.
// Uso pessoal/não comercial; o crédito ao autor precisa aparecer no app.

import { Component, Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import CivicCoupe97_3D, { Ctx, Internals, LENGTH } from "./CivicCoupe97_3D.jsx";

// Prata metálico.
export const PAINT = "#b9bec6";

// Pontos dos marcadores, medidos neste modelo (frente do carro em x = 0; entre-eixos 2,60 m).
const AXLE_F = 0.925;
export const PIN_ANCHORS = {
  motor: [0.75, 1.15, 0],
  arrefecimento: [-0.35, 0.55, 0],
  transmissao: [1.35, 0.5, 1.15],
  freios: [AXLE_F, -0.06, 1.15],
  pneus: [3.525, -0.06, 1.15],
};

export const MODEL_URL = "/models/civic-coupe-97.glb";
export const MODEL_CREDIT = {
  title: "1999 Honda Civic Si",
  author: "ZD 3D Modelling and Design",
  url: "https://discord.gg/ZwWHzxk2zu", // servidor do Discord indicado pelo criador
  license: "CC BY-NC-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

// Peça do modelo → região (pelo nome do nó; vale para o nó ou qualquer ancestral).
const REGION_RULES = [
  ["arrefecimento", /hooda_black/i], // grade (no Civic 96–00 ela fica presa ao capô)
  ["motor", /hooda_body/i], // capô
  ["freios", /caliper|rotor/i], // pinças e discos
  ["pneus", /3DWheel2A_Material1/i], // pneus (borracha das 4 rodas)
];
// Peças que recebem a cor do estado (as demais da região só respondem ao clique).
const TINTED = { motor: /hooda_body/i, arrefecimento: /hooda_black/i, freios: /caliper/i, pneus: /3DWheel2A_Material1/i };

function regionOf(obj) {
  for (let o = obj; o; o = o.parent) {
    for (const [region, re] of REGION_RULES) if (re.test(o.name)) return region;
  }
  return null;
}

/** Normaliza o modelo: comprimento real de 4,45 m, frente para -x, centrado e apoiado no chão. */
function prepare(gltfScene) {
  const root = gltfScene.clone(true);
  const inner = new THREE.Group();
  inner.add(root);

  const centroid = (re) => {
    const box = new THREE.Box3();
    root.traverse((o) => o.isMesh && re.test(o.name) && box.expandByObject(o));
    return box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
  };

  // Eixo do comprimento = maior dimensão horizontal.
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  let rotY = size.z > size.x ? Math.PI / 2 : 0;
  inner.rotation.y = rotY;
  inner.updateMatrixWorld(true);
  // Frente (faróis) deve ficar em -x.
  const head = centroid(/headlight/i);
  const tail = centroid(/taillight/i);
  if (head && tail) {
    const h = head.clone().applyMatrix4(inner.matrixWorld);
    const t = tail.clone().applyMatrix4(inner.matrixWorld);
    if (h.x > t.x) inner.rotation.y = rotY + Math.PI;
  }
  inner.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(inner);
  inner.scale.setScalar(LENGTH / (box.max.x - box.min.x));
  inner.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);

  // Materiais próprios desta instância; pintura na cor do carro; regiões marcadas.
  const cache = new Map();
  const own = (m) => {
    if (!cache.has(m)) {
      const copy = m.clone();
      copy.userData.base = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
      cache.set(m, copy);
    }
    return cache.get(m);
  };
  const tinted = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const region = regionOf(o);
    o.userData.region = region;
    if (region && TINTED[region].test(o.name + " " + (o.parent?.name ?? ""))) {
      o.material = o.material.clone(); // cada peça colorida tem material próprio
      o.material.userData.base = { transparent: false, opacity: 1, depthWrite: true };
      o.userData.tint = region;
      tinted.push(o);
    } else {
      o.material = own(o.material);
    }
    if (/carpaint/i.test(o.material.name) || /carpaint/i.test(o.name)) {
      o.material.color.set(PAINT);
      o.material.metalness = 0.85;
      o.material.roughness = 0.3;
      if ("clearcoat" in o.material) o.material.clearcoat = 1;
    }
  });
  return { object: inner, tinted, materials: [...cache.values()] };
}

function GLBCar({ regions, selected, onSelect, xray }) {
  const gltf = useGLTF(MODEL_URL);
  const car = useMemo(() => prepare(gltf.scene), [gltf.scene]);
  const [hover, setHover] = useState(null);

  // Cor de estado nas peças das regiões.
  useEffect(() => {
    for (const o of car.tinted) {
      const id = o.userData.tint;
      const color = new THREE.Color(regions[id]?.color ?? "#64748b");
      const m = o.material;
      const glow = selected === id ? 0.9 : hover === id ? 0.45 : id === "pneus" ? 0.02 : 0.12;
      if (id === "motor") {
        // Capô fica na cor do carro; o estado aparece só como brilho.
        m.emissive.copy(color);
        m.emissiveIntensity = selected === id ? 0.55 : hover === id ? 0.3 : 0.08;
      } else {
        // Pneu continua parecendo borracha: só um tom da cor; grade e pinças ganham a cor cheia.
        m.color.copy(id === "pneus" ? new THREE.Color("#111318").lerp(color, 0.12) : color);
        if (m.map && id !== "pneus") m.map = null;
        m.emissive?.copy(color);
        m.emissiveIntensity = glow;
      }
      m.needsUpdate = true;
    }
  }, [car, regions, selected, hover]);

  // Raio X: tudo translúcido, menos pinças/pneus; carroceria deixa de receber cliques.
  useEffect(() => {
    const keep = (o) => o.userData.tint === "freios" || o.userData.tint === "pneus";
    car.object.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      const b = m.userData.base;
      const ghost = xray && !keep(o);
      m.transparent = ghost ? true : b.transparent;
      m.opacity = ghost ? 0.1 : b.opacity;
      m.depthWrite = ghost ? false : b.depthWrite;
      m.needsUpdate = true;
      if (ghost) o.raycast = () => null;
      else delete o.raycast; // volta ao raycast do protótipo
    });
  }, [car, xray]);

  const handlers = {
    onClick: (e) => {
      e.stopPropagation();
      const r = e.object.userData.region;
      if (r) onSelect(selected === r ? null : r);
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      const r = e.object.userData.region;
      setHover(r);
      document.body.style.cursor = r ? "pointer" : "";
    },
    onPointerOut: () => {
      setHover(null);
      document.body.style.cursor = "";
    },
  };

  return (
    <Ctx.Provider value={{ regions, selected, onSelect, hover, setHover }}>
      <primitive object={car.object} {...handlers} />
      {xray && (
        <group position={[-LENGTH / 2, 0, 0]}>
          <Internals />
        </group>
      )}
    </Ctx.Provider>
  );
}

/** Se o .glb falhar, mostra o modelo procedural em vez de quebrar a cena. */
class Fallback extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn("Modelo 3D (.glb) não carregou; usando o modelo procedural.", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function CivicCoupe97Model(props) {
  const procedural = <CivicCoupe97_3D {...props} />;
  return (
    <Fallback fallback={procedural}>
      <Suspense fallback={procedural}>
        <GLBCar {...props} />
      </Suspense>
    </Fallback>
  );
}

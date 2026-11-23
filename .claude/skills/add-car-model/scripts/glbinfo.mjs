// Resumo de um .glb: extensões, malhas, materiais, triângulos e árvore de nós (nome [tris; materiais]).
// Uso: node glbinfo.mjs arquivo.glb   (só lê o JSON do GLB; não executa nada do arquivo)
import { readFileSync } from "node:fs";
const buf = readFileSync(process.argv[2]);
if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error("não é GLB");
const jsonLen = buf.readUInt32LE(12);
const g = JSON.parse(buf.toString("utf8", 20, 20 + jsonLen));
console.log("versão:", g.asset?.version, "| gerador:", g.asset?.generator, "| copyright:", g.asset?.copyright ?? "-");
console.log("extensões:", (g.extensionsUsed || []).join(", ") || "-");
console.log(`nós: ${g.nodes?.length} | malhas: ${g.meshes?.length} | materiais: ${g.materials?.length} | texturas: ${g.textures?.length ?? 0} | imagens: ${g.images?.length ?? 0} | animações: ${g.animations?.length ?? 0}`);
let totalTris = 0;
const triOf = (m) => m.primitives.reduce((t, p) => t + (p.indices != null ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count) / 3, 0);
g.meshes.forEach((m) => (totalTris += triOf(m)));
console.log("triângulos totais:", Math.round(totalTris).toLocaleString("pt-BR"));
console.log("\nmateriais:", g.materials.map((m) => m.name).join(" | "));
if (g.images) console.log("\nimagens:", g.images.map((im) => `${im.name || "?"}(${im.mimeType}, ${g.bufferViews[im.bufferView]?.byteLength >> 10} KB)`).join(" | "));
console.log("\nárvore de nós (nome [malha: tris, materiais]):");
const walk = (i, d) => {
  const n = g.nodes[i];
  let info = "";
  if (n.mesh != null) { const m = g.meshes[n.mesh]; info = ` [${Math.round(triOf(m))} tris; ${[...new Set(m.primitives.map((p) => g.materials[p.material]?.name))].join(",")}]`; }
  const extra = [n.scale && `s=${n.scale.map((v) => +v.toFixed(3))}`, n.rotation && `r`, n.translation && `t=${n.translation.map((v) => +v.toFixed(2))}`].filter(Boolean).join(" ");
  if (d < 12) console.log("  ".repeat(d) + (n.name || `#${i}`) + info + (extra ? "  " + extra : ""));
  (n.children || []).forEach((c) => walk(c, d + 1));
};
g.scenes[g.scene ?? 0].nodes.forEach((i) => walk(i, 0));

// Regiões do carro e escala de cores da vida útil.
// As chaves batem com backend/app/regions.py.

export const REGION_LABELS = {
  motor: "Motor",
  arrefecimento: "Arrefecimento",
  transmissao: "Câmbio",
  freios: "Freios",
  pneus: "Pneus",
  suspensao: "Suspensão",
  eletrica: "Elétrica",
  outros: "Outros",
};

// Faixas de cor pela vida útil restante (%). Ajuste aqui para mudar o app inteiro.
export const LIFE_SCALE = [
  { min: 75, color: "#3b82f6", label: "Em dia (> 75%)" },
  { min: 50, color: "#22c55e", label: "Bom (50–75%)" },
  { min: 25, color: "#eab308", label: "Atenção (25–50%)" },
  { min: -Infinity, color: "#ef4444", label: "Trocar (< 25%)" },
];

// Sem registro de troca o app não sabe a vida útil: mostra a cor inicial (azul).
export const INITIAL_COLOR = LIFE_SCALE[0].color;

export function lifeColor(percent) {
  if (percent == null) return INITIAL_COLOR;
  return LIFE_SCALE.find((s) => percent > s.min).color;
}

/** Resumo por região: menor vida útil conhecida, quantidade de itens e itens sem registro. */
export function summarizeRegions(items) {
  const out = {};
  for (const item of items) {
    const key = item.region || "outros";
    const r = (out[key] ??= { key, label: REGION_LABELS[key] ?? key, items: [], minLife: null, unknown: 0 });
    r.items.push(item);
    if (item.life_percent == null) r.unknown += 1;
    else r.minLife = r.minLife == null ? item.life_percent : Math.min(r.minLife, item.life_percent);
  }
  for (const r of Object.values(out)) r.color = lifeColor(r.minLife);
  return out;
}

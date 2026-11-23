import { lazy, Suspense } from "react";
import CivicCoupe97, { DRAWN_REGIONS } from "../cars/CivicCoupe97.jsx";
import { LIFE_SCALE, REGION_LABELS } from "../regions.js";

// A cena 3D (three.js) é pesada: carrega só quando o diagrama aparece.
const Garage3D = lazy(() => import("./Garage3D.jsx"));

const hasWebGL = (() => {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
})();

// Por enquanto todo veículo usa o desenho do Civic coupé 97 (carro piloto).
// Quando houver outros modelos, escolher o desenho a partir de vehicle.brand/model.
export default function CarDiagram({ regions, selected, onSelect, title }) {
  // Regiões desenhadas primeiro; regiões sem desenho (ex.: "outros") aparecem só como chip.
  const keys = [...DRAWN_REGIONS, ...Object.keys(regions).filter((k) => !DRAWN_REGIONS.includes(k))];

  return (
    <section className="card diagram">
      {hasWebGL ? (
        <Suspense fallback={<div className="garage loading">Abrindo a garagem...</div>}>
          <Garage3D regions={regions} selected={selected} onSelect={onSelect} title={title} />
        </Suspense>
      ) : (
        <CivicCoupe97 regions={regions} selected={selected} onSelect={onSelect} />
      )}

      <div className="region-chips">
        {keys.map((key) => {
          const r = regions[key];
          return (
            <button
              key={key}
              className={`chip ${selected === key ? "active" : ""}`}
              onClick={() => onSelect(selected === key ? null : key)}
              disabled={!r}
            >
              <span className="dot" style={{ background: r?.color ?? "#cbd5e1", color: r?.color ?? "#cbd5e1" }} />
              {REGION_LABELS[key] ?? key}
              <strong>{r ? (r.minLife != null ? `${Math.round(r.minLife)}%` : "?") : "—"}</strong>
              {r?.unknown > 0 && (
                <span className="muted small" title="Itens sem registro de troca">
                  {r.unknown} s/ registro
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="legend small muted">
        {LIFE_SCALE.map((s) => (
          <span key={s.label}>
            <span className="dot" style={{ background: s.color, color: s.color }} /> {s.label}
          </span>
        ))}
        <span>A cor de cada região é a do item mais desgastado nela.</span>
      </div>
    </section>
  );
}

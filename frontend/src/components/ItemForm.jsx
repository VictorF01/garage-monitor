import { useState } from "react";
import { REGION_LABELS } from "../regions.js";

export default function ItemForm({ onSubmit, onCancel, defaultRegion }) {
  const [f, setF] = useState({
    name: "",
    kind: "servico",
    region: defaultRegion ?? "",
    interval_km: "",
    interval_months: "",
    notes: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      name: f.name,
      kind: f.kind,
      region: f.region || null, // vazio: o backend deduz pelo nome
      interval_km: f.interval_km ? Number(f.interval_km) : null,
      interval_months: f.interval_months ? Number(f.interval_months) : null,
      notes: f.notes || null,
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Nome*
        <input required value={f.name} onChange={set("name")} placeholder="Troca de óleo" />
      </label>
      <label>
        Tipo
        <select value={f.kind} onChange={set("kind")}>
          <option value="servico">Serviço</option>
          <option value="peca">Peça</option>
        </select>
      </label>
      <label>
        Região
        <select value={f.region} onChange={set("region")}>
          <option value="">Automática (pelo nome)</option>
          {Object.entries(REGION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Vida útil (km)
        <input type="number" min="1" value={f.interval_km} onChange={set("interval_km")} placeholder="10000" />
      </label>
      <label>
        Vida útil (meses)
        <input type="number" min="1" value={f.interval_months} onChange={set("interval_months")} placeholder="12" />
      </label>
      <label className="wide">
        Observações
        <input value={f.notes} onChange={set("notes")} />
      </label>
      <div className="row">
        <button type="submit">Adicionar</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

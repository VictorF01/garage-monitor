import { useState } from "react";

const EMPTY = { name: "", brand: "", model: "", year: "", current_km: "" };

/** Cadastro e edição de veículo; com `initial`, o formulário já vem preenchido. */
export default function VehicleForm({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState(() =>
    initial ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, initial[k] ?? ""])) : EMPTY,
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      name: f.name,
      brand: f.brand || null,
      model: f.model || null,
      year: f.year ? Number(f.year) : null,
      current_km: Number(f.current_km || 0),
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Apelido*
        <input required value={f.name} onChange={set("name")} placeholder="Meu carro" />
      </label>
      <label>
        Marca
        <input value={f.brand} onChange={set("brand")} />
      </label>
      <label>
        Modelo
        <input value={f.model} onChange={set("model")} />
      </label>
      <label>
        Ano
        <input type="number" value={f.year} onChange={set("year")} />
      </label>
      <label>
        Km atual
        <input type="number" min="0" value={f.current_km} onChange={set("current_km")} />
      </label>
      <div className="row">
        <button type="submit">Salvar</button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

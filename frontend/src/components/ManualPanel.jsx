import { useEffect, useState } from "react";
import { api } from "../api.js";

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export default function ManualPanel({ vehicle, existingItems, onAddItems, onError }) {
  const [manuals, setManuals] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const load = async () => {
    try {
      setManuals(await api.listManuals(vehicle.id));
    } catch (e) {
      onError(e.message);
    }
  };

  useEffect(() => {
    load();
    setSuggestions([]);
  }, [vehicle.id]);

  const upload = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadManual(vehicle.id, file);
      await load();
    } catch (err) {
      onError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (m) => {
    if (!confirm(`Excluir o manual "${m.filename}"?`)) return;
    try {
      await api.deleteManual(m.id);
      await load();
    } catch (err) {
      onError(err.message);
    }
  };

  const analyze = async (m) => {
    setAnalyzing(m.id);
    setSuggestions([]);
    try {
      const list = await api.suggest(m.id);
      const existing = new Set(existingItems.map((i) => norm(i.name)));
      setSuggestions(list.map((s) => ({ ...s, exists: existing.has(norm(s.name)) })));
      // Pré-seleciona o que ainda não está cadastrado.
      setSelected(new Set(list.map((s, i) => (existing.has(norm(s.name)) ? null : i)).filter((i) => i !== null)));
    } catch (err) {
      onError(err.message);
    } finally {
      setAnalyzing(null);
    }
  };

  const toggle = (i) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };

  const accept = async () => {
    const chosen = suggestions
      .filter((_, i) => selected.has(i))
      .map(({ exists, ...s }) => ({ ...s, source: "manual" }));
    await onAddItems(chosen);
    setSuggestions([]);
  };

  return (
    <section className="card">
      <div className="section-head">
        <h2>Manual do carro</h2>
        <label className="button">
          {uploading ? "Enviando..." : "Enviar PDF"}
          <input type="file" accept="application/pdf" hidden onChange={upload} disabled={uploading} />
        </label>
      </div>

      {manuals.length === 0 && (
        <p className="muted">Envie o manual (PDF) para receber sugestões de manutenção com base no plano do fabricante.</p>
      )}
      <ul className="manuals">
        {manuals.map((m) => (
          <li key={m.id}>
            📄 {m.filename} <span className="muted small">({(m.size_bytes / 1024 / 1024).toFixed(1)} MB)</span>
            <button onClick={() => analyze(m)} disabled={analyzing !== null}>
              {analyzing === m.id ? "Analisando o manual..." : "Sugerir manutenções"}
            </button>
            <button className="danger link" onClick={() => remove(m)}>
              Excluir
            </button>
          </li>
        ))}
      </ul>
      {analyzing !== null && <p className="muted small">Isso pode levar alguns minutos em manuais grandes.</p>}

      {suggestions.length > 0 && (
        <>
          <h3>Sugestões do manual</h3>
          <table className="suggestions">
            <thead>
              <tr>
                <th></th>
                <th>Item</th>
                <th>Tipo</th>
                <th>Km</th>
                <th>Meses</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s, i) => (
                <tr key={i} className={s.exists ? "muted" : ""}>
                  <td>
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                  </td>
                  <td>
                    {s.name}
                    {s.exists && <span className="small"> (já cadastrado)</span>}
                  </td>
                  <td>{s.kind === "peca" ? "Peça" : "Serviço"}</td>
                  <td>{s.interval_km?.toLocaleString("pt-BR") ?? "—"}</td>
                  <td>{s.interval_months ?? "—"}</td>
                  <td className="small">{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row">
            <button onClick={accept} disabled={selected.size === 0}>
              Adicionar {selected.size} selecionado(s)
            </button>
            <button className="secondary" onClick={() => setSuggestions([])}>
              Descartar
            </button>
          </div>
        </>
      )}
    </section>
  );
}

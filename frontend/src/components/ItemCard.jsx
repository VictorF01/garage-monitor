import { useState } from "react";
import { api } from "../api.js";
import { lifeColor } from "../regions.js";

const STATUS_LABEL = {
  ok: "OK",
  atencao: "Atenção",
  vencido: "Vencido",
  sem_registro: "Sem registro de troca",
  sem_intervalo: "Sem vida útil definida",
};

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const fmtKm = (n) => n.toLocaleString("pt-BR");
const fmtDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("pt-BR");

function remainingText(item) {
  const parts = [];
  if (item.km_remaining != null)
    parts.push(
      item.km_remaining >= 0 ? `${fmtKm(item.km_remaining)} km restantes` : `${fmtKm(-item.km_remaining)} km além`,
    );
  if (item.days_remaining != null)
    parts.push(
      item.days_remaining >= 0 ? `${item.days_remaining} dias restantes` : `${-item.days_remaining} dias atrasado`,
    );
  return parts.join(" · ");
}

export default function ItemCard({ item, vehicle, onChange, onError, onUndoable }) {
  const [mode, setMode] = useState(null); // null | "record" | "history"
  const [form, setForm] = useState({ performed_at: today(), km_at_service: vehicle.current_km, cost: "", notes: "" });
  const [history, setHistory] = useState([]);

  const life = item.life_percent;
  const interval = [
    item.interval_km && `${fmtKm(item.interval_km)} km`,
    item.interval_months && `${item.interval_months} meses`,
  ]
    .filter(Boolean)
    .join(" ou ");

  const safe =
    (fn) =>
    async (...a) => {
      try {
        await fn(...a);
      } catch (e) {
        onError(e.message);
      }
    };

  const openRecord = () => {
    setForm({ performed_at: today(), km_at_service: vehicle.current_km, cost: "", notes: "" });
    setMode(mode === "record" ? null : "record");
  };

  const openHistory = safe(async () => {
    if (mode === "history") return setMode(null);
    setHistory(await api.listRecords(item.id));
    setMode("history");
  });

  const saveRecord = safe(async (e) => {
    e.preventDefault();
    await api.createRecord(item.id, {
      performed_at: form.performed_at,
      km_at_service: Number(form.km_at_service),
      cost: form.cost ? Number(form.cost) : null,
      notes: form.notes || null,
    });
    setMode(null);
    onChange();
  });

  // Sem confirm: a exclusão é reversível pelo "Desfazer" (e itens ficam na lixeira).
  const removeRecord = safe(async (id) => {
    await api.deleteRecord(id);
    setHistory(await api.listRecords(item.id));
    onChange();
    onUndoable(`Registro de "${item.name}" excluído`, async () => {
      await api.restoreRecord(id);
      if (mode === "history") setHistory(await api.listRecords(item.id));
    });
  });

  const removeItem = safe(async () => {
    await api.deleteItem(item.id);
    onChange();
    onUndoable(`"${item.name}" foi para a lixeira`, () => api.restoreItem(item.id));
  });

  return (
    <div className={`card item ${item.status}`} style={{ "--c": lifeColor(life) }}>
      <div className="item-head">
        <div>
          <h3>{item.name}</h3>
          <span className="muted small">
            {item.kind === "peca" ? "Peça" : "Serviço"}
            {interval && ` · a cada ${interval}`}
            {item.source === "manual" && " · do manual"}
          </span>
        </div>
        <span className="life">{life != null ? `${Math.round(life)}%` : "—"}</span>
      </div>

      <div className="bar">
        <div className="fill" style={{ width: `${Math.max(0, Math.min(100, life ?? 0))}%` }} />
      </div>

      <p className="small">
        <strong className="status">{STATUS_LABEL[item.status]}</strong>
        {remainingText(item) && ` · ${remainingText(item)}`}
      </p>
      {item.last_record && (
        <p className="small muted">
          Última troca: {fmtDate(item.last_record.performed_at)} com {fmtKm(item.last_record.km_at_service)} km
        </p>
      )}
      {item.notes && <p className="small muted">{item.notes}</p>}

      <div className="row">
        <button onClick={openRecord}>{item.kind === "peca" ? "Troquei" : "Fiz o serviço"}</button>
        <button className="secondary" onClick={openHistory}>
          Histórico
        </button>
        <button className="danger link" onClick={removeItem}>
          Excluir
        </button>
      </div>

      {mode === "record" && (
        <form className="form compact" onSubmit={saveRecord}>
          <label>
            Data
            <input
              type="date"
              required
              value={form.performed_at}
              max={today()}
              onChange={(e) => setForm({ ...form, performed_at: e.target.value })}
            />
          </label>
          <label>
            Km
            <input
              type="number"
              required
              min="0"
              value={form.km_at_service}
              onChange={(e) => setForm({ ...form, km_at_service: e.target.value })}
            />
          </label>
          <label>
            Custo (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </label>
          <label className="wide">
            Observações
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Marca da peça, oficina..."
            />
          </label>
          <button type="submit">Salvar (vida útil volta a 100%)</button>
        </form>
      )}

      {mode === "history" && (
        <ul className="history">
          {history.length === 0 && <li className="muted">Nenhum registro.</li>}
          {history.map((r) => (
            <li key={r.id}>
              {fmtDate(r.performed_at)} · {fmtKm(r.km_at_service)} km
              {r.cost != null && ` · R$ ${Number(r.cost).toFixed(2)}`}
              {r.notes && ` · ${r.notes}`}
              <button className="danger link" onClick={() => removeRecord(r.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

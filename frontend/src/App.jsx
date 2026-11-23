import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import VehicleForm from "./components/VehicleForm.jsx";
import ItemCard from "./components/ItemCard.jsx";
import ItemForm from "./components/ItemForm.jsx";
import ManualPanel from "./components/ManualPanel.jsx";
import CarDiagram from "./components/CarDiagram.jsx";
import { REGION_LABELS, summarizeRegions } from "./regions.js";

export default function App() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [km, setKm] = useState("");
  const [region, setRegion] = useState(null);
  const [trash, setTrash] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [undo, setUndo] = useState(null); // { message, restore }
  const undoTimer = useRef();

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const loadVehicles = useCallback(async () => {
    const list = await api.listVehicles();
    setVehicles(list);
    setVehicleId((cur) => (list.some((v) => v.id === cur) ? cur : (list[0]?.id ?? null)));
  }, []);

  const loadItems = useCallback(async () => {
    if (!vehicleId) {
      setItems([]);
      setTrash([]);
      return;
    }
    const [live, deleted] = await Promise.all([api.listItems(vehicleId), api.listDeletedItems(vehicleId)]);
    setItems(live);
    setTrash(deleted);
  }, [vehicleId]);

  const run =
    (fn) =>
    async (...args) => {
      setError("");
      try {
        await fn(...args);
      } catch (e) {
        setError(e.message);
      }
    };

  useEffect(() => {
    run(loadVehicles)();
  }, [loadVehicles]);

  useEffect(() => {
    setRegion(null);
    setEditingVehicle(false);
  }, [vehicleId]);

  useEffect(() => {
    run(loadItems)();
    setKm(vehicle ? String(vehicle.current_km) : "");
  }, [loadItems, vehicle?.current_km]);

  const refresh = async () => {
    await loadVehicles();
    await loadItems();
  };

  /** Mostra o aviso "Desfazer" por alguns segundos depois de uma exclusão. */
  const offerUndo = (message, restore) => {
    clearTimeout(undoTimer.current);
    setUndo({ message, restore });
    undoTimer.current = setTimeout(() => setUndo(null), 10000);
  };

  const doUndo = run(async () => {
    const u = undo;
    clearTimeout(undoTimer.current);
    setUndo(null);
    await u.restore();
    await refresh();
  });

  const restoreFromTrash = run(async (item) => {
    await api.restoreItem(item.id);
    await loadItems();
  });

  const createVehicle = run(async (data) => {
    const v = await api.createVehicle(data);
    setShowVehicleForm(false);
    await loadVehicles();
    setVehicleId(v.id);
  });

  const updateVehicle = run(async (data) => {
    await api.updateVehicle(vehicle.id, data);
    setEditingVehicle(false);
    await refresh(); // km pode ter mudado: recalcula a vida útil
  });

  const deleteVehicle = run(async () => {
    if (!confirm(`Excluir "${vehicle.name}" e todo o histórico?`)) return;
    const { id, name } = vehicle;
    await api.deleteVehicle(id);
    await loadVehicles();
    offerUndo(`Veículo "${name}" excluído`, async () => {
      await api.restoreVehicle(id);
      setVehicleId(id);
    });
  });

  const saveOdometer = run(async (e) => {
    e.preventDefault();
    await api.updateOdometer(vehicle.id, Number(km));
    await refresh();
  });

  const addItems = run(async (list) => {
    await api.createItems(vehicle.id, list);
    setShowItemForm(false);
    await loadItems();
  });

  const regions = summarizeRegions(items);
  const shownItems = region ? items.filter((i) => (i.region || "outros") === region) : items;

  const counts = items.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {});

  return (
    <div className="app">
      <header>
        <h1>🔧 Garage Monitor</h1>
        <div className="row">
          {vehicles.length > 0 && (
            <select value={vehicleId ?? ""} onChange={(e) => setVehicleId(Number(e.target.value))}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          <button onClick={() => setShowVehicleForm((s) => !s)}>+ Veículo</button>
        </div>
      </header>

      {error && (
        <div className="error" onClick={() => setError("")}>
          {error}
        </div>
      )}

      {(showVehicleForm || vehicles.length === 0) && (
        <section className="card">
          <h2>Novo veículo</h2>
          <VehicleForm onSubmit={createVehicle} onCancel={vehicles.length ? () => setShowVehicleForm(false) : null} />
        </section>
      )}

      {vehicle && (
        <>
          {editingVehicle ? (
            <section className="card">
              <h2>Editar veículo</h2>
              <VehicleForm
                key={vehicle.id}
                initial={vehicle}
                onSubmit={updateVehicle}
                onCancel={() => setEditingVehicle(false)}
              />
            </section>
          ) : (
            <section className="card vehicle">
              <div>
                <h2>{vehicle.name}</h2>
                <p className="muted">
                  {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="summary">
                  <span className="badge vencido">{counts.vencido || 0} vencidos</span>
                  <span className="badge atencao">{counts.atencao || 0} atenção</span>
                  <span className="badge ok">{counts.ok || 0} ok</span>
                  <span className="badge sem_registro">{counts.sem_registro || 0} sem registro</span>
                </p>
              </div>
              <form className="odometer" onSubmit={saveOdometer}>
                <label>
                  Hodômetro (km)
                  <input type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} />
                </label>
                <button type="submit">Atualizar km</button>
                <button type="button" className="secondary" onClick={() => setEditingVehicle(true)}>
                  Editar dados
                </button>
                <button type="button" className="danger link" onClick={deleteVehicle}>
                  Excluir veículo
                </button>
              </form>
            </section>
          )}

          {items.length > 0 && (
            <CarDiagram
              regions={regions}
              selected={region}
              onSelect={setRegion}
              title={[vehicle.brand, vehicle.model, "Coupé", vehicle.year].filter(Boolean).join(" ")}
            />
          )}

          <section>
            <div className="section-head">
              <h2>
                {region ? `${REGION_LABELS[region] ?? region}: ${shownItems.length} item(ns)` : "Peças e manutenções"}
              </h2>
              <div className="row">
                {region && (
                  <button className="secondary" onClick={() => setRegion(null)}>
                    Ver todos
                  </button>
                )}
                <button onClick={() => setShowItemForm((s) => !s)}>+ Item</button>
              </div>
            </div>
            {showItemForm && (
              <div className="card">
                <ItemForm
                  defaultRegion={region}
                  onSubmit={(d) => addItems([d])}
                  onCancel={() => setShowItemForm(false)}
                />
              </div>
            )}
            {items.length === 0 && !showItemForm && (
              <p className="muted">
                Nenhum item ainda. Adicione manualmente ou envie o manual do carro abaixo para receber sugestões.
              </p>
            )}
            <div className="grid">
              {shownItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  vehicle={vehicle}
                  onChange={run(refresh)}
                  onError={setError}
                  onUndoable={offerUndo}
                />
              ))}
            </div>
          </section>

          {trash.length > 0 && (
            <section className="card trash">
              <div className="section-head">
                <h2>🗑 Lixeira ({trash.length})</h2>
                <button className="secondary" onClick={() => setShowTrash((s) => !s)}>
                  {showTrash ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {showTrash && (
                <ul className="trash-list">
                  {trash.map((t) => (
                    <li key={t.id}>
                      <span>
                        <strong>{t.name}</strong>
                        <span className="muted small">
                          {" "}
                          · excluído em {new Date(t.deleted_at).toLocaleString("pt-BR")}
                        </span>
                      </span>
                      <button onClick={() => restoreFromTrash(t)}>Restaurar</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <ManualPanel vehicle={vehicle} existingItems={items} onAddItems={addItems} onError={setError} />
        </>
      )}
      {undo && (
        <div className="toast" role="status">
          <span>{undo.message}</span>
          <button onClick={doUndo}>Desfazer</button>
          <button className="link" aria-label="Fechar" onClick={() => setUndo(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

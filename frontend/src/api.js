async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, opts);
  if (!res.ok) {
    let msg = res.status === 413 ? "O arquivo excede o limite de 100 MB" : `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (data.detail) msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  listVehicles: () => request("GET", "/vehicles"),
  createVehicle: (data) => request("POST", "/vehicles", data),
  updateVehicle: (id, data) => request("PUT", `/vehicles/${id}`, data),
  deleteVehicle: (id) => request("DELETE", `/vehicles/${id}`),
  restoreVehicle: (id) => request("POST", `/vehicles/${id}/restore`),
  updateOdometer: (id, km) => request("PATCH", `/vehicles/${id}/odometer`, { current_km: km }),

  listItems: (vehicleId) => request("GET", `/vehicles/${vehicleId}/items`),
  createItems: (vehicleId, items) => request("POST", `/vehicles/${vehicleId}/items`, items),
  deleteItem: (id) => request("DELETE", `/items/${id}`),
  restoreItem: (id) => request("POST", `/items/${id}/restore`),
  listDeletedItems: (vehicleId) => request("GET", `/vehicles/${vehicleId}/items/deleted`),

  listRecords: (itemId) => request("GET", `/items/${itemId}/records`),
  createRecord: (itemId, data) => request("POST", `/items/${itemId}/records`, data),
  deleteRecord: (id) => request("DELETE", `/records/${id}`),
  restoreRecord: (id) => request("POST", `/records/${id}/restore`),

  listManuals: (vehicleId) => request("GET", `/vehicles/${vehicleId}/manuals`),
  uploadManual: (vehicleId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("POST", `/vehicles/${vehicleId}/manuals`, fd);
  },
  deleteManual: (id) => request("DELETE", `/manuals/${id}`),
  suggest: (manualId) => request("POST", `/manuals/${manualId}/suggestions`),
};

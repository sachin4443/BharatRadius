import React, { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import apiClient from "../../services/api";
import { apiError } from "../../utils/format";
import { usePolling } from "../../hooks/usePolling";

interface NasItem {
  id: string;
  nasName: string;
  nasIpAddress?: string;
  dashboardInterfaces?: string[];
}

interface RouterInterface {
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
  comment?: string;
}

interface Point {
  time: string;
  rx: number;
  tx: number;
}

const MAX_POINTS = 40;

const formatBps = (bps: number) => {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${bps} bps`;
};

/**
 * NAS statistics: one live RX/TX graph per selected router interface
 * (e.g. sfp1 uplink, vlan to OLT). Interfaces are chosen with the
 * "Interfaces" button and saved on the NAS, so every user of the site sees them.
 */
const NasInterfaceGraphs: React.FC = () => {
  const [nasList, setNasList] = useState<NasItem[]>([]);
  const [nasId, setNasId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [series, setSeries] = useState<Record<string, Point[]>>({});
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);

  // interface picker
  const [showPicker, setShowPicker] = useState(false);
  const [available, setAvailable] = useState<RouterInterface[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerChoice, setPickerChoice] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    apiClient
      .get("/Dashboard/live-by-nas")
      .then((res) => {
        const list: NasItem[] = res.data ?? [];
        setNasList(list);
        if (list.length > 0) {
          setNasId(list[0].id);
          setSelected(list[0].dashboardInterfaces ?? []);
        }
      })
      .catch((err) => setError(apiError(err, "Unable to load NAS list.")));
  }, []);

  useEffect(() => {
    const nas = nasList.find((n) => n.id === nasId);
    setSelected(nas?.dashboardInterfaces ?? []);
    setSeries({});
    setError("");
  }, [nasId, nasList]);

  // Poll every 3 seconds; never overlaps, pauses while the tab is hidden
  usePolling(
    async () => {
      try {
        const res = await apiClient.get(`/Nas/interface-traffic/${nasId}`, {
          params: { interfaces: selected.join(",") },
        });
        const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setSeries((prev) => {
          const next = { ...prev };
          for (const item of res.data?.items ?? []) {
            const arr = next[item.name] ? [...next[item.name]] : [];
            arr.push({ time, rx: item.rx, tx: item.tx });
            next[item.name] = arr.slice(-MAX_POINTS);
          }
          return next;
        });
        setError("");
      } catch (err) {
        setError(apiError(err, "Router not reachable."));
      }
    },
    3000,
    !!nasId && selected.length > 0 && !paused,
    [nasId, selected.join(",")],
  );

  const openPicker = async () => {
    setShowPicker(true);
    setPickerChoice(selected);
    setPickerLoading(true);
    setAvailable([]);
    try {
      const res = await apiClient.get(`/Nas/interfaces/${nasId}`);
      setAvailable(res.data?.interfaces ?? []);
    } catch (err) {
      setError(apiError(err, "Unable to read interfaces from the router."));
    } finally {
      setPickerLoading(false);
    }
  };

  const savePicker = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put(`/Nas/dashboard-interfaces/${nasId}`, { interfaces: pickerChoice });
      const saved: string[] = res.data?.interfaces ?? pickerChoice;
      setNasList((list) => list.map((n) => (n.id === nasId ? { ...n, dashboardInterfaces: saved } : n)));
      setShowPicker(false);
    } catch (err) {
      alert(apiError(err, "Unable to save interfaces."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h6 className="fw-bold mb-0">📶 NAS Statistics</h6>
          <div className="d-flex gap-2 flex-wrap">
            <select
              className="form-select form-select-sm"
              style={{ minWidth: 160 }}
              value={nasId}
              onChange={(e) => setNasId(e.target.value)}
            >
              {nasList.length === 0 && <option value="">No NAS</option>}
              {nasList.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nasName}
                </option>
              ))}
            </select>
            <button className="btn btn-sm btn-light border text-nowrap" disabled={!nasId} onClick={openPicker}>
              ⚙ Interfaces
            </button>
            <button className="btn btn-sm btn-light border" onClick={() => setPaused((p) => !p)} title="Pause / resume">
              {paused ? "▶" : "⏸"}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-warning py-2 small">{error}</div>}

        {selected.length === 0 ? (
          <div className="text-center text-muted small py-4">
            No interfaces selected. Click <b>⚙ Interfaces</b> to choose which ports to show (uplink, OLT VLAN...).
          </div>
        ) : (
          <div className="row g-3">
            {selected.map((name) => {
              const data = series[name] ?? [];
              const last = data[data.length - 1];
              return (
                <div key={name} className="col-12 col-xl-6">
                  <div className="border rounded-3 p-2">
                    <div className="d-flex justify-content-between small mb-1">
                      <span className="fw-semibold">{name}</span>
                      <span className="text-muted">
                        <span style={{ color: "#16a34a" }}>RX {formatBps(last?.rx ?? 0)}</span> /{" "}
                        <span style={{ color: "#dc2626" }}>TX {formatBps(last?.tx ?? 0)}</span>
                      </span>
                    </div>
                    <div style={{ height: 150 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                          <XAxis dataKey="time" tick={{ fontSize: 9 }} minTickGap={30} />
                          <YAxis tick={{ fontSize: 9 }} width={62} tickFormatter={(v) => formatBps(Number(v))} />
                          <Tooltip formatter={(v) => formatBps(Number(v))} />
                          <Area type="monotone" dataKey="rx" name="RX" stroke="#16a34a" fill="#16a34a" fillOpacity={0.25} isAnimationActive={false} />
                          <Area type="monotone" dataKey="tx" name="TX" stroke="#dc2626" fill="#dc2626" fillOpacity={0.12} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPicker && (
        <div className="modal show d-block" style={{ background: "rgba(15,23,42,.5)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header">
                <h6 className="modal-title fw-bold">Dashboard interfaces</h6>
                <button className="btn-close" onClick={() => setShowPicker(false)} />
              </div>
              <div className="modal-body">
                <input
                  className="form-control form-control-sm mb-2"
                  placeholder="Search interface..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                />
                {pickerLoading && <div className="text-muted small">Reading interfaces from router...</div>}
                {available
                  .filter((i) => i.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                  .map((i) => (
                    <label key={i.name} className="d-flex align-items-center gap-2 py-1 border-bottom small" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={pickerChoice.includes(i.name)}
                        onChange={(e) =>
                          setPickerChoice((c) =>
                            e.target.checked ? [...c, i.name].slice(0, 12) : c.filter((x) => x !== i.name),
                          )
                        }
                      />
                      <span>{i.running ? "🟢" : "⚪"}</span>
                      <span className="fw-semibold">{i.name}</span>
                      <span className="text-muted">{i.type}</span>
                      {i.comment && <span className="text-muted text-truncate">— {i.comment}</span>}
                    </label>
                  ))}
                <div className="text-muted small mt-2">Up to 12 interfaces.</div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light border rounded-pill" onClick={() => setShowPicker(false)}>
                  Close
                </button>
                <button className="btn btn-brand rounded-pill px-4" disabled={saving} onClick={savePicker}>
                  {saving ? "Saving..." : "Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NasInterfaceGraphs;

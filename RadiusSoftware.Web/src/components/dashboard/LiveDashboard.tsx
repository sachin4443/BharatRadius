import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../services/api";
import { apiError, formatDate, formatMoney } from "../../utils/format";
import NasInterfaceGraphs from "./NasInterfaceGraphs";
import SubscriberListModal from "./SubscriberListModal";
import { RealtimeTrafficDashboard } from "../RealtimeTrafficDashboard";
import { RealtimePingDashboard } from "../RealtimePingDashboard";
import { LiveRadiusTerminal } from "../LiveRadiusTerminal";

// ---------------------------------------------------------------------------
// Widget catalogue
// ---------------------------------------------------------------------------

type Summary = Record<string, any>;

interface CardDef {
  id: string;
  title: string;
  icon: string;
  color: string;
  value: (s: Summary) => string | number;
  /** subscriber list filter opened on click */
  drill?: string;
  /** or navigate to a page */
  link?: string;
}

const CARDS: CardDef[] = [
  { id: "total", title: "Total Subscribers", icon: "👥", color: "#0ea5e9", value: (s) => s.totalSubscribers, drill: "all" },
  { id: "online", title: "Online Subscribers", icon: "📡", color: "#0d9488", value: (s) => s.online, drill: "online" },
  { id: "active", title: "Active Subscribers", icon: "✅", color: "#475569", value: (s) => s.active, drill: "active" },
  { id: "activeOffline", title: "Active but Offline", icon: "💤", color: "#64748b", value: (s) => s.activeOffline, drill: "offline" },
  { id: "expiringToday", title: "Expiring Today", icon: "⏳", color: "#f43f5e", value: (s) => s.expiringToday, drill: "expiring-today" },
  { id: "expiringTomorrow", title: "Expiring Tomorrow", icon: "📅", color: "#f97316", value: (s) => s.expiringTomorrow, drill: "expiring-tomorrow" },
  { id: "expiringWeek", title: "Expiring in 7 Days", icon: "🗓", color: "#d97706", value: (s) => s.expiringWeek, drill: "expiring-week" },
  { id: "expired", title: "Expired Subscribers", icon: "⛔", color: "#dc2626", value: (s) => s.expired, drill: "expired" },
  { id: "expiredThisMonth", title: "Expired This Month", icon: "📉", color: "#b91c1c", value: (s) => s.expiredThisMonth, drill: "expired-month" },
  { id: "pendingRecharge", title: "Pending Recharge", icon: "🔔", color: "#c2410c", value: (s) => s.pendingRecharge, drill: "expired" },
  { id: "suspended", title: "Suspended", icon: "🚫", color: "#a16207", value: (s) => s.suspended, drill: "suspended" },
  { id: "disabled", title: "Disabled", icon: "🔌", color: "#6b7280", value: (s) => s.disabled, drill: "disabled" },
  { id: "wrongPassword", title: "Wrong Password", icon: "🔑", color: "#7c3aed", value: (s) => s.wrongPassword, drill: "wrongpassword" },
  { id: "newThisMonth", title: "New This Month", icon: "🆕", color: "#2563eb", value: (s) => s.newThisMonth },
  { id: "siteBalance", title: "Site Balance", icon: "👛", color: "#9333ea", value: (s) => (s.siteBalance == null ? "—" : formatMoney(s.siteBalance)), link: "/transactions" },
  { id: "todayRecharge", title: "Today Recharges", icon: "⚡", color: "#16a34a", value: (s) => `${s.todayRechargeCount} • ${formatMoney(s.todayRechargeAmount)}`, link: "/reports" },
  { id: "yesterdayRecharge", title: "Yesterday Recharges", icon: "🧾", color: "#4d7c0f", value: (s) => `${s.yesterdayRechargeCount} • ${formatMoney(s.yesterdayRechargeAmount)}`, link: "/reports" },
  { id: "monthRecharge", title: "This Month Recharges", icon: "📊", color: "#15803d", value: (s) => `${s.monthRechargeCount} • ${formatMoney(s.monthRechargeAmount)}`, link: "/reports" },
  { id: "rejectsToday", title: "Login Rejects Today", icon: "🔒", color: "#be123c", value: (s) => s.rejectsToday, link: "/radius-auth-logs" },
];

const SECTIONS = [
  { id: "nasGraphs", title: "NAS Statistics (interface graphs)" },
  { id: "liveByNas", title: "Live users by NAS" },
  { id: "authLog", title: "RADIUS Auth Log" },
  { id: "expiringList", title: "Expiring this week (list)" },
  { id: "trafficMonitor", title: "Real-time traffic monitor" },
  { id: "pingMonitor", title: "Real-time ping monitor" },
  { id: "radiusTerminal", title: "Live RADIUS terminal" },
];

const defaultWidgets = (level: string): string[] => {
  const cards = CARDS.map((c) => c.id).filter((id) => !["activeOffline", "newThisMonth", "yesterdayRecharge"].includes(id));
  const sections = ["nasGraphs", "liveByNas", "authLog", "expiringList"];
  if (level === "L2") sections.push("trafficMonitor", "pingMonitor", "radiusTerminal");
  return [...cards, ...sections];
};

// ---------------------------------------------------------------------------

interface Props {
  level: string;
}

const LiveDashboard: React.FC<Props> = ({ level }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [widgets, setWidgets] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [drill, setDrill] = useState<{ title: string; status: string } | null>(null);
  const [now, setNow] = useState(new Date());

  const loadSummary = useCallback(() => {
    apiClient
      .get("/Dashboard/summary")
      .then((res) => {
        setSummary(res.data);
        setError("");
      })
      .catch((err) => setError(apiError(err, "Unable to load dashboard.")));
  }, []);

  useEffect(() => {
    loadSummary();
    apiClient
      .get("/Dashboard/config")
      .then((res) => setWidgets(res.data?.widgets ?? defaultWidgets(level)))
      .catch(() => setWidgets(defaultWidgets(level)));
    const t = window.setInterval(loadSummary, 30000);
    const c = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(c);
    };
  }, [level, loadSummary]);

  const has = (id: string) => (widgets ?? []).includes(id);
  const visibleCards = useMemo(() => CARDS.filter((c) => has(c.id)), [widgets]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-2">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="fw-bold mb-0">Dashboard</h5>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-success-subtle text-success-emphasis border">
            {now.toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button className="btn btn-sm btn-light border" onClick={() => setShowConfig(true)}>
            ⚙ Config
          </button>
        </div>
      </div>

      {error && <div className="alert alert-warning py-2 small">{error}</div>}

      {/* INFO BOXES */}
      <div className="row g-2 g-md-3 mb-3">
        {visibleCards.map((c) => (
          <div key={c.id} className="col-6 col-md-4 col-xl-3">
            <div
              role="button"
              className="rounded-4 text-white h-100 d-flex align-items-center gap-3 p-3 shadow-sm"
              style={{ background: c.color, cursor: c.drill || c.link ? "pointer" : "default", minHeight: 78 }}
              onClick={() => {
                if (c.drill) setDrill({ title: c.title, status: c.drill });
                else if (c.link) navigate(c.link);
              }}
            >
              <span className="d-none d-sm-inline" style={{ fontSize: 30, opacity: 0.9 }}>
                {c.icon}
              </span>
              <div className="min-w-0">
                <div className="text-uppercase fw-semibold text-truncate" style={{ fontSize: 11, opacity: 0.9 }}>
                  {c.title}
                </div>
                <div className="fw-bold text-truncate" style={{ fontSize: 22 }}>
                  {summary ? c.value(summary) ?? 0 : "…"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        {has("nasGraphs") && (
          <div className="col-12">
            <NasInterfaceGraphs />
          </div>
        )}
        {has("expiringList") && (
          <div className="col-12 col-xl-6">
            <ExpiringWidget onOpen={() => setDrill({ title: "Expiring in 7 Days", status: "expiring-week" })} />
          </div>
        )}
        {has("authLog") && (
          <div className="col-12 col-xl-6">
            <AuthLogWidget onOpen={() => navigate("/radius-auth-logs")} />
          </div>
        )}
        {has("liveByNas") && (
          <div className="col-12 col-xl-6">
            <LiveByNasWidget />
          </div>
        )}
        {has("trafficMonitor") && (
          <div className="col-12 col-xl-6">
            <RealtimeTrafficDashboard />
          </div>
        )}
        {has("pingMonitor") && (
          <div className="col-12 col-xl-6">
            <RealtimePingDashboard />
          </div>
        )}
        {has("radiusTerminal") && (
          <div className="col-12" style={{ overflow: "hidden" }}>
            <LiveRadiusTerminal />
          </div>
        )}
      </div>

      {drill && <SubscriberListModal title={drill.title} status={drill.status} onClose={() => { setDrill(null); loadSummary(); }} />}

      {showConfig && widgets && (
        <DashboardConfigModal
          selected={widgets}
          onClose={() => setShowConfig(false)}
          onSaved={(w) => {
            setWidgets(w);
            setShowConfig(false);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small widgets
// ---------------------------------------------------------------------------

const ExpiringWidget: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    apiClient
      .get("/Subscribers/paged", { params: { status: "expiring-week", pageSize: 8, sortBy: "expireDate", sortDir: "asc" } })
      .then((res) => {
        setRows(res.data?.items ?? []);
        setTotal(res.data?.total ?? 0);
      })
      .catch(() => undefined);
  }, []);
  return (
    <div className="card border-0 shadow-sm rounded-4 h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="fw-bold mb-0">🗓 Expiring this week ({total})</h6>
          <button className="btn btn-sm btn-light border" onClick={onOpen}>
            View all
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-sm small mb-0 align-middle">
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="text-muted text-center py-3">No subscriber expires in the next 7 days.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.pppoeUsername}</td>
                  <td className="d-none d-sm-table-cell">{r.fullName}</td>
                  <td className="d-none d-md-table-cell">{r.mobile}</td>
                  <td className="text-end text-nowrap">
                    <span className="badge bg-warning-subtle text-warning-emphasis border">{formatDate(r.expireDate, true)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AuthLogWidget: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const load = () =>
      apiClient
        .get("/Dashboard/auth-logs", { params: { pageSize: 8 } })
        .then((res) => setRows(res.data?.items ?? []))
        .catch(() => undefined);
    load();
    const t = window.setInterval(load, 20000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="card border-0 shadow-sm rounded-4 h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="fw-bold mb-0">🔐 RADIUS Auth Log</h6>
          <button className="btn btn-sm btn-light border" onClick={onOpen}>
            View all
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-sm small mb-0 align-middle">
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="text-muted text-center py-3">No login attempts yet.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.username}</td>
                  <td>
                    <span className={`badge ${r.result === "ACCEPT" ? "bg-success" : "bg-danger"}`}>
                      {r.result === "ACCEPT" ? "Accept" : "Reject"}
                    </span>
                  </td>
                  <td className="d-none d-sm-table-cell text-muted">{r.message}</td>
                  <td className="text-end text-nowrap text-muted">{formatDate(r.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const LiveByNasWidget: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const load = () => apiClient.get("/Dashboard/live-by-nas").then((res) => setRows(res.data ?? [])).catch(() => undefined);
    load();
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="card border-0 shadow-sm rounded-4 h-100">
      <div className="card-body">
        <h6 className="fw-bold mb-2">📶 Live by NAS</h6>
        <table className="table table-sm small mb-0">
          <thead className="table-light">
            <tr>
              <th>NAS</th>
              <th className="text-end">Live users</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="text-muted text-center py-3">
                  No NAS added.
                </td>
              </tr>
            )}
            {rows.map((n) => (
              <tr key={n.id}>
                <td>
                  {n.nasName} <span className="text-muted">({n.nasIpAddress})</span>
                </td>
                <td className="text-end fw-semibold">{n.liveUsers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Config modal
// ---------------------------------------------------------------------------

const DashboardConfigModal: React.FC<{
  selected: string[];
  onClose: () => void;
  onSaved: (widgets: string[]) => void;
}> = ({ selected, onClose, onSaved }) => {
  const [choice, setChoice] = useState<string[]>(selected);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string, on: boolean) => setChoice((c) => (on ? [...c, id] : c.filter((x) => x !== id)));
  const allCards = CARDS.every((c) => choice.includes(c.id));
  const allSections = SECTIONS.every((c) => choice.includes(c.id));

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put("/Dashboard/config", { widgets: choice });
      onSaved(res.data?.widgets ?? choice);
    } catch (err) {
      alert(apiError(err, "Unable to save dashboard settings."));
    } finally {
      setSaving(false);
    }
  };

  const Group = ({ title, items, all }: { title: string; items: { id: string; title: string }[]; all: boolean }) => (
    <>
      <div className="d-flex justify-content-between align-items-center border-bottom pb-1 mb-2 mt-2">
        <h6 className="fw-bold mb-0">{title}</h6>
        <label className="small d-flex align-items-center gap-1">
          <input
            type="checkbox"
            className="form-check-input mt-0"
            checked={all}
            onChange={(e) =>
              setChoice((c) =>
                e.target.checked
                  ? Array.from(new Set([...c, ...items.map((i) => i.id)]))
                  : c.filter((x) => !items.some((i) => i.id === x)),
              )
            }
          />
          Select All
        </label>
      </div>
      <div className="row g-2 mb-2">
        {items.map((i) => (
          <div key={i.id} className="col-12 col-sm-6 col-lg-4">
            <label className="d-flex align-items-center gap-2 small" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                className="form-check-input mt-0"
                checked={choice.includes(i.id)}
                onChange={(e) => toggle(i.id, e.target.checked)}
              />
              {i.title}
            </label>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="modal show d-block" style={{ background: "rgba(15,23,42,.5)", zIndex: 1060 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
        <div className="modal-content border-0 rounded-4">
          <div className="modal-header">
            <h6 className="modal-title fw-bold">⚙ Dashboard Config</h6>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <Group title="Info-Box" items={CARDS} all={allCards} />
            <Group title="Sections" items={SECTIONS} all={allSections} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-light border rounded-pill" onClick={onClose}>
              Close
            </button>
            <button className="btn btn-brand rounded-pill px-4" disabled={saving} onClick={save}>
              {saving ? "Saving..." : "Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveDashboard;

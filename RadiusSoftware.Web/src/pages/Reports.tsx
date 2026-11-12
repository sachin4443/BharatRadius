import React, { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import apiClient from "../services/api";
import SubscriberListModal from "../components/dashboard/SubscriberListModal";
import { apiError, formatDate, formatMoney, saveBlob } from "../utils/format";

type Tab = "overview" | "recharges" | "packages";

const isoDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const presets = () => {
  const now = new Date();
  const today = isoDate(now);
  const first = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastMonthStart = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = isoDate(new Date(now.getFullYear(), now.getMonth(), 0));
  const yearStart = isoDate(new Date(now.getFullYear(), 0, 1));
  return [
    { label: "Today", from: today, to: today, groupBy: "day" },
    { label: "This Month", from: first, to: today, groupBy: "day" },
    { label: "Last Month", from: lastMonthStart, to: lastMonthEnd, groupBy: "day" },
    { label: "This Year", from: yearStart, to: today, groupBy: "month" },
  ];
};

/**
 * Reports: expired users, recharge count / amount, pending recharges,
 * day-wise and month-wise breakdown, recharge list and package-wise sales.
 */
const Reports: React.FC = () => {
  const p = presets();
  const [tab, setTab] = useState<Tab>("overview");
  const [from, setFrom] = useState(p[1].from);
  const [to, setTo] = useState(p[1].to);
  const [groupBy, setGroupBy] = useState("day");
  const [overview, setOverview] = useState<any | null>(null);
  const [recharges, setRecharges] = useState<any | null>(null);
  const [packages, setPackages] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drill, setDrill] = useState<{ title: string; status: string } | null>(null);

  const params = { from, to, groupBy };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") {
        const res = await apiClient.get("/Reports/overview", { params });
        setOverview(res.data);
      } else if (tab === "recharges") {
        const res = await apiClient.get("/Reports/recharges", {
          params: { from, to, search: search || undefined, page, pageSize: 50 },
        });
        setRecharges(res.data);
      } else {
        const res = await apiClient.get("/Reports/package-sales", { params: { from, to } });
        setPackages(res.data);
      }
    } catch (err) {
      setError(apiError(err, "Unable to load report."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(load, tab === "recharges" && search ? 350 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, from, to, groupBy, page, search]);

  const exportRecharges = async () => {
    try {
      const res = await apiClient.get("/Reports/recharges", {
        params: { from, to, search: search || undefined, csv: true },
        responseType: "blob",
      });
      saveBlob(res.data, `recharges-${from}-to-${to}.csv`);
    } catch (err) {
      alert(apiError(err, "Export failed."));
    }
  };

  const t = overview?.totals;

  return (
    <div className="container-fluid py-2 px-0 px-md-3">
      <div className="bg-white border rounded-4 shadow-sm p-3 p-md-4 mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h4 className="fw-bold text-brand mb-1">📈 Reports</h4>
            <div className="small text-muted">Recharges, expired users and pending renewals (India time).</div>
          </div>
          <div className="d-flex flex-wrap gap-1">
            {p.map((x) => (
              <button
                key={x.label}
                className={`btn btn-sm rounded-pill ${from === x.from && to === x.to ? "btn-brand" : "btn-light border"}`}
                onClick={() => {
                  setFrom(x.from);
                  setTo(x.to);
                  setGroupBy(x.groupBy);
                  setPage(1);
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="row g-2 mt-2">
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">From</label>
            <input type="date" className="form-control form-control-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">To</label>
            <input type="date" className="form-control form-control-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          {tab === "overview" && (
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Group by</label>
              <select className="form-select form-select-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <option value="day">Day-wise</option>
                <option value="month">Month-wise</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <ul className="nav nav-pills mb-3 gap-1 flex-nowrap overflow-auto">
        {([
          ["overview", "Summary"],
          ["recharges", "Recharge List"],
          ["packages", "Package-wise Sales"],
        ] as [Tab, string][]).map(([k, label]) => (
          <li key={k} className="nav-item">
            <button className={`nav-link text-nowrap ${tab === k ? "active" : ""}`} onClick={() => { setTab(k); setPage(1); }}>
              {label}
            </button>
          </li>
        ))}
      </ul>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {loading && <div className="text-muted small mb-2">Loading...</div>}

      {tab === "overview" && overview && (
        <>
          <div className="row g-2 g-md-3 mb-3">
            <Stat title="Recharges" value={t.rechargeCount} sub={formatMoney(t.rechargeAmount)} color="#16a34a" />
            <Stat title="Users Recharged" value={t.uniqueSubscribersRecharged} color="#0d9488" />
            <Stat title="Expired (in period)" value={t.expiredCount} color="#dc2626"
              onClick={() => setDrill({ title: "Expired this month", status: "expired-month" })} />
            <Stat title="Pending Recharges" value={t.pendingRecharges} sub={`${t.expiredNotRenewed} expired + ${t.expiringNext7Days} expiring`} color="#c2410c"
              onClick={() => setDrill({ title: "Expired – not renewed", status: "expired" })} />
            <Stat title="Expiring next 7 days" value={t.expiringNext7Days} color="#d97706"
              onClick={() => setDrill({ title: "Expiring in 7 days", status: "expiring-week" })} />
            <Stat title="New Subscribers" value={t.newSubscribers} color="#2563eb" />
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body">
              <h6 className="fw-bold">{overview.groupBy === "month" ? "Month-wise" : "Day-wise"}</h6>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="rechargeCount" name="Recharges" fill="#16a34a" />
                    <Bar dataKey="expiredCount" name="Expired" fill="#dc2626" />
                    <Bar dataKey="newSubscribers" name="New" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="table-responsive mt-3" style={{ maxHeight: 420 }}>
                <table className="table table-sm table-hover small mb-0">
                  <thead className="table-light" style={{ position: "sticky", top: 0 }}>
                    <tr>
                      <th>{overview.groupBy === "month" ? "Month" : "Date"}</th>
                      <th className="text-end">Recharges</th>
                      <th className="text-end">Amount</th>
                      <th className="text-end">Expired</th>
                      <th className="text-end">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...overview.rows].reverse().map((r: any) => (
                      <tr key={r.period}>
                        <td>{r.period}</td>
                        <td className="text-end">{r.rechargeCount}</td>
                        <td className="text-end">{formatMoney(r.rechargeAmount)}</td>
                        <td className={`text-end ${r.expiredCount ? "text-danger fw-semibold" : ""}`}>{r.expiredCount}</td>
                        <td className="text-end">{r.newSubscribers}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light fw-semibold">
                    <tr>
                      <td>Total</td>
                      <td className="text-end">{t.rechargeCount}</td>
                      <td className="text-end">{formatMoney(t.rechargeAmount)}</td>
                      <td className="text-end">{t.expiredCount}</td>
                      <td className="text-end">{t.newSubscribers}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "recharges" && recharges && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div className="small">
                <b>{recharges.total}</b> recharges • <b>{formatMoney(recharges.totalAmount)}</b>
              </div>
              <div className="d-flex gap-2">
                <input className="form-control form-control-sm" style={{ maxWidth: 220 }} placeholder="Search user / mobile"
                  value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                <button className="btn btn-sm btn-light border text-nowrap" onClick={exportRecharges}>⬇ Export</button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm table-hover small align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Username</th>
                    <th className="d-none d-md-table-cell">Name</th>
                    <th>Package</th>
                    <th className="text-end">Amount</th>
                    <th>Start</th>
                    <th>End</th>
                    <th className="d-none d-lg-table-cell">Type</th>
                    <th className="d-none d-lg-table-cell">By</th>
                  </tr>
                </thead>
                <tbody>
                  {recharges.items.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-muted py-4">No recharges in this period.</td></tr>
                  )}
                  {recharges.items.map((r: any) => (
                    <tr key={r.id}>
                      <td className="text-nowrap">{formatDate(r.createdAt, true)}</td>
                      <td className="fw-semibold">{r.username}</td>
                      <td className="d-none d-md-table-cell">{r.fullName}</td>
                      <td>{r.packageName}{r.quantity > 1 ? ` ×${r.quantity}` : ""}</td>
                      <td className="text-end">{formatMoney(r.amount)}</td>
                      <td className="text-nowrap">{formatDate(r.startDate)}</td>
                      <td className="text-nowrap">{formatDate(r.endDate)}</td>
                      <td className="d-none d-lg-table-cell">{r.action}</td>
                      <td className="d-none d-lg-table-cell">{r.createdByName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recharges.total > recharges.pageSize && (
              <div className="d-flex justify-content-end gap-2 mt-2">
                <button className="btn btn-sm btn-light border" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
                <button className="btn btn-sm btn-light border" disabled={page * recharges.pageSize >= recharges.total} onClick={() => setPage(page + 1)}>Next ›</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "packages" && packages && (
        <div className="row g-3">
          <div className="col-12 col-lg-7">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body">
                <h6 className="fw-bold">Sales by package</h6>
                <table className="table table-sm small mb-0">
                  <thead className="table-light">
                    <tr><th>Package</th><th className="text-end">Recharges</th><th className="text-end">Periods</th><th className="text-end">Amount</th></tr>
                  </thead>
                  <tbody>
                    {packages.rows.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-3">No sales in this period.</td></tr>}
                    {packages.rows.map((r: any) => (
                      <tr key={r.packageName}>
                        <td>{r.packageName}</td>
                        <td className="text-end">{r.count}</td>
                        <td className="text-end">{r.quantity}</td>
                        <td className="text-end">{formatMoney(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body">
                <h6 className="fw-bold">Active subscribers per package (now)</h6>
                <table className="table table-sm small mb-0">
                  <tbody>
                    {packages.activePerPackage.map((r: any) => (
                      <tr key={r.packageName}>
                        <td>{r.packageName}</td>
                        <td className="text-end fw-semibold">{r.activeSubscribers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {drill && <SubscriberListModal title={drill.title} status={drill.status} onClose={() => setDrill(null)} />}
    </div>
  );
};

const Stat = ({ title, value, sub, color, onClick }: { title: string; value: number; sub?: string; color: string; onClick?: () => void }) => (
  <div className="col-6 col-md-4 col-xl-2">
    <div
      className="bg-white border rounded-4 p-3 h-100 shadow-sm"
      role={onClick ? "button" : undefined}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", borderLeft: `4px solid ${color}` }}
    >
      <div className="small text-muted text-truncate">{title}</div>
      <div className="fw-bold" style={{ fontSize: 24, color }}>{value}</div>
      {sub && <div className="small text-muted text-truncate">{sub}</div>}
    </div>
  </div>
);

export default Reports;

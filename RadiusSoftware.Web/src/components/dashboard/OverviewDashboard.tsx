import React, { useState } from "react";
import apiClient from "../../services/api";
import { apiError, formatDate, formatMoney } from "../../utils/format";
import { usePolling } from "../../hooks/usePolling";

interface Props {
  /** "L0" = super admin (companies), otherwise sites of the company */
  level: string;
}

/**
 * Real overview from /Dashboard/overview (no dummy numbers):
 *  - Super admin  : every company (L1) with sites, subscribers, live users, NAS
 *  - Company admin: every site of the company with the same counters
 */
const OverviewDashboard: React.FC<Props> = ({ level }) => {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  usePolling(
    () =>
      apiClient
        .get("/Dashboard/overview")
        .then((res) => {
          setData(res.data);
          setError("");
        })
        .catch((err) => setError(apiError(err, "Unable to load overview."))),
    60000,
  );

  const isSuper = level === "L0";
  const t = data?.totals;
  const rs = data?.radiusServer;
  const term = search.trim().toLowerCase();

  const companies: any[] = (data?.companies ?? []).filter(
    (c: any) => !term || `${c.name} ${c.code} ${c.adminUsername ?? ""}`.toLowerCase().includes(term),
  );
  const sites: any[] = (data?.sites ?? []).filter(
    (s: any) => !term || `${s.siteName} ${s.companyName} ${s.adminUsername ?? ""}`.toLowerCase().includes(term),
  );

  const lastPacketAgo = rs?.lastPacketAt ? Math.round((Date.now() - new Date(rs.lastPacketAt).getTime()) / 1000) : null;

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h5 className="fw-bold mb-0">{isSuper ? "👑 Platform Overview" : "🏢 Company Overview"}</h5>
            <div className="small text-muted">
              {isSuper ? "All companies (L1) and their sites." : "All sites of your company."} Updated {formatDate(data?.generatedAt, true)}
            </div>
          </div>
          {isSuper && rs && (
            <span
              className={`badge px-3 py-2 ${rs.running ? "bg-success-subtle text-success-emphasis border border-success-subtle" : "bg-secondary-subtle text-secondary-emphasis border"}`}
              title={rs.running ? `UDP ${rs.authPort}/${rs.acctPort} • ${rs.packetsReceived} packets` : "RADIUS server is not running in this API instance"}
            >
              {rs.running
                ? `🟢 RADIUS server running • last packet ${lastPacketAgo === null ? "—" : `${lastPacketAgo}s ago`}`
                : "⚪ RADIUS server not running here"}
            </span>
          )}
        </div>

        {error && <div className="alert alert-warning py-2 small">{error}</div>}

        <div className="row g-2 mb-3">
          {isSuper && <Mini title="Companies (L1)" value={t?.companies ?? "…"} color="#7c3aed" />}
          <Mini title="Sites" value={t?.sites ?? "…"} sub={(t?.sitesByLevel ?? []).map((l: any) => `L${l.level}: ${l.count}`).join(" • ")} color="#0ea5e9" />
          <Mini title="Subscribers" value={t?.subscribers ?? "…"} color="#475569" />
          <Mini title="Online now (RADIUS)" value={t?.online ?? "…"} color="#0d9488" />
          <Mini title="Expired" value={t?.expired ?? "…"} color="#dc2626" />
          <Mini title="NAS online" value={t ? `${t.nasOnline} / ${t.nas}` : "…"} color="#2563eb" />
          <Mini title="This month recharge" value={t ? formatMoney(t.monthRechargeAmount) : "…"} color="#16a34a" />
        </div>

        <input
          className="form-control form-control-sm mb-2"
          style={{ maxWidth: 320 }}
          placeholder={isSuper ? "Search company..." : "Search site..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="table-responsive" style={{ maxHeight: 420 }}>
          {isSuper ? (
            <table className="table table-sm table-hover small align-middle mb-0">
              <thead className="table-light" style={{ position: "sticky", top: 0 }}>
                <tr>
                  <th>Company</th>
                  <th className="d-none d-md-table-cell">Admin</th>
                  <th className="text-end">L1 sites</th>
                  <th className="text-end">All sites</th>
                  <th className="text-end">Subscribers</th>
                  <th className="text-end">Online</th>
                  <th className="text-end d-none d-md-table-cell">Expired</th>
                  <th className="text-end d-none d-lg-table-cell">NAS</th>
                  <th className="text-end d-none d-lg-table-cell">Month ₹</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted py-3">
                      {data ? "No company found." : "Loading..."}
                    </td>
                  </tr>
                )}
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="fw-semibold">{c.name}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{c.code}</div>
                    </td>
                    <td className="d-none d-md-table-cell">{c.adminUsername || "—"}</td>
                    <td className="text-end">{c.l1Sites}</td>
                    <td className="text-end">{c.totalSites}</td>
                    <td className="text-end fw-semibold">{c.subscribers}</td>
                    <td className="text-end text-success fw-semibold">{c.online}</td>
                    <td className="text-end d-none d-md-table-cell text-danger">{c.expired}</td>
                    <td className="text-end d-none d-lg-table-cell">{c.nasOnline}/{c.nas}</td>
                    <td className="text-end d-none d-lg-table-cell">{formatMoney(c.monthRechargeAmount)}</td>
                    <td>
                      <span className={`badge ${c.isActive ? "bg-success" : "bg-danger"}`}>{c.isActive ? "Active" : "Inactive"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="table table-sm table-hover small align-middle mb-0">
              <thead className="table-light" style={{ position: "sticky", top: 0 }}>
                <tr>
                  <th>Site</th>
                  <th>Level</th>
                  <th className="d-none d-md-table-cell">Admin</th>
                  <th className="text-end">Subscribers</th>
                  <th className="text-end">Online</th>
                  <th className="text-end d-none d-md-table-cell">Expired</th>
                  <th className="text-end d-none d-lg-table-cell">NAS</th>
                  <th className="text-end d-none d-md-table-cell">Wallet</th>
                  <th className="text-end d-none d-lg-table-cell">Month ₹</th>
                </tr>
              </thead>
              <tbody>
                {sites.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-3">
                      {data ? "No site found." : "Loading..."}
                    </td>
                  </tr>
                )}
                {sites.map((s) => (
                  <tr key={s.id} className={s.isActive ? "" : "table-secondary"}>
                    <td>
                      <div className="fw-semibold">{s.siteName}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{s.companyName}</div>
                    </td>
                    <td><span className="badge bg-light text-dark border">L{s.level}</span></td>
                    <td className="d-none d-md-table-cell">{s.adminUsername || "—"}</td>
                    <td className="text-end fw-semibold">{s.subscribers}</td>
                    <td className="text-end text-success fw-semibold">{s.online}</td>
                    <td className="text-end d-none d-md-table-cell text-danger">{s.expired}</td>
                    <td className="text-end d-none d-lg-table-cell">{s.nasOnline}/{s.nas}</td>
                    <td className="text-end d-none d-md-table-cell">{s.walletBalance == null ? "—" : formatMoney(s.walletBalance)}</td>
                    <td className="text-end d-none d-lg-table-cell">{formatMoney(s.monthRechargeAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const Mini = ({ title, value, sub, color }: { title: string; value: React.ReactNode; sub?: string; color: string }) => (
  <div className="col-6 col-md-4 col-xl">
    <div className="border rounded-3 p-2 h-100" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="text-muted text-truncate" style={{ fontSize: 11 }}>{title}</div>
      <div className="fw-bold" style={{ fontSize: 20, color }}>{value}</div>
      {sub && <div className="text-muted text-truncate" style={{ fontSize: 10 }}>{sub}</div>}
    </div>
  </div>
);

export default OverviewDashboard;

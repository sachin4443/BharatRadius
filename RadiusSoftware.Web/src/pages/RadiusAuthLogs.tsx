import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/api";
import { apiError, formatDate } from "../utils/format";

/** RADIUS authentication log: every PPPoE login attempt with the accept / reject reason. */
const RadiusAuthLogs: React.FC = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(true);
  const pageSize = 50;

  const load = () => {
    setLoading(true);
    apiClient
      .get("/Dashboard/auth-logs", {
        params: {
          result: result || undefined,
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          pageSize,
        },
      })
      .then((res) => {
        setData(res.data);
        setError("");
      })
      .catch((err) => setError(apiError(err, "Unable to load auth log.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = window.setTimeout(load, search ? 350 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, search, from, to, page]);

  useEffect(() => {
    if (!auto || page !== 1) return;
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, page, result, search, from, to]);

  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="container-fluid py-2 px-0 px-md-3">
      <div className="bg-white border rounded-4 shadow-sm p-3 p-md-4 mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h4 className="fw-bold text-brand mb-1">🔐 RADIUS Authentication</h4>
            <div className="small text-muted">Every PPPoE login attempt and why it was accepted or rejected.</div>
          </div>
          <div className="d-flex gap-2">
            <span className="badge bg-success px-3 py-2">Today accepted: {data?.todayAccept ?? 0}</span>
            <span className="badge bg-danger px-3 py-2">Today rejected: {data?.todayReject ?? 0}</span>
          </div>
        </div>
        <div className="row g-2 mt-2">
          <div className="col-12 col-md-4">
            <input className="form-control form-control-sm" placeholder="Search username, name, MAC, reason..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="col-4 col-md-2">
            <select className="form-select form-select-sm" value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="ACCEPT">Accept</option>
              <option value="REJECT">Reject</option>
            </select>
          </div>
          <div className="col-4 col-md-2">
            <input type="date" className="form-control form-control-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="col-4 col-md-2">
            <input type="date" className="form-control form-control-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div className="col-12 col-md-2 d-flex align-items-center">
            <label className="small d-flex align-items-center gap-2">
              <input type="checkbox" className="form-check-input mt-0" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Auto refresh
            </label>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-sm table-hover small align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th className="d-none d-md-table-cell">MAC</th>
                  <th className="d-none d-lg-table-cell">NAS</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">Loading...</td></tr>
                )}
                {data?.items?.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No records.</td></tr>
                )}
                {data?.items?.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      {r.subscriberId ? (
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/subscribers/${r.subscriberId}`); }}>
                          {r.username}
                        </a>
                      ) : (
                        r.username
                      )}
                      {r.fullName && <div className="text-muted" style={{ fontSize: 11 }}>{r.fullName}</div>}
                    </td>
                    <td>
                      <span className={`badge ${r.result === "ACCEPT" ? "bg-success" : "bg-danger"}`}>
                        {r.result === "ACCEPT" ? "Accept" : "Reject"}
                      </span>
                    </td>
                    <td>{r.message}</td>
                    <td className="d-none d-md-table-cell font-monospace">{r.macAddress || "—"}</td>
                    <td className="d-none d-lg-table-cell">{r.nasName || r.nasIpAddress}</td>
                    <td className="text-nowrap">{formatDate(r.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <small className="text-muted">Page {page} of {pages} • {data?.total} records</small>
              <div className="btn-group btn-group-sm">
                <button className="btn btn-light border" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
                <button className="btn btn-light border" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RadiusAuthLogs;

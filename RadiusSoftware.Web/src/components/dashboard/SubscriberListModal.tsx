import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../services/api";
import RechargeModal from "../subscriber/RechargeModal";
import SubscriberStatusBadge from "../subscriber/SubscriberStatusBadge";
import { apiError, daysUntil, formatDate } from "../../utils/format";

interface Props {
  title: string;
  /** status filter for /Subscribers/paged, e.g. "expiring-week" */
  status: string;
  onClose: () => void;
}

/** Drill-down list opened from a dashboard card (e.g. users expiring this week). */
const SubscriberListModal: React.FC<Props> = ({ title, status, onClose }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rechargeFor, setRechargeFor] = useState<any | null>(null);
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    apiClient
      .get("/Subscribers/paged", {
        params: {
          status,
          page,
          pageSize,
          search: search || undefined,
          sortBy: status.startsWith("expir") ? "expireDate" : undefined,
          sortDir: status === "expired" || status === "expired-month" ? "desc" : "asc",
        },
      })
      .then((res) => {
        setRows(res.data?.items ?? []);
        setTotal(res.data?.total ?? 0);
        setError("");
      })
      .catch((err) => setError(apiError(err, "Unable to load subscribers.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = window.setTimeout(load, search ? 350 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, search]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(15,23,42,.5)", zIndex: 1050 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable modal-fullscreen-md-down">
        <div className="modal-content border-0 rounded-4">
          <div className="modal-header">
            <h6 className="modal-title fw-bold">
              {title} <span className="badge bg-light text-dark border ms-1">{total}</span>
            </h6>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <input
              className="form-control form-control-sm mb-3"
              placeholder="Search name, username, mobile..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle small mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Username</th>
                    <th>Name</th>
                    <th className="d-none d-md-table-cell">Mobile</th>
                    <th className="d-none d-md-table-cell">Package</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        No subscribers.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const expired = r.expireDate && new Date(r.expireDate).getTime() <= Date.now();
                      const d = daysUntil(r.expireDate);
                      return (
                        <tr key={r.id} className={expired ? "table-danger" : d !== null && d <= 3 ? "table-warning" : ""}>
                          <td>
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/subscribers/${r.id}`);
                              }}
                            >
                              {r.pppoeUsername}
                            </a>
                          </td>
                          <td>{r.fullName}</td>
                          <td className="d-none d-md-table-cell">{r.mobile}</td>
                          <td className="d-none d-md-table-cell">{r.packageName || "—"}</td>
                          <td className="text-nowrap">{formatDate(r.expireDate, true)}</td>
                          <td>
                            <SubscriberStatusBadge subscriber={r} />
                          </td>
                          <td className="text-end">
                            <button className="btn btn-sm btn-brand rounded-pill px-3" onClick={() => setRechargeFor(r)}>
                              ⚡ Recharge
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {pages > 1 && (
            <div className="modal-footer justify-content-between">
              <small className="text-muted">
                Page {page} of {pages}
              </small>
              <div className="btn-group btn-group-sm">
                <button className="btn btn-light border" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ‹ Prev
                </button>
                <button className="btn btn-light border" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  Next ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {rechargeFor && (
        <RechargeModal subscriber={rechargeFor} onClose={() => setRechargeFor(null)} onDone={load} />
      )}
    </div>
  );
};

export default SubscriberListModal;

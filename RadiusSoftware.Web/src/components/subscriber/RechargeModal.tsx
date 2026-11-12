import React, { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/api";
import { apiError, formatDate, formatMoney } from "../../utils/format";

interface Props {
  subscriber: {
    id: string;
    siteId?: string;
    fullName?: string;
    pppoeUsername?: string;
    ppPoEUsername?: string;
    packageId?: string | null;
    packageName?: string | null;
    expireDate?: string | null;
  };
  onClose: () => void;
  onDone?: () => void;
}

interface PackageItem {
  id: string;
  siteId?: string;
  packageName: string;
  downloadMbps?: number;
  uploadMbps?: number;
  price?: number;
  expiryDays?: number;
  validityType?: string;
  isActive?: boolean;
}

interface Preview {
  packageName: string;
  downloadMbps: number;
  uploadMbps: number;
  price: number;
  validity: string;
  quantity: number;
  startDate: string;
  endDate: string;
  amount: number;
  walletBalance: number;
  balanceAfter: number;
  sufficientBalance: boolean;
}

/**
 * Recharge / renew / change package popup.
 * Shows start & end date and the amount that will be deducted from the wallet
 * before the operator confirms.
 */
const RechargeModal: React.FC<Props> = ({ subscriber, onClose, onDone }) => {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [packageId, setPackageId] = useState<string>(subscriber.packageId || "");
  const [quantity, setQuantity] = useState(1);
  const [startFrom, setStartFrom] = useState<"auto" | "now">("auto");
  const [comment, setComment] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const username = subscriber.pppoeUsername || subscriber.ppPoEUsername || "";

  useEffect(() => {
    apiClient
      .get("/Packages/list")
      .then((res) => {
        const list: PackageItem[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
        const mine = list.filter(
          (p) => p.isActive !== false && (!subscriber.siteId || String(p.siteId) === String(subscriber.siteId))
        );
        setPackages(mine);
        if (!packageId && mine.length > 0) setPackageId(mine[0].id);
      })
      .catch((err) => setError(apiError(err, "Unable to load packages.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!packageId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    setError("");
    apiClient
      .get(`/Recharge/${subscriber.id}/preview`, {
        params: { packageId, quantity, startFrom },
      })
      .then((res) => !cancelled && setPreview(res.data))
      .catch((err) => !cancelled && setError(apiError(err, "Unable to calculate recharge.")))
      .finally(() => !cancelled && setLoadingPreview(false));
    return () => {
      cancelled = true;
    };
  }, [packageId, quantity, startFrom, subscriber.id]);

  const selected = useMemo(() => packages.find((p) => p.id === packageId), [packages, packageId]);

  const handleRecharge = async () => {
    if (!packageId || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiClient.post(`/Recharge/${subscriber.id}`, {
        packageId,
        quantity,
        startFrom,
        comment,
      });
      setSuccess(res.data?.message || "Recharge successful.");
      onDone?.();
    } catch (err) {
      setError(apiError(err, "Recharge failed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(15,23,42,.5)", zIndex: 1060 }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-sm-down">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">⚡ Recharge</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
          </div>

          <div className="modal-body">
            {success ? (
              <div className="text-center py-4">
                <div style={{ fontSize: 48 }}>✅</div>
                <div className="fw-semibold mt-2">{success}</div>
                <button className="btn btn-brand rounded-pill px-4 mt-3" onClick={onClose}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="row g-2 small mb-3">
                  <div className="col-6 col-md-4">
                    <div className="text-muted">Username</div>
                    <div className="fw-semibold text-break">{username || "—"}</div>
                  </div>
                  <div className="col-6 col-md-4">
                    <div className="text-muted">Current Package</div>
                    <div className="fw-semibold">{subscriber.packageName || "—"}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="text-muted">Current Expiry</div>
                    <div className="fw-semibold">{formatDate(subscriber.expireDate, true)}</div>
                  </div>
                </div>

                <label className="form-label fw-semibold">Package</label>
                <select
                  className="form-select mb-3"
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                >
                  {packages.length === 0 && <option value="">No package available</option>}
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.packageName} — {formatMoney(p.price)}
                    </option>
                  ))}
                </select>

                {selected && (
                  <div className="table-responsive mb-3">
                    <table className="table table-sm table-bordered mb-0 text-center small">
                      <thead className="table-light">
                        <tr>
                          <th>Speed</th>
                          <th>Validity</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            {selected.downloadMbps} / {selected.uploadMbps} Mbps
                          </td>
                          <td>
                            {selected.expiryDays} {selected.validityType || "Days"}
                          </td>
                          <td>{formatMoney(selected.price)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="row g-3 align-items-end mb-3">
                  <div className="col-12 col-md-5">
                    <label className="form-label fw-semibold">Quantity</label>
                    <div className="input-group">
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      >
                        −
                      </button>
                      <input
                        className="form-control text-center"
                        type="number"
                        min={1}
                        max={36}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.min(36, Math.max(1, Number(e.target.value) || 1)))}
                      />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(36, q + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="col-12 col-md-7">
                    <label className="form-label fw-semibold">Start from</label>
                    <select
                      className="form-select"
                      value={startFrom}
                      onChange={(e) => setStartFrom(e.target.value as "auto" | "now")}
                    >
                      <option value="auto">Auto (same plan running → after current expiry)</option>
                      <option value="now">Now</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-3 border p-3 mb-3" style={{ background: "#f8fafc" }}>
                  {loadingPreview || !preview ? (
                    <div className="text-muted small">{loadingPreview ? "Calculating..." : "Select a package."}</div>
                  ) : (
                    <div className="d-flex flex-wrap gap-3 small">
                      <div>
                        Start Date:{" "}
                        <span className="badge bg-success-subtle text-success-emphasis border">
                          {formatDate(preview.startDate)}
                        </span>
                      </div>
                      <div>
                        End Date:{" "}
                        <span className="badge bg-warning-subtle text-warning-emphasis border">
                          {formatDate(preview.endDate)}
                        </span>
                      </div>
                      <div>
                        Deductible Amount:{" "}
                        <span className="badge bg-danger-subtle text-danger-emphasis border">
                          {formatMoney(preview.amount)}
                        </span>
                      </div>
                      <div>
                        Wallet:{" "}
                        <span className={preview.sufficientBalance ? "fw-semibold" : "fw-semibold text-danger"}>
                          {formatMoney(preview.walletBalance)}
                        </span>{" "}
                        → {formatMoney(preview.balanceAfter)}
                      </div>
                    </div>
                  )}
                </div>

                <input
                  className="form-control mb-2"
                  placeholder="Comment (optional)"
                  value={comment}
                  maxLength={300}
                  onChange={(e) => setComment(e.target.value)}
                />

                {preview && !preview.sufficientBalance && (
                  <div className="alert alert-warning py-2 small mb-2">
                    Wallet balance is not enough for this recharge.
                  </div>
                )}
                {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
              </>
            )}
          </div>

          {!success && (
            <div className="modal-footer border-0 pt-0">
              <button className="btn btn-light border rounded-pill px-4" onClick={onClose} disabled={saving}>
                Close
              </button>
              <button
                className="btn btn-brand rounded-pill px-4 fw-semibold"
                onClick={handleRecharge}
                disabled={saving || loadingPreview || !preview || !preview.sufficientBalance}
              >
                {saving ? "Processing..." : "⚡ Recharge"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RechargeModal;

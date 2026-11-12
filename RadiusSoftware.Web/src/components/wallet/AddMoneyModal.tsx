import React, { useEffect, useState } from "react";
import apiClient from "../../services/api";
import { apiError, formatMoney } from "../../utils/format";

interface Props {
  onClose: () => void;
  /** called after money was added (new balance) */
  onDone?: (balance: number) => void;
  /** prefill, e.g. the shortfall for a recharge */
  suggestedAmount?: number;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let checkoutLoader: Promise<void> | null = null;

/** Loads Razorpay Checkout once, only when somebody actually wants to pay. */
const loadCheckout = () => {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutLoader) {
    checkoutLoader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        checkoutLoader = null;
        reject(new Error("Could not load the payment window. Please check your internet connection."));
      };
      document.body.appendChild(script);
    });
  }
  return checkoutLoader;
};

const PRESETS = [500, 1000, 2000, 5000, 10000];

/**
 * "Add Money" to the logged-in site's wallet through Razorpay
 * (UPI, debit / ATM card, credit card, net banking, wallets).
 * The wallet is credited by the server only after Razorpay confirms the payment.
 */
const AddMoneyModal: React.FC<Props> = ({ onClose, onDone, suggestedAmount }) => {
  const [options, setOptions] = useState<any | null>(null);
  const [amount, setAmount] = useState<string>(suggestedAmount ? String(Math.ceil(suggestedAmount)) : "1000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [pending, setPending] = useState<{ topupId: string } | null>(null);

  useEffect(() => {
    apiClient
      .get("/WalletTopup/options")
      .then((res) => setOptions(res.data))
      .catch((err) => setError(apiError(err, "Unable to load payment options.")));
  }, []);

  const value = Number(amount);
  const min = options?.minAmount ?? 100;
  const max = options?.maxAmount ?? 500000;
  const valid = Number.isFinite(value) && value >= min && value <= max;

  const finish = (data: any) => {
    setResult(data);
    setPending(null);
    if (data?.success) {
      onDone?.(Number(data.balance ?? 0));
      window.dispatchEvent(new CustomEvent("wallet-updated", { detail: { balance: data.balance } }));
    }
  };

  const checkStatus = async () => {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiClient.post(`/WalletTopup/${pending.topupId}/check`);
      if (res.data?.success) finish(res.data);
      else setError(res.data?.message || "Payment not received yet.");
    } catch (err) {
      setError(apiError(err, "Unable to check payment status."));
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const [{ data: order }] = await Promise.all([
        apiClient.post("/WalletTopup/create-order", { amount: Math.round(value * 100) / 100 }),
        loadCheckout(),
      ]);
      setPending({ topupId: order.topupId });

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#f97316" },
        handler: async (response: any) => {
          setBusy(true);
          try {
            const res = await apiClient.post("/WalletTopup/verify", {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            if (res.data?.success) finish(res.data);
            else setError(res.data?.message || "Payment is being confirmed. Use 'Check status' in a moment.");
          } catch (err) {
            setError(apiError(err, "Payment received by Razorpay but not confirmed yet. Use 'Check status'."));
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        setError(resp?.error?.description || "Payment failed. No money was added.");
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setError(apiError(err, "Unable to start the payment."));
      setBusy(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(15,23,42,.5)", zIndex: 1065 }}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">💳 Add Money to Wallet</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={busy} />
          </div>

          <div className="modal-body">
            {result?.success ? (
              <div className="text-center py-3">
                <div style={{ fontSize: 46 }}>✅</div>
                <div className="fw-semibold mt-2">{formatMoney(result.amount)} added to your wallet</div>
                <div className="text-muted small">
                  New balance: <b>{formatMoney(result.balance)}</b>
                  {result.method ? ` • paid by ${String(result.method).toUpperCase()}` : ""}
                </div>
                <button className="btn btn-brand rounded-pill px-4 mt-3" onClick={onClose}>
                  Done
                </button>
              </div>
            ) : !options ? (
              <div className="placeholder-glow py-3">
                <span className="placeholder col-8 mb-2 d-block" />
                <span className="placeholder col-12 d-block" style={{ height: 38 }} />
                {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}
              </div>
            ) : !options.enabled ? (
              <div className="alert alert-warning small mb-0">{options.reason}</div>
            ) : (
              <>
                <div className="d-flex justify-content-between small mb-3">
                  <span className="text-muted">{options.siteName}</span>
                  <span>
                    Current balance: <b>{formatMoney(options.balance)}</b>
                  </span>
                </div>

                <label className="form-label fw-semibold">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className={`form-control form-control-lg ${amount && !valid ? "is-invalid" : ""}`}
                  min={min}
                  max={max}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy}
                />
                <div className="invalid-feedback">
                  Enter between {formatMoney(min)} and {formatMoney(max)}.
                </div>

                <div className="d-flex flex-wrap gap-2 mt-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm rounded-pill ${value === p ? "btn-brand" : "btn-light border"}`}
                      onClick={() => setAmount(String(p))}
                      disabled={busy}
                    >
                      {formatMoney(p)}
                    </button>
                  ))}
                </div>

                <div className="rounded-3 border p-2 mt-3 small text-muted" style={{ background: "#f8fafc" }}>
                  Pay with UPI, debit / ATM card, credit card, net banking or wallet in the secure Razorpay window.
                  {options.mode === "TEST" && <span className="badge bg-secondary ms-1">TEST MODE</span>}
                </div>

                {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}
              </>
            )}
          </div>

          {!result?.success && options?.enabled && (
            <div className="modal-footer border-0 pt-0">
              {pending && (
                <button className="btn btn-light border rounded-pill" onClick={checkStatus} disabled={busy}>
                  Check status
                </button>
              )}
              <button className="btn btn-light border rounded-pill" onClick={onClose} disabled={busy}>
                Close
              </button>
              <button className="btn btn-brand rounded-pill px-4 fw-semibold" onClick={pay} disabled={!valid || busy}>
                {busy ? "Please wait..." : `Pay ${valid ? formatMoney(value) : ""}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddMoneyModal;

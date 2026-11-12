import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import apiClient from "../../services/api";
import { formatMoney } from "../../utils/format";

const AddMoneyModal = lazy(() => import("./AddMoneyModal"));

/**
 * Wallet balance in the top bar for site accounts (L1 / L2 / L3 ...) with a quick
 * "+ Add" button (any balance). Hidden for organization / super admins.
 */
const WalletChip: React.FC = () => {
  const [info, setInfo] = useState<{ enabled: boolean; balance: number; siteName?: string } | null>(null);
  const [show, setShow] = useState(false);

  const load = useCallback(() => {
    apiClient
      .get("/WalletTopup/options")
      .then((res) => setInfo(res.data?.siteName ? res.data : null))
      .catch(() => setInfo(null));
  }, []);

  useEffect(() => {
    load();
    const onUpdated = () => load();
    window.addEventListener("wallet-updated", onUpdated);
    return () => window.removeEventListener("wallet-updated", onUpdated);
  }, [load]);

  if (!info) return null;
  const low = info.balance <= 0;

  return (
    <>
      <div
        className="d-flex align-items-center gap-1 rounded-pill border px-2 py-1 bg-white shadow-sm"
        title="Wallet balance"
        style={{ borderColor: low ? "#fecaca" : "#ffedd5" }}
      >
        <span className="d-none d-md-inline" aria-hidden="true">💳</span>
        <span className={`fw-semibold small text-nowrap ${low ? "text-danger" : "text-dark"}`}>{formatMoney(info.balance)}</span>
        {/* Always offered: if online payment is not set up yet the popup says whom to ask */}
        <button
          type="button"
          className="btn btn-sm btn-brand rounded-pill py-0 px-2 ms-1"
          style={{ fontSize: 12 }}
          onClick={() => setShow(true)}
          title={info.enabled ? "Add money online" : "Online payment is not set up yet"}
        >
          + Add
        </button>
      </div>
      {show &&
        createPortal(
          <Suspense fallback={null}>
            <AddMoneyModal onClose={() => setShow(false)} />
          </Suspense>,
          document.body,
        )}
    </>
  );
};

export default WalletChip;

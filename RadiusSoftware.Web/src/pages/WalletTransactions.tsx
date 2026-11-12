import React, { Suspense, lazy, useEffect, useState } from "react";
import apiClient from "../services/api";

const AddMoneyModal = lazy(() => import("../components/wallet/AddMoneyModal"));

interface WalletTransaction {
  id: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

const WalletTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [canAddMoney, setCanAddMoney] = useState(false);
  const [topups, setTopups] = useState<any[]>([]);
  const [checking, setChecking] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      const response = await apiClient.get("/wallet/transactions");
      setTransactions(response.data || []);
    } catch (error: any) {
      console.error("Transaction loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopups = () =>
    apiClient
      .get("/WalletTopup/history", { params: { take: 10 } })
      .then((res) => setTopups(res.data ?? []))
      .catch(() => setTopups([]));

  useEffect(() => {
    fetchTransactions();
    fetchTopups();
    apiClient
      .get("/WalletTopup/options")
      // any site account may add money; the popup explains if payment is not set up
      .then((res) => setCanAddMoney(!!res.data?.siteName))
      .catch(() => setCanAddMoney(false));
    const onUpdated = () => {
      fetchTransactions();
      fetchTopups();
    };
    window.addEventListener("wallet-updated", onUpdated);
    return () => window.removeEventListener("wallet-updated", onUpdated);
  }, []);

  // A payment that was made but not confirmed (e.g. browser closed)
  const checkTopup = async (id: string) => {
    setChecking(id);
    try {
      const res = await apiClient.post(`/WalletTopup/${id}/check`);
      if (res.data?.success) {
        window.dispatchEvent(new CustomEvent("wallet-updated"));
      } else {
        alert(res.data?.message || "Payment not received yet.");
      }
      fetchTopups();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Unable to check payment.");
    } finally {
      setChecking(null);
    }
  };

  return (
    <div className="container-fluid py-2 px-3">
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h3 className="fw-bold mb-1">Wallet Transactions</h3>
          <p className="text-muted mb-0">Complete wallet credit and debit history.</p>
        </div>
        {canAddMoney && (
          <button className="btn btn-brand rounded-pill px-4 fw-semibold" onClick={() => setShowAddMoney(true)}>
            + Add Money
          </button>
        )}
      </div>

      {topups.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <h6 className="fw-bold mb-2">Online payments</h6>
            <div className="table-responsive">
              <table className="table table-sm small align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th className="text-end">Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th className="d-none d-md-table-cell">Payment ID</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {topups.map((t) => (
                    <tr key={t.id}>
                      <td className="text-nowrap">{new Date(t.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                      <td className="text-end fw-semibold">₹{Number(t.amount).toFixed(2)}</td>
                      <td>{t.paymentMethod ? String(t.paymentMethod).toUpperCase() : "—"}</td>
                      <td>
                        <span className={`badge ${t.status === "PAID" ? "bg-success" : t.status === "FAILED" ? "bg-danger" : "bg-secondary"}`}>
                          {t.status === "CREATED" ? "NOT PAID" : t.status}
                        </span>
                      </td>
                      <td className="d-none d-md-table-cell font-monospace">{t.providerPaymentId || "—"}</td>
                      <td className="text-end">
                        {t.status === "CREATED" && (
                          <button className="btn btn-sm btn-light border py-0" disabled={checking === t.id} onClick={() => checkTopup(t.id)}>
                            {checking === t.id ? "..." : "Check status"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAddMoney && (
        <Suspense fallback={null}>
          <AddMoneyModal onClose={() => setShowAddMoney(false)} />
        </Suspense>
      )}

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="px-4">Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Balance Before</th>
                  <th>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5">Loading...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-5">No wallet transactions found.</td>
                  </tr>
                ) : (
                  transactions.map((item) => {
                    const isCredit = item.transactionType?.toUpperCase() === "CREDIT";
                    return (
                      <tr key={item.id}>
                        <td className="px-4">
                          {new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </td>
                        <td>
                          <span className={`badge ${isCredit ? "bg-success" : "bg-danger"}`}>
                            {item.transactionType}
                          </span>
                        </td>
                        <td>{item.description || "-"}</td>
                        <td className={`fw-bold ${isCredit ? "text-success" : "text-danger"}`}>
                          {isCredit ? "+" : "-"}₹{Number(item.amount || 0).toFixed(2)}
                        </td>
                        <td>₹{Number(item.balanceBefore || 0).toFixed(2)}</td>
                        <td className="fw-semibold">₹{Number(item.balanceAfter || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletTransactions;
import React, { useEffect, useState } from "react";
import apiClient from "../services/api";

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

  useEffect(() => {
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
    fetchTransactions();
  }, []);

  return (
    <div className="container-fluid py-2 px-3">
      <div className="mb-4">
        <h3 className="fw-bold mb-1">Wallet Transactions</h3>
        <p className="text-muted mb-0">Complete wallet credit and debit history.</p>
      </div>

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
                          {new Date(item.createdAt).toLocaleString("en-IN")}
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
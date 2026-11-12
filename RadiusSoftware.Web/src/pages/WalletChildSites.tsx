import React, { useEffect, useState } from "react";
import apiClient from "../services/api";

interface ChildSite {
  id: string;
  name: string;
  walletBalance: number;
}

interface WalletTransactionItem {
  id: string;
  createdAt: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  toSiteName?: string;
  subscriberName?: string;
  packageName?: string;
}

const WalletChildSites: React.FC = () => {
  const [sites, setSites] = useState<ChildSite[]>([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parentBalance, setParentBalance] = useState<number>(0);

  // History & Filter States
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [filterSiteId, setFilterSiteId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadData = async () => {
    try {
      const [sitesResponse, balanceResponse] = await Promise.all([
        apiClient.get("/wallet/child-sites"),
        apiClient.get("/wallet/balance"),
      ]);

      setSites(sitesResponse.data || []);
      setParentBalance(Number(balanceResponse.data?.balance ?? 0));
    } catch (error: any) {
      console.error("Wallet data loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      let queryParams = "?type=DEBIT"; // L2 ne jo child ko diya ya recharge kiya
      if (filterSiteId) queryParams += `&siteId=${filterSiteId}`;
      if (filterType) queryParams += `&type=${filterType}`;
      if (filterFrom) queryParams += `&from=${filterFrom}`;
      if (filterTo) queryParams += `&to=${filterTo}`;

      const res = await apiClient.get(`/wallet/transactions${queryParams}`);
      setTransactions(res.data || []);
    } catch (err) {
      console.error("Failed to load transfer history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
    loadHistory();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [filterSiteId, filterType, filterFrom, filterTo]);

  const addBalance = async () => {
    if (!selectedSite) {
      alert("Please select child site.");
      return;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.post("/wallet/add-to-child", {
        siteId: selectedSite,
        amount: numericAmount,
        description: description.trim(),
      });

      alert(response.data?.message || "Balance added successfully.");
      setAmount("");
      setDescription("");
      setSelectedSite("");

      await loadData();
      await loadHistory();
    } catch (error: any) {
      alert(error?.response?.data?.message || "Unable to add balance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid py-2 px-3">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">Child Site Wallet & Transfer Lifecycle</h3>
          <p className="text-muted mb-0">
            Transfer wallet balance to child sites and track complete distribution history.
          </p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 px-4 py-3 bg-white">
          <small className="text-muted">Available Balance</small>
          <h4 className="fw-bold text-brand mb-0">₹{parentBalance.toFixed(2)}</h4>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* ADD BALANCE FORM */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4">Transfer Balance to Child</h5>

              <div className="mb-3">
                <label className="form-label fw-semibold">Select Child Site</label>
                <select
                  className="form-select"
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  disabled={loading || saving}
                >
                  <option value="">-- Select Child Site --</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} — Current Bal: ₹{Number(site.walletBalance || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Amount</label>
                <div className="input-group">
                  <span className="input-group-text">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="form-control"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold">Description / Note</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional note e.g. Monthly stock advance"
                  disabled={saving}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary w-100 py-2 fw-semibold rounded-pill"
                onClick={addBalance}
                disabled={saving || loading || !selectedSite || !amount}
              >
                {saving ? "Processing Transfer..." : "Transfer Amount"}
              </button>
            </div>
          </div>
        </div>

        {/* CHILD SITES LIST OVERVIEW */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0">Active Child Sites</h5>
                <span className="badge bg-light text-dark px-3 py-2 rounded-pill">{sites.length} Sites</span>
              </div>

              <div className="table-responsive" style={{ maxHeight: "280px", overflowY: "auto" }}>
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Site Name</th>
                      <th className="text-end">Wallet Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={2} className="text-center text-muted py-4">Loading child sites...</td>
                      </tr>
                    ) : sites.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-center text-muted py-4">No child sites found.</td>
                      </tr>
                    ) : (
                      sites.map((site) => (
                        <tr key={site.id}>
                          <td className="fw-semibold">{site.name}</td>
                          <td className="text-end fw-bold text-success">
                            ₹{Number(site.walletBalance || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMPLETE LIFECYCLE HISTORY WITH FILTERS */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <h5 className="fw-bold mb-3">Child Site Transfer History & Lifecycle</h5>

          {/* Filter Bar */}
          <div className="row g-3 mb-4 bg-light p-3 rounded-3">
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Filter by Site</label>
              <select
                className="form-select form-select-sm"
                value={filterSiteId}
                onChange={(e) => setFilterSiteId(e.target.value)}
              >
                <option value="">All Child Sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small fw-semibold">Type</label>
              <select
                className="form-select form-select-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="CREDIT">CREDIT</option>
                <option value="DEBIT">DEBIT</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">From Date</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">To Date</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
            <div className="col-md-1 d-flex align-items-end">
              <button
                className="btn btn-outline-secondary btn-sm w-100"
                onClick={() => {
                  setFilterSiteId("");
                  setFilterType("");
                  setFilterFrom("");
                  setFilterTo("");
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* History Table */}
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="px-3">Date & Time</th>
                  <th>Type</th>
                  <th>Description / Note</th>
                  <th>Amount</th>
                  <th>Balance Before</th>
                  <th>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4">Loading history...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">No lifecycle history records found.</td>
                  </tr>
                ) : (
                  transactions.map((item) => {
                    const isCredit = item.transactionType?.toUpperCase() === "CREDIT";
                    return (
                      <tr key={item.id}>
                        <td className="px-3 text-nowrap">
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

export default WalletChildSites;
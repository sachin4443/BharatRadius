import React, { useEffect, useState, useMemo } from "react";
import { LiveRadiusTerminal } from "../components/LiveRadiusTerminal";
import { SuperAdminDashboard } from "../components/SuperAdminDashboard";
import { CompanyAdminDashboard } from "../components/CompanyAdminDashboard";
import { RealtimeTrafficDashboard } from "../components/RealtimeTrafficDashboard";
import { RealtimePingDashboard } from "../components/RealtimePingDashboard";
import apiClient from "../services/api";

// Summary Card Component (Re-usable)
const SummaryCard = ({
  title,
  value,
  icon,
  color = "#4f46e5",
  background = "#eef2ff",
}: {
  title: string;
  value: number;
  icon: string;
  color?: string;
  background?: string;
}) => {
  return (
    <div className="col-xl-2 col-lg-4 col-md-6 col-6">
      <div
        className="bg-white h-100"
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          boxShadow: "0 3px 12px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div className="p-3 p-lg-4">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="min-w-0">
              <div
                className="small fw-semibold mb-2"
                style={{
                  color: "#64748b",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </div>
              <div
                className="fw-bold"
                style={{
                  color,
                  fontSize: 28,
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
            </div>
            <div
              className="d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background,
                color,
                fontSize: 19,
                fontWeight: 600,
              }}
            >
              {icon}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const [walletBalance, setWalletBalance] = useState<number>(0);
  
  // Subscribers state for Summary Cards
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [liveSubscriberIds, setLiveSubscriberIds] = useState<Set<string>>(new Set());

  const isSuperAdmin = user?.isSuperAdmin || false;
  
  const userLevel = user?.level || user?.orgType || "L1";
  const orgType = typeof userLevel === "number" ? `L${userLevel}` : userLevel;

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // 1. Wallet Balance
        const walletRes = await apiClient.get("/wallet/balance");
        setWalletBalance(walletRes.data.balance ?? 0);

        // 2. Subscribers List for Counters
        const subRes = await apiClient.get("/Subscribers/list");
        const subData = Array.isArray(subRes.data)
          ? subRes.data
          : (subRes.data?.data ?? []);
        setSubscribers(subData);
      } catch (error: unknown) {
        console.error("Dashboard data loading error:", error);
      }
    };

    loadDashboardData();
  }, []);

  // Counters Calculation
  const total = subscribers.length;
  const active = subscribers.filter((x) => x.isActive === true).length;
  const enabled = subscribers.filter((x) => x.connectionEnabled === true).length;
  const connectionOff = subscribers.filter((x) => x.connectionEnabled !== true).length;
  const inactive = subscribers.filter((x) => x.isActive === false).length;
  const liveCount = liveSubscriberIds.size;

  return (
    <div className="container-fluid py-2 px-3">
      {/* Wallet Balance header widget */}
      <div className="d-flex justify-content-end mb-2">
        <div className="badge bg-light text-dark border px-3 py-2 rounded-pill shadow-sm">
          💳 Wallet Balance: <span className="fw-bold text-success">₹{walletBalance.toFixed(2)}</span>
        </div>
      </div>

      {/* 1. SuperAdmin Dynamic Dashboard */}
      {isSuperAdmin && <SuperAdminDashboard />}

      {/* 2. L0 Company / ClientPortal Dashboard */}
      {!isSuperAdmin && (orgType === "L0" || orgType === "ClientPortal" || orgType === "L1") && (
        <CompanyAdminDashboard />
      )}

      {/* 3. L2 Branch Dashboard - Real-time Graphs & Summary Cards included */}
      {!isSuperAdmin && orgType === "L2" && (
        <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h4 className="fw-bold text-brand mb-1">
                Dashboard <span className="text-muted fw-normal fs-6">(District Franchise / Reseller)</span>
              </h4>
              <p className="text-muted small mb-0">
                Monitor live network metrics, active sites, and system analytics.
              </p>
            </div>
          </div>

          {/* SUMMARY CARDS ROW */}
          <div className="row g-3 mb-4">
            <SummaryCard title="Total Records" value={total} icon="👥" color="#4f46e5" background="#eef2ff" />
            <SummaryCard title="Live Users" value={liveCount} icon="📡" color="#059669" background="#ecfdf5" />
            <SummaryCard title="Active Users" value={active} icon="✓" color="#16a34a" background="#f0fdf4" />
            <SummaryCard title="Allow Connection" value={enabled} icon="🔌" color="#7c3aed" background="#f5f3ff" />
            <SummaryCard title="Connection Off" value={connectionOff} icon="⛔" color="#64748b" background="#f1f5f9" />
            <SummaryCard title="Inactive Users" value={inactive} icon="⚠" color="#dc2626" background="#fef2f2" />
          </div>

          <div className="row g-3">
            {/* 📈 1. Real-time Traffic Monitor */}
            <div className="col-xl-6 col-lg-12">
              <RealtimeTrafficDashboard />
            </div>

            {/* 🏓 2. Real-time Ping / Latency Monitor */}
            <div className="col-xl-6 col-lg-12">
              <RealtimePingDashboard />
            </div>

            {/* 💻 3. Live RADIUS Terminal */}
            <div className="col-12">
              <div style={{ overflow: "hidden" }}>
                <LiveRadiusTerminal />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. L3 Site Dashboard */}
      {!isSuperAdmin && orgType === "L3" && (
        <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
          <h4 className="fw-bold text-brand mb-1">
            📍 L3 Site Dashboard <span className="text-muted fw-normal fs-6">(Area Partner)</span>
          </h4>
          <p className="text-muted small mb-0">
            Monitor local nodes, L4 retailers, and direct connections.
          </p>
        </div>
      )}

      {/* 5. L4 Sub-Site Dashboard */}
      {!isSuperAdmin && orgType === "L4" && (
        <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
          <h4 className="fw-bold text-brand mb-1">
            🏠 L4 Sub-Site / Outlet Dashboard
          </h4>
          <p className="text-muted small mb-0">
            Retailer portal for customer recharges and daily support tickets.
          </p>
        </div>
      )}
    </div>
  );
};
import React, { useState, useEffect, useRef, useCallback } from "react";
import apiClient from "../services/api";

interface RouterLiveInfoModalProps {
  nasId: string;
  nasName: string;
  onClose: () => void;
}

// TypeScript Interfaces
interface RouterStats {
  identity?: string;
  version?: string;
  architecture?: string;
  board?: string;
  model?: string;
  serial?: string;
  firmware?: string;
  cpuModel?: string;
  cpuCount?: number;
  cpuFrequency?: string;
  cpuLoad?: string;
  cpuLoadNum?: number;
  uptime?: string;
  usedMemory?: string;
  totalMemory?: string;
  memUsageNum?: number;
  freeMemory?: string;
  totalSecrets?: number;
  activePppoe?: number;
  offlineSecrets?: number;
  freeHdd?: string;
  ip?: string;
}

interface SpeedDataPoint {
  dl: number;
  ul: number;
}

export const RouterLiveInfoModal: React.FC<RouterLiveInfoModalProps> = ({
  nasId,
  nasName,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<RouterStats | null>(null);
  const [error, setError] = useState<string>("");

  const [trafficData, setTrafficData] = useState({
    downloadBps: "0 bps",
    uploadBps: "0 bps",
  });

  // Updated to hold both Download and Upload values for the new graph
  const [speedHistory, setSpeedHistory] = useState<SpeedDataPoint[]>([]);
  
  const [isTrafficPolling, setIsTrafficPolling] = useState<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- 1. Traffic Polling Functions ---
  const stopAutoTrafficPolling = useCallback(() => {
    setIsTrafficPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchTrafficSpeed = async () => {
    try {
      const res = await apiClient.post(`/Nas/live-traffic/${nasId}`);
      if (res.data.success) {
        setTrafficData({
          downloadBps: res.data.txBps,
          uploadBps: res.data.rxBps,
        });

        // Store KBps for smoother graph scaling
        const dlKbps = res.data.tx / 1024; 
        const ulKbps = res.data.rx / 1024;
        
        // Keep last 15 points for a nice line graph
        setSpeedHistory((prev) => [...prev.slice(-14), { dl: dlKbps, ul: ulKbps }]); 
      }
    } catch (err: unknown) {
      console.error("Failed to fetch live traffic", err);
      stopAutoTrafficPolling();
    }
  };

  const startAutoTrafficPolling = () => {
    setIsTrafficPolling(true);
    fetchTrafficSpeed();
    intervalRef.current = setInterval(() => {
      fetchTrafficSpeed();
    }, 2000);
  };

  const toggleTrafficPolling = () => {
    if (isTrafficPolling) {
      stopAutoTrafficPolling();
    } else {
      startAutoTrafficPolling();
    }
  };

  // --- 2. Initial Data Load ---
  useEffect(() => {
    let isMounted = true;

    const loadInitialStats = async () => {
      try {
        const res = await apiClient.post(`/Nas/fetch-router-info/${nasId}`);
        if (isMounted) setStats(res.data);
      } catch (err: unknown) {
        if (isMounted) {
          const e = err as { response?: { data?: { message?: string } } };
          setError(e?.response?.data?.message || "Failed to connect to MikroTik router.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialStats();

    return () => {
      isMounted = false;
      stopAutoTrafficPolling();
    };
  }, [nasId, stopAutoTrafficPolling]);

  // --- 3. Manual Refresh ---
  const handleRefresh = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.post(`/Nas/fetch-router-info/${nasId}`);
      setStats(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || "Failed to connect to MikroTik router.");
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (value: number | undefined) => {
    if (!value) return "bg-success";
    if (value > 85) return "bg-danger";
    if (value > 60) return "bg-warning";
    return "bg-success";
  };

  // --- Mini SVG Graph Calculations ---
  const miniWidth = 200;
  const miniHeight = 50;
  // Dynamic scaling based on the highest peak in the current window
  const miniMaxVal = Math.max(10, ...speedHistory.flatMap(s => [s.dl, s.ul]));

  const pointsDl = speedHistory.map((s, i) => `${(i / Math.max(speedHistory.length - 1, 1)) * miniWidth},${miniHeight - (s.dl / miniMaxVal) * miniHeight}`).join(" ");
  const pointsUl = speedHistory.map((s, i) => `${(i / Math.max(speedHistory.length - 1, 1)) * miniWidth},${miniHeight - (s.ul / miniMaxVal) * miniHeight}`).join(" ");

  return (
    <>
      <style>
        {`
          @keyframes pulse-btn {
            0% { box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(13, 110, 253, 0); }
            100% { box-shadow: 0 0 0 0 rgba(13, 110, 253, 0); }
          }
          .btn-blink {
            animation: pulse-btn 2s infinite;
          }
        `}
      </style>

      <div
        className="modal show d-block"
        style={{
          backgroundColor: "rgba(15,23,42,0.75)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div
            className="modal-content border-0 shadow-lg overflow-hidden"
            style={{ borderRadius: "1.25rem", backgroundColor: "#f8fafc" }}
          >
            {/* 🟦 Header */}
            <div className="modal-header bg-dark text-white px-4 py-3 border-0">
              <div>
                <div
                  className="text-uppercase text-secondary font-monospace fw-bold"
                  style={{ fontSize: "11px", letterSpacing: "1px" }}
                >
                  MikroTik Router Dashboard
                </div>
                <h4 className="modal-title fw-bold text-white mb-0 mt-1">
                  ⚡ {stats?.identity || nasName}
                </h4>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white shadow-none"
                onClick={onClose}
              ></button>
            </div>

            {/* ⬜ Body */}
            <div
              className="modal-body p-4"
              style={{ maxHeight: "80vh", overflowY: "auto" }}
            >
              {loading ? (
                <div className="py-5 text-center">
                  <div
                    className="spinner-border text-primary mb-3"
                    role="status"
                    style={{ width: "3rem", height: "3rem" }}
                  ></div>
                  <h5 className="fw-bold text-dark">Connecting to RouterOS...</h5>
                  <p className="text-muted small">
                    Gathering hardware, CPU, memory, PPPoE & system statistics.
                  </p>
                </div>
              ) : error ? (
                <div className="alert alert-danger border-0 shadow-sm p-5 text-center rounded-4">
                  <div className="fs-1 mb-2">⚠️</div>
                  <h4 className="fw-bold">Connection Failed</h4>
                  <p className="text-muted">{error}</p>
                  <button
                    className="btn btn-danger px-4 rounded-pill mt-3 fw-semibold shadow-sm"
                    onClick={handleRefresh}
                  >
                    🔄 Retry Connection
                  </button>
                </div>
              ) : (
                <div className="row g-4">
                  {/* 🖥️ Left Column: System Info */}
                  <div className="col-lg-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-4 bg-white">
                      <h6 className="fw-bold text-dark border-bottom pb-3 mb-3 d-flex align-items-center">
                        <span className="fs-5 me-2">🖥️</span> System Information
                      </h6>
                      <ul className="list-group list-group-flush small">
                        <li className="list-group-item d-flex justify-content-between px-0 py-2 border-0">
                          <span className="text-muted fw-semibold">Identity</span>
                          <span className="fw-bold text-dark">{stats?.identity}</span>
                        </li>
                        <li className="list-group-item d-flex justify-content-between px-0 py-2 border-0">
                          <span className="text-muted fw-semibold">Version</span>
                          <span className="badge bg-primary bg-opacity-10 text-primary px-3 rounded-pill border border-primary-subtle">
                            {stats?.version}
                          </span>
                        </li>
                        <li className="list-group-item d-flex justify-content-between px-0 py-2 border-0">
                          <span className="text-muted fw-semibold">Architecture</span>
                          <span className="fw-bold text-dark">{stats?.architecture}</span>
                        </li>
                        <li className="list-group-item d-flex justify-content-between px-0 py-2 border-0">
                          <span className="text-muted fw-semibold">Board</span>
                          <span className="fw-bold text-dark">{stats?.board}</span>
                        </li>
                        <li className="list-group-item d-flex justify-content-between px-0 py-2 border-0">
                          <span className="text-muted fw-semibold">Model</span>
                          <span className="fw-bold text-dark">{stats?.model}</span>
                        </li>
                        <li className="list-group-item d-flex justify-content-between px-0 py-2 border-0">
                          <span className="text-muted fw-semibold">Serial No.</span>
                          <span className="font-monospace fw-bold text-secondary">{stats?.serial}</span>
                        </li>
                        <li className="list-group-item d-flex justify-content-between px-0 py-2 border-0">
                          <span className="text-muted fw-semibold">Firmware</span>
                          <span className="fw-bold text-dark">{stats?.firmware}</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* ⚙️ Middle Column: CPU, Memory, Storage */}
                  <div className="col-lg-4 d-flex flex-column gap-4">
                    {/* CPU & Uptime Card */}
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white flex-grow-1">
                      <h6 className="fw-bold text-dark border-bottom pb-2 mb-3 d-flex align-items-center">
                        <span className="fs-5 me-2">⚙️</span> CPU Performance
                      </h6>
                      <div className="row text-center mb-3 g-2">
                        <div className="col-4">
                          <div className="bg-light rounded-3 p-2 border">
                            <small className="text-muted d-block" style={{ fontSize: "10px" }}>MODEL</small>
                            <span className="fw-bold text-dark small">{stats?.cpuModel}</span>
                          </div>
                        </div>
                        <div className="col-4">
                          <div className="bg-light rounded-3 p-2 border">
                            <small className="text-muted d-block" style={{ fontSize: "10px" }}>CORES</small>
                            <span className="fw-bold text-dark small">{stats?.cpuCount}</span>
                          </div>
                        </div>
                        <div className="col-4">
                          <div className="bg-light rounded-3 p-2 border">
                            <small className="text-muted d-block" style={{ fontSize: "10px" }}>FREQ</small>
                            <span className="fw-bold text-dark small">{stats?.cpuFrequency}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="d-flex justify-content-between small fw-bold mb-1">
                          <span className="text-muted">CPU Load</span>
                          <span className={(stats?.cpuLoadNum || 0) > 85 ? "text-danger" : "text-success"}>
                            {stats?.cpuLoad}
                          </span>
                        </div>
                        <div className="progress rounded-pill bg-light border" style={{ height: "14px" }}>
                          <div className={`progress-bar rounded-pill ${getProgressColor(stats?.cpuLoadNum)}`} style={{ width: stats?.cpuLoad }}></div>
                        </div>
                      </div>

                      <div className="mt-auto d-flex justify-content-between align-items-center bg-light p-3 rounded-3 border">
                        <span className="small fw-bold text-muted">⏰ UPTIME</span>
                        <span className="font-monospace fw-bold text-dark">{stats?.uptime}</span>
                      </div>
                    </div>

                    {/* RAM Memory Card */}
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                      <h6 className="fw-bold text-dark mb-3 d-flex align-items-center">
                        <span className="fs-5 me-2">💾</span> RAM Memory
                      </h6>
                      <div className="d-flex justify-content-between small mb-1 fw-bold">
                        <span className="text-muted">
                          Used: <span className="text-dark">{stats?.usedMemory}</span> / {stats?.totalMemory}
                        </span>
                        <span className="text-primary">{stats?.memUsageNum}%</span>
                      </div>
                      <div className="progress rounded-pill bg-light border mb-2" style={{ height: "12px" }}>
                        <div className={`progress-bar rounded-pill ${getProgressColor(stats?.memUsageNum)}`} style={{ width: `${stats?.memUsageNum}%` }}></div>
                      </div>
                      <small className="text-muted fw-semibold">
                        Free Memory: <span className="text-success">{stats?.freeMemory}</span>
                      </small>
                    </div>
                  </div>

                  {/* 👥 Right Column: PPPoE, Traffic, Network */}
                  <div className="col-lg-4 d-flex flex-column gap-4">
                    {/* PPPoE Card */}
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                      <h6 className="fw-bold text-dark border-bottom pb-2 mb-3 d-flex align-items-center">
                        <span className="fs-5 me-2">👥</span> PPPoE Subscribers
                      </h6>
                      <div className="row text-center g-2">
                        <div className="col-12 mb-2">
                          <div className="bg-light border rounded-3 py-3">
                            <small className="text-muted fw-bold d-block mb-1">TOTAL SECRETS</small>
                            <h3 className="fw-bold text-dark mb-0">{stats?.totalSecrets}</h3>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3 py-3">
                            <small className="text-success fw-bold d-block mb-1">ONLINE</small>
                            <h4 className="fw-bold text-success mb-0">{stats?.activePppoe}</h4>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 py-3">
                            <small className="text-danger fw-bold d-block mb-1">OFFLINE</small>
                            <h4 className="fw-bold text-danger mb-0">{Math.max(0, stats?.offlineSecrets || 0)}</h4>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Smart Live Traffic Card with New SVG Line/Dot Graph */}
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center">
                          <span className="fs-5 me-2">📈</span> Traffic (ether3)
                        </h6>
                        <button
                          onClick={toggleTrafficPolling}
                          className={`btn btn-sm fw-bold px-3 ${isTrafficPolling ? 'btn-danger' : 'btn-primary btn-blink'}`}
                        >
                          {isTrafficPolling ? "⏹ Stop" : "▶ Start"}
                        </button>
                      </div>

                      <div className="row text-center g-3 mb-3">
                        <div className="col-6 border-end">
                          <div className="text-success mb-1"><i className="fs-4">📥</i></div>
                          <small className="text-muted fw-bold d-block" style={{ fontSize: "10px" }}>DOWNLOAD</small>
                          <h6 className="fw-bold text-dark mt-1 mb-0">{trafficData.downloadBps}</h6>
                        </div>
                        <div className="col-6">
                          <div className="text-info mb-1"><i className="fs-4">📤</i></div>
                          <small className="text-muted fw-bold d-block" style={{ fontSize: "10px" }}>UPLOAD</small>
                          <h6 className="fw-bold text-dark mt-1 mb-0">{trafficData.uploadBps}</h6>
                        </div>
                      </div>

                      {/* NEW: SVG Line and Dot Graph */}
                      <div className="bg-light rounded-3 p-2 border position-relative" style={{ height: "65px", overflow: "hidden" }}>
                        {speedHistory.length > 0 && isTrafficPolling ? (
                          <svg viewBox={`0 0 ${miniWidth} ${miniHeight}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                            {/* Smooth Lines */}
                            <polyline fill="none" stroke="#198754" strokeWidth="2" strokeLinejoin="round" points={pointsDl} />
                            <polyline fill="none" stroke="#0dcaf0" strokeWidth="2" strokeLinejoin="round" points={pointsUl} />
                            
                            {/* Data Point Dots */}
                            {speedHistory.map((s, i) => {
                              const x = (i / Math.max(speedHistory.length - 1, 1)) * miniWidth;
                              const yDl = miniHeight - (s.dl / miniMaxVal) * miniHeight;
                              const yUl = miniHeight - (s.ul / miniMaxVal) * miniHeight;
                              return (
                                <g key={i}>
                                  <circle cx={x} cy={yDl} r="2.5" fill="#198754" />
                                  <circle cx={x} cy={yUl} r="2.5" fill="#0dcaf0" />
                                </g>
                              );
                            })}
                          </svg>
                        ) : (
                          <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted small fw-bold">
                            Click Start to view graph
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Network & Storage Small Tags */}
                    <div className="d-flex gap-2">
                      <div className="card border-0 shadow-sm rounded-4 p-3 bg-white flex-fill text-center">
                        <small className="text-muted fw-bold d-block mb-1">STORAGE</small>
                        <span className="fw-bold text-dark">{stats?.freeHdd} Free</span>
                      </div>
                      <div className="card border-0 shadow-sm rounded-4 p-3 bg-white flex-fill text-center">
                        <small className="text-muted fw-bold d-block mb-1">IP ADDR</small>
                        <span className="fw-bold text-primary font-monospace">{stats?.ip}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ⬛ Footer */}
            <div className="modal-footer bg-white px-4 py-3 border-top border-light shadow-sm">
              {!loading && !error && (
                <button className="btn btn-outline-primary rounded-pill px-4 fw-semibold me-auto" onClick={handleRefresh}>
                  🔄 Refresh Stats
                </button>
              )}
              <button type="button" className="btn btn-dark px-5 rounded-pill fw-bold shadow-sm" onClick={onClose}>
                Close Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
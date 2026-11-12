import React, { useState, useEffect, useRef } from "react";
import apiClient from "../services/api"; // Ensure this path is correct

// TypeScript Interfaces to fix "any" type errors
interface NasDevice {
  id: string;
  nasName: string;
  nasIpAddress: string;
}

interface ChartDataPoint {
  time: string;
  rxKbps: number;
  txKbps: number;
  rxRaw: string;
  txRaw: string;
}

interface HoverData extends ChartDataPoint {
  x: number;
  yRx: number;
  yTx: number;
}

export const RealtimeTrafficDashboard: React.FC = () => {
  const [nasList, setNasList] = useState<NasDevice[]>([]);
  const [selectedNasId, setSelectedNasId] = useState<string>("");
  const [selectedNasIp, setSelectedNasIp] = useState<string>("");

  const [currentRx, setCurrentRx] = useState<number>(0);
  const [currentTx, setCurrentTx] = useState<number>(0);
  const [rxFormatted, setRxFormatted] = useState("0 bps");
  const [txFormatted, setTxFormatted] = useState("0 bps");

  const [lastUpdated, setLastUpdated] = useState<string>("--:--:--");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // State for Tooltip Hover
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  
  // State for Start/Stop Button
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Fix useRef type
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Core Functions ---
  const stopPolling = () => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resetDashboard = () => {
    stopPolling();
    setChartData([]);
    setCurrentRx(0);
    setCurrentTx(0);
    setRxFormatted("0 bps");
    setTxFormatted("0 bps");
    setLastUpdated("--:--:--");
  };

  const fetchTraffic = async (nasId: string) => {
    try {
      const res = await apiClient.post(`/Nas/live-traffic/${nasId}`);
      if (res.data.success) {
        const uploadVal = res.data.rx; 
        const downloadVal = res.data.tx;

        setCurrentRx(uploadVal);
        setCurrentTx(downloadVal);
        setRxFormatted(res.data.rxBps); 
        setTxFormatted(res.data.txBps);

        const timeString = new Date().toLocaleTimeString("en-US", {
          hour12: true,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        });
        
        setLastUpdated(timeString);

        const uploadKbps = uploadVal / 1024;
        const downloadKbps = downloadVal / 1024;

        setChartData((prev) => [
          ...prev.slice(-14),
          {
            time: timeString,
            rxKbps: parseFloat(uploadKbps.toFixed(2)),
            txKbps: parseFloat(downloadKbps.toFixed(2)),
            rxRaw: res.data.rxBps,
            txRaw: res.data.txBps,
          },
        ]);
      }
    } catch (err) {
      console.error("Traffic poll error", err);
      stopPolling();
    }
  };

  const startPolling = (nasId: string) => {
    setIsPolling(true);
    fetchTraffic(nasId); 
    intervalRef.current = setInterval(() => {
      fetchTraffic(nasId);
    }, 2000);
  };

  const togglePolling = () => {
    if (isPolling) {
      stopPolling();
    } else {
      if (selectedNasId) startPolling(selectedNasId);
    }
  };

  // --- Effects ---
  useEffect(() => {
    const fetchNas = async () => {
      try {
        const res = await apiClient.get("/Nas/list");
        setNasList(res.data);
        if (res.data.length > 0) {
          setSelectedNasId(res.data[0].id);
          setSelectedNasIp(res.data[0].nasIpAddress);
        }
      } catch (err) {
        console.error("Failed to load NAS list", err);
      }
    };
    
    fetchNas();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // --- SVG Coordinates calculation ---
  const width = 800;
  const height = 220;
  const maxVal = Math.max(
    100,
    ...chartData.map((d) => Math.max(d.rxKbps, d.txKbps)),
  );

  const pointsRx = chartData
    .map((d, i) => {
      const x = (i / Math.max(chartData.length - 1, 1)) * width;
      const y = height - (d.rxKbps / maxVal) * (height - 40) - 20;
      return `${x},${y}`;
    })
    .join(" ");

  const pointsTx = chartData
    .map((d, i) => {
      const x = (i / Math.max(chartData.length - 1, 1)) * width;
      const y = height - (d.txKbps / maxVal) * (height - 40) - 20;
      return `${x},${y}`;
    })
    .join(" ");

  const areaRx = chartData.length > 1 ? `${pointsRx} ${width},${height} 0,${height}` : "";
  const areaTx = chartData.length > 1 ? `${pointsTx} ${width},${height} 0,${height}` : "";

  // Helper to format Mbps if Kbps is large
  const formatSpeed = (kbps: number) => {
    if (kbps >= 1000) {
      return (kbps / 1024).toFixed(2) + " Mbps";
    }
    return kbps.toFixed(2) + " Kbps";
  };

  // Metrics
  const avgRxVal = chartData.length ? (chartData.reduce((acc, curr) => acc + curr.rxKbps, 0) / chartData.length) : 0;
  const avgTxVal = chartData.length ? (chartData.reduce((acc, curr) => acc + curr.txKbps, 0) / chartData.length) : 0;
  const maxRxVal = chartData.length ? Math.max(...chartData.map((c) => c.rxKbps)) : 0;
  const maxTxVal = chartData.length ? Math.max(...chartData.map((c) => c.txKbps)) : 0;

  const avgUpload = formatSpeed(avgRxVal);
  const avgDownload = formatSpeed(avgTxVal);
  const peakUpload = formatSpeed(maxRxVal);
  const peakDownload = formatSpeed(maxTxVal);

  const totalThroughputKbps = (currentRx + currentTx) / 1024; 
  const totalThroughputFormatted = formatSpeed(totalThroughputKbps);

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white text-dark">
      {/* 🚀 Header Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center pb-3 mb-4 border-bottom gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-success bg-opacity-10 p-2 rounded-3 text-success fs-4">📊</div>
          <div>
            {/* Added text-brand for gradient header */}
            <h4 className="fw-bold mb-0 text-brand">Real-time Traffic Monitor</h4>
            <div className="d-flex gap-3 small text-muted mt-1 font-monospace flex-wrap">
              <span>🔌 Interface: <strong className="text-success">ether3</strong></span>
              <span>🌐 IP: <strong className="text-info">{selectedNasIp}</strong></span>
              <span>🕒 Updated: <strong className="text-warning">{lastUpdated}</strong></span>
            </div>
          </div>
        </div>

        {/* NAS Selector & Control Button */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <select
            className="form-select form-select-sm bg-light text-dark border shadow-none"
            style={{ width: "200px", cursor: "pointer" }}
            value={selectedNasId}
            onChange={(e) => {
              const selected = nasList.find((n) => n.id === e.target.value);
              if (selected) {
                setSelectedNasId(e.target.value);
                setSelectedNasIp(selected.nasIpAddress);
                resetDashboard(); 
              }
            }}
            disabled={isPolling}
          >
            {nasList.map((nas) => (
              <option key={nas.id} value={nas.id}>
                {nas.nasName} ({nas.nasIpAddress})
              </option>
            ))}
          </select>
          
          {/* Using btn-brand class for brand colored button */}
          <button 
            className={`btn btn-sm px-4 fw-bold text-white ${isPolling ? 'btn-danger' : 'btn-brand'}`}
            onClick={togglePolling}
            disabled={!selectedNasId}
          >
            {isPolling ? "⏹ Stop" : "▶ Start"}
          </button>

          {isPolling && (
            <span className="badge bg-success px-3 py-2 d-flex align-items-center gap-1">
              <span className="spinner-grow spinner-grow-sm text-light" style={{ width: "10px", height: "10px" }}></span>{" "}
              Live
            </span>
          )}
        </div>
      </div>

      {/* 📊 Top 4 Cards */}
      <div className="row g-2 mb-4">
        {[
          {
            label: "DOWNLOAD (TX)",
            value: txFormatted,
            sub: `${currentTx.toLocaleString()} bps`,
            color: "text-success",
          },
          {
            label: "UPLOAD (RX)",
            value: rxFormatted,
            sub: `${currentRx.toLocaleString()} bps`,
            color: "text-info",
          },
          {
            label: "TOTAL THROUGHPUT",
            value: totalThroughputFormatted, 
            sub: "Combined Speed",
            color: "text-warning",
          },
          {
            label: "STATUS",
            value: isPolling ? "Live" : "Stopped",
            sub: isPolling ? "● Connected" : "○ Disconnected",
            color: isPolling ? "text-dark" : "text-muted",
            subColor: isPolling ? "text-success" : "text-muted",
          },
        ].map((card, idx) => (
          <div key={idx} className="col-6 col-md-6 col-lg-3 col-xl-6 col-xxl-3">
            <div
              className="bg-light border rounded-4 p-3 shadow-sm h-100 transition-all hover-scale"
              style={{ transition: "transform 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <small className="text-muted fw-bold d-block mb-1 text-truncate" style={{ fontSize: "11px" }}>
                {card.label}
              </small>
              <div className={`fw-bold mb-0 ${card.color} text-truncate fs-4 fs-md-3`}>
                {card.value}
              </div>
              <span className={`${card.subColor || "text-muted"} d-block text-truncate`} style={{ fontSize: "11px" }}>
                {card.sub}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 📈 Professional SVG Line Chart */}
      <div className="bg-light border rounded-4 p-4 position-relative" onMouseLeave={() => setHoverData(null)}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="fw-bold text-secondary font-monospace small">Live Traffic Flow</span>
          <div className="d-flex gap-3 small flex-wrap">
            <span className="text-success fw-bold">● Download (TX)</span>
            <span className="text-info fw-bold">● Upload (RX)</span>
          </div>
        </div>

        {/* Floating Tooltip Container */}
        {hoverData && (
          <div
            className="position-absolute bg-white text-dark p-2 rounded-3 shadow border z-3"
            style={{
              top: "10px",
              left: `calc(${(hoverData.x / width) * 100}% + 15px)`,
              transform: "translateX(-50%)",
              minWidth: "130px",
              pointerEvents: "none",
              backdropFilter: "blur(4px)",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
            }}
          >
            <div className="small text-muted mb-1 text-center font-monospace border-bottom pb-1">
              {hoverData.time}
            </div>
            <div className="d-flex justify-content-between small fw-bold mt-1">
              <span className="text-success">Download:</span> <span>{hoverData.txRaw}</span>
            </div>
            <div className="d-flex justify-content-between small fw-bold">
              <span className="text-info">Upload:</span> <span>{hoverData.rxRaw}</span>
            </div>
          </div>
        )}

        <div style={{ width: "100%", height: "220px", position: "relative" }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", overflow: "visible" }}
          >
            <defs>
              <linearGradient id="gradTx" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#198754" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#198754" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="gradRx" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0dcaf0" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0dcaf0" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                y1={height * ratio}
                x2={width}
                y2={height * ratio}
                stroke="#e9ecef"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Area Fills */}
            {areaTx && <polygon points={areaTx} fill="url(#gradTx)" />}
            {areaRx && <polygon points={areaRx} fill="url(#gradRx)" />}

            {/* Smooth Lines */}
            {pointsTx && <polyline fill="none" stroke="#198754" strokeWidth="3" points={pointsTx} />}
            {pointsRx && <polyline fill="none" stroke="#0dcaf0" strokeWidth="3" points={pointsRx} />}

            {/* Interactive Points & Hitboxes */}
            {chartData.map((d, i) => {
              const x = (i / Math.max(chartData.length - 1, 1)) * width;
              const yRx = height - (d.rxKbps / maxVal) * (height - 40) - 20;
              const yTx = height - (d.txKbps / maxVal) * (height - 40) - 20;
              const isHovered = hoverData?.time === d.time;

              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoverData({ x, yRx, yTx, ...d })}
                  style={{ cursor: "crosshair" }}
                >
                  <rect
                    x={x - width / chartData.length / 2}
                    y="0"
                    width={width / chartData.length}
                    height={height}
                    fill="transparent"
                  />
                  <circle
                    cx={x}
                    cy={yTx}
                    r={isHovered ? "6" : "4"}
                    fill="#198754"
                    stroke={isHovered ? "#fff" : "none"}
                    strokeWidth="2"
                    style={{ transition: "all 0.2s ease" }}
                  />
                  <circle
                    cx={x}
                    cy={yRx}
                    r={isHovered ? "6" : "4"}
                    fill="#0dcaf0"
                    stroke={isHovered ? "#fff" : "none"}
                    strokeWidth="2"
                    style={{ transition: "all 0.2s ease" }}
                  />
                  {isHovered && (
                    <line
                      x1={x} y1="0" x2={x} y2={height}
                      stroke="#adb5bd" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* 🕒 Time Labels */}
        <div className="d-flex justify-content-between mt-3 fw-bold" style={{ fontSize: "12px", color: "#495057", position: "relative" }}>
          {chartData.map((d, i) => {
            const showLabel = i === 0 || i === chartData.length - 1 || i % Math.ceil(chartData.length / 4) === 0;
            return (
              <div
                key={i}
                style={{
                  width: `${100 / chartData.length}%`,
                  textAlign: i === 0 ? "left" : i === chartData.length - 1 ? "right" : "center",
                  opacity: showLabel ? 1 : 0,
                }}
              >
                {d.time}
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 Bottom Analytics Bar */}
      <div className="row text-center mt-3 g-2 font-monospace small bg-white py-3 rounded-4 border mx-0">
        <div className="col-12 col-md-3 mb-2 mb-md-0">
          <span className="text-muted">Avg Download:</span> <strong className="text-success">{avgDownload}</strong>
        </div>
        <div className="col-12 col-md-3 border-md-start mb-2 mb-md-0">
          <span className="text-muted">Avg Upload:</span> <strong className="text-info">{avgUpload}</strong>
        </div>
        <div className="col-12 col-md-3 border-md-start mb-2 mb-md-0">
          <span className="text-muted">Peak Download:</span> <strong className="text-success">{peakDownload}</strong>
        </div>
        <div className="col-12 col-md-3 border-md-start">
          <span className="text-muted">Peak Upload:</span> <strong className="text-info">{peakUpload}</strong>
        </div>
      </div>
    </div>
  );
};
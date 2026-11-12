import React, { useState, useEffect, useRef } from "react";
import apiClient from "../services/api";

// 1. TypeScript Interfaces to fix "any" type errors
interface NasDevice {
  id: string;
  nasName: string;
  nasIpAddress: string;
}

interface PingDataPoint {
  time: string;
  latency: number;
}

interface HoverData extends PingDataPoint {
  x: number;
  y: number;
}

export const RealtimePingDashboard: React.FC = () => {
  const [nasList, setNasList] = useState<NasDevice[]>([]);
  const [selectedNasId, setSelectedNasId] = useState<string>("");
  const [targetIp, setTargetIp] = useState<string>("8.8.8.8");

  // Latency States
  const [currentLatency, setCurrentLatency] = useState<number>(0);
  const [avgLatency, setAvgLatency] = useState<number>(0);
  const [minLatency, setMinLatency] = useState<number>(0);
  const [maxLatency, setMaxLatency] = useState<number>(0);
  const [packetLoss, setPacketLoss] = useState<number>(0);

  const [lastUpdated, setLastUpdated] = useState<string>("--:--:--");
  const [pingHistory, setPingHistory] = useState<PingDataPoint[]>([]);

  // State for Interactive Tooltip
  const [hoverData, setHoverData] = useState<HoverData | null>(null);

  // State for Start/Stop Control
  const [isPolling, setIsPolling] = useState<boolean>(false);
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
    setPingHistory([]);
    setCurrentLatency(0);
    setAvgLatency(0);
    setMinLatency(0);
    setMaxLatency(0);
    setPacketLoss(0);
    setLastUpdated("--:--:--");
  };

  const fetchPing = async (nasId: string, currentTarget: string) => {
    try {
      const res = await apiClient.post(
        `/Nas/live-ping/${nasId}?target=${currentTarget}`
      );
      if (res.data.success) {
        setCurrentLatency(res.data.latency);
        setAvgLatency(res.data.avg);
        setMinLatency(res.data.min);
        setMaxLatency(res.data.max);
        setPacketLoss(res.data.packetLoss);

        const timeString = new Date().toLocaleTimeString("en-US", {
          hour12: true,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        });
        setLastUpdated(timeString);

        setPingHistory((prev) => [
          ...prev.slice(-14),
          { time: timeString, latency: res.data.latency },
        ]);
      }
    } catch (err) {
      console.error("Ping error", err);
      stopPolling();
    }
  };

  const startPolling = (nasId: string, currentTarget: string) => {
    setIsPolling(true);
    fetchPing(nasId, currentTarget);
    intervalRef.current = setInterval(() => {
      fetchPing(nasId, currentTarget);
    }, 2000);
  };

  const togglePolling = () => {
    if (isPolling) {
      stopPolling();
    } else {
      if (selectedNasId && targetIp) startPolling(selectedNasId, targetIp);
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

  // SVG Chart Calculations
  const width = 800;
  const height = 220;
  const maxLatVal = Math.max(50, ...pingHistory.map((p) => p.latency));

  const points = pingHistory
    .map((p, i) => {
      const x = (i / Math.max(pingHistory.length - 1, 1)) * width;
      const y = height - (p.latency / maxLatVal) * (height - 40) - 20;
      return `${x},${y}`;
    })
    .join(" ");

  const area = pingHistory.length > 1 ? `${points} ${width},${height} 0,${height}` : "";

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white text-dark h-100">
      {/* 🚀 Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center pb-3 mb-4 border-bottom gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-info bg-opacity-10 p-2 rounded-3 text-info fs-4">
            🏓
          </div>
          <div>
            {/* Added text-brand for gradient header */}
            <h4 className="fw-bold mb-0 text-brand">
              Real-time Latency & Ping Monitor
            </h4>
            <div className="d-flex gap-3 small text-muted mt-1 font-monospace flex-wrap">
              <span>🎯 Target: <strong className="text-info">{targetIp}</strong></span>
              <span>🕒 Updated: <strong className="text-warning">{lastUpdated}</strong></span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* NAS Selector */}
          <select
            className="form-select form-select-sm bg-light text-dark border shadow-none"
            style={{ width: "200px", cursor: "pointer" }}
            value={selectedNasId}
            onChange={(e) => {
              setSelectedNasId(e.target.value);
              resetDashboard();
            }}
            disabled={isPolling}
          >
            {nasList.map((nas) => (
              <option key={nas.id} value={nas.id}>
                {nas.nasName}
              </option>
            ))}
          </select>

          {/* 🎯 PRO UI: Dropdown + Input Combo */}
          <div className="input-group input-group-sm shadow-none" style={{ width: "230px" }}>
            <select
              className="form-select bg-light text-dark border border-end-0"
              style={{ cursor: "pointer", maxWidth: "95px" }}
              onChange={(e) => {
                setTargetIp(e.target.value);
                resetDashboard();
              }}
              disabled={isPolling}
              value={["8.8.8.8", "1.1.1.1", "192.168.1.1"].includes(targetIp) ? targetIp : ""}
            >
              <option value="8.8.8.8">Google</option>
              <option value="1.1.1.1">Cloud</option>
              <option value="192.168.1.1">Gateway</option>
              <option value="" hidden>Custom</option>
            </select>
            <input
              type="text"
              className="form-control bg-light text-dark border"
              value={targetIp}
              onChange={(e) => {
                setTargetIp(e.target.value);
                resetDashboard();
              }}
              disabled={isPolling}
              placeholder="IP Address"
            />
          </div>

          {/* Using btn-brand class for brand colored button */}
          <button 
            className={`btn btn-sm px-4 fw-bold text-white ${isPolling ? 'btn-danger' : 'btn-brand'}`}
            onClick={togglePolling}
            disabled={!selectedNasId || !targetIp}
          >
            {isPolling ? "⏹ Stop" : "▶ Start"}
          </button>

          {isPolling && (
            <span className="badge bg-info text-white px-3 py-2 fw-bold d-flex align-items-center gap-1">
              <span className="spinner-grow spinner-grow-sm text-white" style={{ width: "10px", height: "10px" }}></span>{" "}
              Live
            </span>
          )}
        </div>
      </div>

      {/* 📊 Top 5 Metric Cards (Responsive Grid) */}
      <div className="row row-cols-2 row-cols-md-5 g-2 mb-4">
        {[
          {
            label: "CURRENT",
            value: currentLatency,
            unit: "ms",
            color: currentLatency > 100 ? "text-danger" : currentLatency > 50 ? "text-warning" : "text-success",
          },
          { label: "AVERAGE", value: avgLatency, unit: "ms", color: "text-info" },
          { label: "MINIMUM", value: minLatency, unit: "ms", color: "text-success" },
          { label: "MAXIMUM", value: maxLatency, unit: "ms", color: "text-warning" },
          {
            label: "PACKET LOSS",
            value: packetLoss,
            unit: "%",
            color: packetLoss > 0 ? "text-danger" : "text-success",
          },
        ].map((card, idx) => (
          <div key={idx} className="col">
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
                {card.value} <span style={{ fontSize: "14px", fontWeight: "normal" }}>{card.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 📈 Professional SVG Smooth Chart with Tooltips */}
      <div className="bg-light border rounded-4 p-4 position-relative" onMouseLeave={() => setHoverData(null)}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="fw-bold text-secondary font-monospace small">Latency Waveform (ms)</span>
          <span className="text-info fw-bold small">● Ping (ms)</span>
        </div>

        {/* Floating Tooltip Container */}
        {hoverData && (
          <div
            className="position-absolute bg-white text-dark p-2 rounded-3 shadow border z-3"
            style={{
              top: "10px",
              left: `calc(${(hoverData.x / width) * 100}% + 15px)`,
              transform: "translateX(-50%)",
              minWidth: "110px",
              pointerEvents: "none",
              backdropFilter: "blur(4px)",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
            }}
          >
            <div className="small text-muted mb-1 text-center font-monospace border-bottom pb-1">
              {hoverData.time}
            </div>
            <div className="d-flex justify-content-center small fw-bold mt-1">
              <span className="text-info">Ping:</span> <span className="ms-2">{hoverData.latency} ms</span>
            </div>
          </div>
        )}

        <div style={{ width: "100%", height: "220px", position: "relative" }}>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <linearGradient id="gradPing" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0dcaf0" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0dcaf0" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line key={ratio} x1="0" y1={height * ratio} x2={width} y2={height * ratio} stroke="#e9ecef" strokeWidth="1" strokeDasharray="4 4" />
            ))}

            {/* Area Fill */}
            {area && <polygon points={area} fill="url(#gradPing)" />}

            {/* Smooth Line */}
            {points && <polyline fill="none" stroke="#0dcaf0" strokeWidth="3" points={points} />}

            {/* Interactive Points & Hitboxes */}
            {pingHistory.map((p, i) => {
              const x = (i / Math.max(pingHistory.length - 1, 1)) * width;
              const y = height - (p.latency / maxLatVal) * (height - 40) - 20;
              const isHovered = hoverData?.time === p.time;

              return (
                <g key={i} onMouseEnter={() => setHoverData({ x, y, ...p })} style={{ cursor: "crosshair" }}>
                  <rect x={x - width / pingHistory.length / 2} y="0" width={width / pingHistory.length} height={height} fill="transparent" />
                  <circle cx={x} cy={y} r={isHovered ? "6" : "4"} fill="#0dcaf0" stroke={isHovered ? "#fff" : "none"} strokeWidth="2" style={{ transition: "all 0.2s ease" }} />
                  {isHovered && <line x1={x} y1="0" x2={x} y2={height} stroke="#adb5bd" strokeWidth="1" strokeDasharray="3 3" pointerEvents="none" />}
                </g>
              );
            })}
          </svg>
        </div>

        {/* 🕒 Time Labels */}
        <div className="d-flex justify-content-between mt-3 fw-bold" style={{ fontSize: "12px", color: "#495057", position: "relative" }}>
          {pingHistory.map((p, i) => {
            const showLabel = i === 0 || i === pingHistory.length - 1 || i % Math.ceil(pingHistory.length / 4) === 0;
            return (
              <div key={i} style={{ width: `${100 / pingHistory.length}%`, textAlign: i === 0 ? "left" : i === pingHistory.length - 1 ? "right" : "center", opacity: showLabel ? 1 : 0 }}>
                {p.time}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
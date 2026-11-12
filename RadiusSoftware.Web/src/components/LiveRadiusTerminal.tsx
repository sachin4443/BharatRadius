import React, { useState, useEffect, useRef } from "react";
import apiClient, { SIGNALR_BASE_URL } from "../services/api";
import * as signalR from "@microsoft/signalr";

export const LiveRadiusTerminal: React.FC = () => {
  const [logs, setLogs] = useState<{ message: string; type: string }[]>([]);
  const [nasList, setNasList] = useState<{ id: string; nasName: string; nasIpAddress: string }[]>([]);
  const [selectedNasId, setSelectedNasId] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  // 1. Component load hote hi NAS routers ki list fetch karein
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
  }, []);

     useEffect(() => {
  let cancelled = false;

  const hubUrl = `${SIGNALR_BASE_URL}/radiusLogHub`;

  console.log("SignalR Hub URL:", hubUrl);

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl)
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Information)
    .build();

  connectionRef.current = connection;

  connection.on("ReceiveLog", (message: string, type: string) => {
    if (cancelled) return;

    setLogs((prevLogs) => [
      ...prevLogs.slice(-100),
      {
        message,
        type,
      },
    ]);
  });

  connection.onreconnecting((error?: Error) => {
    console.warn("SignalR reconnecting...", error);

    if (!cancelled) {
      setLogs((prev) => [
        ...prev.slice(-100),
        {
          message: "[SYSTEM] SignalR reconnecting...",
          type: "SYSTEM",
        },
      ]);
    }
  });

  connection.onreconnected((connectionId?: string) => {
    console.log("SignalR reconnected:", connectionId);

    if (!cancelled) {
      setLogs((prev) => [
        ...prev.slice(-100),
        {
          message: "[SYSTEM] SignalR reconnected successfully.",
          type: "SYSTEM",
        },
      ]);
    }
  });

  connection.onclose((error?: Error) => {
    if (!cancelled) {
      console.warn("SignalR connection closed.", error);
    }
  });

  const startConnection = async (): Promise<void> => {
    try {
      await connection.start();

      if (cancelled) {
        await connection.stop();
        return;
      }

      console.log("✅ SignalR connected successfully");

      setLogs((prev) => [
        ...prev,
        {
          message: "[SYSTEM] Connected to Live Terminal Hub...",
          type: "SYSTEM",
        },
      ]);
    } catch (error: unknown) {
      if (!cancelled) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error("SignalR Connection Error:", error);

        setLogs((prev) => [
          ...prev.slice(-100),
          {
            message: `[ERROR] SignalR connection failed: ${errorMessage}`,
            type: "ERROR",
          },
        ]);
      }
    }
  };

  startConnection();

  return () => {
    cancelled = true;

    connection.off("ReceiveLog");

    if (connection.state !== signalR.HubConnectionState.Disconnected) {
      connection.stop().catch(() => {});
    }

    if (connectionRef.current === connection) {
      connectionRef.current = null;
    }
  };
}, []);
  // 3. Traffic Polling Effect (Only runs when "Go" is explicitly clicked)
  useEffect(() => {
    let trafficInterval: number | null = null;

    if (isStreaming && selectedNasId) {
      trafficInterval = window.setInterval(async () => {
        if (!isStreaming) return;

        try {
          const res = await apiClient.post(
            `/Nas/live-traffic/${selectedNasId}`,
          );
          if (res.data && res.data.success) {
            const timeNow = new Date().toLocaleTimeString();
            const trafficMsg = `[${timeNow}] Live Traffic (ether3) -> Download: ${res.data.rxBps} | Upload: ${res.data.txBps}`;
            setLogs((prev) => [
              ...prev.slice(-100),
              { message: trafficMsg, type: "TRAFFIC" },
            ]);
          }
        } catch {
          // Ignore polling errors silently
        }
      }, 3000);
    }

    return () => {
      if (trafficInterval) {
        clearInterval(trafficInterval);
      }
    };
  }, [isStreaming, selectedNasId]);

  // Scroll to bottom automatically
  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 9999 }}>
      {/* 🚀 Floating Trigger Button */}
      {!isOpen && (
        <button
          className="btn btn-brand rounded-pill shadow-lg px-4 py-3 text-white fw-bold d-flex align-items-center gap-2"
          onClick={() => setIsOpen(true)}
          style={{
            background: "linear-gradient(135deg, rgb(245, 113, 22) 0%, rgb(234, 88, 12) 100%)",
            border: "none"
          }}
        >
          <span className="spinner-grow spinner-grow-sm text-light" role="status"></span>
          🖥️ Live Terminal
        </button>
      )}

      {/* ⬛ Floating Terminal Box */}
      {isOpen && (
        <div 
          className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white"
          style={{ width: "480px", maxWidth: "90vw", border: "1px solid rgba(0,0,0,0.1)" }}
        >
          {/* Header */}
          <div className="card-header bg-light border-bottom d-flex justify-content-between align-items-center px-3 py-2">
            <div className="fw-bold d-flex align-items-center small">
              <span className={`spinner-grow spinner-grow-sm ${isStreaming ? "text-success" : "text-muted"} me-2`} role="status"></span>
              <span className="text-brand">RADIUS Terminal</span>
            </div>

            <div className="d-flex align-items-center gap-1">
              <select
                className="form-select form-select-sm bg-white text-dark border shadow-none"
                style={{ width: "130px", fontSize: "12px" }}
                value={selectedNasId}
                onChange={(e) => setSelectedNasId(e.target.value)}
              >
                {nasList.map((nas) => (
                  <option key={nas.id} value={nas.id}>
                    {nas.nasName}
                  </option>
                ))}
              </select>

              <button
                className={`btn btn-sm ${isStreaming ? "btn-danger" : "btn-brand"} px-2 text-white`}
                style={{ fontSize: "11px" }}
                onClick={() => {
                  if (!isStreaming) {
                    setLogs((prev) => [
                      ...prev,
                      { message: "[SYSTEM] Started live traffic polling for selected router...", type: "SYSTEM" },
                    ]);
                  }
                  setIsStreaming(!isStreaming);
                }}
              >
                {isStreaming ? "Stop" : "🚀 Go"}
              </button>

              <button
                className="btn btn-sm btn-outline-secondary px-2"
                style={{ fontSize: "11px" }}
                onClick={() => setLogs([])}
              >
                Clr
              </button>

              {/* Close Button */}
              <button
                type="button"
                className="btn-close ms-2"
                style={{ fontSize: "10px" }}
                onClick={() => setIsOpen(false)}
              ></button>
            </div>
          </div>

          {/* Terminal Body */}
          <div
            className="card-body p-3"
            style={{
              height: "280px",
              overflowY: "auto",
              backgroundColor: "#f8f9fa",
            }}
          >
            <div className="font-monospace" style={{ fontSize: "12px" }}>
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="mb-1"
                  style={{
                    fontWeight: "500",
                    color:
                      log.type === "ERROR"
                        ? "#dc3545"
                        : log.type === "SYSTEM"
                          ? "#0d6efd"
                          : log.type === "TRAFFIC"
                            ? "#198754"
                            : "#6f42c1",
                  }}
                >
                  {log.message}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
            {logs.length === 0 && (
              <div className="text-muted font-monospace small mt-2">
                Click "Go" to stream...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveRadiusTerminal;
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface SubscriberLiveSessionProps {
  subscriber: any;
  liveData: any;
  loading?: boolean;
  onRefresh: () => void;
}

interface LiveSpeedResponse {
  success: boolean;
  online: boolean;
  subscriberId: string;
  subscriberName: string;
  username: string;
  nasName?: string | null;
  nasIpAddress?: string | null;
  interfaceName?: string | null;
  downloadMbps?: number;
  uploadMbps?: number;
  downloadKbps?: number;
  uploadKbps?: number;
  rxBitsPerSecond?: number;
  txBitsPerSecond?: number;
  rxBytes?: number;
  txBytes?: number;
  timestamp?: string;
  message?: string;
  ipAddress?: string | null;
  macAddress?: string | null;
  sessionId?: string | null;
  acctSessionId?: string | null;
}

const API_BASE_URL = "https://api.bharatradius.com/api";

const SubscriberLiveSession: React.FC<
  SubscriberLiveSessionProps
> = ({
  subscriber,
  liveData,
  loading = false,
  onRefresh,
}) => {
  const [showLiveSpeed, setShowLiveSpeed] = useState(false);
  const [speedLoading, setSpeedLoading] = useState(false);
  const [liveSpeed, setLiveSpeed] = useState<LiveSpeedResponse | null>(null);

  const [currentSpeed, setCurrentSpeed] = useState({
    download: 0,
    upload: 0,
  });

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);
  const previousTrafficRef = useRef<{
    rxBytes: number;
    txBytes: number;
    time: number;
  } | null>(null);

  const getToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwtToken") ||
      ""
    );
  };

  const getValue = (...values: any[]) => {
    return values.find(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    );
  };

  const bytesToSize = (bytes: number) => {
    const value = Number(bytes) || 0;
    if (value <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index++;
    }
    return `${size.toFixed(2)} ${units[index]}`;
  };

  const formatSpeed = (mbps: number) => {
    const value = Number(mbps) || 0;
    if (value <= 0) return "0 Mbps";
    if (value >= 1000) return `${(value / 1000).toFixed(2)} Gbps`;
    if (value < 1) return `${(value * 1000).toFixed(2)} Kbps`;
    return `${value.toFixed(2)} Mbps`;
  };

  const formatDate = (value: any) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  };

  const formatDuration = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    if (totalSeconds <= 0) return "00h 00m 00s";
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const result = `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
    if (days > 0) return `${days}d ${result}`;
    return result;
  };

  const online = Boolean(
    liveSpeed?.online ??
      liveData?.isOnline ??
      liveData?.online ??
      false
  );

  const username =
    getValue(
      liveSpeed?.username,
      liveData?.username,
      liveData?.pppoeUsername,
      subscriber?.pppoeUsername,
      subscriber?.ppPoEUsername,
      subscriber?.PPPoEUsername
    ) || "-";

  const sessionId =
    getValue(
      liveData?.acctSessionId,
      liveData?.routerSessionId,
      liveData?.sessionId,
      liveSpeed?.acctSessionId,
      liveSpeed?.sessionId
    ) || "-";

  const ipAddress =
    getValue(
      liveData?.ipAddress,
      liveData?.framedIpAddress,
      liveSpeed?.ipAddress
    ) || "-";

  const macAddress =
    getValue(
      liveData?.macAddress,
      liveData?.callingStationId,
      liveSpeed?.macAddress,
      subscriber?.macAddress
    ) || "-";

  const nasName =
    getValue(liveSpeed?.nasName, liveData?.nasName, subscriber?.nasName) || "-";

  const nasIp =
    getValue(
      liveSpeed?.nasIpAddress,
      liveData?.nasIpAddress,
      subscriber?.nasIpAddress
    ) || "-";

  const interfaceName =
    getValue(liveSpeed?.interfaceName, liveData?.interfaceName) || "-";

  const service = getValue(liveData?.service, subscriber?.service) || "PPPoE";

  const inputOctets =
    Number(
      getValue(liveData?.inputOctets, liveData?.downloadBytes, liveData?.rxBytes, 0)
    ) || 0;

  const outputOctets =
    Number(
      getValue(liveData?.outputOctets, liveData?.uploadBytes, liveData?.txBytes, 0)
    ) || 0;

  const inputPackets = Number(getValue(liveData?.inputPackets, 0)) || 0;
  const outputPackets = Number(getValue(liveData?.outputPackets, 0)) || 0;
  const totalTraffic = inputOctets + outputOctets;

  const downloadSpeed = Number(currentSpeed.download) || 0;
  const uploadSpeed = Number(currentSpeed.upload) || 0;

  const uptime = useMemo(() => {
    if (liveData?.uptime) return liveData.uptime;
    const seconds = Number(
      liveData?.sessionTime ?? liveData?.acctSessionTime ?? 0
    );
    if (seconds <= 0) return "-";
    return formatDuration(seconds);
  }, [liveData?.uptime, liveData?.sessionTime, liveData?.acctSessionTime]);

  const fetchLiveSpeed = useCallback(async () => {
    if (!subscriber?.id) {
      console.error("Subscriber ID is missing.");
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setSpeedLoading(true);

    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE_URL}/subscriber-live-speed/${subscriber.id}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Live speed API returned ${response.status}`);
      }

      const result: LiveSpeedResponse = await response.json();
      setLiveSpeed(result);

      const now = Date.now();
      const currentRxBytes = Number(result.rxBytes) || 0;
      const currentTxBytes = Number(result.txBytes) || 0;

      let calculatedDownloadMbps = Number(result.downloadMbps) || 0;
      let calculatedUploadMbps = Number(result.uploadMbps) || 0;

      if (calculatedDownloadMbps <= 0 && calculatedUploadMbps <= 0) {
        if (previousTrafficRef.current) {
          const elapsedSeconds =
            (now - previousTrafficRef.current.time) / 1000;
          if (elapsedSeconds > 0) {
            const rxDelta = currentRxBytes - previousTrafficRef.current.rxBytes;
            const txDelta = currentTxBytes - previousTrafficRef.current.txBytes;
            const safeRxDelta = Math.max(0, rxDelta);
            const safeTxDelta = Math.max(0, txDelta);

            calculatedDownloadMbps =
              (safeRxDelta * 8) / elapsedSeconds / 1_000_000;
            calculatedUploadMbps =
              (safeTxDelta * 8) / elapsedSeconds / 1_000_000;
          }
        }
      }

      if (!result.online) {
        calculatedDownloadMbps = 0;
        calculatedUploadMbps = 0;
        previousTrafficRef.current = null;
      } else {
        previousTrafficRef.current = {
          rxBytes: currentRxBytes,
          txBytes: currentTxBytes,
          time: now,
        };
      }

      setCurrentSpeed({
        download: calculatedDownloadMbps,
        upload: calculatedUploadMbps,
      });
    } catch (error) {
      console.error("LIVE SPEED API ERROR:", error);
    } finally {
      isFetchingRef.current = false;
      setSpeedLoading(false);
    }
  }, [subscriber?.id]);

  const startLiveSpeed = async () => {
    setShowLiveSpeed(true);
    setSpeedLoading(true);
    setLiveSpeed(null);
    setCurrentSpeed({ download: 0, upload: 0 });
    previousTrafficRef.current = null;
    await fetchLiveSpeed();
  };

  const stopLiveSpeed = () => {
    setShowLiveSpeed(false);
    setSpeedLoading(false);
    setLiveSpeed(null);
    setCurrentSpeed({ download: 0, upload: 0 });
    previousTrafficRef.current = null;
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    if (!showLiveSpeed) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      await fetchLiveSpeed();
      if (cancelled) return;
      pollingRef.current = setTimeout(poll, 2000);
    };

    pollingRef.current = setTimeout(poll, 2000);

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [showLiveSpeed, fetchLiveSpeed]);

  return (
    <div>
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h5 className="fw-bold mb-1">Live PPPoE Session</h5>
          <div className="text-muted small">Real-time gateway connection status</div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-light border rounded-pill px-3"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Refreshing...
              </>
            ) : (
              <>🔄 Refresh Status</>
            )}
          </button>

          {!showLiveSpeed ? (
            <button
              type="button"
              className="btn btn-primary rounded-pill px-4"
              onClick={startLiveSpeed}
              disabled={!subscriber?.id || speedLoading}
            >
              {speedLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Loading...
                </>
              ) : (
                <>📈 Show Live Speed</>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline-danger rounded-pill px-4"
              onClick={stopLiveSpeed}
            >
              ⏹ Stop Live Speed
            </button>
          )}
        </div>
      </div>

      {/* TOP STATUS CARDS */}
      <div className="row g-3 mb-4">
        <div className="col-xl-3 col-md-6">
          <LiveStatusCard title="Connection" value={online ? "ONLINE" : "OFFLINE"} success={online} icon="📡" />
        </div>
        <div className="col-xl-3 col-md-6">
          <LiveStatusCard title="IP Address" value={ipAddress} icon="🌐" />
        </div>
        <div className="col-xl-3 col-md-6">
          <LiveStatusCard title="Session Uptime" value={online ? uptime : "-"} icon="⏱" />
        </div>
        <div className="col-xl-3 col-md-6">
          <LiveStatusCard title="MAC Address" value={macAddress} icon="💻" />
        </div>
      </div>

      {/* SIDE-BY-SIDE LIVE SPEED & SESSION TRAFFIC SPEEDOMETERS */}
      {showLiveSpeed && (
        <div className="row g-4 mb-4">
          {/* LIVE SPEED GAUGES */}
          <div className="col-xl-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">LIVE SPEED STATUS</h6>
                  <span className={`badge rounded-pill ${online ? "text-bg-success" : "text-bg-secondary"}`}>
                    {online ? "● LIVE" : "● OFFLINE"}
                  </span>
                </div>
                <div className="text-muted small mb-4">Real-time throughput via MikroTik Interface</div>

                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <SpeedometerCard
                      title="Download Speed"
                      value={formatSpeed(downloadSpeed)}
                      subtext="MikroTik RX"
                      percentage={Math.min(100, (downloadSpeed / 100) * 100)}
                      color="#0ea5e9"
                      icon="⬇"
                    />
                  </div>
                  <div className="col-md-6">
                    <SpeedometerCard
                      title="Upload Speed"
                      value={formatSpeed(uploadSpeed)}
                      subtext="MikroTik TX"
                      percentage={Math.min(100, (uploadSpeed / 100) * 100)}
                      color="#10b981"
                      icon="⬆"
                    />
                  </div>
                </div>

                <div className="bg-light p-3 rounded-3 small">
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Interface:</span>
                    <span className="font-monospace fw-semibold">{interfaceName}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">NAS / Router IP:</span>
                    <span className="font-monospace fw-semibold">{nasIp}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Last Update:</span>
                    <span className="fw-semibold">{formatDate(liveSpeed?.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SESSION TRAFFIC GAUGES */}
          <div className="col-xl-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">SESSION TRAFFIC</h6>
                  <span className="badge rounded-pill text-bg-primary">📊 Cumulative</span>
                </div>
                <div className="text-muted small mb-4">Total data consumed in current session</div>

                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <SpeedometerCard
                      title="Downloaded"
                      value={bytesToSize(Number(liveSpeed?.rxBytes || inputOctets))}
                      subtext={`${inputPackets.toLocaleString()} pkts`}
                      percentage={75}
                      color="#6366f1"
                      icon="⬇"
                    />
                  </div>
                  <div className="col-md-6">
                    <SpeedometerCard
                      title="Uploaded"
                      value={bytesToSize(Number(liveSpeed?.txBytes || outputOctets))}
                      subtext={`${outputPackets.toLocaleString()} pkts`}
                      percentage={45}
                      color="#f59e0b"
                      icon="⬆"
                    />
                  </div>
                </div>

                <div className="bg-light p-3 rounded-3 small">
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Total Combined Traffic:</span>
                    <span className="fw-bold text-dark">
                      {bytesToSize(Number(liveSpeed?.rxBytes || inputOctets) + Number(liveSpeed?.txBytes || outputOctets))}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Session ID:</span>
                    <span className="font-monospace fw-semibold">{sessionId}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Status:</span>
                    <span className="fw-semibold text-success">Active & Monitoring</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SESSION DETAILS + NETWORK INFO */}
      <div className="row g-4 mb-4">
        <div className="col-xl-6">
          <InfoCard title="Session Details" icon="🔌">
            <InfoRow label="PPPoE Username" value={username} mono />
            <InfoRow label="Session ID" value={sessionId} mono />
            <InfoRow label="Service" value={service} />
            <InfoRow label="Current IP" value={ipAddress} mono />
            <InfoRow label="MAC Address" value={macAddress} mono />
            <InfoRow label="Session Status" value={online ? "ACTIVE" : "NO ACTIVE SESSION"} />
          </InfoCard>
        </div>

        <div className="col-xl-6">
          <InfoCard title="Network Information" icon="🌐">
            <InfoRow label="Static IP" value={subscriber?.staticIp} mono />
            <InfoRow label="Current IP" value={ipAddress} mono />
            <InfoRow label="NAS Name" value={nasName} />
            <InfoRow label="NAS IP" value={nasIp} mono />
            <InfoRow label="Interface" value={interfaceName} mono />
            <InfoRow label="Connection" value={subscriber?.connectionEnabled ? "ENABLED" : "DISABLED"} />
          </InfoCard>
        </div>
      </div>

      {!online && (
        <div className="alert alert-warning border-0 rounded-4 mt-4">
          <strong>⚠ Subscriber is offline</strong>
          <div className="small mt-1">No active PPPoE session is currently available.</div>
        </div>
      )}

      <div className="text-muted small mt-3">
        {showLiveSpeed ? (
          <>🟢 Live speed monitoring is active. API polling every 2 seconds.</>
        ) : (
          <>ℹ Click <strong>Show Live Speed</strong> to start real-time speedometer monitoring.</>
        )}
      </div>
    </div>
  );
};

// ============================================================
// SPEEDOMETER / GAUGE CARD COMPONENT
// ============================================================

const SpeedometerCard = ({
  title,
  value,
  subtext,
  percentage,
  color,
  icon,
}: {
  title: string;
  value: string;
  subtext: string;
  percentage: number;
  color: string;
  icon: string;
}) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="bg-white border rounded-4 p-3 text-center h-100 shadow-sm d-flex flex-column align-items-center justify-content-between">
      <div className="d-flex justify-content-between w-100 align-items-center mb-1">
        <span className="text-muted small fw-semibold">{title}</span>
        <span className="badge bg-light text-dark rounded-circle p-1" style={{ width: 24, height: 24, fontSize: 12 }}>
          {icon}
        </span>
      </div>

      <div className="position-relative my-2" style={{ width: 90, height: 90 }}>
        <svg width="90" height="90" className="transform-rotate">
          <circle
            cx="45"
            cy="45"
            r={radius}
            stroke="#f1f5f9"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="45"
            cy="45"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div
          className="position-absolute top-50 start-50 translate-middle fw-bold text-dark"
          style={{ fontSize: 13, lineHeight: "1.2" }}
        >
          {value}
        </div>
      </div>

      <div className="text-muted small mt-1">{subtext}</div>
    </div>
  );
};

const LiveStatusCard = ({
  title,
  value,
  icon,
  success = false,
}: {
  title: string;
  value: string;
  icon: string;
  success?: boolean;
}) => {
  return (
    <div className="card border-0 shadow-sm rounded-4 h-100">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="text-muted small mb-2">{title}</div>
            <div className={`fw-bold ${success ? "text-success" : ""}`} style={{ fontSize: 20 }}>
              {value}
            </div>
          </div>
          <div
            className="rounded-circle bg-light d-flex align-items-center justify-content-center"
            style={{ width: 46, height: 46, fontSize: 20 }}
          >
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="card border-0 shadow-sm rounded-4 h-100">
      <div className="card-body p-4">
        <h6 className="fw-bold mb-3">
          <span className="me-2">{icon}</span>
          {title}
        </h6>
        {children}
      </div>
    </div>
  );
};

const InfoRow = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: any;
  mono?: boolean;
}) => {
  return (
    <div className="d-flex justify-content-between align-items-center border-bottom py-3 gap-3">
      <span className="text-muted small">{label}</span>
      <span
        className={`fw-semibold text-end ${mono ? "font-monospace" : ""}`}
        style={{ wordBreak: "break-word" }}
      >
        {value !== undefined && value !== null && value !== "" ? value : "-"}
      </span>
    </div>
  );
};

export default SubscriberLiveSession;
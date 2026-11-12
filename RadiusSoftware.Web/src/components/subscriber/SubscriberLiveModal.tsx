import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import apiClient from "../../services/api";

interface Props {
  subscriber: any;
  onClose: () => void;
}

interface LiveData {
  success?: boolean;

  online?: boolean;
  isOnline?: boolean;

  subscriberId?: string;
  subscriberName?: string;
  fullName?: string;

  username?: string;
  pppoeUsername?: string;

  nasName?: string;
  nasIpAddress?: string;
  interfaceName?: string;

  downloadMbps?: number;
  uploadMbps?: number;

  downloadKbps?: number;
  uploadKbps?: number;

  rxBitsPerSecond?: number;
  txBitsPerSecond?: number;

  rxBytes?: number;
  txBytes?: number;

  downloadBytes?: number;
  uploadBytes?: number;

  inputOctets?: number;
  outputOctets?: number;

  inputPackets?: number;
  outputPackets?: number;

  ipAddress?: string;
  macAddress?: string;

  service?: string;

  sessionId?: string;
  acctSessionId?: string;
  routerSessionId?: string;

  uptime?: string;
  sessionTime?: number;

  loginTime?: string;
  startTime?: string;

  timestamp?: string;
  lastUpdate?: string;

  connectionEnabled?: boolean;
  isActive?: boolean;
  routerOnline?: boolean;

  terminateCause?: string;

  message?: string;
}

interface SpeedState {
  download: number;
  upload: number;
}

interface TrafficState {
  rxBytes: number;
  txBytes: number;
  time: number;
}

const SubscriberLiveModal: React.FC<Props> = ({
  subscriber,
  onClose,
}) => {
  // =========================================================
  // STATE
  // =========================================================

  const [data, setData] =
    useState<LiveData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [speed, setSpeed] =
    useState<SpeedState>({
      download: 0,
      upload: 0,
    });

  const [lastRefresh, setLastRefresh] =
    useState<Date | null>(null);

  // =========================================================
  // REFS
  // =========================================================

  const modalRef =
    useRef<HTMLDivElement | null>(null);

  const previousTraffic =
    useRef<TrafficState | null>(null);

  const intervalRef =
    useRef<number | null>(null);

  const requestInProgress =
    useRef(false);

  const mountedRef =
    useRef(true);

  const visibleRef =
    useRef(false);

  // =========================================================
  // CLEAR POLLING
  // =========================================================

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(
        intervalRef.current
      );

      intervalRef.current = null;
    }
  }, []);

  // =========================================================
  // LOAD LIVE DATA
  // =========================================================

  const load = useCallback(async () => {
    // Don't request if component is not visible
    if (!visibleRef.current) {
      return;
    }

    // Prevent overlapping requests
    if (requestInProgress.current) {
      return;
    }

    requestInProgress.current = true;

    try {
      setError("");

      const response =
        await apiClient.get(
          `/subscriber-live-speed/${subscriber.id}`
        );

      if (!mountedRef.current) {
        return;
      }

      const result: LiveData =
        response.data;

      console.log(
        "SUBSCRIBER LIVE SPEED:",
        result
      );

      // =====================================================
      // ONLINE
      // =====================================================

      const online =
        Boolean(
          result?.online ??
          result?.isOnline ??
          false
        );

      // =====================================================
      // RX / TX
      //
      // RX = Download
      // TX = Upload
      // =====================================================

      const rxBytes =
        Number(
          result?.rxBytes ??
          result?.downloadBytes ??
          result?.inputOctets ??
          0
        );

      const txBytes =
        Number(
          result?.txBytes ??
          result?.uploadBytes ??
          result?.outputOctets ??
          0
        );

      // =====================================================
      // BACKEND SPEED
      // =====================================================

      const backendDownload =
        Number(
          result?.downloadMbps ?? 0
        );

      const backendUpload =
        Number(
          result?.uploadMbps ?? 0
        );

      const now =
        Date.now();

      // =====================================================
      // OFFLINE
      // =====================================================

      if (!online) {
        setSpeed({
          download: 0,
          upload: 0,
        });

        previousTraffic.current =
          null;
      }

      // =====================================================
      // ONLINE
      // =====================================================

      else {
        // ---------------------------------------------------
        // Backend speed available
        // ---------------------------------------------------

        if (
          backendDownload > 0 ||
          backendUpload > 0
        ) {
          setSpeed({
            download:
              backendDownload,
            upload:
              backendUpload,
          });
        }

        // ---------------------------------------------------
        // Calculate speed from RX/TX
        // ---------------------------------------------------

        else if (
          previousTraffic.current
        ) {
          const previous =
            previousTraffic.current;

          const elapsed =
            (now - previous.time) /
            1000;

          const rxDelta =
            rxBytes -
            previous.rxBytes;

          const txDelta =
            txBytes -
            previous.txBytes;

          /*
           * If counters decreased,
           * session probably restarted.
           *
           * Don't show fake speed.
           */

          if (
            elapsed > 0 &&
            rxDelta >= 0 &&
            txDelta >= 0
          ) {
            const downloadMbps =
              (rxDelta * 8) /
              elapsed /
              1_000_000;

            const uploadMbps =
              (txDelta * 8) /
              elapsed /
              1_000_000;

            setSpeed({
              download:
                downloadMbps,
              upload:
                uploadMbps,
            });
          } else {
            setSpeed({
              download: 0,
              upload: 0,
            });
          }
        }

        // ---------------------------------------------------
        // Save counters
        // ---------------------------------------------------

        previousTraffic.current = {
          rxBytes,
          txBytes,
          time: now,
        };
      }

      // =====================================================
      // SAVE DATA
      // =====================================================

      setData({
        ...result,
        isOnline: online,
        lastUpdate:
          result.timestamp ??
          result.lastUpdate,
      });

      setLastRefresh(
        new Date()
      );
    } catch (err: any) {
      if (!mountedRef.current) {
        return;
      }

      console.error(
        "Subscriber live speed error:",
        err
      );

      console.error(
        "API RESPONSE:",
        err?.response?.data
      );

      setError(
        err?.response?.data?.message ||
        "Unable to load live subscriber status."
      );
    } finally {
      requestInProgress.current =
        false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [subscriber.id]);

  // =========================================================
  // START POLLING
  // =========================================================

  const startPolling = useCallback(() => {
    stopPolling();

    // First request immediately
    load();

    // Then every 5 seconds
    intervalRef.current =
      window.setInterval(() => {
        load();
      }, 5000);
  }, [load, stopPolling]);

  // =========================================================
  // VIEWPORT OBSERVER
  //
  // API only runs when modal is actually visible
  // =========================================================

  useEffect(() => {
    mountedRef.current = true;

    const element =
      modalRef.current;

    if (!element) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const entry =
            entries[0];

          const visible =
            entry.isIntersecting;

          visibleRef.current =
            visible;

          if (visible) {
            startPolling();
          } else {
            stopPolling();

            previousTraffic.current =
              null;
          }
        },
        {
          threshold: 0.1,
        }
      );

    observer.observe(element);

    return () => {
      mountedRef.current = false;

      visibleRef.current =
        false;

      stopPolling();

      observer.disconnect();
    };
  }, [
    startPolling,
    stopPolling,
  ]);

  // =========================================================
  // RESET WHEN SUBSCRIBER CHANGES
  // =========================================================

  useEffect(() => {
    previousTraffic.current =
      null;

    setData(null);

    setSpeed({
      download: 0,
      upload: 0,
    });

    setError("");

    setLoading(true);
  }, [subscriber.id]);

  // =========================================================
  // FORMAT BYTES
  // =========================================================

  const formatBytes = (
    value?: number
  ) => {
    const bytes =
      Number(value) || 0;

    if (bytes <= 0) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
      "TB",
    ];

    let size = bytes;
    let index = 0;

    while (
      size >= 1024 &&
      index <
        units.length - 1
    ) {
      size /= 1024;
      index++;
    }

    return `${size.toFixed(2)} ${units[index]}`;
  };

  // =========================================================
  // FORMAT SPEED
  // =========================================================

  const formatSpeed = (
    mbps: number
  ) => {
    const value =
      Number(mbps) || 0;

    if (value <= 0) {
      return "0 Mbps";
    }

    if (value >= 1000) {
      return `${(
        value / 1000
      ).toFixed(2)} Gbps`;
    }

    if (value >= 1) {
      return `${value.toFixed(
        2
      )} Mbps`;
    }

    return `${(
      value * 1000
    ).toFixed(0)} Kbps`;
  };

  // =========================================================
  // FORMAT DURATION
  // =========================================================

  const formatDuration = (
    seconds?: number
  ) => {
    if (
      seconds === undefined ||
      seconds === null ||
      seconds <= 0
    ) {
      return "00:00:00";
    }

    let total =
      Math.floor(seconds);

    const days =
      Math.floor(
        total / 86400
      );

    total %= 86400;

    const hours =
      Math.floor(
        total / 3600
      );

    total %= 3600;

    const minutes =
      Math.floor(
        total / 60
      );

    const secs =
      total % 60;

    const hh =
      String(hours).padStart(
        2,
        "0"
      );

    const mm =
      String(minutes).padStart(
        2,
        "0"
      );

    const ss =
      String(secs).padStart(
        2,
        "0"
      );

    if (days > 0) {
      return `${days}d ${hh}:${mm}:${ss}`;
    }

    return `${hh}:${mm}:${ss}`;
  };

  // =========================================================
  // LIVE UPTIME
  // =========================================================

  const getLiveUptime = () => {
    if (
      data?.sessionTime !==
        undefined &&
      data?.sessionTime !== null &&
      data.sessionTime > 0
    ) {
      return formatDuration(
        data.sessionTime
      );
    }

    if (
      data?.uptime &&
      data.uptime !== "-"
    ) {
      return data.uptime;
    }

    const login =
      data?.loginTime ??
      data?.startTime;

    if (
      !login ||
      !data?.isOnline
    ) {
      return "00:00:00";
    }

    const start =
      new Date(
        login
      ).getTime();

    if (
      Number.isNaN(start)
    ) {
      return "00:00:00";
    }

    const seconds =
      Math.max(
        0,
        Math.floor(
          (Date.now() -
            start) /
            1000
        )
      );

    return formatDuration(
      seconds
    );
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (
    value?: string
  ) => {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "medium",
      }
    );
  };

  // =========================================================
  // TRAFFIC
  // =========================================================

  const downloadBytes =
    Number(
      data?.rxBytes ??
      data?.downloadBytes ??
      data?.inputOctets ??
      0
    );

  const uploadBytes =
    Number(
      data?.txBytes ??
      data?.uploadBytes ??
      data?.outputOctets ??
      0
    );

  const totalBytes =
    downloadBytes +
    uploadBytes;

  // =========================================================
  // USERNAME
  // =========================================================

  const username =
    data?.username ||
    data?.pppoeUsername ||
    subscriber?.ppPoEUsername ||
    subscriber?.pppoeUsername ||
    subscriber?.PPPoEUsername ||
    "-";

  // =========================================================
  // SESSION ID
  // =========================================================

  const sessionId =
    data?.sessionId ||
    data?.acctSessionId ||
    data?.routerSessionId ||
    "-";

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      ref={modalRef}
      className="modal show d-block"
      style={{
        background:
          "rgba(15,23,42,.65)",
        backdropFilter:
          "blur(7px)",
        zIndex: 2000,
      }}
    >
      <div
        className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
        style={{
          maxWidth: 1100,
        }}
      >
        <div
          className="modal-content border-0 shadow-lg"
          style={{
            borderRadius: 22,
            overflow: "hidden",
          }}
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <div
            className="px-4 py-3 text-white"
            style={{
              background:
                "linear-gradient(135deg,#2563eb,#4f46e5)",
            }}
          >
            <div className="d-flex justify-content-between align-items-center">

              <div className="d-flex align-items-center gap-3">

                <div
                  className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center fw-bold"
                  style={{
                    width: 48,
                    height: 48,
                    fontSize: 20,
                  }}
                >
                  {(
                    subscriber?.fullName ||
                    data?.subscriberName ||
                    username
                  )
                    ?.charAt(0)
                    ?.toUpperCase() ||
                    "S"}
                </div>

                <div>

                  <div
                    className="small opacity-75"
                    style={{
                      letterSpacing:
                        ".08em",
                    }}
                  >
                    SUBSCRIBER LIVE SESSION
                  </div>

                  <h5 className="mb-0 fw-bold">
                    {subscriber?.fullName ||
                      data?.subscriberName ||
                      username}
                  </h5>

                  <div className="small opacity-75 font-monospace">
                    {username}
                  </div>

                </div>

                <span
                  className={`badge rounded-pill px-3 py-2 ${
                    data?.isOnline
                      ? "bg-success"
                      : "bg-secondary"
                  }`}
                >
                  {data?.isOnline
                    ? "● ONLINE"
                    : "● OFFLINE"}
                </span>

              </div>

              <button
                type="button"
                className="btn btn-light btn-sm rounded-circle"
                style={{
                  width: 38,
                  height: 38,
                }}
                onClick={onClose}
              >
                ✕
              </button>

            </div>
          </div>

          {/* =================================================
              BODY
          ================================================= */}

          <div
            className="modal-body p-4"
            style={{
              background:
                "#f6f8fb",
            }}
          >

            {loading && !data ? (

              <div className="text-center py-5">

                <div className="spinner-border text-primary" />

                <div className="mt-3 text-muted">
                  Reading live
                  MikroTik/RADIUS
                  session...
                </div>

              </div>

            ) : error && !data ? (

              <div className="text-center py-5">

                <div className="text-danger fs-1">
                  ⚠️
                </div>

                <h5>
                  Unable to load session
                </h5>

                <p className="text-muted">
                  {error}
                </p>

                <button
                  className="btn btn-primary rounded-pill px-4"
                  onClick={() => {
                    setLoading(true);
                    load();
                  }}
                >
                  Retry
                </button>

              </div>

            ) : (

              <>

                {/* =================================================
                    TOP SUMMARY
                    ONLY CONNECTION + UPTIME
                    NO SPEED HERE
                ================================================= */}

                <div className="row g-3 mb-4">

                  <LiveCard
                    title="Connection"
                    value={
                      data?.isOnline
                        ? "ONLINE"
                        : "OFFLINE"
                    }
                    icon={
                      data?.isOnline
                        ? "🟢"
                        : "🔴"
                    }
                    color={
                      data?.isOnline
                        ? "success"
                        : "danger"
                    }
                  />

                  <LiveCard
                    title="Uptime"
                    value={
                      data?.isOnline
                        ? getLiveUptime()
                        : "-"
                    }
                    icon="⏱️"
                    color="primary"
                  />

                

                </div>

                {/* =================================================
                    CONNECTION
                ================================================= */}

                <Panel
                  title="Live Connection"
                  icon="📡"
                >

                  <div className="row g-3">

                    <Info
                      title="PPPoE Username"
                      value={username}
                    />

                    <Info
                      title="Service"
                      value={
                        data?.service ||
                        subscriber?.service ||
                        "PPPoE"
                      }
                    />

                    <Info
                      title="Current IP"
                      value={
                        data?.ipAddress
                      }
                    />

                    <Info
                      title="MAC Address"
                      value={
                        data?.macAddress ||
                        subscriber?.macAddress
                      }
                    />

                    <Info
                      title="Interface"
                      value={
                        data?.interfaceName
                      }
                    />

                    <Info
                      title="Session ID"
                      value={sessionId}
                    />

                  </div>

                </Panel>

                {/* =================================================
                    MIKROTIK
                ================================================= */}

                <Panel
                  title="MikroTik / NAS"
                  icon="🖥️"
                >

                  <div className="row g-3">

                    <Info
                      title="Router / NAS"
                      value={
                        data?.nasName ||
                        subscriber?.nasName ||
                        "-"
                      }
                    />

                    <Info
                      title="NAS IP"
                      value={
                        data?.nasIpAddress ||
                        subscriber?.nasIpAddress ||
                        "-"
                      }
                    />

                    <Info
                      title="Router Status"
                      value={
                        data?.online
                          ? "ONLINE"
                          : "OFFLINE"
                      }
                    />

                    <Info
                      title="Account Status"
                      value={
                        subscriber?.connectionEnabled
                          ? "ENABLED"
                          : "DISABLED"
                      }
                    />

                    <Info
                      title="Session Status"
                      value={
                        data?.isOnline
                          ? "ACTIVE"
                          : "NO ACTIVE SESSION"
                      }
                    />

                    <Info
                      title="Message"
                      value={
                        data?.message
                      }
                    />

                  </div>

                </Panel>

                {/* =================================================
                    ONLY ONE CURRENT SPEED SECTION
                ================================================= */}

                <Panel
                  title="Current Speed"
                  icon="🚀"
                >

                  <div className="row g-3">

                    <SpeedCard
                      title="Download Speed"
                      value={formatSpeed(
                        speed.download
                      )}
                      icon="⬇"
                      description="Current receive speed"
                    />

                    <SpeedCard
                      title="Upload Speed"
                      value={formatSpeed(
                        speed.upload
                      )}
                      icon="⬆"
                      description="Current transmit speed"
                    />

                  </div>

                </Panel>

                {/* =================================================
                    SESSION TRAFFIC
                    NO SPEED HERE
                ================================================= */}

                <Panel
                  title="Session Traffic"
                  icon="📈"
                >

                  <div className="row g-3">

                    <TrafficCard
                      title="Downloaded"
                      value={formatBytes(
                        downloadBytes
                      )}
                      icon="⬇️"
                    />

                    <TrafficCard
                      title="Uploaded"
                      value={formatBytes(
                        uploadBytes
                      )}
                      icon="⬆️"
                    />

                    <TrafficCard
                      title="Total Traffic"
                      value={formatBytes(
                        totalBytes
                      )}
                      icon="📊"
                    />

                  </div>

                </Panel>

                {/* =================================================
                    SESSION TIMING
                ================================================= */}

                <Panel
                  title="Session Timing"
                  icon="🕒"
                >

                  <div className="row g-3">

                    <Info
                      title="Login Time"
                      value={formatDate(
                        data?.loginTime ||
                        data?.startTime
                      )}
                    />

                    <Info
                      title="Last Update"
                      value={formatDate(
                        data?.timestamp ||
                        data?.lastUpdate
                      )}
                    />

                    <Info
                      title="Session Duration"
                      value={
                        data?.isOnline
                          ? getLiveUptime()
                          : "-"
                      }
                    />

                    <Info
                      title="RX Bytes"
                      value={formatBytes(
                        data?.rxBytes
                      )}
                    />

                    <Info
                      title="TX Bytes"
                      value={formatBytes(
                        data?.txBytes
                      )}
                    />

                    <Info
                      title="Session ID"
                      value={sessionId}
                    />

                  </div>

                </Panel>

                {/* =================================================
                    OFFLINE
                ================================================= */}

                {!data?.isOnline && (

                  <div className="alert alert-warning border-0 rounded-4 shadow-sm">

                    <div className="d-flex gap-3">

                      <div className="fs-4">
                        ⚠️
                      </div>

                      <div>

                        <div className="fw-bold">
                          Subscriber is currently offline
                        </div>

                        <div className="small mt-1">
                          There is currently no
                          active PPPoE/RADIUS
                          session for this subscriber.
                        </div>

                      </div>

                    </div>

                  </div>

                )}

                {/* =================================================
                    ERROR
                ================================================= */}

                {error && data && (

                  <div className="alert alert-warning small rounded-3">
                    {error}
                  </div>

                )}

                {/* =================================================
                    REFRESH INFO
                ================================================= */}

                <div className="d-flex justify-content-between align-items-center mt-2">

                  <span className="small text-muted">
                    ● Live refresh every 5 seconds
                  </span>

                  <span className="small text-muted">
                    {lastRefresh
                      ? `Last update: ${lastRefresh.toLocaleTimeString(
                          "en-IN"
                        )}`
                      : ""}
                  </span>

                </div>

              </>

            )}

          </div>

          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="modal-footer bg-white border-top px-4">

            <button
              type="button"
              className="btn btn-light border rounded-pill px-4"
              onClick={() => {
                setLoading(true);
                load();
              }}
            >
              🔄 Refresh
            </button>

            <button
              type="button"
              className="btn btn-dark rounded-pill px-4"
              onClick={onClose}
            >
              Close
            </button>

          </div>

        </div>
      </div>
    </div>
  );
};

// =============================================================
// PANEL
// =============================================================

const Panel = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="bg-white rounded-4 shadow-sm border-0 p-4 mb-4">

      <div className="d-flex align-items-center gap-2 mb-3">

        <span
          className="d-flex align-items-center justify-content-center rounded-3 bg-primary-subtle"
          style={{
            width: 38,
            height: 38,
            fontSize: 18,
          }}
        >
          {icon}
        </span>

        <h6 className="fw-bold mb-0">
          {title}
        </h6>

      </div>

      {children}

    </div>
  );
};

// =============================================================
// INFO
// =============================================================

const Info = ({
  title,
  value,
}: {
  title: string;
  value: any;
}) => {
  return (
    <div className="col-lg-4 col-md-6">

      <div
        className="border rounded-3 p-3 h-100"
        style={{
          background:
            "#f8fafc",
        }}
      >

        <div className="text-muted small mb-1">
          {title}
        </div>

        <div
          className="fw-semibold text-dark text-break"
          style={{
            fontFamily:
              "monospace",
          }}
        >
          {value !== undefined &&
          value !== null &&
          value !== ""
            ? value
            : "-"}
        </div>

      </div>

    </div>
  );
};

// =============================================================
// LIVE CARD
// =============================================================

const LiveCard = ({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: string;
  color:
    | "success"
    | "danger"
    | "primary"
    | "info"
    | "warning";
}) => {

  const backgrounds: Record<
    string,
    string
  > = {
    success:
      "#ecfdf5",
    danger:
      "#fef2f2",
    primary:
      "#eff6ff",
    info:
      "#ecfeff",
    warning:
      "#fffbeb",
  };

  const textColors: Record<
    string,
    string
  > = {
    success:
      "#059669",
    danger:
      "#dc2626",
    primary:
      "#2563eb",
    info:
      "#0891b2",
    warning:
      "#d97706",
  };

  return (
    <div className="col-lg-3 col-md-6">

      <div
        className="rounded-4 p-3 border h-100"
        style={{
          background:
            backgrounds[color],
          borderColor:
            "#e5e7eb",
        }}
      >

        <div className="d-flex justify-content-between">

          <div>

            <div className="small text-muted">
              {title}
            </div>

            <div
              className="fw-bold fs-5 mt-1"
              style={{
                color:
                  textColors[color],
              }}
            >
              {value}
            </div>

          </div>

          <div
            style={{
              fontSize: 24,
            }}
          >
            {icon}
          </div>

        </div>

      </div>

    </div>
  );
};

// =============================================================
// SPEED CARD
// =============================================================

const SpeedCard = ({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string;
  icon: string;
  description: string;
}) => {

  return (
    <div className="col-lg-6">

      <div
        className="rounded-4 p-4 h-100 border"
        style={{
          background:
            "linear-gradient(135deg,#f8fbff,#ffffff)",
        }}
      >

        <div className="d-flex justify-content-between">

          <div>

            <div className="text-muted small">
              {title}
            </div>

            <div className="fw-bold fs-2 text-primary mt-1">
              {value}
            </div>

            <div className="text-muted small mt-1">
              {description}
            </div>

          </div>

          <div
            className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center"
            style={{
              width: 50,
              height: 50,
              fontSize: 22,
            }}
          >
            {icon}
          </div>

        </div>

      </div>

    </div>
  );
};

// =============================================================
// TRAFFIC CARD
// =============================================================

const TrafficCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) => {

  return (
    <div className="col-lg-4">

      <div className="border rounded-4 p-3 bg-light h-100">

        <div className="d-flex justify-content-between">

          <div>

            <div className="text-muted small">
              {title}
            </div>

            <div className="fw-bold fs-4 mt-1">
              {value}
            </div>

          </div>

          <div className="fs-3">
            {icon}
          </div>

        </div>

      </div>

    </div>
  );
};

export default SubscriberLiveModal;
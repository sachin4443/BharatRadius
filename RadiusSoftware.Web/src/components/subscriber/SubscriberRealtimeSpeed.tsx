import React, { useEffect, useState } from "react";
import apiClient from "../../services/api";

interface Props {
  subscriberId: string;
}

interface LiveSpeedData {
  isOnline: boolean;

  username?: string;
  ipAddress?: string;
  macAddress?: string;

  downloadMbps: number;
  uploadMbps: number;

  downloadBps?: number;
  uploadBps?: number;

  totalDownloadBytes?: number;
  totalUploadBytes?: number;

  uptime?: string;
  sessionId?: string;

  lastUpdated?: string;
}

const SubscriberRealtimeSpeed: React.FC<Props> = ({
  subscriberId,
}) => {
  const [data, setData] = useState<LiveSpeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSpeed = async () => {
    try {
      const response = await apiClient.get(
        `/Subscribers/${subscriberId}/live-speed`,
      );

      setData(response.data);
      setError("");
    } catch (err: any) {
      console.error("Live speed error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to read live speed.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpeed();

    const timer = window.setInterval(() => {
      loadSpeed();
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [subscriberId]);

  const formatSpeed = (mbps?: number) => {
    if (!mbps || mbps <= 0) {
      return "0.00 Mbps";
    }

    if (mbps >= 1000) {
      return `${(mbps / 1000).toFixed(2)} Gbps`;
    }

    return `${mbps.toFixed(2)} Mbps`;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) {
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
      index < units.length - 1
    ) {
      size /= 1024;
      index++;
    }

    return `${size.toFixed(2)} ${units[index]}`;
  };

  if (loading && !data) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4 text-center">
          <div
            className="spinner-border spinner-border-sm text-primary"
            role="status"
          />

          <div className="mt-2 text-muted small">
            Reading live subscriber speed...
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="text-danger fw-semibold">
            Live Speed Unavailable
          </div>

          <div className="text-muted small mt-1">
            {error}
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-primary mt-3"
            onClick={loadSpeed}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const online = Boolean(data?.isOnline);

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4">

        {/* HEADER */}
        <div className="d-flex justify-content-between align-items-center mb-4">

          <div>
            <div className="text-muted small">
              REALTIME NETWORK
            </div>

            <h5 className="fw-bold mb-0">
              Live Speed
            </h5>
          </div>

          <div
            className={`badge rounded-pill px-3 py-2 ${
              online
                ? "bg-success"
                : "bg-secondary"
            }`}
          >
            {online
              ? "● LIVE"
              : "● OFFLINE"}
          </div>

        </div>

        {!online ? (
          <div className="text-center py-4">

            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
              style={{
                width: 64,
                height: 64,
                background: "#f1f5f9",
                fontSize: 28,
              }}
            >
              📡
            </div>

            <h6 className="fw-bold">
              Subscriber Offline
            </h6>

            <div className="text-muted small">
              Live speed is available when the
              PPPoE session is connected.
            </div>

          </div>
        ) : (
          <>
            {/* SPEED CARDS */}
            <div className="row g-3">

              {/* DOWNLOAD */}
              <div className="col-md-6">

                <div
                  className="rounded-4 p-4 h-100"
                  style={{
                    background:
                      "linear-gradient(135deg,#eff6ff,#ffffff)",
                    border:
                      "1px solid #dbeafe",
                  }}
                >

                  <div className="d-flex justify-content-between">

                    <div>
                      <div className="text-muted small">
                        Download
                      </div>

                      <div
                        className="fw-bold mt-1"
                        style={{
                          fontSize: 28,
                        }}
                      >
                        {formatSpeed(
                          data?.downloadMbps,
                        )}
                      </div>

                      <div className="text-muted small mt-1">
                        Current receive speed
                      </div>
                    </div>

                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: 50,
                        height: 50,
                        background: "#dbeafe",
                        fontSize: 22,
                      }}
                    >
                      ↓
                    </div>

                  </div>

                </div>

              </div>

              {/* UPLOAD */}
              <div className="col-md-6">

                <div
                  className="rounded-4 p-4 h-100"
                  style={{
                    background:
                      "linear-gradient(135deg,#ecfdf5,#ffffff)",
                    border:
                      "1px solid #d1fae5",
                  }}
                >

                  <div className="d-flex justify-content-between">

                    <div>
                      <div className="text-muted small">
                        Upload
                      </div>

                      <div
                        className="fw-bold mt-1"
                        style={{
                          fontSize: 28,
                        }}
                      >
                        {formatSpeed(
                          data?.uploadMbps,
                        )}
                      </div>

                      <div className="text-muted small mt-1">
                        Current transmit speed
                      </div>
                    </div>

                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: 50,
                        height: 50,
                        background: "#d1fae5",
                        fontSize: 22,
                      }}
                    >
                      ↑
                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* SESSION INFORMATION */}
            <div className="row g-3 mt-1">

              <Info
                title="IP Address"
                value={data?.ipAddress}
              />

              <Info
                title="MAC Address"
                value={data?.macAddress}
              />

              <Info
                title="Session ID"
                value={data?.sessionId}
              />

              <Info
                title="Uptime"
                value={data?.uptime}
              />

              <Info
                title="Download Total"
                value={formatBytes(
                  data?.totalDownloadBytes,
                )}
              />

              <Info
                title="Upload Total"
                value={formatBytes(
                  data?.totalUploadBytes,
                )}
              />

            </div>

            <div className="text-muted small mt-3">
              ● Updating automatically every 2 seconds
            </div>

          </>
        )}

      </div>
    </div>
  );
};

interface InfoProps {
  title: string;
  value?: string;
}

const Info: React.FC<InfoProps> = ({
  title,
  value,
}) => {
  return (
    <div className="col-md-4">

      <div
        className="p-3 rounded-3"
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
        }}
      >

        <div className="text-muted small">
          {title}
        </div>

        <div
          className="fw-semibold mt-1 text-truncate"
          title={value || "-"}
        >
          {value || "-"}
        </div>

      </div>

    </div>
  );
};

export default SubscriberRealtimeSpeed;
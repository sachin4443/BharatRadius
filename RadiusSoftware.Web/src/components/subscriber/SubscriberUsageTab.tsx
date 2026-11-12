import React, { useEffect, useMemo, useState } from "react";

interface SubscriberUsageTabProps {
  subscriber: any;
  liveData: any;
  loading?: boolean;
  onRefresh: () => void;
}

interface TrafficPoint {
  time: string;
  download: number;
  upload: number;
}

const SubscriberUsageTab: React.FC<
  SubscriberUsageTabProps
> = ({
  subscriber,
  liveData,
  loading = false,
  onRefresh,
}) => {
  const [trafficHistory, setTrafficHistory] =
    useState<TrafficPoint[]>([]);

  // ============================================================
  // HELPERS
  // ============================================================

  const bytesToSize = (bytes: number) => {
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

    let value = bytes;
    let index = 0;

    while (
      value >= 1024 &&
      index < units.length - 1
    ) {
      value /= 1024;
      index++;
    }

    return `${value.toFixed(2)} ${units[index]}`;
  };

  const formatDate = (value: any) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  };

  const formatDuration = (
    seconds: number,
  ) => {
    if (!seconds || seconds <= 0) {
      return "0s";
    }

    const days = Math.floor(
      seconds / 86400,
    );

    const hours = Math.floor(
      (seconds % 86400) / 3600,
    );

    const minutes = Math.floor(
      (seconds % 3600) / 60,
    );

    const secs = Math.floor(
      seconds % 60,
    );

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days}d`);
    }

    if (hours > 0) {
      parts.push(`${hours}h`);
    }

    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }

    parts.push(`${secs}s`);

    return parts.join(" ");
  };

  const getValue = (
    ...values: any[]
  ) => {
    return values.find(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== "",
    );
  };

  // ============================================================
  // REAL ACCOUNTING VALUES
  // ============================================================

  const downloadBytes = Number(
    getValue(
      liveData?.inputOctets,
      liveData?.downloadBytes,
      0,
    ),
  );

  const uploadBytes = Number(
    getValue(
      liveData?.outputOctets,
      liveData?.uploadBytes,
      0,
    ),
  );

  const downloadPackets = Number(
    getValue(
      liveData?.inputPackets,
      0,
    ),
  );

  const uploadPackets = Number(
    getValue(
      liveData?.outputPackets,
      0,
    ),
  );

  const totalBytes =
    downloadBytes + uploadBytes;

  const sessionTime = Number(
    getValue(
      liveData?.sessionTime,
      liveData?.acctSessionTime,
      0,
    ),
  );

  // ============================================================
  // TRAFFIC %
  // ============================================================

  const downloadPercent = useMemo(() => {
    if (totalBytes <= 0) {
      return 0;
    }

    return Math.round(
      (downloadBytes / totalBytes) *
        100,
    );
  }, [
    downloadBytes,
    totalBytes,
  ]);

  const uploadPercent =
    totalBytes > 0
      ? 100 - downloadPercent
      : 0;

  // ============================================================
  // UPDATE GRAPH
  // ============================================================

  useEffect(() => {
    if (!liveData) {
      return;
    }

    const now = new Date();

    const time =
      now.toLocaleTimeString(
        "en-IN",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      );

    setTrafficHistory(
      (previous) => [
        ...previous,
        {
          time,
          download: downloadBytes,
          upload: uploadBytes,
        },
      ].slice(-30),
    );
  }, [
    liveData,
    downloadBytes,
    uploadBytes,
  ]);

  // ============================================================
  // SESSION DATA
  // ============================================================

  const sessionId =
    getValue(
      liveData?.acctSessionId,
      liveData?.routerSessionId,
      liveData?.sessionId,
    ) || "-";

  const ipAddress =
    getValue(
      liveData?.ipAddress,
      liveData?.framedIpAddress,
    ) || "-";

  const macAddress =
    getValue(
      liveData?.macAddress,
      liveData?.callingStationId,
      subscriber?.macAddress,
    ) || "-";

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="d-flex justify-content-between align-items-center mb-4">

        <div>
          <h5 className="fw-bold mb-1">
            Usage & Traffic
          </h5>

          <div className="text-muted small">
            RADIUS accounting and subscriber
            traffic statistics
          </div>
        </div>

        <button
          type="button"
          className="btn btn-light border rounded-pill px-3"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Updating...
            </>
          ) : (
            <>
              🔄 Refresh Usage
            </>
          )}
        </button>

      </div>

      {/* ======================================================
          SUMMARY CARDS
      ====================================================== */}

      <div className="row g-3 mb-4">

        <UsageCard
          title="Download"
          value={bytesToSize(
            downloadBytes,
          )}
          subtitle={`${downloadPackets.toLocaleString()} packets`}
          icon="⬇"
          type="download"
        />

        <UsageCard
          title="Upload"
          value={bytesToSize(
            uploadBytes,
          )}
          subtitle={`${uploadPackets.toLocaleString()} packets`}
          icon="⬆"
          type="upload"
        />

        <UsageCard
          title="Total Traffic"
          value={bytesToSize(
            totalBytes,
          )}
          subtitle="Download + Upload"
          icon="📊"
          type="total"
        />

        <UsageCard
          title="Session Time"
          value={formatDuration(
            sessionTime,
          )}
          subtitle="Current accounting session"
          icon="⏱"
          type="time"
        />

      </div>

      {/* ======================================================
          TRAFFIC DISTRIBUTION
      ====================================================== */}

      <div className="row g-4 mb-4">

        <div className="col-lg-7">

          <div className="card border-0 shadow-sm rounded-4 h-100">

            <div className="card-body p-4">

              <div className="d-flex justify-content-between align-items-center mb-4">

                <div>
                  <h6 className="fw-bold mb-1">
                    Traffic Distribution
                  </h6>

                  <div className="text-muted small">
                    Session traffic breakdown
                  </div>
                </div>

                <span className="badge bg-light text-dark rounded-pill">
                  LIVE ACCOUNTING
                </span>

              </div>

              {/* DOWNLOAD */}

              <div className="mb-4">

                <div className="d-flex justify-content-between mb-2">

                  <span className="small fw-semibold">
                    Download
                  </span>

                  <span className="small fw-bold text-primary">
                    {downloadPercent}%
                  </span>

                </div>

                <div
                  className="progress"
                  style={{
                    height: 10,
                    borderRadius: 20,
                  }}
                >
                  <div
                    className="progress-bar bg-primary"
                    style={{
                      width: `${downloadPercent}%`,
                    }}
                  />
                </div>

                <div className="d-flex justify-content-between mt-2">

                  <span className="text-muted small">
                    {bytesToSize(
                      downloadBytes,
                    )}
                  </span>

                  <span className="text-muted small">
                    {downloadPackets.toLocaleString()} packets
                  </span>

                </div>

              </div>

              {/* UPLOAD */}

              <div>

                <div className="d-flex justify-content-between mb-2">

                  <span className="small fw-semibold">
                    Upload
                  </span>

                  <span className="small fw-bold text-success">
                    {uploadPercent}%
                  </span>

                </div>

                <div
                  className="progress"
                  style={{
                    height: 10,
                    borderRadius: 20,
                  }}
                >
                  <div
                    className="progress-bar bg-success"
                    style={{
                      width: `${uploadPercent}%`,
                    }}
                  />
                </div>

                <div className="d-flex justify-content-between mt-2">

                  <span className="text-muted small">
                    {bytesToSize(
                      uploadBytes,
                    )}
                  </span>

                  <span className="text-muted small">
                    {uploadPackets.toLocaleString()} packets
                  </span>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* TOTAL */}

        <div className="col-lg-5">

          <div className="card border-0 shadow-sm rounded-4 h-100">

            <div className="card-body p-4">

              <h6 className="fw-bold mb-4">
                Traffic Summary
              </h6>

              <div className="text-center mb-4">

                <div
                  className="rounded-circle mx-auto d-flex align-items-center justify-content-center"
                  style={{
                    width: 150,
                    height: 150,
                    background:
                      "linear-gradient(135deg,#eff6ff,#ecfdf5)",
                  }}
                >

                  <div>

                    <div className="text-muted small">
                      TOTAL
                    </div>

                    <div
                      className="fw-bold"
                      style={{
                        fontSize: 24,
                      }}
                    >
                      {bytesToSize(
                        totalBytes,
                      )}
                    </div>

                  </div>

                </div>

              </div>

              <div className="row g-2">

                <div className="col-6">

                  <div className="bg-light rounded-3 p-3">

                    <div className="text-muted small">
                      Download
                    </div>

                    <div className="fw-bold text-primary">
                      {bytesToSize(
                        downloadBytes,
                      )}
                    </div>

                  </div>

                </div>

                <div className="col-6">

                  <div className="bg-light rounded-3 p-3">

                    <div className="text-muted small">
                      Upload
                    </div>

                    <div className="fw-bold text-success">
                      {bytesToSize(
                        uploadBytes,
                      )}
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ======================================================
          TRAFFIC GRAPH
      ====================================================== */}

      <div className="card border-0 shadow-sm rounded-4 mb-4">

        <div className="card-body p-4">

          <div className="d-flex justify-content-between align-items-center mb-3">

            <div>
              <h6 className="fw-bold mb-1">
                Traffic History
              </h6>

              <div className="text-muted small">
                Recent RADIUS accounting updates
              </div>
            </div>

            <div className="d-flex gap-3 small">

              <span>
                <span
                  className="d-inline-block rounded-circle me-1"
                  style={{
                    width: 8,
                    height: 8,
                    background:
                      "#2563eb",
                  }}
                />

                Download
              </span>

              <span>
                <span
                  className="d-inline-block rounded-circle me-1"
                  style={{
                    width: 8,
                    height: 8,
                    background:
                      "#16a34a",
                  }}
                />

                Upload
              </span>

            </div>

          </div>

          <TrafficChart
            data={trafficHistory}
          />

        </div>

      </div>

      {/* ======================================================
          ACCOUNTING DETAILS
      ====================================================== */}

      <div className="card border-0 shadow-sm rounded-4 mb-4">

        <div className="card-body p-4">

          <h6 className="fw-bold mb-3">
            Accounting Details
          </h6>

          <div className="row g-3">

            <Detail
              label="Session ID"
              value={sessionId}
              mono
            />

            <Detail
              label="Current IP"
              value={ipAddress}
              mono
            />

            <Detail
              label="MAC Address"
              value={macAddress}
              mono
            />

            <Detail
              label="Input Packets"
              value={downloadPackets.toLocaleString()}
            />

            <Detail
              label="Output Packets"
              value={uploadPackets.toLocaleString()}
            />

            <Detail
              label="Session Time"
              value={formatDuration(
                sessionTime,
              )}
            />

            <Detail
              label="Start Time"
              value={formatDate(
                liveData?.startTime,
              )}
            />

            <Detail
              label="Last Update"
              value={formatDate(
                liveData?.lastUpdate ||
                  liveData?.lastUpdateTime,
              )}
            />

          </div>

        </div>

      </div>

      {/* ======================================================
          TRAFFIC NOTE
      ====================================================== */}

      <div className="alert alert-info border-0 rounded-4">

        <div className="fw-semibold mb-1">
          ℹ About Usage Data
        </div>

        <div className="small">
          Usage shown here is based on the
          latest RADIUS accounting data
          received for this subscriber.
          Values update whenever new
          accounting information is received.
        </div>

      </div>

    </div>
  );
};

// ============================================================
// USAGE CARD
// ============================================================

const UsageCard = ({
  title,
  value,
  subtitle,
  icon,
  type,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  type:
    | "download"
    | "upload"
    | "total"
    | "time";
}) => {
  const textClass =
    type === "download"
      ? "text-primary"
      : type === "upload"
        ? "text-success"
        : type === "total"
          ? "text-dark"
          : "text-warning";

  return (
    <div className="col-xl-3 col-md-6">

      <div className="card border-0 shadow-sm rounded-4 h-100">

        <div className="card-body p-4">

          <div className="d-flex justify-content-between">

            <div>

              <div className="text-muted small">
                {title}
              </div>

              <div
                className={`fw-bold mt-1 ${textClass}`}
                style={{
                  fontSize: 23,
                }}
              >
                {value}
              </div>

              <div className="text-muted small mt-1">
                {subtitle}
              </div>

            </div>

            <div
              className="rounded-circle bg-light d-flex align-items-center justify-content-center"
              style={{
                width: 45,
                height: 45,
                fontSize: 20,
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

// ============================================================
// DETAIL
// ============================================================

const Detail = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: any;
  mono?: boolean;
}) => {
  return (
    <div className="col-md-6">

      <div className="bg-light rounded-3 p-3">

        <div className="text-muted small mb-1">
          {label}
        </div>

        <div
          className={`fw-semibold ${
            mono
              ? "font-monospace"
              : ""
          }`}
        >
          {value || "-"}
        </div>

      </div>

    </div>
  );
};

// ============================================================
// TRAFFIC GRAPH
// ============================================================

const TrafficChart = ({
  data,
}: {
  data: TrafficPoint[];
}) => {
  const width = 900;
  const height = 280;

  if (!data.length) {
    return (
      <div
        className="d-flex align-items-center justify-content-center text-muted"
        style={{
          height: 280,
        }}
      >
        Waiting for accounting data...
      </div>
    );
  }

  const max = Math.max(
    1,
    ...data.flatMap((item) => [
      item.download,
      item.upload,
    ]),
  );

  const getPoint = (
    value: number,
    index: number,
  ) => {
    const x =
      20 +
      (index /
        Math.max(
          1,
          data.length - 1,
        )) *
        (width - 40);

    const y =
      height -
      25 -
      (value / max) *
        (height - 50);

    return `${x},${y}`;
  };

  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
      }}
    >

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="280"
      >

        {[0, 1, 2, 3, 4].map(
          (line) => {
            const y =
              25 +
              ((height - 50) /
                4) *
                line;

            return (
              <line
                key={line}
                x1="20"
                x2={
                  width - 20
                }
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
              />
            );
          },
        )}

        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={data
            .map(
              (item, index) =>
                getPoint(
                  item.download,
                  index,
                ),
            )
            .join(" ")}
        />

        <polyline
          fill="none"
          stroke="#16a34a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={data
            .map(
              (item, index) =>
                getPoint(
                  item.upload,
                  index,
                ),
            )
            .join(" ")}
        />

      </svg>

    </div>
  );
};

export default SubscriberUsageTab;
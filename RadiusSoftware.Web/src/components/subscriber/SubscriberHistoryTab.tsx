import React, { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/api";

interface Props {
  subscriber: any;
}

interface SessionHistory {
  id: string;
  username: string;
  sessionId: string;
  status: string;
  isActive: boolean;

  ipAddress?: string;
  macAddress?: string;
  nasIpAddress?: string;
  nasName?: string;
  serviceType?: string;

  startTime?: string;
  lastUpdateTime?: string;
  stopTime?: string;

  sessionTime: number;

  inputOctets: number;
  outputOctets: number;

  inputPackets: number;
  outputPackets: number;

  terminateCause?: string;

  totalBytes: number;
}

const SubscriberHistoryTab: React.FC<Props> = ({
  subscriber,
}) => {
  const [sessions, setSessions] = useState<
    SessionHistory[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [selectedSession, setSelectedSession] =
    useState<SessionHistory | null>(null);

  const [filter, setFilter] =
    useState("ALL");

  const [search, setSearch] =
    useState("");

  const loadHistory = async () => {
    try {
      setLoading(true);

      const response =
        await apiClient.get(
          `/Subscribers/${subscriber.id}/history`,
        );

      setSessions(
        response.data?.data || [],
      );
    } catch (error) {
      console.error(
        "Subscriber history error:",
        error,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [subscriber.id]);

  // ==========================================================
  // HELPERS
  // ==========================================================

  const formatBytes = (
    bytes: number,
  ) => {
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

  const formatDate = (
    value?: string,
  ) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    );
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

    if (days) {
      parts.push(`${days}d`);
    }

    if (hours) {
      parts.push(`${hours}h`);
    }

    if (minutes) {
      parts.push(`${minutes}m`);
    }

    if (secs || parts.length === 0) {
      parts.push(`${secs}s`);
    }

    return parts.join(" ");
  };

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredSessions =
    useMemo(() => {
      return sessions.filter(
        (session) => {
          const matchesFilter =
            filter === "ALL" ||
            (filter === "ONLINE" &&
              session.isActive) ||
            (filter === "DISCONNECTED" &&
              !session.isActive);

          const text =
            `${session.sessionId}
             ${session.ipAddress}
             ${session.macAddress}
             ${session.nasName}
             ${session.terminateCause}`
              .toLowerCase();

          const matchesSearch =
            !search ||
            text.includes(
              search.toLowerCase(),
            );

          return (
            matchesFilter &&
            matchesSearch
          );
        },
      );
    }, [
      sessions,
      filter,
      search,
    ]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const totalSessions =
    sessions.length;

  const activeSessions =
    sessions.filter(
      (x) => x.isActive,
    ).length;

  const disconnectedSessions =
    sessions.filter(
      (x) => !x.isActive,
    ).length;

  const totalTraffic =
    sessions.reduce(
      (sum, x) =>
        sum + x.totalBytes,
      0,
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="d-flex justify-content-between align-items-center mb-4">

        <div>
          <h5 className="fw-bold mb-1">
            Session History
          </h5>

          <div className="text-muted small">
            Complete PPPoE connection and
            disconnection history
          </div>
        </div>

        <button
          type="button"
          className="btn btn-light border rounded-pill px-3"
          onClick={loadHistory}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Loading...
            </>
          ) : (
            <>
              🔄 Refresh History
            </>
          )}
        </button>

      </div>

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div className="row g-3 mb-4">

        <SummaryCard
          title="Total Sessions"
          value={totalSessions}
          icon="📡"
        />

        <SummaryCard
          title="Currently Online"
          value={activeSessions}
          icon="🟢"
          color="success"
        />

        <SummaryCard
          title="Disconnected"
          value={disconnectedSessions}
          icon="🔴"
          color="danger"
        />

        <SummaryCard
          title="Total Traffic"
          value={formatBytes(
            totalTraffic,
          )}
          icon="📊"
          color="primary"
        />

      </div>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="card border-0 shadow-sm rounded-4 mb-4">

        <div className="card-body p-3">

          <div className="row g-2">

            <div className="col-lg-7">

              <div className="input-group">

                <span className="input-group-text bg-white">
                  🔎
                </span>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Search session, IP, MAC, NAS..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value,
                    )
                  }
                />

              </div>

            </div>

            <div className="col-lg-5">

              <div className="btn-group w-100">

                <button
                  className={`btn ${
                    filter === "ALL"
                      ? "btn-primary"
                      : "btn-light border"
                  }`}
                  onClick={() =>
                    setFilter("ALL")
                  }
                >
                  All
                </button>

                <button
                  className={`btn ${
                    filter === "ONLINE"
                      ? "btn-success"
                      : "btn-light border"
                  }`}
                  onClick={() =>
                    setFilter(
                      "ONLINE",
                    )
                  }
                >
                  Online
                </button>

                <button
                  className={`btn ${
                    filter ===
                    "DISCONNECTED"
                      ? "btn-danger"
                      : "btn-light border"
                  }`}
                  onClick={() =>
                    setFilter(
                      "DISCONNECTED",
                    )
                  }
                >
                  Disconnected
                </button>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ======================================================
          HISTORY
      ====================================================== */}

      <div className="card border-0 shadow-sm rounded-4">

        <div className="card-body p-0">

          <div className="p-4 border-bottom">

            <h6 className="fw-bold mb-1">
              Connection Timeline
            </h6>

            <div className="text-muted small">
              {filteredSessions.length} session
              {filteredSessions.length !== 1
                ? "s"
                : ""}{" "}
              found
            </div>

          </div>

          {loading ? (
            <div className="text-center py-5">

              <div className="spinner-border text-primary" />

              <div className="text-muted mt-2">
                Loading session history...
              </div>

            </div>
          ) : filteredSessions.length ===
            0 ? (
            <div className="text-center py-5">

              <div
                style={{
                  fontSize: 42,
                }}
              >
                📭
              </div>

              <h6 className="fw-bold mt-3">
                No session history
              </h6>

              <div className="text-muted">
                No RADIUS accounting session
                records found for this
                subscriber.
              </div>

            </div>
          ) : (
            <div>

              {filteredSessions.map(
                (
                  session,
                  index,
                ) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    index={index}
                    formatBytes={
                      formatBytes
                    }
                    formatDate={
                      formatDate
                    }
                    formatDuration={
                      formatDuration
                    }
                    onClick={() =>
                      setSelectedSession(
                        session,
                      )
                    }
                  />
                ),
              )}

            </div>
          )}

        </div>

      </div>

      {/* ======================================================
          DETAIL MODAL
      ====================================================== */}

      {selectedSession && (
        <SessionDetailModal
          session={
            selectedSession
          }
          onClose={() =>
            setSelectedSession(
              null,
            )
          }
          formatBytes={
            formatBytes
          }
          formatDate={
            formatDate
          }
          formatDuration={
            formatDuration
          }
        />
      )}

    </div>
  );
};

export default SubscriberHistoryTab;

// ============================================================
// SUMMARY CARD
// ============================================================

const SummaryCard = ({
  title,
  value,
  icon,
  color = "dark",
}: {
  title: string;
  value: any;
  icon: string;
  color?: string;
}) => {
  return (
    <div className="col-xl-3 col-md-6">

      <div className="card border-0 shadow-sm rounded-4 h-100">

        <div className="card-body p-4">

          <div className="d-flex justify-content-between align-items-center">

            <div>

              <div className="text-muted small">
                {title}
              </div>

              <div
                className={`fw-bold text-${color}`}
                style={{
                  fontSize: 24,
                }}
              >
                {value}
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
// SESSION ROW
// ============================================================

const SessionRow = ({
  session,
  index,
  formatBytes,
  formatDate,
  formatDuration,
  onClick,
}: {
  session: SessionHistory;
  index: number;
  formatBytes: (
    value: number,
  ) => string;
  formatDate: (
    value?: string,
  ) => string;
  formatDuration: (
    value: number,
  ) => string;
  onClick: () => void;
}) => {
  const online =
    session.isActive;

  return (
    <div
      className="p-4 border-bottom"
      style={{
        cursor: "pointer",
      }}
      onClick={onClick}
    >

      <div className="row align-items-center g-3">

        {/* TIMELINE */}

        <div className="col-auto">

          <div
            className={`rounded-circle d-flex align-items-center justify-content-center ${
              online
                ? "bg-success"
                : "bg-danger"
            }`}
            style={{
              width: 42,
              height: 42,
              color: "white",
            }}
          >
            {online
              ? "✓"
              : "↔"}
          </div>

        </div>

        {/* SESSION */}

        <div className="col-lg-3">

          <div className="fw-bold">
            {online
              ? "Active Session"
              : "Disconnected"}
          </div>

          <div className="text-muted small font-monospace">
            {session.sessionId ||
              "-"}
          </div>

        </div>

        {/* START */}

        <div className="col-lg-2">

          <div className="text-muted small">
            Started
          </div>

          <div className="small fw-semibold">
            {formatDate(
              session.startTime,
            )}
          </div>

        </div>

        {/* END */}

        <div className="col-lg-2">

          <div className="text-muted small">
            {online
              ? "Last Update"
              : "Disconnected"}
          </div>

          <div className="small fw-semibold">
            {formatDate(
              online
                ? session.lastUpdateTime
                : session.stopTime,
            )}
          </div>

        </div>

        {/* DURATION */}

        <div className="col-lg-1">

          <div className="text-muted small">
            Duration
          </div>

          <div className="small fw-semibold">
            {formatDuration(
              session.sessionTime,
            )}
          </div>

        </div>

        {/* TRAFFIC */}

        <div className="col-lg-2">

          <div className="text-muted small">
            Traffic
          </div>

          <div className="small fw-semibold">
            {formatBytes(
              session.totalBytes,
            )}
          </div>

          <div className="text-muted small">
            ↓{" "}
            {formatBytes(
              session.inputOctets,
            )}{" "}
            · ↑{" "}
            {formatBytes(
              session.outputOctets,
            )}
          </div>

        </div>

      </div>

      {/* EXTRA INFO */}

      <div className="mt-3 pt-3 border-top">

        <div className="row g-2">

          <div className="col-md-3">

            <span className="text-muted small">
              IP
            </span>

            <div className="font-monospace small">
              {session.ipAddress ||
                "-"}
            </div>

          </div>

          <div className="col-md-3">

            <span className="text-muted small">
              MAC
            </span>

            <div className="font-monospace small">
              {session.macAddress ||
                "-"}
            </div>

          </div>

          <div className="col-md-3">

            <span className="text-muted small">
              NAS
            </span>

            <div className="small">
              {session.nasName ||
                session.nasIpAddress ||
                "-"}
            </div>

          </div>

          <div className="col-md-3">

            <span className="text-muted small">
              Termination
            </span>

            <div className="small">
              {session.terminateCause ||
                (online
                  ? "Active"
                  : "Unknown")}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

// ============================================================
// DETAIL MODAL
// ============================================================

const SessionDetailModal = ({
  session,
  onClose,
  formatBytes,
  formatDate,
  formatDuration,
}: {
  session: SessionHistory;
  onClose: () => void;
  formatBytes: (
    value: number,
  ) => string;
  formatDate: (
    value?: string,
  ) => string;
  formatDuration: (
    value: number,
  ) => string;
}) => {
  return (
    <div
      className="modal show d-block"
      style={{
        background:
          "rgba(15,23,42,.55)",
        backdropFilter:
          "blur(4px)",
      }}
    >

      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">

        <div className="modal-content border-0 rounded-4 shadow-lg">

          {/* HEADER */}

          <div className="modal-header bg-dark text-white border-0">

            <div>

              <div className="small opacity-75">
                SESSION DETAILS
              </div>

              <h5 className="mb-0 fw-bold">
                {session.sessionId ||
                  "Session"}
              </h5>

            </div>

            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            />

          </div>

          {/* BODY */}

          <div className="modal-body p-4">

            <div className="d-flex justify-content-between align-items-center mb-4">

              <div>

                <div className="text-muted small">
                  SESSION STATUS
                </div>

                <h4
                  className={
                    session.isActive
                      ? "text-success"
                      : "text-danger"
                  }
                >
                  {session.isActive
                    ? "● ONLINE"
                    : "● DISCONNECTED"}
                </h4>

              </div>

              <span
                className={`badge rounded-pill px-3 py-2 ${
                  session.isActive
                    ? "bg-success"
                    : "bg-danger"
                }`}
              >
                {session.isActive
                  ? "ACTIVE"
                  : "CLOSED"}
              </span>

            </div>

            <div className="row g-3">

              <DetailBox
                title="Username"
                value={
                  session.username
                }
              />

              <DetailBox
                title="Session ID"
                value={
                  session.sessionId
                }
                mono
              />

              <DetailBox
                title="IP Address"
                value={
                  session.ipAddress
                }
                mono
              />

              <DetailBox
                title="MAC Address"
                value={
                  session.macAddress
                }
                mono
              />

              <DetailBox
                title="NAS"
                value={
                  session.nasName ||
                  session.nasIpAddress
                }
              />

              <DetailBox
                title="Service"
                value={
                  session.serviceType
                }
              />

              <DetailBox
                title="Start Time"
                value={formatDate(
                  session.startTime,
                )}
              />

              <DetailBox
                title={
                  session.isActive
                    ? "Last Update"
                    : "Disconnect Time"
                }
                value={formatDate(
                  session.isActive
                    ? session.lastUpdateTime
                    : session.stopTime,
                )}
              />

              <DetailBox
                title="Session Duration"
                value={formatDuration(
                  session.sessionTime,
                )}
              />

              <DetailBox
                title="Download"
                value={formatBytes(
                  session.inputOctets,
                )}
              />

              <DetailBox
                title="Upload"
                value={formatBytes(
                  session.outputOctets,
                )}
              />

              <DetailBox
                title="Total Traffic"
                value={formatBytes(
                  session.totalBytes,
                )}
              />

              <DetailBox
                title="Input Packets"
                value={session.inputPackets.toLocaleString()}
              />

              <DetailBox
                title="Output Packets"
                value={session.outputPackets.toLocaleString()}
              />

              <DetailBox
                title="Termination Cause"
                value={
                  session.terminateCause ||
                  (session.isActive
                    ? "Active"
                    : "Not reported")
                }
              />

              <DetailBox
                title="Accounting Status"
                value={
                  session.isActive
                    ? "Interim / Active"
                    : "Stop"
                }
              />

            </div>

          </div>

          {/* FOOTER */}

          <div className="modal-footer border-0">

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

// ============================================================
// DETAIL BOX
// ============================================================

const DetailBox = ({
  title,
  value,
  mono = false,
}: {
  title: string;
  value: any;
  mono?: boolean;
}) => {
  return (
    <div className="col-md-6">

      <div className="border rounded-3 p-3 bg-light">

        <div className="text-muted small mb-1">
          {title}
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
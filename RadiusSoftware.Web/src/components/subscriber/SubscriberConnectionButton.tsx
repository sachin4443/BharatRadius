import React, { useEffect, useState } from "react";
import apiClient from "../../services/api";

interface SubscriberConnectionButtonProps {
  subscriber: any;
  onChanged?: () => void;
  onLive?: (subscriber: any) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  compact?: boolean;
}

interface ConnectionStatus {
  success?: boolean;

  connectionEnabled?: boolean;
  isOnline?: boolean;

  // IMPORTANT
  errorConnection?: boolean;

  username?: string;
  pppoeUsername?: string;

  nasName?: string;
  nasIpAddress?: string;

  ipAddress?: string;
  macAddress?: string;

  acctSessionId?: string;
  sessionId?: string;

  uptime?: string;

  message?: string;
}

const SubscriberConnectionButton: React.FC<
  SubscriberConnectionButtonProps
> = ({
  subscriber,
  onChanged,
  onLive,
  onStatusChange,
  compact = false,
}) => {
  const [enabled, setEnabled] = useState<boolean>(
    Boolean(subscriber?.connectionEnabled)
  );

  const [online, setOnline] = useState<boolean>(false);

  const [status, setStatus] =
    useState<ConnectionStatus | null>(null);

  const [loading, setLoading] = useState(false);

  const [statusLoading, setStatusLoading] =
    useState(false);

  const [showConfirm, setShowConfirm] =
    useState(false);

  const [pendingState, setPendingState] =
    useState<boolean | null>(null);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  // ============================================================
  // LOAD LIVE CONNECTION STATUS
  // ============================================================

  const loadStatus = async (
    showLoader = false
  ) => {
    if (!subscriber?.id) {
      return;
    }

    try {
      if (showLoader) {
        setStatusLoading(true);
      }

      const response = await apiClient.get(
        `/Subscribers/${subscriber.id}/connection-status`
      );

      const data: ConnectionStatus =
        response.data?.data ??
        response.data;

      setStatus(data);

      setEnabled(
        Boolean(data?.connectionEnabled)
      );

      setOnline(
        Boolean(data?.isOnline)
      );
      onStatusChange?.(data);
    } catch (err: any) {
      console.error(
        "Subscriber connection status error:",
        err
      );

      // Do not destroy existing state on temporary
      // status API failure.
    } finally {
      if (showLoader) {
        setStatusLoading(false);
      }
    }
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    if (!subscriber?.id) {
      return;
    }

    setEnabled(
      Boolean(subscriber?.connectionEnabled)
    );

    loadStatus(true);
  }, [
    subscriber?.id,
    subscriber?.connectionEnabled,
  ]);

  // ============================================================
  // LIVE STATUS REFRESH
  // ============================================================

  useEffect(() => {
    if (!subscriber?.id) {
      return;
    }

    const timer = window.setInterval(() => {
      loadStatus(false);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [subscriber?.id]);

  // ============================================================
  // OPEN CONFIRMATION
  // ============================================================

  const openToggleConfirmation = (
    nextState: boolean
  ) => {
    setError("");
    setMessage("");

    setPendingState(nextState);
    setShowConfirm(true);
  };

  // ============================================================
  // CLOSE CONFIRMATION
  // ============================================================

  const closeConfirmation = () => {
    if (loading) {
      return;
    }

    setShowConfirm(false);
    setPendingState(null);
  };

  // ============================================================
  // ACTUAL CONNECTION TOGGLE
  // ============================================================

  const toggleConnection = async () => {
    if (pendingState === null) {
      return;
    }

    const nextState = pendingState;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      // ========================================================
      // ENABLE
      // ========================================================

      const response = await apiClient.post(
        `/Subscribers/${subscriber.id}/connection`,
        nextState,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = response.data;

      // ========================================================
      // Backend result
      // ========================================================

      if (result?.success === false) {
        throw new Error(
          result?.message ||
            "Unable to update subscriber connection."
        );
      }

      setEnabled(
        Boolean(
          result?.enabled ??
            nextState
        )
      );

      setMessage(
        result?.message ||
          (
            nextState
              ? "Subscriber connection enabled successfully."
              : "Subscriber disconnected successfully."
          )
      );

      // ========================================================
      // Close confirmation
      // ========================================================

      setShowConfirm(false);
      setPendingState(null);

      // ========================================================
      // Reload REAL status from backend
      // ========================================================

      await loadStatus(false);

      // ========================================================
      // Notify parent
      // ========================================================

      onChanged?.();

      // If successfully connected and session became
      // live, allow parent to open live modal.
      if (nextState) {
        setTimeout(() => {
          loadStatus(false);
        }, 1000);
      }
    } catch (err: any) {
      console.error(
        "Subscriber connection toggle error:",
        err
      );

      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unable to update subscriber connection.";

      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LIVE BUTTON
  // ============================================================

  const openLive = () => {
    if (!online) {
      return;
    }

    onLive?.(subscriber);
  };

  // ============================================================
  // DISPLAY VALUES
  // ============================================================

  const username =
    status?.username ||
    status?.pppoeUsername ||
    subscriber?.pppoeUsername ||
    subscriber?.PPPoEUsername ||
    "-";

  const nasName =
    status?.nasName ||
    subscriber?.nasName ||
    "-";

  // ============================================================
  // DISABLED CONDITIONS
  // ============================================================

  const subscriberInactive =
    subscriber?.isActive === false;

  const routerOffline =
    status?.nasIpAddress &&
    status?.nasName &&
    status?.isOnline === false &&
    !online;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      {/* ========================================================
          MAIN BUTTON AREA
      ======================================================== */}

      <div
        className={
          compact
            ? "d-flex align-items-center gap-2"
            : "d-flex align-items-center gap-2 flex-wrap"
        }
      >
        {/* ======================================================
            CONNECTION BUTTON
        ====================================================== */}

        <button
          type="button"
          className={`btn btn-sm rounded-pill fw-semibold ${
            enabled
              ? "btn-success"
              : "btn-outline-secondary"
          }`}
          disabled={
            loading ||
            statusLoading ||
            subscriberInactive
          }
          onClick={() =>
            openToggleConfirmation(!enabled)
          }
          title={
            subscriberInactive
              ? "Subscriber is inactive"
              : enabled
                ? "Click to disconnect subscriber"
                : "Click to enable subscriber connection"
          }
        >
          {loading ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
              />
              Working...
            </>
          ) : enabled ? (
            <>
              🟢 ON
            </>
          ) : (
            <>
              ⚪ OFF
            </>
          )}
        </button>

        {/* ======================================================
            LIVE STATUS
        ====================================================== */}

        {online && (
          <button
            type="button"
            className="btn btn-sm btn-success rounded-pill px-3 fw-semibold"
            onClick={openLive}
            title="Open live subscriber session"
          >
            📡 LIVE
          </button>
        )}

        {/* ======================================================
            SMALL STATUS
        ====================================================== */}

        {!compact && (
          <span
            className={`badge rounded-pill ${
              online
                ? "bg-success-subtle text-success border border-success-subtle"
                : enabled
                  ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                  : "bg-light text-secondary border"
            }`}
          >
            {statusLoading
              ? "Checking..."
              : online
                ? "Online"
                : enabled
                  ? "Waiting for login"
                  : "Disconnected"}
          </span>
        )}
      </div>

      {/* ========================================================
          CONFIRMATION MODAL
      ======================================================== */}

      {showConfirm && (
        <div
          className="modal show d-block"
          style={{
            background:
              "rgba(15,23,42,0.45)",
            backdropFilter:
              "blur(4px)",
            zIndex: 1060,
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div
              className="modal-content border-0 shadow-lg"
              style={{
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              {/* HEADER */}

              <div
                className={`p-4 ${
                  pendingState
                    ? "bg-success-subtle"
                    : "bg-danger-subtle"
                }`}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className={`rounded-circle d-flex align-items-center justify-content-center ${
                      pendingState
                        ? "bg-success"
                        : "bg-danger"
                    }`}
                    style={{
                      width: 48,
                      height: 48,
                      fontSize: 22,
                    }}
                  >
                    {pendingState
                      ? "🔌"
                      : "⛔"}
                  </div>

                  <div>
                    <h5 className="fw-bold mb-1">
                      {pendingState
                        ? "Start Connection"
                        : "Disconnect Subscriber"}
                    </h5>

                    <div className="text-muted small">
                      Subscriber connection
                    </div>
                  </div>
                </div>
              </div>

              {/* BODY */}

              <div className="p-4">
                <div className="mb-3">
                  <div className="fw-bold text-dark">
                    {subscriber?.fullName ||
                      "Subscriber"}
                  </div>

                  <div className="small text-muted font-monospace">
                    {username}
                  </div>
                </div>

                {pendingState ? (
                  <>
                    <div className="alert alert-light border rounded-3 small mb-3">
                      <div className="fw-semibold mb-1">
                        Connection will be enabled
                      </div>

                      <div className="text-muted">
                        The subscriber will be
                        allowed to authenticate
                        through the assigned
                        MikroTik RADIUS server.
                      </div>
                    </div>

                    <div className="small text-muted">
                      <div>
                        <strong>NAS:</strong>{" "}
                        {nasName}
                      </div>

                      {subscriber?.nasIpAddress && (
                        <div>
                          <strong>Router:</strong>{" "}
                          {
                            subscriber.nasIpAddress
                          }
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="alert alert-warning border rounded-3 small">
                    <div className="fw-semibold mb-1">
                      Disconnect this subscriber?
                    </div>

                    <div>
                      The current PPPoE session
                      will be disconnected if it
                      is active, and the account
                      connection will be disabled.
                    </div>
                  </div>
                )}

                {/* ERROR */}

                {error && (
                  <div className="alert alert-danger small border-0 mt-3 mb-0">
                    <div className="fw-semibold">
                      Connection failed
                    </div>

                    <div className="mt-1">
                      {error}
                    </div>
                  </div>
                )}

                {/* SUCCESS */}

                {message && (
                  <div className="alert alert-success small border-0 mt-3 mb-0">
                    {message}
                  </div>
                )}
              </div>

              {/* FOOTER */}

              <div className="px-4 pb-4">
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light border rounded-pill flex-fill"
                    disabled={loading}
                    onClick={
                      closeConfirmation
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={`btn rounded-pill flex-fill fw-semibold ${
                      pendingState
                        ? "btn-success"
                        : "btn-danger"
                    }`}
                    disabled={loading}
                    onClick={
                      toggleConnection
                    }
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Processing...
                      </>
                    ) : pendingState ? (
                      "Start Connection"
                    ) : (
                      "Disconnect"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          BACKDROP
      ======================================================== */}

      {showConfirm && (
        <div
          className="modal-backdrop show"
          style={{
            zIndex: 1055,
          }}
        />
      )}
    </>
  );
};

export default SubscriberConnectionButton;
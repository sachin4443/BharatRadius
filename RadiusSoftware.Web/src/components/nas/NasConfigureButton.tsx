import React, { useState } from "react";
import apiClient from "../../services/api";

interface NasConfigureButtonProps {
  nasId: string;
  isConfigured: boolean;
  onConfigured: () => void;
}

export const NasConfigureButton: React.FC<NasConfigureButtonProps> = ({
  nasId,
  isConfigured,
  onConfigured,
}) => {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [result, setResult] = useState<{
    success: boolean;
    title: string;
    message: string;
    step?: string;
  } | null>(null);

  const handleConfigure = async () => {
    if (loading) return;

    setShowConfirm(false);
    setLoading(true);

    try {
      const response = await apiClient.post(
        `/Nas/configure/${nasId}`
      );

      if (response.data?.success) {
        setResult({
          success: true,
          title: "RADIUS Configuration Successful",
          message:
            response.data.message ||
            "MikroTik RADIUS and Syslog configuration completed successfully.",
        });

        setShowResult(true);

        // NAS list refresh
        onConfigured();
      } else {
        setResult({
          success: false,
          title: "Configuration Failed",
          message:
            response.data?.message ||
            "MikroTik RADIUS configuration failed.",
          step: response.data?.step,
        });

        setShowResult(true);
      }
    } catch (error: any) {
      console.error(
        "NAS RADIUS configuration error:",
        error
      );

      const data = error?.response?.data;

      let message =
        data?.message ||
        data?.error ||
        "Unable to configure RADIUS on this MikroTik router.";

      // Friendly messages for common connectivity errors
      const lowerMessage = String(message).toLowerCase();

      if (
        lowerMessage.includes("actively refused") ||
        lowerMessage.includes("connection refused")
      ) {
        message =
          "MikroTik API connection was refused.\n\n" +
          "Please verify:\n" +
          "• Router IP address\n" +
          "• API port\n" +
          "• MikroTik API service is enabled\n" +
          "• Firewall is allowing the API port";
      } else if (
        lowerMessage.includes("timed out") ||
        lowerMessage.includes("timeout") ||
        lowerMessage.includes("period of time")
      ) {
        message =
          "MikroTik API connection timed out.\n\n" +
          "Please verify:\n" +
          "• Router is online\n" +
          "• Router IP is reachable from the server\n" +
          "• API port is correct\n" +
          "• Firewall/NAT is allowing the API connection";
      }

      setResult({
        success: false,
        title: "MikroTik Connection Failed",
        message,
        step: data?.step,
      });

      setShowResult(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* =====================================================
          CONFIGURE BUTTON
      ====================================================== */}

      {isConfigured ? (
        <span className="badge bg-success rounded-pill px-3 py-2 me-2">
          ✓ RADIUS Configured
        </span>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-outline-warning rounded-pill px-3 me-2"
          onClick={() => setShowConfirm(true)}
          disabled={loading}
        >
          {loading ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              />
              Configuring...
            </>
          ) : (
            <>⚙️ Configure RADIUS</>
          )}
        </button>
      )}

      {/* =====================================================
          CONFIRMATION MODAL
      ====================================================== */}

      {showConfirm && (
        <div
          className="modal show d-block"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1055,
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">
                  ⚙️ Configure MikroTik RADIUS
                </h5>

                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                />
              </div>

              <div className="modal-body p-4">
                <div className="alert alert-warning border-0">
                  <strong>
                    Configure RADIUS & Syslog on this MikroTik router?
                  </strong>
                </div>

                <p className="text-muted mb-3">
                  The following configuration will be applied:
                </p>

                <div className="list-group mb-3">
                  <div className="list-group-item">
                    ✅ MikroTik API connection
                  </div>

                  <div className="list-group-item">
                    🔐 RADIUS Authentication
                  </div>

                  <div className="list-group-item">
                    📊 RADIUS Accounting
                  </div>

                  <div className="list-group-item">
                    ⚙️ PPP AAA / Use RADIUS
                  </div>

                  <div className="list-group-item">
                    ⏱️ Interim Accounting Update
                  </div>

                  {/* ✨ Yahan add kiya gaya hai Syslog confirmation item */}
                  <div className="list-group-item">
                    📡 Firewall & Syslog Logging
                  </div>

                  <div className="list-group-item">
                    🔎 Configuration Verification
                  </div>
                </div>

                <div className="small text-muted">
                  Existing RADIUS configuration will be checked
                  before adding/updating the configured RADIUS
                  server.
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-light border rounded-pill px-4"
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-warning rounded-pill px-4 fw-semibold"
                  onClick={handleConfigure}
                  disabled={loading}
                >
                  ⚙️ Configure Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          RESULT MODAL
      ====================================================== */}

      {showResult && result && (
        <div
          className="modal show d-block"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1060,
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className={`modal-header ${
                  result.success
                    ? "bg-success"
                    : "bg-danger"
                } text-white`}
              >
                <h5 className="modal-title fw-bold">
                  {result.success ? "✓" : "⚠️"}{" "}
                  {result.title}
                </h5>

                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowResult(false)}
                />
              </div>

              <div className="modal-body p-4">
                {result.success ? (
                  <>
                    <div className="text-center mb-4">
                      <div
                        className="mx-auto d-flex align-items-center justify-content-center rounded-circle bg-success-subtle"
                        style={{
                          width: "70px",
                          height: "70px",
                          fontSize: "32px",
                        }}
                      >
                        ✓
                      </div>
                    </div>

                    <h5 className="text-center fw-bold text-success">
                      RADIUS Configured Successfully
                    </h5>

                    <p className="text-center text-muted mb-4">
                      {result.message}
                    </p>

                    <div className="list-group">
                      <div className="list-group-item d-flex justify-content-between">
                        <span>API Connection</span>
                        <strong className="text-success">
                          ✓ Connected
                        </strong>
                      </div>

                      <div className="list-group-item d-flex justify-content-between">
                        <span>RADIUS Authentication</span>
                        <strong className="text-success">
                          ✓ Configured
                        </strong>
                      </div>

                      <div className="list-group-item d-flex justify-content-between">
                        <span>RADIUS Accounting</span>
                        <strong className="text-success">
                          ✓ Configured
                        </strong>
                      </div>

                      <div className="list-group-item d-flex justify-content-between">
                        <span>PPP AAA</span>
                        <strong className="text-success">
                          ✓ Configured
                        </strong>
                      </div>

                      {/* ✨ Yahan add kiya gaya hai Result list me Success item */}
                      <div className="list-group-item d-flex justify-content-between">
                        <span>Firewall & Syslog Logging</span>
                        <strong className="text-success">
                          ✓ Configured
                        </strong>
                      </div>

                      <div className="list-group-item d-flex justify-content-between">
                        <span>Verification</span>
                        <strong className="text-success">
                          ✓ Passed
                        </strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="alert alert-danger">
                      <strong>
                        MikroTik configuration could not be
                        completed.
                      </strong>
                    </div>

                    {result.step && (
                      <div className="mb-2">
                        <strong>Failed Step:</strong>{" "}
                        {result.step}
                      </div>
                    )}

                    <div
                      className="alert alert-warning"
                      style={{
                        whiteSpace: "pre-line",
                      }}
                    >
                      {result.message}
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className={`btn ${
                    result.success
                      ? "btn-success"
                      : "btn-danger"
                  } rounded-pill px-4`}
                  onClick={() => setShowResult(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
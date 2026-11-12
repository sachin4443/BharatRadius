import React from "react";

interface Props {
  show: boolean;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  onClose: () => void;
}

const SubscriberActionModal: React.FC<Props> = ({
  show,
  type,
  title,
  message,
  onClose,
}) => {
  if (!show) return null;

  const config = {
    success: {
      icon: "✓",
      color: "#16a34a",
      bg: "#ecfdf5",
    },
    error: {
      icon: "×",
      color: "#dc2626",
      bg: "#fef2f2",
    },
    warning: {
      icon: "!",
      color: "#d97706",
      bg: "#fffbeb",
    },
    info: {
      icon: "i",
      color: "#2563eb",
      bg: "#eff6ff",
    },
  }[type];

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{
        background: "rgba(15,23,42,.35)",
        backdropFilter: "blur(4px)",
        zIndex: 2000,
      }}
    >
      <div
        className="bg-white rounded-4 shadow-lg p-4"
        style={{
          width: "min(460px, calc(100% - 30px))",
        }}
      >
        <div className="text-center">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 fw-bold"
            style={{
              width: 64,
              height: 64,
              background: config.bg,
              color: config.color,
              fontSize: 32,
            }}
          >
            {config.icon}
          </div>

          <h5 className="fw-bold mb-2">
            {title}
          </h5>

          <p className="text-muted mb-4">
            {message}
          </p>

          <button
            type="button"
            className="btn btn-primary rounded-pill px-4"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriberActionModal;
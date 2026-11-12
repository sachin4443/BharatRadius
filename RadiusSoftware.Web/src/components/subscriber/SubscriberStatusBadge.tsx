import React from "react";

interface Props {
  subscriber: any;
  online?: boolean;
  errorConnection?: boolean;
}

const SubscriberStatusBadge: React.FC<Props> = ({
  subscriber,
  online = false,
  errorConnection = false,
}) => {
  // ==========================================================
  // 0. STATUS CALCULATED BY THE SERVER (subscriber list)
  // ==========================================================

  const serverStatus: string | undefined = subscriber?.status;
  if (serverStatus) {
    const map: Record<string, { label: string; cls: string }> = {
      Online: { label: "● Online", cls: "bg-success" },
      Active: { label: "Active", cls: "bg-primary-subtle text-primary-emphasis border border-primary-subtle" },
      Expired: { label: "Expired", cls: "bg-danger" },
      Suspended: { label: "Suspended", cls: "bg-warning text-dark" },
      Disabled: { label: "Disabled", cls: "bg-secondary" },
      WrongPassword: { label: "⚠ Wrong Password", cls: "bg-warning-subtle text-warning-emphasis border border-warning" },
    };
    const item = map[serverStatus] ?? { label: serverStatus, cls: "bg-light text-dark border" };
    return (
      <span className={`badge rounded-pill px-3 py-2 ${item.cls}`} style={{ fontSize: "11px" }}>
        {item.label}
      </span>
    );
  }


  // ==========================================================
  // 1. WRONG CONNECTION
  // ==========================================================

  if (
    errorConnection ||
    subscriber?.errorConnection === true
  ) {
    return (
      <span
        className="badge rounded-pill bg-warning text-dark px-3 py-2"
        style={{ fontSize: "11px" }}
      >
        ⚠ Wrong Password
      </span>
    );
  }

  // ==========================================================
  // 2. INACTIVE
  // ==========================================================

  if (subscriber?.isActive === false) {
    return (
      <span
        className="badge rounded-pill bg-danger px-3 py-2"
        style={{ fontSize: "11px" }}
      >
        Inactive
      </span>
    );
  }

  // ==========================================================
  // 3. ONLINE / LIVE
  // ==========================================================

  if (
    online ||
    subscriber?.isOnline === true
  ) {
    return (
      <div className="d-flex align-items-center gap-2">
        <span
          className="badge rounded-pill bg-success px-3 py-2"
          style={{ fontSize: "11px" }}
        >
          <span className="me-1">●</span>
          ONLINE
        </span>

        <span
          className="badge rounded-pill bg-light text-success border"
          style={{ fontSize: "10px" }}
        >
          LIVE
        </span>
      </div>
    );
  }

  // ==========================================================
  // 4. CONNECTION ENABLED BUT NOT ONLINE
  // ==========================================================

  if (subscriber?.connectionEnabled === true) {
    return (
      <span
        className="badge rounded-pill bg-warning text-dark px-3 py-2"
        style={{ fontSize: "11px" }}
      >
        Error Connection
      </span>
    );
  }

  // ==========================================================
  // 5. CONNECTION OFF
  // ==========================================================

  return (
    <span
      className="badge rounded-pill bg-secondary px-3 py-2"
      style={{ fontSize: "11px" }}
    >
      CONNECTION OFF
    </span>
  );
};

export default SubscriberStatusBadge;
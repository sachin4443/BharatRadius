import React, { useState } from "react";
import { impersonationDepth, peekAdminSession, popAdminSession } from "../utils/impersonation";
import { currentUser } from "../utils/format";

/**
 * Shown while an admin is working inside a child site.
 * Tells who you are acting as and offers a clear way back.
 */
const ImpersonationBar: React.FC = () => {
  const [leaving, setLeaving] = useState(false);
  const admin = peekAdminSession();
  if (!admin) return null;

  const viewing = currentUser();
  const depth = impersonationDepth();
  const backName = admin.user?.companyName || admin.user?.fullName || "Admin";
  const viewingName = viewing?.siteName || viewing?.companyName || viewing?.fullName || "Child site";
  const viewingLevel = viewing?.orgType ? ` (${viewing.orgType})` : "";

  const goBack = () => {
    setLeaving(true);
    if (popAdminSession()) {
      window.location.assign("/dashboard");
    } else {
      // Admin session expired: never reuse it, ask to log in again
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.assign("/");
    }
  };

  return (
    <div className="impersonation-bar" role="status">
      <div className="impersonation-bar__info">
        <span className="impersonation-bar__icon" aria-hidden="true">
          🛡️
        </span>
        <div className="min-w-0">
          <div className="impersonation-bar__title text-truncate">
            Viewing as <strong>{viewingName}</strong>
            {viewingLevel}
          </div>
          <div className="impersonation-bar__sub text-truncate">
            Your admin session ({backName}) is kept safe{depth > 1 ? ` • ${depth} levels deep` : ""}
          </div>
        </div>
      </div>
      <button type="button" className="impersonation-bar__btn" onClick={goBack} disabled={leaving}>
        {leaving ? (
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        ) : (
          <span aria-hidden="true">←</span>
        )}
        <span>
          Back to <span className="d-none d-sm-inline">{backName}</span>
          <span className="d-sm-none">Admin</span>
        </span>
      </button>
    </div>
  );
};

export default ImpersonationBar;

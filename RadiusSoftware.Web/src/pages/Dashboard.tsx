import React from "react";
import { SuperAdminDashboard } from "../components/SuperAdminDashboard";
import { CompanyAdminDashboard } from "../components/CompanyAdminDashboard";
import LiveDashboard from "../components/dashboard/LiveDashboard";
import { currentLevel } from "../utils/format";

/**
 * Dashboard for every level.
 *  - Super admin (L0): platform overview + live dashboard
 *  - L1 company admin: company overview + live dashboard
 *  - L2 / L3 / L4: live dashboard (cards, expiring users, NAS graphs, auth log...)
 * Every user can choose the widgets with the "Config" button.
 */
export const Dashboard: React.FC = () => {
  const level = currentLevel();

  return (
    <div className="container-fluid py-2 px-0 px-md-3">
      {level === "L0" && <SuperAdminDashboard />}
      {(level === "L1" || level === "ClientPortal") && <CompanyAdminDashboard />}
      <LiveDashboard level={level} />
    </div>
  );
};

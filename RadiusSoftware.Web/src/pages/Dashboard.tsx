import React from "react";
import OverviewDashboard from "../components/dashboard/OverviewDashboard";
import LiveDashboard from "../components/dashboard/LiveDashboard";
import { currentLevel } from "../utils/format";

/**
 * Dashboard by role (all numbers are real, from the database / RADIUS):
 *  - Super admin (L0) : platform overview (companies / L1 sites) + live cards
 *  - Company admin L1 : company overview (all its sites) + live cards
 *  - L2 / L3 / L4     : live cards, expiring users, NAS graphs, auth log...
 * Widgets can be chosen with the "Config" button.
 */
export const Dashboard: React.FC = () => {
  const level = currentLevel();

  return (
    <div className="container-fluid py-2 px-0 px-md-3">
      {(level === "L0" || level === "L1" || level === "ClientPortal") && <OverviewDashboard level={level} />}
      <LiveDashboard level={level} />
    </div>
  );
};

import React, { useState, useEffect } from "react";
import apiClient from "../services/api";

interface SiteSummary {
  id: string;
  siteMsrNumber: number;
  siteName: string;
  companyName: string;
  siteEmail: string;
  siteMobileNo: string;
  businessType: string;
  isActive: boolean;
  addDate: string;
}

export const CompanyAdminDashboard: React.FC = () => {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchSitesData = async () => {
      try {
        const res = await apiClient.get<SiteSummary[]>("/Sites/list");
        if (isMounted) {
          setSites(res.data);
        }
      } catch {
        console.error("Failed to load site metrics for organization dashboard");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSitesData();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalSites = sites.length;
  const activeSites = sites.filter((s) => s.isActive).length;
  const inactiveSites = totalSites - activeSites;

  return (
    <div className="company-admin-dashboard mb-3">
      <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
          <div>
            <h4 className="fw-bold text-success mb-1 d-flex align-items-center gap-2">
              🏢 Client Portal Dashboard (Primary ISP)
            </h4>
            <p className="text-muted small mb-0">
              Overview of your registered reseller branches, sites network, and subscriber nodes.
            </p>
          </div>
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-semibold border border-primary border-opacity-25">
            🌐 Portal Status: Online
          </span>
        </div>

        {/* Metric Cards */}
        <div className="row g-3">
          {/* 1. Total Sites Card (Dynamic Count) */}
          <div className="col-xl-3 col-md-6">
            <div className="p-3 bg-light border rounded-4 h-100 position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-semibold d-block">
                    Total Reseller Sites
                  </span>
                  <h3 className="fw-bold text-dark my-1">
                    {loading ? "..." : totalSites}
                  </h3>
                  <span className="badge bg-success bg-opacity-10 text-success small">
                    Managed Nodes
                  </span>
                </div>
                <div
                  className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                  style={{ width: "48px", height: "48px", fontSize: "22px" }}
                >
                  🏢
                </div>
              </div>
            </div>
          </div>

          {/* 2. Active Sites */}
          <div className="col-xl-3 col-md-6">
            <div className="p-3 bg-light border rounded-4 h-100 position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-semibold d-block">
                    Active Sites
                  </span>
                  <h3 className="fw-bold text-success my-1">
                    {loading ? "..." : activeSites}
                  </h3>
                  <span className="text-muted small">
                    Inactive: <strong className="text-danger">{inactiveSites}</strong>
                  </span>
                </div>
                <div
                  className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                  style={{ width: "48px", height: "48px", fontSize: "22px" }}
                >
                  ⚡
                </div>
              </div>
            </div>
          </div>

          {/* 3. Subscribed Users Pool */}
          <div className="col-xl-3 col-md-6">
            <div className="p-3 bg-light border rounded-4 h-100 position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-semibold d-block">
                    Estimated Subscribers
                  </span>
                  <h3 className="fw-bold text-dark my-1">
                    {loading ? "..." : totalSites * 75}{" "}
                    <span className="fs-6 text-muted">Users</span>
                  </h3>
                  <span className="badge bg-info bg-opacity-10 text-info small">
                    Live Connections
                  </span>
                </div>
                <div
                  className="bg-info text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                  style={{ width: "48px", height: "48px", fontSize: "22px" }}
                >
                  👥
                </div>
              </div>
            </div>
          </div>

          {/* 4. Bandwidth / Network Gateway Pool */}
          <div className="col-xl-3 col-md-6">
            <div className="p-3 bg-light border rounded-4 h-100 position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-semibold d-block">
                    Bandwidth Pool
                  </span>
                  <h3 className="fw-bold text-primary my-1">10 Gbps</h3>
                  <span className="badge bg-secondary bg-opacity-10 text-secondary small">
                    Core Gateway
                  </span>
                </div>
                <div
                  className="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                  style={{ width: "48px", height: "48px", fontSize: "22px" }}
                >
                  🚀
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sites Quick Overview Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0 text-dark">📋 Reseller Site Nodes</h6>
          <span className="badge bg-secondary">{totalSites} Registered Sites</span>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover small">
            <thead className="bg-light text-secondary text-uppercase" style={{ fontSize: "11px" }}>
              <tr>
                <th className="ps-3 py-2">MSR & Site Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Contact</th>
                <th>Business Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sites.length > 0 ? (
                sites.slice(0, 5).map((site) => (
                  <tr key={site.id}>
                    <td className="ps-3">
                      <span className="badge bg-dark bg-opacity-10 text-dark border font-monospace me-1">
                        #{site.siteMsrNumber}
                      </span>
                      <strong className="text-dark">{site.siteName}</strong>
                    </td>
                    <td className="text-muted">{site.companyName}</td>
                    <td className="text-muted">{site.siteEmail}</td>
                    <td className="text-muted">{site.siteMobileNo}</td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {site.businessType}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${site.isActive ? "bg-success" : "bg-danger"}`}>
                        {site.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    {loading ? "Loading site records..." : "No sites registered yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import apiClient from "../services/api";

interface SidebarProps {
  collapsed: boolean;
  companyLogo?: string;
  /** Called after a link is clicked (closes the mobile drawer). */
  onNavigate?: () => void;
}

/** Built-in pages that every panel user gets (not stored in the Menus table). */
const builtInMenus = (level: string) => [
  { route: "/reports", title: "Reports", icon: "📈" },
  { route: "/radius-auth-logs", title: "RADIUS Auth Log", icon: "🔐" },
  ...(level === "L0" || level === "L1"
    ? [{ route: "/gateway-settings", title: "SMS & Payment Gateway", icon: "💳" }]
    : []),
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, companyLogo, onNavigate }) => {
  const [menus, setMenus] = useState<any[]>([]);
  // Track which parent menus are expanded/open
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});

  const location = useLocation();
  const navigate = useNavigate();

  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const companyName = user?.companyName || "ISP Portal";
  const level = user?.isSuperAdmin
    ? "L0"
    : typeof user?.orgType === "number"
      ? `L${user.orgType}`
      : user?.orgType || "L1";
  const extraMenus = builtInMenus(level).filter(
    (b) => !menus.some((m) => m.route === b.route),
  );

  const getFullImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("data:image") || url.startsWith("http")) return url;
    return `${apiClient.defaults.baseURL?.replace("/api", "") || "http://localhost:5000"}${url}`;
  };

  const activeLogo = companyLogo || user?.logoUrl;

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const response = await apiClient.get("/Menu/user-menus");
        setMenus(response.data);
      } catch (err) {
        console.error("Failed to load dynamic menus", err);
      }
    };
    fetchMenus();
  }, []);

  // Toggle dropdown state for parent menus
  const toggleSubmenu = (menuRoute: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuRoute]: !prev[menuRoute],
    }));
  };

  // Separate parent menus (ParentMenuCode is null/empty) and submenus
  const parentMenus = menus.filter((m) => !m.parentMenuCode);

  return (
    <div
      className="bg-white text-dark border-end d-flex flex-column h-100 shadow-sm"
      style={{
        minHeight: "100vh",
        width: collapsed ? "70px" : "260px",
        transition: "width 0.3s ease",
      }}
    >
      {/* Brand Header */}
      <div
        className="px-3 border-bottom d-flex align-items-center gap-3 bg-white flex-shrink-0"
        style={{ height: "70px" }}
      >
        {activeLogo ? (
          <img
            src={getFullImageUrl(activeLogo)}
            alt="Logo"
            className="rounded-circle border flex-shrink-0 shadow-sm"
            width="42"
            height="42"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            className="text-white fw-bold rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
            style={{
              width: "42px",
              height: "42px",
              fontSize: "16px",
              background: "linear-gradient(135deg, #f97316 0%, #16a34a 100%)",
            }}
          >
            {companyName ? companyName.charAt(0).toUpperCase() : "⚡"}
          </div>
        )}

        {!collapsed && (
          <div className="overflow-hidden">
            <h6
              className="mb-0 fw-bold text-dark text-truncate"
              style={{ fontSize: "14px", lineHeight: "1.2" }}
            >
              {companyName}
            </h6>
            <span className="text-muted" style={{ fontSize: "11px" }}>
              Management Suite
            </span>
          </div>
        )}
      </div>

      {/* Dynamic Navigation Links with Accordion / Submenu */}
      <div className="list-group list-group-flush mt-2 flex-grow-1 px-2 overflow-auto">
        {parentMenus.map((parent) => {
          // Find submenus matching this parent's route or code
          const subMenus = menus.filter(
            (m) => m.parentMenuCode === parent.route,
          );
          const hasChildren = subMenus.length > 0;
          const isOpen = openMenus[parent.route] || false;
          const isParentActive =
            location.pathname === parent.route ||
            subMenus.some((s) => location.pathname === s.route);

          return (
            <div key={parent.id} className="mb-1">
              {hasChildren ? (
                // Parent menu with children (Click to toggle)
                <div
                  className={`list-group-item list-group-item-action py-2 px-3 border-0 rounded d-flex align-items-center justify-content-between text-dark cursor-pointer ${
                    isParentActive
                      ? "fw-semibold"
                      : "bg-transparent text-secondary"
                  }`}
                  style={{
                    ...(isParentActive
                      ? {
                          background: "rgba(249, 115, 22, 0.08)",
                          color: "#c2410c",
                        }
                      : {}),
                    transition: "all 0.2s",
                    userSelect: "none",
                  }}
                  onClick={() => toggleSubmenu(parent.route)}
                  title={collapsed ? parent.title : ""}
                >
                  <div className="d-flex align-items-center gap-3">
                    <span
                      style={{
                        fontSize: "17px",
                        color: isParentActive ? "#f97316" : "inherit",
                      }}
                    >
                      {parent.icon || "📌"}
                    </span>
                    {!collapsed && (
                      <span className="small text-truncate">
                        {parent.title}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <span
                      className="small text-muted"
                      style={{
                        fontSize: "11px",
                        transition: "transform 0.2s",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      ▼
                    </span>
                  )}
                </div>
              ) : (
                // Normal standalone menu link
                <Link
                  to={parent.route}
                  onClick={onNavigate}
                  className={`list-group-item list-group-item-action py-2 px-3 border-0 rounded d-flex align-items-center gap-3 text-dark ${
                    location.pathname === parent.route
                      ? "text-white shadow-sm fw-semibold"
                      : "bg-transparent text-secondary"
                  }`}
                  style={{
                    ...(location.pathname === parent.route
                      ? {
                          background:
                            "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                        }
                      : { transition: "all 0.2s" }),
                  }}
                  title={collapsed ? parent.title : ""}
                >
                  <span style={{ fontSize: "17px" }}>
                    {parent.icon || "📌"}
                  </span>
                  {!collapsed && (
                    <span className="small text-truncate">{parent.title}</span>
                  )}
                </Link>
              )}

              {/* Render Submenus Dynamically when Open */}
              {hasChildren && isOpen && !collapsed && (
                <div className="ps-4 ms-2 border-start my-1 d-flex flex-column gap-1">
                  {subMenus.map((sub) => {
                    const isSubActive = location.pathname === sub.route;
                    return (
                      <Link
                        key={sub.id}
                        to={sub.route}
                        onClick={onNavigate}
                        className={`list-group-item list-group-item-action py-1.5 px-3 border-0 rounded small d-flex align-items-center gap-2 ${
                          isSubActive ? "fw-bold" : "text-muted bg-transparent"
                        }`}
                        style={{
                          ...(isSubActive
                            ? {
                                color: "#ea580c",
                                backgroundColor: "rgba(249, 115, 22, 0.1)",
                              }
                            : {}),
                          transition: "all 0.2s",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            color: isSubActive ? "#ea580c" : "inherit",
                          }}
                        >
                          {sub.icon || "🔸"}
                        </span>
                        <span className="text-truncate">{sub.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Reports & tools */}
        {!collapsed && (
          <div className="text-uppercase text-muted fw-semibold px-3 mt-3 mb-1" style={{ fontSize: 10, letterSpacing: 1 }}>
            Reports & Tools
          </div>
        )}
        {extraMenus.map((item) => {
          const active = location.pathname === item.route;
          return (
            <Link
              key={item.route}
              to={item.route}
              onClick={onNavigate}
              className={`list-group-item list-group-item-action py-2 px-3 border-0 rounded d-flex align-items-center gap-3 mb-1 ${
                active ? "text-white shadow-sm fw-semibold" : "bg-transparent text-secondary"
              }`}
              style={active ? { background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" } : undefined}
              title={collapsed ? item.title : ""}
            >
              <span style={{ fontSize: "17px" }}>{item.icon}</span>
              {!collapsed && <span className="small text-truncate">{item.title}</span>}
            </Link>
          );
        })}

        {menus.length === 0 && !collapsed && (
          <div className="text-center p-3 text-muted small">
            No permissions mapped yet.
          </div>
        )}
      </div>

      {!collapsed && (
  <div
    className="p-3 border-top text-center flex-shrink-0"
    style={{ fontSize: "11px", background: "#fafbfc" }}
  >
    <div className="d-flex align-items-center justify-content-center gap-2">
      {/* 🟢 Live / Active Indicator Dot */}
      <span 
        className="rounded-circle d-inline-block" 
        style={{ 
          width: "6px", 
          height: "6px", 
          backgroundColor: "#10b981",
          boxShadow: "0 0 6px rgba(16, 185, 129, 0.6)"
        }}
      ></span>
      
      {/* Version with Brand Text Highlight */}
      <span className="fw-semibold text-secondary">
        v2.1 <span className="text-muted fw-normal">• Clean Light UI</span>
      </span>
    </div>
  </div>
)}
    </div>
  );
};
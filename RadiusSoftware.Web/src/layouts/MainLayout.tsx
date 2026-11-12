import React, { useState, useEffect, useRef, Suspense } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import apiClient from "../services/api";

export const MainLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Phones / small tablets: sidebar becomes a slide-in drawer
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 991.98px)").matches);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 991.98px)");
    const onChange = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setMobileMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const userStr = localStorage.getItem("user");
  const [user, setUser] = useState(userStr ? JSON.parse(userStr) : null);

  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || "",
    username: user?.username || "",
    logoUrl: user?.logoUrl || "",
  });

  // Helper to resolve Image URL
  const getFullImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("data:image") || url.startsWith("http")) return url;
    return `${apiClient.defaults.baseURL?.replace("/api", "") || "http://localhost:5000"}${url}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    // Keep only the "Remember Me" login id
    const remember = localStorage.getItem("rememberLogin");
    const rememberedUser = localStorage.getItem("rememberedUser");
    const rememberedLogo = localStorage.getItem("rememberedLogo");
    localStorage.clear();
    if (remember === "1" && rememberedUser) {
      localStorage.setItem("rememberLogin", "1");
      localStorage.setItem("rememberedUser", rememberedUser);
      if (rememberedLogo) localStorage.setItem("rememberedLogo", rememberedLogo);
    }
    navigate("/");
  };

  // Logo is resized in the browser (max 256 px) so upload and page load stay fast
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      alert("Please choose a PNG, JPG or WEBP image.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setProfileData((prev) => ({ ...prev, logoUrl: canvas.toDataURL("image/png") }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiClient.put("/Auth/update-profile", {
        fullName: profileData.fullName,
        logoUrl: profileData.logoUrl,
        removeLogo: !profileData.logoUrl && !!user?.logoUrl,
      });

      localStorage.setItem("user", JSON.stringify(response.data));
      if (localStorage.getItem("rememberLogin") === "1") {
        if (response.data?.logoUrl) localStorage.setItem("rememberedLogo", response.data.logoUrl);
        else localStorage.removeItem("rememberedLogo");
      }
      setUser(response.data);
      setShowProfileModal(false);
      alert("Profile & Logo updated successfully in database!");
      window.location.reload();
    } catch (err: unknown) {
      const errorData = err as { response?: { data?: { message?: string } } };
      alert(errorData.response?.data?.message || "Failed to update profile.");
    }
  };

  // Safe handler to return to SuperAdmin mode
  const handleReturnToAdmin = () => {
    const adminToken = localStorage.getItem("adminToken");
    const adminUser = localStorage.getItem("adminUser");
    if (adminToken && adminUser) {
      localStorage.setItem("token", adminToken);
      localStorage.setItem("user", adminUser);
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      
      window.location.assign("/dashboard"); 
    }
  };

  return (
    <div className="d-flex bg-light vh-100 overflow-hidden" id="wrapper">
      {/* Mobile drawer backdrop */}
      {isMobile && mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 1040 }}
        />
      )}

      {/* Sidebar - Fixed Height (drawer on mobile) */}
      <div
        className="h-100 flex-shrink-0 bg-white"
        style={
          isMobile
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: "260px",
                transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 0.25s ease",
                zIndex: 1045,
              }
            : {
                width: isSidebarCollapsed ? "70px" : "260px",
                transition: "width 0.3s ease",
                zIndex: 1000,
              }
        }
      >
        <Sidebar
          collapsed={!isMobile && isSidebarCollapsed}
          companyLogo={getFullImageUrl(user?.logoUrl)}
          onNavigate={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main Content Area - Independently Scrollable */}
      <div className="flex-grow-1 d-flex flex-column h-100 overflow-hidden">
        {/* Top Navbar - Fixed/Sticky */}
        <nav
          className="navbar navbar-expand navbar-light bg-white border-bottom px-2 px-md-4 shadow-sm flex-shrink-0"
          style={{ height: "65px", zIndex: 1010 }}
        >
          <div className="container-fluid px-0">
            <div className="d-flex align-items-center gap-3">
  <button
    type="button"
    className="btn border shadow-sm me-2 rounded-pill px-3 py-2"
    style={{
      backgroundColor: "#fff7ed",
      borderColor: "#ffedd5",
      color: "#f97316",
      transition: "all 0.2s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "#ffedd5";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "#fff7ed";
    }}
    onClick={() =>
      isMobile ? setMobileMenuOpen(!mobileMenuOpen) : setIsSidebarCollapsed(!isSidebarCollapsed)
    }
    title="Toggle Sidebar"
  >
    ☰
  </button>

  <span className="fw-bold text-brand small d-none d-md-inline" style={{ letterSpacing: "0.3px" }}>
    ISP Multi-Tenant Portal Dashboard
  </span>
</div>
            {/* Right side container: Back to Admin button + Profile Dropdown */}
            <div className="ms-auto d-flex align-items-center gap-3">
              
              {/* 🔙 Impersonation Back Button */}
             {localStorage.getItem("adminToken") && (
  <button
    className="btn btn-sm btn-admin-glow rounded-pill px-4 py-2 fw-bold shadow-sm d-flex align-items-center gap-2"
    style={{
      fontSize: "13px",
    }}
    onClick={handleReturnToAdmin}
  >
    <span className="fs-6">←</span> 
    Back to Admin
  </button>
)}

              {/* Profile Dropdown */}
              <div className="position-relative" ref={dropdownRef}>
                <div
                  className="d-flex align-items-center gap-2 cursor-pointer py-1 px-2 rounded-pill border bg-white shadow-sm"
                  onClick={() => setShowDropdown(!showDropdown)}
                  style={{ cursor: "pointer" }}
                >
                  {user?.logoUrl ? (
                    <img
                      src={getFullImageUrl(user.logoUrl)}
                      alt="Logo"
                      className="rounded-circle border"
                      width="32"
                      height="32"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="text-white rounded-circle d-flex align-items-center justify-content-center fw-bold"
                      style={{
                        width: "32px",
                        height: "32px",
                        fontSize: "13px",
                        background: "linear-gradient(135deg, #f97316 0%, #16a34a 100%)",
                      }}
                    >
                      {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}
                  <div className="text-start pe-1 d-none d-sm-block">
                    <div
                      className="fw-bold text-dark"
                      style={{ fontSize: "13px", lineHeight: "1.2" }}
                    >
                      {user?.fullName || "Administrator"}
                    </div>
                    <div className="text-muted" style={{ fontSize: "11px" }}>
                      {user?.username || "superadmin"}
                    </div>
                  </div>
                  <span className="text-muted small">▼</span>
                </div>

                {showDropdown && (
                  <div
                    className="position-absolute end-0 mt-2 bg-white border shadow-lg rounded-4 p-2"
                    style={{ width: "220px", zIndex: 1050 }}
                  >
                    <div className="px-3 py-2 border-bottom mb-1">
                      <p className="mb-0 fw-bold small text-dark">
                        {user?.fullName}
                      </p>
                      <small className="text-muted" style={{ fontSize: "11px" }}>
                        Level: {user?.orgType || "Admin"}
                      </small>
                    </div>
                    <button
                      className="dropdown-item rounded py-2 px-2 small text-dark fw-semibold mb-1 d-flex align-items-center gap-2"
                      onClick={() => {
                        setShowDropdown(false);
                        // ✅ FIX: Setting state here directly to avoid useEffect cascading render error
                        setProfileData({
                          fullName: user?.fullName || "",
                          username: user?.username || "",
                          logoUrl: user?.logoUrl || "",
                        });
                        setShowProfileModal(true);
                      }}
                    >
                      <span>👤</span> My Profile & Logo
                    </button>
                    <button
                      className="dropdown-item rounded py-2 px-2 small text-danger fw-semibold d-flex align-items-center gap-2"
                      onClick={handleLogout}
                    >
                      <span>🚪</span> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <div
          className="p-2 p-md-4 flex-grow-1 overflow-auto"
          style={{ backgroundColor: "#f8fafc" }}
        >
          <Suspense
            fallback={
              <div className="d-flex justify-content-center py-5">
                <div className="spinner-border text-warning" role="status" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div
                className="modal-header text-white"
                style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}
              >
                <h5 className="modal-title fw-bold">
                  ⚙️ Edit Profile & Company Logo
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowProfileModal(false)}
                ></button>
              </div>
              <form onSubmit={handleProfileSave}>
                <div className="modal-body p-4">
                  <div className="text-center mb-4">
                    {profileData.logoUrl ? (
                      <img
                        src={getFullImageUrl(profileData.logoUrl)}
                        alt="Preview"
                        className="rounded-circle border shadow-sm"
                        width="80"
                        height="80"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        className="text-white rounded-circle d-flex align-items-center justify-content-center fw-bold mx-auto shadow-sm"
                        style={{
                          width: "80px",
                          height: "80px",
                          fontSize: "28px",
                          background: "linear-gradient(135deg, #f97316 0%, #16a34a 100%)",
                        }}
                      >
                        {profileData.fullName ? profileData.fullName.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                    <div className="mt-2">
                      <label
                        className="btn btn-sm px-3 rounded-pill text-white shadow-sm cursor-pointer"
                        style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}
                      >
                        📁 Upload Logo/Image
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="d-none"
                          onChange={handleImageUpload}
                        />
                      </label>
                      {profileData.logoUrl && (
                        <button
                          type="button"
                          className="btn btn-sm btn-light border rounded-pill px-3 ms-2"
                          onClick={() => setProfileData((prev) => ({ ...prev, logoUrl: "" }))}
                        >
                          Remove
                        </button>
                      )}
                      <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                        This logo is only for your account / site.
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileData.fullName}
                      onChange={(e) =>
                        setProfileData({ ...profileData, fullName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Username
                    </label>
                    <input
                      type="text"
                      className="form-control bg-light"
                      value={profileData.username}
                      disabled
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary px-4 rounded-pill"
                    onClick={() => setShowProfileModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white px-4 rounded-pill"
                    style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
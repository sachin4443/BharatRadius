import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../services/api";

interface SiteUser {
  fullName?: string;
  username?: string;
  email?: string;
  mobile?: string;
}

interface Site {
  id: string;
  siteMsrNumber: number;
  parentSiteMsrNumber?: number;
  siteLevel: number;
  siteName: string;
  companyName: string;
  siteEmail: string;
  siteDomain?: string;
  siteMobileNo: string;
  useOwnDomain?: boolean;
  companyTagline?: string;
  siteAddress?: string;
  siteDescription?: string;
  state?: string;
  city?: string;
  zip?: string;
  businessType?: string;
  currencyId?: string;
  timeZone?: string;
  isActive: boolean;
  user?: SiteUser;
}

interface Menu {
  id: string;
  title: string;
  icon?: string;
  route?: string;
  parentMenuCode?: string;
}

export const SitesManagement: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [allowedMenus, setAllowedMenus] = useState<Menu[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showViewModal, setShowViewModal] = useState<boolean>(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [formData, setFormData] = useState({
    id: "",
    siteName: "",
    siteEmail: "",
    siteDomain: "",
    siteMobileNo: "",
    useOwnDomain: false,
    companyName: "",
    companyTagline: "",
    siteAddress: "",
    siteDescription: "",
    state: "",
    city: "",
    zip: "",
    businessType: "Non Reseller",
    currencyId: "INR",
    timeZone: "IST",
    adminFullName: "",
    adminUsername: "",
    adminEmail: "",
    adminMobile: "",
    adminPassword: "",
    menuIds: [] as string[],
  });

  const fetchSites = useCallback(async () => {
    try {
      const response = await apiClient.get<Site[]>("/Sites/list");
      setSites(response.data);
    } catch {
      console.error("Error fetching sites");
    }
  }, []);

  const fetchAllowedMenus = useCallback(async () => {
    try {
      const response = await apiClient.get<Menu[]>("/Sites/allowed-menus");
      setAllowedMenus(response.data);
    } catch {
      console.error("Error fetching allowed menus");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const [sitesRes, menusRes] = await Promise.all([
          apiClient.get<Site[]>("/Sites/list"),
          apiClient.get<Menu[]>("/Sites/allowed-menus"),
        ]);
        if (isMounted) {
          setSites(sitesRes.data);
          setAllowedMenus(menusRes.data);
        }
      } catch {
        console.error("Initial load failed");
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const zip = e.target.value;
    setFormData((prev) => ({ ...prev, zip }));

    if (zip.length === 6) {
      try {
        const res = await fetch(`https://api.zippopotam.us/in/${zip}`);
        if (res.ok) {
          const data = await res.json();
          const place = data.places[0];
          setFormData((prev) => ({
            ...prev,
            city: place["place name"],
            state: place["state"],
          }));
        }
      } catch {
        console.error("Auto-fill failed for zipcode");
      }
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target;
    const value =
      target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
    setFormData((prev) => ({ ...prev, [target.name]: value }));
  };

  // Grouped Menu Handlers
  const handleToggleMenu = (menuId: string) => {
    setFormData((prev) => {
      const exists = prev.menuIds.includes(menuId);
      return {
        ...prev,
        menuIds: exists ? prev.menuIds.filter((id) => id !== menuId) : [...prev.menuIds, menuId],
      };
    });
  };

  const handleToggleGroup = (parentCode: string, groupChildIds: string[]) => {
    setFormData((prev) => {
      const allSelected = groupChildIds.every((id) => prev.menuIds.includes(id));
      if (allSelected) {
        return {
          ...prev,
          menuIds: prev.menuIds.filter((id) => !groupChildIds.includes(id)),
        };
      } else {
        const set = new Set([...prev.menuIds, ...groupChildIds]);
        return { ...prev, menuIds: Array.from(set) };
      }
    });
  };

  const validateForm = () => {
    if (!formData.siteName || !formData.siteEmail || !formData.siteMobileNo || !formData.companyName) {
      setError("Please fill all mandatory site information fields.");
      return false;
    }
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(formData.siteMobileNo) || !mobileRegex.test(formData.adminMobile)) {
      setError("Mobile numbers must be exactly 10 digits.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isEditMode) {
        await apiClient.put(`/Sites/update-site/${formData.id}`, formData);
        setMessage("Site updated successfully!");
      } else {
        await apiClient.post("/Sites/create-site", formData);
        setMessage("Site & Admin User created successfully!");
      }
      setShowModal(false);
      await fetchSites();
      resetForm();
    } catch (err: unknown) {
      const eData = err as { response?: { data?: { message?: string } } };
      setError(eData.response?.data?.message || "Operation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = async (site: Site) => {
    setIsEditMode(true);
    let assignedMenuIds: string[] = [];
    try {
      const res = await apiClient.get<string[]>(`/Sites/site-menus/${site.id}`);
      assignedMenuIds = res.data;
    } catch {
      console.error("Failed to fetch site menus");
    }

    setFormData({
      id: site.id,
      siteName: site.siteName || "",
      siteEmail: site.siteEmail || "",
      siteDomain: site.siteDomain || "",
      siteMobileNo: site.siteMobileNo || "",
      useOwnDomain: site.useOwnDomain || false,
      companyName: site.companyName || "",
      companyTagline: site.companyTagline || "",
      siteAddress: site.siteAddress || "",
      siteDescription: site.siteDescription || "",
      state: site.state || "",
      city: site.city || "",
      zip: site.zip || "",
      businessType: site.businessType || "Non Reseller",
      currencyId: site.currencyId || "INR",
      timeZone: site.timeZone || "IST",
      adminFullName: site.user?.fullName || "",
      adminUsername: site.user?.username || "",
      adminEmail: site.user?.email || "",
      adminMobile: site.user?.mobile || "",
      adminPassword: "",
      menuIds: assignedMenuIds,
    });
    setShowModal(true);
  };

  const handleToggleStatus = async (site: Site) => {
    if (!window.confirm(`Toggle status for ${site.siteName}?`)) return;
    try {
      await apiClient.put(`/Sites/toggle-status/${site.id}`);
      await fetchSites();
    } catch {
      alert("Failed to update status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this site?")) return;
    try {
      await apiClient.delete(`/Sites/delete/${id}`);
      await fetchSites();
      setMessage("Site deleted successfully!");
    } catch {
      alert("Failed to delete site.");
    }
  };

  const handleImpersonate = async (siteId: string) => {
    try {
      localStorage.setItem("adminToken", localStorage.getItem("token") || "");
      localStorage.setItem("adminUser", localStorage.getItem("user") || "");

      const response = await apiClient.post(`/Auth/impersonate-site?siteId=${siteId}`);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data));
      window.location.assign("/dashboard");
    } catch {
      alert("Direct login failed. Ensure active admin account exists for this site.");
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setFormData({
      id: "",
      siteName: "",
      siteEmail: "",
      siteDomain: "",
      siteMobileNo: "",
      useOwnDomain: false,
      companyName: "",
      companyTagline: "",
      siteAddress: "",
      siteDescription: "",
      state: "",
      city: "",
      zip: "",
      businessType: "Non Reseller",
      currencyId: "INR",
      timeZone: "IST",
      adminFullName: "",
      adminUsername: "",
      adminEmail: "",
      adminMobile: "",
      adminPassword: "",
      menuIds: [],
    });
  };

  // Group menus by ParentMenuCode
  const menuGroups = allowedMenus.reduce<Record<string, Menu[]>>((acc, menu) => {
    const group = menu.parentMenuCode || "General Modules";
    if (!acc[group]) acc[group] = [];
    acc[group].push(menu);
    return acc;
  }, {});

  return (
    <div className="container-fluid py-3" style={{ background: "#f8fafc", minHeight: "90vh" }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-4 rounded-4 shadow-sm border">
        <div>
          <h4 className="fw-bold text-dark mb-1">🏢 Reseller & Site Management</h4>
          <p className="text-muted small mb-0">
            Hierarchical site node distribution with auto Level and MSR mapping.
          </p>
        </div>
        <button
          className="btn btn-brand px-4 fw-semibold shadow-sm rounded-pill"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          + Add New Reseller
        </button>
      </div>

      {message && <div className="alert alert-success border-0 shadow-sm rounded-3">{message}</div>}
      {error && <div className="alert alert-danger border-0 shadow-sm rounded-3">{error}</div>}

      {/* Sites Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover">
            <thead className="bg-light text-secondary small text-uppercase">
              <tr>
                <th className="py-3 ps-4">MSR & Level</th>
                <th>Site & Company</th>
                <th>Domain / Contact</th>
                <th>Location</th>
                <th>Business Type</th>
                <th>Status</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.length > 0 ? (
                sites.map((site) => (
                  <tr key={site.id} className="border-bottom">
                    <td className="ps-4 py-3">
                      <div className="d-flex flex-column">
                        <span className="badge bg-dark bg-opacity-10 text-dark border font-monospace mb-1" style={{ width: "fit-content" }}>
                          MSR #{site.siteMsrNumber}
                        </span>
                        <span className="badge bg-primary bg-opacity-10 text-primary" style={{ width: "fit-content" }}>
                          Level {site.siteLevel}
                        </span>
                        {site.parentSiteMsrNumber && (
                          <span className="text-muted fw-semibold" style={{ fontSize: "10px" }}>
                            ↳ Parent MSR: #{site.parentSiteMsrNumber}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div
                        className="fw-bold text-primary cursor-pointer d-flex align-items-center gap-1"
                        onClick={() => handleImpersonate(site.id)}
                        title="Click to login directly"
                        style={{ cursor: "pointer" }}
                      >
                        {site.siteName} <span className="fs-6">🔗</span>
                      </div>
                      <div className="text-muted small">({site.companyName})</div>
                    </td>
                    <td>
                      <div className="small text-dark fw-semibold">{site.siteDomain || "N/A"}</div>
                      <div className="text-muted" style={{ fontSize: "12px" }}>{site.siteEmail}</div>
                    </td>
                    <td>
                      <div className="small fw-semibold">{site.city}, {site.state}</div>
                      <div className="text-muted" style={{ fontSize: "11px" }}>Zip: {site.zip}</div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border px-2 py-1">
                        {site.businessType}
                      </span>
                    </td>
                    <td>
                      <div className="form-check form-switch cursor-pointer">
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          checked={site.isActive}
                          onChange={() => handleToggleStatus(site)}
                        />
                        <label className={`form-check-label small fw-bold ${site.isActive ? "text-success" : "text-danger"}`}>
                          {site.isActive ? "Active" : "Inactive"}
                        </label>
                      </div>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        className="btn btn-sm btn-light border me-2 px-3 rounded-pill text-secondary fw-semibold"
                        onClick={() => {
                          setSelectedSite(site);
                          setShowViewModal(true);
                        }}
                      >
                        👁️ View
                      </button>
                      <button
                        className="btn btn-sm btn-light border me-2 px-3 rounded-pill text-dark fw-semibold"
                        onClick={() => handleEditClick(site)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger border-0 fw-semibold rounded-pill px-3 shadow-sm"
                        onClick={() => handleDelete(site.id)}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    No Reseller found. Click "+ Add New Reseller" to configure one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Site Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(5px)" }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">
              <div className="modal-header bg-dark text-white px-4 py-3">
                <h5 className="modal-title fw-bold">
                  {isEditMode ? "✏️ Edit Reseller Node" : "✨ Register New Reseller Node"}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                  <h6 className="text-dark border-bottom pb-2 mb-3 fw-bold">🏢 Reseller Information</h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Reseller Name *</label>
                      <input type="text" className="form-control rounded-3" name="siteName" value={formData.siteName} onChange={handleChange} required />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Reseller Email *</label>
                      <input type="email" className="form-control rounded-3" name="siteEmail" value={formData.siteEmail} onChange={handleChange} required />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Domain</label>
                      <input type="text" className="form-control rounded-3" name="siteDomain" value={formData.siteDomain} onChange={handleChange} placeholder="mydomain.com" />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Mobile No * (10 Digits)</label>
                      <input type="text" className="form-control rounded-3" name="siteMobileNo" maxLength={10} value={formData.siteMobileNo} onChange={handleChange} required />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Company Name *</label>
                      <input type="text" className="form-control rounded-3" name="companyName" value={formData.companyName} onChange={handleChange} required />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Company Tagline</label>
                      <input type="text" className="form-control rounded-3" name="companyTagline" value={formData.companyTagline} onChange={handleChange} />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold text-muted">Zip Code *</label>
                      <input type="text" className="form-control rounded-3" name="zip" maxLength={6} value={formData.zip} onChange={handleZipChange} required placeholder="Auto-fills" />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold text-muted">City *</label>
                      <input type="text" className="form-control rounded-3 bg-light" name="city" value={formData.city} onChange={handleChange} required />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small fw-semibold text-muted">State *</label>
                      <input type="text" className="form-control rounded-3 bg-light" name="state" value={formData.state} onChange={handleChange} required />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted">Currency</label>
                      <select className="form-select rounded-3" name="currencyId" value={formData.currencyId} onChange={handleChange}>
                        <option value="INR">Indian Rupee (INR)</option>
                        <option value="USD">US Dollar (USD)</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted">Business Type</label>
                      <select className="form-select rounded-3" name="businessType" value={formData.businessType} onChange={handleChange}>
                        <option value="Non Reseller">Non Reseller</option>
                        <option value="Reseller">Reseller</option>
                        <option value="Franchise">Franchise</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted">Time Zone</label>
                      <select className="form-select rounded-3" name="timeZone" value={formData.timeZone} onChange={handleChange}>
                        <option value="IST">IST (India Standard Time)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>

                    <div className="col-md-12">
                      <label className="form-label small fw-semibold text-muted">Full Address *</label>
                      <textarea className="form-control rounded-3" rows={2} name="siteAddress" value={formData.siteAddress} onChange={handleChange} required></textarea>
                    </div>
                  </div>

                  {/* 🛡️ Hierarchical Grouped Menu Permissions */}
                  <div className="mb-4">
                    <label className="form-label small fw-bold text-dark mb-1">
                      🛡️ Assign Hierarchical Menu Permissions *
                    </label>
                    <p className="text-muted small mb-2">
                      Choose which modules this Reseller admin is authorized to view:
                    </p>
                    <div className="border rounded-4 p-3 bg-light" style={{ maxHeight: "250px", overflowY: "auto" }}>
                      {Object.keys(menuGroups).length > 0 ? (
                        Object.keys(menuGroups).map((groupName) => {
                          const groupMenus = menuGroups[groupName];
                          const groupIds = groupMenus.map((m) => m.id);
                          const isAllChecked = groupIds.every((id) => formData.menuIds.includes(id));

                          return (
                            <div key={groupName} className="mb-3 bg-white p-3 rounded-3 border">
                              <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-2">
                                <span className="fw-bold text-dark small text-uppercase">
                                  📁 {groupName}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link p-0 text-decoration-none small text-primary"
                                  onClick={() => handleToggleGroup(groupName, groupIds)}
                                >
                                  {isAllChecked ? "Deselect All" : "Select All"}
                                </button>
                              </div>
                              <div className="row g-2">
                                {groupMenus.map((menu) => (
                                  <div key={menu.id} className="col-md-4 col-sm-6">
                                    <div className="form-check">
                                      <input
                                        type="checkbox"
                                        className="form-check-input me-2"
                                        id={`menu-${menu.id}`}
                                        checked={formData.menuIds.includes(menu.id)}
                                        onChange={() => handleToggleMenu(menu.id)}
                                      />
                                      <label className="form-check-label small text-dark cursor-pointer" htmlFor={`menu-${menu.id}`}>
                                        {menu.icon && <span className="me-1">{menu.icon}</span>}
                                        {menu.title}
                                      </label>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-muted small">No permitted menus available.</span>
                      )}
                    </div>
                  </div>

                  {/* Admin Account */}
                  <h6 className="text-dark border-bottom pb-2 mb-3 fw-bold">👤 Site Admin Credentials</h6>
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Admin Full Name *</label>
                      <input type="text" className="form-control rounded-3" name="adminFullName" value={formData.adminFullName} onChange={handleChange} required />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Username *</label>
                      <input type="text" className="form-control rounded-3" name="adminUsername" value={formData.adminUsername} onChange={handleChange} required />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Admin Email *</label>
                      <input type="email" className="form-control rounded-3" name="adminEmail" value={formData.adminEmail} onChange={handleChange} required />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Mobile No * (10 Digits)</label>
                      <input type="text" className="form-control rounded-3" name="adminMobile" maxLength={10} value={formData.adminMobile} onChange={handleChange} required />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-semibold text-muted">Password *</label>
                      <input
                        type="password"
                        className="form-control rounded-3"
                        name="adminPassword"
                        value={formData.adminPassword}
                        onChange={handleChange}
                        required={!isEditMode}
                        placeholder={isEditMode ? "Leave blank to keep existing password" : ""}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light px-4 py-3">
                  <button type="button" className="btn btn-light border px-4 rounded-pill fw-semibold" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-brand px-4 rounded-pill fw-semibold shadow-sm" disabled={loading}>
                    {loading ? "Saving..." : isEditMode ? "💾 Update Reseller" : "💾 Create Reseller"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Site Modal */}
      {showViewModal && selectedSite && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(5px)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">
              <div className="modal-header bg-light px-4 py-3 border-bottom">
                <h5 className="modal-title fw-bold text-dark">📄 Reseller Node Details</h5>
                <button type="button" className="btn-close" onClick={() => setShowViewModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="text-center mb-3">
                  <div className="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold mx-auto mb-2 shadow-sm" style={{ width: "60px", height: "60px", fontSize: "24px" }}>
                    🏢
                  </div>
                  <h4 className="fw-bold text-dark mb-0">{selectedSite.siteName}</h4>
                  <span className="badge bg-secondary me-1">MSR #{selectedSite.siteMsrNumber}</span>
                  <span className="badge bg-primary">Level {selectedSite.siteLevel}</span>
                </div>

                <div className="bg-light p-3 rounded-3 small">
                  <div className="d-flex justify-content-between mb-2 pb-1 border-bottom">
                    <span className="text-muted">Company Name:</span>
                    <span className="fw-bold text-dark">{selectedSite.companyName}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 pb-1 border-bottom">
                    <span className="text-muted">Parent MSR:</span>
                    <span className="fw-bold text-dark">{selectedSite.parentSiteMsrNumber ? `#${selectedSite.parentSiteMsrNumber}` : "Direct Organization"}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 pb-1 border-bottom">
                    <span className="text-muted">Email:</span>
                    <span className="text-dark">{selectedSite.siteEmail}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 pb-1 border-bottom">
                    <span className="text-muted">Domain:</span>
                    <span className="text-dark">{selectedSite.siteDomain || "N/A"}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 pb-1 border-bottom">
                    <span className="text-muted">Mobile:</span>
                    <span className="text-dark">{selectedSite.siteMobileNo}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 pb-1 border-bottom">
                    <span className="text-muted">Location:</span>
                    <span className="text-dark">{selectedSite.city}, {selectedSite.state} - {selectedSite.zip}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Business Type:</span>
                    <span className="badge bg-light text-dark border">{selectedSite.businessType}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-light px-4 py-3">
                <button type="button" className="btn btn-secondary w-100 rounded-pill fw-semibold py-2" onClick={() => setShowViewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
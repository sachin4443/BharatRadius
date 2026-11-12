import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../services/api";

// TypeScript Interfaces to eliminate 'no-explicit-any'
interface CompanyItem {
  id: string;
  name: string;
  code: string;
  type: string;
  level: number;
  email?: string;
  phone?: string;
  domain?: string;
  address?: string;
  currency: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  adminUsername: string;
  adminFullName: string;
  adminEmail: string;
  adminMobile: string;
  adminPassword?: string;
  isActive: boolean;
  createdAt: string;
}

interface DeleteSummary {
  userCount: number;
  roleCount: number;
  users: Array<{ fullName: string; email: string }>;
  roles: Array<{ name: string }>;
}

interface ApiValidationResponse {
  errors?: Record<string, string[]>;
  message?: string;
}

export const CompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<DeleteSummary | null>(null);
  const [orgToDelete, setOrgToDelete] = useState<CompanyItem | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    domain: "",
    address: "",
    currency: "INR",
    primaryColor: "#0d6efd",
    secondaryColor: "#6c757d",
    logoUrl: "",
    adminFullName: "",
    adminUsername: "",
    adminEmail: "",
    adminMobile: "",
    adminPassword: "",
    newPassword: "",
  });

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await apiClient.get<CompanyItem[]>("/Organizations/list");
      setCompanies(response.data);
    } catch {
      console.error("Error fetching organizations");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const response = await apiClient.get<CompanyItem[]>("/Organizations/list");
        if (isMounted) {
          setCompanies(response.data);
        }
      } catch {
        console.error("Error fetching organizations");
      }
    };
    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setFieldErrors({});
    setFormData({
      id: "",
      name: "",
      email: "",
      phone: "",
      domain: "",
      address: "",
      currency: "INR",
      primaryColor: "#0d6efd",
      secondaryColor: "#6c757d",
      logoUrl: "",
      adminFullName: "",
      adminUsername: "",
      adminEmail: "",
      adminMobile: "",
      adminPassword: "",
      newPassword: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setFieldErrors({});

    try {
      if (isEditMode) {
        await apiClient.put(`/Organizations/${formData.id}`, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          domain: formData.domain,
          address: formData.address,
          currency: formData.currency,
          logoUrl: formData.logoUrl,
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
          newPassword: formData.newPassword || null,
        });
        setMessage("Company updated successfully!");
      } else {
        const payload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          domain: formData.domain,
          address: formData.address,
          currency: formData.currency,
          logoUrl: formData.logoUrl || null,
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
          adminFullName: formData.adminFullName,
          adminUsername: formData.adminUsername,
          adminEmail: formData.adminEmail,
          adminMobile: formData.adminMobile,
          adminPassword: formData.adminPassword,
        };

        await apiClient.post("/Organizations/create-company", payload);
        setMessage("Company & Admin created successfully!");
      }
      setShowModal(false);
      await fetchCompanies();
      resetForm();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: ApiValidationResponse } };
      if (axiosError.response?.data?.errors) {
        const errors = axiosError.response.data.errors;
        const formattedErrors: Record<string, string> = {};
        Object.keys(errors).forEach((key) => {
          const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
          formattedErrors[lowerKey] = errors[key][0];
        });
        setFieldErrors(formattedErrors);
        setError("Please fix the validation errors highlighted below.");
      } else {
        setError(axiosError.response?.data?.message || "Operation failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (comp: CompanyItem) => {
    setIsEditMode(true);
    setFormData({
      id: comp.id,
      name: comp.name || "",
      email: comp.email || "",
      phone: comp.phone || "",
      domain: comp.domain || "",
      address: comp.address || "",
      currency: comp.currency || "INR",
      primaryColor: comp.primaryColor || "#0d6efd",
      secondaryColor: comp.secondaryColor || "#6c757d",
      logoUrl: comp.logoUrl || "",
      adminFullName: comp.adminFullName || "",
      adminUsername: comp.adminUsername || "",
      adminEmail: comp.adminEmail || "",
      adminMobile: comp.adminMobile || "",
      adminPassword: "",
      newPassword: "", // blank = keep current password
    });
    setFieldErrors({});
    setShowModal(true);
  };

  const handleToggleStatus = async (org: CompanyItem) => {
    if (!window.confirm(`Are you sure you want to ${org.isActive ? "DEACTIVATE" : "ACTIVATE"} ${org.name}?`))
      return;
    try {
      await apiClient.put(`/Organizations/toggle-status/${org.id}`);
      await fetchCompanies();
      setMessage(`Company status changed successfully.`);
    } catch {
      alert("Failed to toggle status.");
    }
  };

  const handleConfirmDelete = async (org: CompanyItem) => {
    setOrgToDelete(org);
    setDeleteInfo(null);
    setShowDeleteModal(true);
    setLoadingSummary(true);
    try {
      const res = await apiClient.get<DeleteSummary>(`/Organizations/${org.id}/summary`);
      setDeleteInfo(res.data);
    } catch {
      alert("Failed to load company summary.");
      setShowDeleteModal(false);
    } finally {
      setLoadingSummary(false);
    }
  };

  const executeDelete = async () => {
    if (!orgToDelete) return;
    try {
      await apiClient.delete(`/Organizations/delete/${orgToDelete.id}`);
      setShowDeleteModal(false);
      await fetchCompanies();
      setMessage("Company and related data deleted successfully!");
    } catch {
      alert("Failed to delete company.");
    }
  };

  return (
    <div className="container-fluid py-3" style={{ background: "#f8fafc", minHeight: "90vh" }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-4 rounded-4 shadow-sm border">
        <div>
          <h4 className="fw-bold text-dark mb-1">🏢 Client Portal Management</h4>
          <p className="text-muted small mb-0">Manage registered client portals, credentials, and settings.</p>
        </div>
        <button
          className="btn btn-dark px-4 fw-semibold shadow-sm rounded-pill"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          + Add New Company
        </button>
      </div>

      {message && <div className="alert alert-success border-0 shadow-sm rounded-3">{message}</div>}
      {error && <div className="alert alert-danger border-0 shadow-sm rounded-3">{error}</div>}

      {/* Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover">
            <thead className="bg-light text-secondary small text-uppercase">
              <tr>
                <th className="py-3 ps-4">Logo & Name</th>
                <th>Auto Code</th>
                <th>Domain</th>
                <th>Email</th>
                <th>Admin Username</th>
                <th>Status</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.length > 0 ? (
                companies.map((comp) => (
                  <tr key={comp.id} className="border-bottom">
                    <td className="ps-4 py-3">
                      <div className="d-flex align-items-center gap-3">
                        {comp.logoUrl ? (
                          <img
                            src={comp.logoUrl}
                            alt="Logo"
                            className="rounded-circle border shadow-sm"
                            width="40"
                            height="40"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            className="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm"
                            style={{ width: "40px", height: "40px", fontSize: "15px" }}
                          >
                            {comp.name ? comp.name.charAt(0) : "C"}
                          </div>
                        )}
                        <div>
                          <span className="fw-bold text-dark">{comp.name}</span>
                          <span className="d-block text-muted small">{comp.phone || "No phone"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-dark bg-opacity-10 text-dark border px-2 py-1 font-monospace">
                        #{comp.code}
                      </span>
                    </td>
                    <td className="text-muted">{comp.domain || "N/A"}</td>
                    <td className="text-muted">{comp.email || "N/A"}</td>
                    <td>
                      <span className="badge bg-light text-primary border px-2 py-1">
                        {comp.adminUsername || "N/A"}
                      </span>
                    </td>
                    <td>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          checked={comp.isActive}
                          onChange={() => handleToggleStatus(comp)}
                        />
                        <label className={`form-check-label small fw-bold ${comp.isActive ? "text-success" : "text-danger"}`}>
                          {comp.isActive ? "Active" : "Inactive"}
                        </label>
                      </div>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        className="btn btn-sm btn-light border me-2 px-3 rounded-pill text-secondary fw-semibold"
                        onClick={() => {
                          setSelectedCompany(comp);
                          setShowViewModal(true);
                        }}
                      >
                        👁️ View
                      </button>
                      <button
                        className="btn btn-sm btn-light border me-2 px-3 rounded-pill text-dark fw-semibold"
                        onClick={() => handleEditClick(comp)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger border-0 fw-semibold rounded-pill px-3 shadow-sm"
                        onClick={() => handleConfirmDelete(comp)}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    No companies found. Click "+ Add New Company" to register one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW MODAL */}
      {showViewModal && selectedCompany && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(5px)" }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">
              <div className="modal-header bg-dark text-white px-4 py-3">
                <h5 className="modal-title fw-bold">🏢 Company Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowViewModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="text-center mb-4">
                  {selectedCompany.logoUrl ? (
                    <img
                      src={selectedCompany.logoUrl}
                      alt="Logo"
                      className="rounded-circle border shadow-sm mb-2"
                      width="80"
                      height="80"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold mx-auto mb-2 shadow-sm"
                      style={{ width: "80px", height: "80px", fontSize: "28px" }}
                    >
                      {selectedCompany.name ? selectedCompany.name.charAt(0) : "C"}
                    </div>
                  )}
                  <h5 className="fw-bold mb-0">{selectedCompany.name}</h5>
                  <span className="badge bg-secondary">Code: {selectedCompany.code}</span>
                </div>

                <div className="border-top pt-3">
                  <div className="row g-2 small">
                    <div className="col-5 text-muted fw-semibold">Email:</div>
                    <div className="col-7 text-dark">{selectedCompany.email || "N/A"}</div>

                    <div className="col-5 text-muted fw-semibold">Phone:</div>
                    <div className="col-7 text-dark">{selectedCompany.phone || "N/A"}</div>

                    <div className="col-5 text-muted fw-semibold">Domain:</div>
                    <div className="col-7 text-dark">{selectedCompany.domain || "N/A"}</div>

                    <div className="col-5 text-muted fw-semibold">Currency:</div>
                    <div className="col-7 text-dark">{selectedCompany.currency}</div>

                    <div className="col-5 text-muted fw-semibold">Address:</div>
                    <div className="col-7 text-dark">{selectedCompany.address || "N/A"}</div>

                    <div className="col-5 text-muted fw-semibold">Primary Color:</div>
                    <div className="col-7 d-flex align-items-center gap-2">
                      <span style={{ width: 14, height: 14, background: selectedCompany.primaryColor || '#0d6efd', borderRadius: 3, display: 'inline-block' }}></span>
                      {selectedCompany.primaryColor || "#0d6efd"}
                    </div>

                    <div className="col-5 text-muted fw-semibold">Admin Username:</div>
                    <div className="col-7 text-primary fw-bold">{selectedCompany.adminUsername}</div>

                    <div className="col-5 text-muted fw-semibold">Admin Password:</div>
                    <div className="col-7 font-monospace text-danger">{selectedCompany.adminPassword}</div>

                    <div className="col-5 text-muted fw-semibold">Status:</div>
                    <div className="col-7">
                      <span className={`badge ${selectedCompany.isActive ? 'bg-success' : 'bg-danger'}`}>
                        {selectedCompany.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-light px-4 py-3">
                <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setShowViewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(5px)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">
              <div className="modal-header bg-dark text-white px-4 py-3">
                <h5 className="modal-title fw-bold">
                  {isEditMode ? "✏️ Edit Company Details" : "✨ Register New Company & Admin"}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                  <div className="text-center mb-4 p-3 bg-light rounded-4 border border-dashed">
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Logo"
                        className="rounded-circle border shadow-sm mb-2"
                        width="75"
                        height="75"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        className="bg-white text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold mx-auto mb-2 shadow-sm border"
                        style={{ width: "75px", height: "75px", fontSize: "24px" }}
                      >
                        🏢
                      </div>
                    )}
                    <div>
                      <label className="btn btn-outline-dark btn-sm rounded-pill px-3 cursor-pointer fw-semibold">
                        📁 Upload Logo
                        <input type="file" accept="image/*" className="d-none" onChange={handleLogoUpload} />
                      </label>
                    </div>
                  </div>

                  <h6 className="text-dark border-bottom pb-2 mb-3 fw-bold">🏢 Company Information</h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-muted">Company Name *</label>
                      <input
                        type="text"
                        className={`form-control rounded-3 ${fieldErrors.name ? "is-invalid" : ""}`}
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                      {fieldErrors.name && <div className="invalid-feedback">{fieldErrors.name}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-muted">Email *</label>
                      <input
                        type="email"
                        className={`form-control rounded-3 ${fieldErrors.email ? "is-invalid" : ""}`}
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                      {fieldErrors.email && <div className="invalid-feedback">{fieldErrors.email}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-muted">Phone Number *</label>
                      <input
                        type="text"
                        className={`form-control rounded-3 ${fieldErrors.phone ? "is-invalid" : ""}`}
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                      />
                      {fieldErrors.phone && <div className="invalid-feedback">{fieldErrors.phone}</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-muted">Domain</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        name="domain"
                        value={formData.domain}
                        onChange={handleChange}
                        placeholder="e.g. client.yourdomain.com"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-muted">Currency</label>
                      <select className="form-select rounded-3" name="currency" value={formData.currency} onChange={handleChange}>
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Primary Color</label>
                      <input
                        type="color"
                        className="form-control form-control-color w-100 rounded-3"
                        name="primaryColor"
                        value={formData.primaryColor}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted">Secondary Color</label>
                      <input
                        type="color"
                        className="form-control form-control-color w-100 rounded-3"
                        name="secondaryColor"
                        value={formData.secondaryColor}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-semibold text-muted">Full Address *</label>
                      <textarea
                        className={`form-control rounded-3 ${fieldErrors.address ? "is-invalid" : ""}`}
                        rows={2}
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        required
                      ></textarea>
                      {fieldErrors.address && <div className="invalid-feedback">{fieldErrors.address}</div>}
                    </div>
                  </div>

                  {!isEditMode ? (
                    <>
                      <h6 className="text-dark border-bottom pb-2 mb-3 fw-bold">👤 Admin Account Details</h6>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-muted">Admin Full Name *</label>
                          <input
                            type="text"
                            className={`form-control rounded-3 ${fieldErrors.adminFullName ? "is-invalid" : ""}`}
                            name="adminFullName"
                            value={formData.adminFullName}
                            onChange={handleChange}
                            required
                          />
                          {fieldErrors.adminFullName && <div className="invalid-feedback">{fieldErrors.adminFullName}</div>}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-muted">Admin Username *</label>
                          <input
                            type="text"
                            className={`form-control rounded-3 ${fieldErrors.adminUsername ? "is-invalid" : ""}`}
                            name="adminUsername"
                            value={formData.adminUsername}
                            onChange={handleChange}
                            required
                          />
                          {fieldErrors.adminUsername && <div className="invalid-feedback">{fieldErrors.adminUsername}</div>}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-muted">Admin Email *</label>
                          <input
                            type="email"
                            className={`form-control rounded-3 ${fieldErrors.adminEmail ? "is-invalid" : ""}`}
                            name="adminEmail"
                            value={formData.adminEmail}
                            onChange={handleChange}
                            required
                          />
                          {fieldErrors.adminEmail && <div className="invalid-feedback">{fieldErrors.adminEmail}</div>}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold text-muted">Admin Mobile *</label>
                          <input
                            type="text"
                            className={`form-control rounded-3 ${fieldErrors.adminMobile ? "is-invalid" : ""}`}
                            name="adminMobile"
                            value={formData.adminMobile}
                            onChange={handleChange}
                            required
                          />
                          {fieldErrors.adminMobile && <div className="invalid-feedback">{fieldErrors.adminMobile}</div>}
                        </div>
                        <div className="col-md-12">
                          <label className="form-label small fw-semibold text-muted">Admin Password *</label>
                          <div className="input-group">
                            <input
                              type={showPassword ? "text" : "password"}
                              className={`form-control rounded-start-3 ${fieldErrors.adminPassword ? "is-invalid" : ""}`}
                              name="adminPassword"
                              value={formData.adminPassword}
                              onChange={handleChange}
                              required
                            />
                            <button
                              type="button"
                              className="btn btn-outline-secondary rounded-end-3"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? "🙈" : "👁️"}
                            </button>
                            {fieldErrors.adminPassword && <div className="invalid-feedback">{fieldErrors.adminPassword}</div>}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h6 className="text-dark border-bottom pb-2 mb-3 fw-bold">🔑 Change Admin Password (Optional)</h6>
                      <div className="col-md-12">
                        <label className="form-label small fw-semibold text-muted">New Password</label>
                        <input
                          type="text"
                          className="form-control rounded-3"
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          placeholder="Leave blank to keep existing password"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer bg-light px-4 py-3">
                  <button type="button" className="btn btn-light border px-4 rounded-pill fw-semibold" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-dark px-4 rounded-pill fw-semibold shadow-sm" disabled={loading}>
                    {loading ? "Saving..." : "💾 Save Company"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(5px)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">
              <div className="modal-header bg-danger text-white px-4 py-3">
                <h5 className="modal-title fw-bold">⚠️ Permanent Deletion</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <h5 className="fw-bold">Delete {orgToDelete?.name}?</h5>
                <p className="text-muted small">This action cannot be undone. All users, roles, and sites associated with this company will be wiped.</p>
                {loadingSummary ? (
                  <p className="text-muted">Loading summary...</p>
                ) : (
                  deleteInfo && (
                    <div className="bg-light p-3 rounded-3 text-start mb-3">
                      <div>👥 <strong>Users Affected:</strong> {deleteInfo.userCount}</div>
                      <div>🛡️ <strong>Roles Affected:</strong> {deleteInfo.roleCount}</div>
                    </div>
                  )
                )}
              </div>
              <div className="modal-footer bg-light px-4 py-3">
                <button type="button" className="btn btn-light border rounded-pill px-4" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger rounded-pill px-4" onClick={executeDelete}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
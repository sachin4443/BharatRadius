import React, { useState, useEffect } from "react";
import apiClient from "../services/api";

interface PackageData {
  id: string;
  packageName: string;
  planCategory: string;

  downloadMbps: number;
  downloadUnit: string;

  uploadMbps: number;
  uploadUnit: string;

  price: number;

  expiryDays: number;
  validityType: string;

  description: string;
  isActive: boolean;

  site?: {
    id: string;
    siteName: string;
  };
}

interface PackageFormData {
  id: string;
  packageName: string;
  planCategory: string;

  downloadMbps: string;
  downloadUnit: string;

  uploadMbps: string;
  uploadUnit: string;

  price: string;

  expiryDays: string;
  validityType: string;

  description: string;
  isActive: boolean;
}

export const PackageManagement: React.FC = () => {
  // ============================================================
  // STATE
  // ============================================================

  const [packages, setPackages] = useState<PackageData[]>([]);

  const [showModal, setShowModal] = useState(false);

  const [isEdit, setIsEdit] = useState(false);

  const [loading, setLoading] = useState(false);

  const [loadingList, setLoadingList] = useState(false);

  const [formData, setFormData] = useState<PackageFormData>({
    id: "",

    packageName: "",

    planCategory: "Unlimited",

    downloadMbps: "",
    downloadUnit: "Mbps",

    uploadMbps: "",
    uploadUnit: "Mbps",

    price: "",

    expiryDays: "",
    validityType: "Days",

    description: "",

    isActive: true,
  });

  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    fetchPackages();
  }, []);

  // ============================================================
  // GET PACKAGES
  // ============================================================

  const fetchPackages = async () => {
    try {
      setLoadingList(true);

      const response = await apiClient.get("/Packages/list");

      setPackages(response.data || []);
    } catch (error) {
      console.error("Error loading packages:", error);

      alert("Failed to load packages.");
    } finally {
      setLoadingList(false);
    }
  };

  // ============================================================
  // HANDLE INPUT
  // ============================================================

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;

    const checked =
      type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : undefined;

    setFormData((prev) => ({
      ...prev,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  // ============================================================
  // SAVE PACKAGE
  // ============================================================

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!formData.packageName.trim()) {
      alert("Please enter package name.");
      return;
    }

    if (!formData.downloadMbps) {
      alert("Please enter download speed.");
      return;
    }

    if (!formData.uploadMbps) {
      alert("Please enter upload speed.");
      return;
    }

    if (!formData.price) {
      alert("Please enter package price.");
      return;
    }

    if (!formData.expiryDays) {
      alert("Please enter validity duration.");
      return;
    }

    try {
      setLoading(true);

      // IMPORTANT:
      // SiteId intentionally NOT sent.
      // Backend will automatically determine SiteId
      // from logged-in user's UserId.

     const payload = {
        id: formData.id ? formData.id : "00000000-0000-0000-0000-000000000000",
        packageName: formData.packageName.trim(),
        planCategory: formData.planCategory,
        downloadMbps: Number(formData.downloadMbps),
        downloadUnit: formData.downloadUnit,
        uploadMbps: Number(formData.uploadMbps),
        uploadUnit: formData.uploadUnit,
        price: Number(formData.price),
        expiryDays: Number(formData.expiryDays),
        validityType: formData.validityType,
        description: formData.description.trim(),
        isActive: formData.isActive,
        // Yahan 'siteId' define nahi kiya gaya hai, jo backend automatically nikal lega.
      };
      console.log(
        "Package payload:",
        payload
      );

      await apiClient.post(
        "/Packages/save",
        payload
      );

      alert(
        isEdit
          ? "Package updated successfully!"
          : "Package created successfully!"
      );

      setShowModal(false);

      resetForm();

      await fetchPackages();
    } catch (error: any) {
      console.error(
        "Failed to save package:",
        error
      );

      const message =
        error?.response?.data?.message ||
        "Failed to save package.";

      alert(message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // EDIT PACKAGE
  // ============================================================

  const handleEdit = (
    item: PackageData
  ) => {
    setIsEdit(true);

    setFormData({
      id: item.id,

      packageName:
        item.packageName || "",

      planCategory:
        item.planCategory || "Unlimited",

      downloadMbps:
        item.downloadMbps?.toString() || "",

      downloadUnit:
        item.downloadUnit || "Mbps",

      uploadMbps:
        item.uploadMbps?.toString() || "",

      uploadUnit:
        item.uploadUnit || "Mbps",

      price:
        item.price?.toString() || "",

      expiryDays:
        item.expiryDays?.toString() || "",

      validityType:
        item.validityType || "Days",

      description:
        item.description || "",

      isActive:
        item.isActive ?? true,
    });

    setShowModal(true);
  };

  // ============================================================
  // DELETE PACKAGE
  // ============================================================

  const handleDelete = async (
    id: string
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this package?"
      );

    if (!confirmed) {
      return;
    }

    try {
      await apiClient.delete(
        `/Packages/delete/${id}`
      );

      alert(
        "Package deleted successfully!"
      );

      await fetchPackages();
    } catch (error: any) {
      console.error(
        "Delete package error:",
        error
      );

      const message =
        error?.response?.data?.message ||
        "Failed to delete package.";

      alert(message);
    }
  };

  // ============================================================
  // RESET FORM
  // ============================================================

  const resetForm = () => {
    setIsEdit(false);

    setFormData({
      id: "",

      packageName: "",

      planCategory: "Unlimited",

      downloadMbps: "",
      downloadUnit: "Mbps",

      uploadMbps: "",
      uploadUnit: "Mbps",

      price: "",

      expiryDays: "",
      validityType: "Days",

      description: "",

      isActive: true,
    });
  };

  // ============================================================
  // OPEN ADD MODAL
  // ============================================================

  const openAddModal = () => {
    resetForm();

    setShowModal(true);
  };

  // ============================================================
  // CLOSE MODAL
  // ============================================================

  const closeModal = () => {
    if (loading) {
      return;
    }

    setShowModal(false);

    resetForm();
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div
      className="container-fluid py-4"
      style={{
        background: "#f4f7f6",
        minHeight: "100vh",
      }}
    >
      {/* ======================================================
          HEADER
      ======================================================= */}

      <div
        className="d-flex justify-content-between align-items-center mb-4 bg-white p-4 rounded-4 shadow-sm border-0"
      >
        <div>
          <h4 className="fw-bold text-dark mb-1">
            📦 Internet Packages
          </h4>

          <p className="text-muted small mb-0">
            Manage broadband plans, pricing,
            and bandwidth limits.
          </p>
        </div>

        <button
          type="button"
          className="btn text-white px-4 fw-semibold rounded-pill"
          style={{
            backgroundColor: "#f97316",
          }}
          onClick={openAddModal}
        >
          + Add New Package
        </button>
      </div>

      {/* ======================================================
          PACKAGE TABLE
      ======================================================= */}

      <div
        className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white"
      >
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover">
            <thead
              className="bg-light text-secondary small text-uppercase"
            >
              <tr>
                <th className="py-3 ps-4">
                  Package Name
                </th>

                <th>
                  Category
                </th>

                <th>
                  Speed (DL / UL)
                </th>

                <th>
                  Validity
                </th>

                <th>
                  Price (₹)
                </th>

                <th>
                  Status
                </th>

                <th className="text-end pe-4">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ==================================================
                  LOADING
              =================================================== */}

              {loadingList && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-5"
                  >
                    <div
                      className="spinner-border text-primary"
                      role="status"
                    >
                      <span className="visually-hidden">
                        Loading...
                      </span>
                    </div>

                    <div className="text-muted mt-2">
                      Loading packages...
                    </div>
                  </td>
                </tr>
              )}

              {/* ==================================================
                  DATA
              =================================================== */}

              {!loadingList &&
                packages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="border-bottom"
                  >
                    {/* PACKAGE NAME */}

                    <td className="ps-4 py-3">
                      <div className="fw-bold text-dark">
                        {pkg.packageName}
                      </div>

                      {pkg.site?.siteName && (
                        <div className="text-primary small fw-semibold">
                          🏢 Site:{" "}
                          {pkg.site.siteName}
                        </div>
                      )}
                    </td>

                    {/* CATEGORY */}

                    <td>
                      <span className="badge bg-secondary bg-opacity-10 text-secondary border">
                        {pkg.planCategory}
                      </span>
                    </td>

                    {/* SPEED */}

                    <td>
                      <div className="fw-semibold text-dark">
                        <span className="text-primary">
                          ⬇{" "}
                          {pkg.downloadMbps}{" "}
                          {pkg.downloadUnit}
                        </span>

                        <br />

                        <span className="text-success">
                          ⬆{" "}
                          {pkg.uploadMbps}{" "}
                          {pkg.uploadUnit}
                        </span>
                      </div>
                    </td>

                    {/* VALIDITY */}

                    <td>
                      <div className="fw-semibold">
                        {pkg.expiryDays}{" "}
                        {pkg.validityType}
                      </div>
                    </td>

                    {/* PRICE */}

                    <td>
                      <div className="fw-bold text-dark">
                        ₹
                        {Number(
                          pkg.price
                        ).toFixed(2)}
                      </div>
                    </td>

                    {/* STATUS */}

                    <td>
                      <span
                        className={`badge px-3 py-1 rounded-pill ${
                          pkg.isActive
                            ? "bg-success bg-opacity-10 text-success border border-success"
                            : "bg-danger bg-opacity-10 text-danger border border-danger"
                        }`}
                      >
                        {pkg.isActive
                          ? "Active"
                          : "Disabled"}
                      </span>
                    </td>

                    {/* ACTIONS */}

                    <td className="text-end pe-4">
                      <button
                        type="button"
                        className="btn btn-sm btn-light border me-2 rounded-pill px-3"
                        onClick={() =>
                          handleEdit(pkg)
                        }
                      >
                        ✏️ Edit
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-pill px-3"
                        onClick={() =>
                          handleDelete(pkg.id)
                        }
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}

              {/* ==================================================
                  EMPTY
              =================================================== */}

              {!loadingList &&
                packages.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-5 text-muted"
                    >
                      <div
                        style={{
                          fontSize: "40px",
                        }}
                      >
                        📦
                      </div>

                      <div className="fw-semibold mt-2">
                        No packages found.
                      </div>

                      <div className="small">
                        Create a package plan
                        to get started.
                      </div>
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          ADD / EDIT MODAL
      ========================================================= */}

      {showModal && (
        <div
          className="modal show d-block"
          style={{
            backgroundColor:
              "rgba(15,23,42,0.6)",
            backdropFilter:
              "blur(5px)",
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">
              <div className="modal-body p-5">

                {/* ==================================================
                    MODAL HEADER
                =================================================== */}

                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h5 className="fw-bold mb-1 text-dark">
                      {isEdit
                        ? "Edit Internet Package"
                        : "Add Internet Package"}
                    </h5>

                    
                  </div>

                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeModal}
                    disabled={loading}
                  />
                </div>

                {/* ==================================================
                    FORM
                =================================================== */}

                <form
                  onSubmit={handleSubmit}
                >
                  <div className="row g-4">

                    {/* PACKAGE NAME */}

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary">
                        Package Name *
                      </label>

                      <input
                        type="text"
                        className="form-control rounded-3"
                        name="packageName"
                        value={
                          formData.packageName
                        }
                        onChange={
                          handleChange
                        }
                        required
                        placeholder="e.g. 50Mbps FUP Plan"
                      />
                    </div>

                    {/* PLAN CATEGORY */}

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary">
                        Plan Category
                      </label>

                      <select
                        className="form-select rounded-3"
                        name="planCategory"
                        value={
                          formData.planCategory
                        }
                        onChange={
                          handleChange
                        }
                      >
                        <option value="Unlimited">
                          Unlimited
                        </option>

                        <option value="FUP">
                          FUP
                        </option>

                        <option value="Data Limit">
                          Data Limit
                        </option>
                      </select>
                    </div>

                    {/* ==================================================
                        DOWNLOAD SPEED
                    =================================================== */}

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary">
                        Download Speed *
                      </label>

                      <div className="input-group">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className="form-control"
                          name="downloadMbps"
                          value={
                            formData.downloadMbps
                          }
                          onChange={
                            handleChange
                          }
                          required
                          placeholder="50"
                        />

                        <select
                          className="form-select bg-light"
                          name="downloadUnit"
                          value={
                            formData.downloadUnit
                          }
                          onChange={
                            handleChange
                          }
                          style={{
                            maxWidth: "100px",
                          }}
                        >
                          <option value="Kbps">
                            Kbps
                          </option>

                          <option value="Mbps">
                            Mbps
                          </option>

                          <option value="Gbps">
                            Gbps
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* ==================================================
                        UPLOAD SPEED
                    =================================================== */}

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary">
                        Upload Speed *
                      </label>

                      <div className="input-group">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className="form-control"
                          name="uploadMbps"
                          value={
                            formData.uploadMbps
                          }
                          onChange={
                            handleChange
                          }
                          required
                          placeholder="50"
                        />

                        <select
                          className="form-select bg-light"
                          name="uploadUnit"
                          value={
                            formData.uploadUnit
                          }
                          onChange={
                            handleChange
                          }
                          style={{
                            maxWidth: "100px",
                          }}
                        >
                          <option value="Kbps">
                            Kbps
                          </option>

                          <option value="Mbps">
                            Mbps
                          </option>

                          <option value="Gbps">
                            Gbps
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* ==================================================
                        PRICE
                    =================================================== */}

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary">
                        Price *
                      </label>

                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">
                          ₹
                        </span>

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          name="price"
                          value={
                            formData.price
                          }
                          onChange={
                            handleChange
                          }
                          required
                          placeholder="999"
                        />
                      </div>
                    </div>

                    {/* ==================================================
                        VALIDITY
                    =================================================== */}

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary">
                        Validity Duration *
                      </label>

                      <input
                        type="number"
                        min="1"
                        className="form-control rounded-3"
                        name="expiryDays"
                        value={
                          formData.expiryDays
                        }
                        onChange={
                          handleChange
                        }
                        required
                        placeholder="30"
                      />
                    </div>

                    {/* VALIDITY TYPE */}

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary">
                        Validity Type
                      </label>

                      <select
                        className="form-select rounded-3"
                        name="validityType"
                        value={
                          formData.validityType
                        }
                        onChange={
                          handleChange
                        }
                      >
                        <option value="Days">
                          Days
                        </option>

                        <option value="Months">
                          Months
                        </option>

                        <option value="Years">
                          Years
                        </option>
                      </select>
                    </div>

                    {/* ==================================================
                        DESCRIPTION
                    =================================================== */}

                    <div className="col-12">
                      <label className="form-label small fw-bold text-secondary">
                        Description
                      </label>

                      <textarea
                        className="form-control rounded-3"
                        name="description"
                        value={
                          formData.description
                        }
                        onChange={
                          handleChange
                        }
                        rows={3}
                        placeholder="Add brief details about the plan..."
                      />
                    </div>

                    {/* ==================================================
                        ACTIVE STATUS
                    =================================================== */}

                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="packageActive"
                          name="isActive"
                          checked={
                            formData.isActive
                          }
                          onChange={
                            handleChange
                          }
                        />

                        <label
                          className="form-check-label fw-semibold"
                          htmlFor="packageActive"
                        >
                          Package Active
                        </label>
                      </div>
                    </div>

                    {/* ==================================================
                        BUTTONS
                    =================================================== */}

                    <div className="col-12 mt-4 text-end">
                      <button
                        type="button"
                        className="btn btn-light px-4 rounded-pill me-3"
                        onClick={
                          closeModal
                        }
                        disabled={loading}
                      >
                        Close
                      </button>

                      <button
                        type="submit"
                        className="btn text-white px-5 rounded-pill shadow-sm"
                        style={{
                          backgroundColor:
                            "#f97316",
                        }}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                            />

                            Saving...
                          </>
                        ) : (
                          <>
                            {isEdit
                              ? "Update Package"
                              : "Save Package"}
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackageManagement;
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "../services/api";

import SubscriberConnectionButton from "../components/subscriber/SubscriberConnectionButton";
import SubscriberLiveModal from "../components/subscriber/SubscriberLiveModal";
import SubscriberStatusBadge from "../components/subscriber/SubscriberStatusBadge";
import SubscriberExcelImport from "../components/subscriber/SubscriberExcelImport";
import RechargeModal from "../components/subscriber/RechargeModal";
import { daysUntil, formatDate, saveBlob } from "../utils/format";
import { usePolling } from "../hooks/usePolling";
import { primeSubscriber } from "../services/subscriberCache";

// ============================================================
// TYPES
// ============================================================

interface Subscriber {
  id: string;

  siteId?: string;
  nasId?: string | null;
  packageId?: string | null;

  subscriberType?: string;

  fullName: string;
  companyName?: string;

  mobile?: string;
  email?: string;

  portalUsername?: string;
  portalPassword?: string;

  address?: string;
  zip?: string;
  city?: string;
  state?: string;

  gstNo?: string;
  comment?: string;

  service?: string;

  pppoeUsername?: string;
  ppPoEUsername?: string;
  pppoePassword?: string;

  macAddress?: string;
  staticIp?: string;

  connectionEnabled?: boolean;
  isActive?: boolean;
  expireDate?: string | null;

  createdAt?: string;
  updatedAt?: string;

  isOnline?: boolean;
  ipAddress?: string;
  uptime?: string;
  // from /Subscribers/paged
  status?: string;
  packageName?: string | null;
  nasName?: string | null;
  siteName?: string | null;
  lastAuthReason?: string | null;
}

interface StatusCounts {
  total: number;
  online: number;
  active: number;
  offline: number;
  expired: number;
  suspended: number;
  disabled: number;
  wrongPassword: number;
}

const emptyCounts: StatusCounts = {
  total: 0,
  online: 0,
  active: 0,
  offline: 0,
  expired: 0,
  suspended: 0,
  disabled: 0,
  wrongPassword: 0,
};

interface Site {
  id: string;
  siteName?: string;
  companyName?: string;
}

interface Nas {
  id: string;
  nasName: string;
  nasIpAddress?: string;
  isOnline?: boolean;
  isEnabled?: boolean;
}

interface PackageProfile {
  id: string;
  packageName?: string;
  downloadMbps?: number;
  uploadMbps?: number;
  price?: number;
}

interface SubscriberForm {
  id: string;

  siteId: string;
  nasId: string;
  packageId: string;

  subscriberType: string;

  fullName: string;
  companyName: string;
  mobile: string;
  email: string;

  portalUsername: string;
  portalPassword: string;

  address: string;
  zip: string;
  city: string;
  state: string;

  gstNo: string;
  comment: string;

  service: string;

  pppoeUsername: string;
  pppoePassword: string;

  macAddress: string;
  staticIp: string;

  connectionEnabled: boolean;
  isActive: boolean;
  expireDate: string;
}

// ============================================================
// EMPTY FORM
// ============================================================

const emptyForm: SubscriberForm = {
  id: "",

  siteId: "",
  nasId: "",
  packageId: "",

  subscriberType: "Individual",

  fullName: "",
  companyName: "",
  mobile: "",
  email: "",

  portalUsername: "",
  portalPassword: "",

  address: "",
  zip: "",
  city: "",
  state: "",

  gstNo: "",
  comment: "",

  service: "PPPoE",

  pppoeUsername: "",
  pppoePassword: "",

  macAddress: "",
  staticIp: "",

  connectionEnabled: true,
  isActive: true,
  expireDate: "",
};

// ============================================================
// COMPONENT
// ============================================================

const SubscriberManagement: React.FC = () => {
  const navigate = useNavigate();

  // ==========================================================
  // DATA
  // ==========================================================

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);


  const [sites, setSites] = useState<Site[]>([]);

  const [routers, setRouters] = useState<Nas[]>([]);

  const [packages, setPackages] = useState<PackageProfile[]>([]);

  // ==========================================================
  // PAGE
  // ==========================================================
  const [enablePPPoEEdit, setEnablePPPoEEdit] = useState<boolean>(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  // ==========================================================
  // MODAL
  // ==========================================================

  const [showModal, setShowModal] = useState(false);

  const [isEdit, setIsEdit] = useState(false);

  const [saving, setSaving] = useState(false);

  const [selectedSubscriber, setSelectedSubscriber] =
    useState<Subscriber | null>(null);

  // ==========================================================
  // FORM TAB
  // ==========================================================

  const [activeTab, setActiveTab] = useState<"basic" | "internet" | "account">(
    "basic",
  );

  // ==========================================================
  // FILTER
  // ==========================================================

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [counts, setCounts] = useState<StatusCounts>(emptyCounts);
  const [rechargeFor, setRechargeFor] = useState<Subscriber | null>(null);
  const [exporting, setExporting] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");

  const [routerFilter, setRouterFilter] = useState("all");

  // ==========================================================
  // FORM
  // ==========================================================

  const [formData, setFormData] = useState<SubscriberForm>({
    ...emptyForm,
  });

  // ==========================================================
  // LOAD DATA
  // ==========================================================
  // ==========================================================
  // LOGGED-IN USER CHECK (For L2 Restrictions)
  // ==========================================================
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const isSuperAdmin = user?.isSuperAdmin || false;
  const userLevel = user?.level || user?.orgType || "L1";
  const orgType = typeof userLevel === "number" ? `L${userLevel}` : userLevel;
  useEffect(() => {
    fetchData(true).finally(() => setInitialised(true));
    const handleImport = () => {
      fetchData(false);
    };

    window.addEventListener("subscribersImported", handleImport);

    return () => {
      window.removeEventListener("subscribersImported", handleImport);
    };
  }, []);

  // ==========================================================
  // FETCH DATA
  // ==========================================================

  // Filters sent to the server (search / status / router / paging)
  const listParams = () => ({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    nasId: routerFilter !== "all" ? routerFilter : undefined,
  });

  const fetchSubscribers = async () => {
    const res = await apiClient.get("/Subscribers/paged", { params: listParams() });
    setSubscribers(res.data?.items ?? []);
    setTotalRows(res.data?.total ?? 0);
    setCounts(res.data?.counts ?? emptyCounts);
  };

  const fetchMasters = async () => {
    const [siteRes, nasRes, packageRes] = await Promise.all([
      apiClient.get("/Sites/list"),
      apiClient.get("/Nas/list"),
      apiClient.get("/Packages/list"),
    ]);

    const siteData = Array.isArray(siteRes.data) ? siteRes.data : (siteRes.data?.data ?? []);
    const nasData = Array.isArray(nasRes.data) ? nasRes.data : (nasRes.data?.data ?? []);
    const packageData = Array.isArray(packageRes.data) ? packageRes.data : (packageRes.data?.data ?? []);

    setSites(siteData);
    setRouters(nasData);
    setPackages(packageData);

    // Automatically assign current available site
    if (siteData.length > 0) {
      setFormData((prev) => {
        const exists = siteData.some((x: Site) => String(x.id) === String(prev.siteId));
        return exists ? prev : { ...prev, siteId: String(siteData[0].id) };
      });
    }
  };

  const fetchData = async (firstLoad = false) => {
    try {
      if (firstLoad) {
        setPageLoading(true);
        await Promise.all([fetchSubscribers(), fetchMasters()]);
      } else {
        setRefreshing(true);
        await fetchSubscribers();
      }
    } catch (error: any) {
      console.error("Subscriber data loading error:", error);
      if (firstLoad) {
        alert(error?.response?.data?.message || "Unable to load subscriber data.");
      }
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  };

  // Search box: wait until typing stops
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(t);
  }, [search]);

  // Reload when filters / page change (first load handled below)
  const [initialised, setInitialised] = useState(false);
  useEffect(() => {
    if (!initialised) return;
    fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, statusFilter, routerFilter]);

  // Silent refresh every 30 seconds (online / offline status), paused when tab hidden
  usePolling(
    () => fetchSubscribers().catch(() => undefined),
    30000,
    initialised,
    [page, pageSize, debouncedSearch, statusFilter, routerFilter],
  );

  const changeStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const { page: _p, pageSize: _s, ...filters } = listParams();
      const res = await apiClient.get("/Subscribers/export", { params: filters, responseType: "blob" });
      saveBlob(res.data, `subscribers-${new Date().toISOString().substring(0, 10)}.csv`);
    } catch (error: any) {
      alert(error?.response?.data?.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  // ==========================================================
  // FORM CHANGE
  // ==========================================================

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const target = e.target as HTMLInputElement;

    setFormData((prev) => ({
      ...prev,
      [target.name]: target.type === "checkbox" ? target.checked : target.value,
    }));
  };

  // ==========================================================
  // PINCODE
  // ==========================================================

  const handlePincodeChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const pin = e.target.value.replace(/\D/g, "");

    setFormData((prev) => ({
      ...prev,
      zip: pin,
    }));

    if (pin.length !== 6) {
      return;
    }

    try {
      const response = await fetch(
        `https://api.postalpincode.in/pincode/${pin}`,
      );

      const data = await response.json();

      if (data?.[0]?.Status === "Success" && data?.[0]?.PostOffice?.length) {
        const office = data[0].PostOffice[0];

        setFormData((prev) => ({
          ...prev,
          city: office.District || "",
          state: office.State || "",
        }));
      }
    } catch (error) {
      console.error("Pincode lookup failed", error);
    }
  };

  // ==========================================================
  // RESET FORM
  // ==========================================================

  const resetForm = () => {
    setIsEdit(false);

    setActiveTab("basic");

    setFormData({
      ...emptyForm,
      siteId: sites.length > 0 ? String(sites[0].id) : "",
    });
  };

  // ==========================================================
  // ADD
  // ==========================================================

  const openAddSubscriber = () => {
    resetForm();
    setShowModal(true);
  };

  // ==========================================================
  // EDIT
  // ==========================================================

 const handleEdit = async (row: Subscriber) => {
    // The list only has the columns it shows, so load the full record
    let subscriber: Subscriber = row;
    try {
      const res = await apiClient.get(`/Subscribers/${row.id}`);
      subscriber = { ...row, ...(res.data?.data ?? res.data) };
    } catch (error: any) {
      alert(error?.response?.data?.message || "Unable to load subscriber details.");
      return;
    }
    setIsEdit(true);
    setActiveTab("basic");
    setEnablePPPoEEdit(false);

    // console.log("Editing subscriber:", subscriber); // Yeh console me check karne ke liye ki data kya aa raha hai

    setFormData({
      id: subscriber.id,
      siteId: subscriber.siteId || "",
      nasId: subscriber.nasId || "",
      packageId: subscriber.packageId || "",
      subscriberType: subscriber.subscriberType || "Individual",
      fullName: subscriber.fullName || "",
      companyName: subscriber.companyName || "",
      mobile: subscriber.mobile || "",
      email: subscriber.email || "",
      portalUsername: subscriber.portalUsername || "",
      portalPassword: "",
      address: subscriber.address || "",
      zip: subscriber.zip || "",
      city: subscriber.city || "",
      state: subscriber.state || "",
      gstNo: subscriber.gstNo || "",
      comment: subscriber.comment || "",
      service: subscriber.service || "PPPoE",
      
      // ✅ Yahan check karein ki aapke subscriber object me keys ka naam kya hai:
      // Agar backend se 'ppPoEUsername' (CamelCase ya PascalCase) aa raha hai toh us hisab se set karein
      pppoeUsername: subscriber.pppoeUsername || (subscriber as any).ppPoEUsername || "",
      pppoePassword: subscriber.pppoePassword || (subscriber as any).ppPoEPassword || "",

      macAddress: subscriber.macAddress || "",
      staticIp: subscriber.staticIp || "",
      connectionEnabled: subscriber.connectionEnabled ?? true,
      isActive: subscriber.isActive ?? true,
      // Show the India date (the stored value is UTC)
      expireDate: subscriber.expireDate
        ? new Date(subscriber.expireDate).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        : "",
    });

    setShowModal(true);
  };
  // ==========================================================
  // SAVE
  // ==========================================================

  // ==========================================================
  // SAVE
  // ==========================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🚨 YAHAN SE 'SITE ID' WALI VALIDATION HATA DI GAYI HAI
    // Kyunki backend khud decide karega ki kaunsi site assign karni hai.

    if (!formData.fullName.trim()) {
      alert("Full Name is required.");
      setActiveTab("basic");
      return;
    }

    if (!formData.mobile.trim()) {
      alert("Mobile number is required.");
      setActiveTab("basic");
      return;
    }

    // ✨ PPPoE VALIDATION
    if (
      formData.service === "PPPoE" &&
      (!isEdit || enablePPPoEEdit) &&
      !formData.pppoeUsername.trim()
    ) {
      alert("PPPoE Username is required.");
      setActiveTab("internet");
      return;
    }

    if (formData.service === "Static" && !isEdit && !formData.macAddress.trim()) {
      alert("Static IP / IPoE subscribers log in by MAC address. Please enter the MAC address.");
      setActiveTab("internet");
      return;
    }
    if (
      formData.service === "PPPoE" &&
      (!isEdit || enablePPPoEEdit) &&
      !formData.pppoePassword.trim()
    ) {
      alert("PPPoE Password is required.");
      setActiveTab("internet");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...formData,
        id: formData.id || "00000000-0000-0000-0000-000000000000",

        // Agar blank hai toh empty GUID bhejenge, backend isko apne hisaab se replace kar dega
        siteId: formData.siteId || "00000000-0000-0000-0000-000000000000",

        // ✨ ROUTER AUR PACKAGE OPTIONAL HAIN (Agar select nahi kiya to null jayega)
        nasId: formData.nasId ? formData.nasId : null,
          expireDate: formData.expireDate
    ? formData.expireDate
    : null,
        packageId: formData.packageId ? formData.packageId : null,

        // PPPoE Edit Logic
        // Static IP users have no login name / password
        pppoeUsername: formData.service === "Static" || (isEdit && !enablePPPoEEdit) ? "" : formData.pppoeUsername,
        pppoePassword: formData.service === "Static" || (isEdit && !enablePPPoEEdit) ? "" : formData.pppoePassword,
      };

      await apiClient.post("/Subscribers/save", payload);
      setShowModal(false);

      resetForm();
      await fetchData(false);

      alert(
        isEdit
          ? "Subscriber updated successfully."
          : "Subscriber created successfully.",
      );
    } catch (error: any) {
      console.error("Subscriber save error:", error);
      alert(error?.response?.data?.message || "Failed to save subscriber.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete = async (id: string) => {
    const subscriber = subscribers.find((x) => x.id === id);

    if (
      !confirm(
        `Delete ${
          subscriber?.fullName || "this subscriber"
        }?\n\nThis action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await apiClient.delete(`/Subscribers/delete/${id}`);

      await fetchData(false);

      alert("Subscriber deleted successfully.");
    } catch (error: any) {
      console.error("Delete error:", error);

      alert(error?.response?.data?.message || "Failed to delete subscriber.");
    }
  };

  // ==========================================================
  // ROUTER
  // ==========================================================

  const getRouter = (subscriber: Subscriber) =>
    routers.find((x) => String(x.id) === String(subscriber.nasId)) || null;

  // ==========================================================
  // PACKAGE
  // ==========================================================

  const getPackage = (subscriber: Subscriber) =>
    packages.find((x) => String(x.id) === String(subscriber.packageId)) || null;

  // ==========================================================
  // FILTER
  // ==========================================================

  // Search / filter / paging is done by the server (/Subscribers/paged)
  const filteredSubscribers = subscribers;
  const total = counts.total;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  // ==========================================================
  // CURRENT SITE
  // ==========================================================

  const currentSite = sites.find(
    (x) => String(x.id) === String(formData.siteId),
  );

  // ==========================================================
  // NEXT TAB
  // ==========================================================

  const nextTab = () => {
    if (activeTab === "basic") {
      setActiveTab("internet");
    } else if (activeTab === "internet") {
      setActiveTab("account");
    }
  };

  // ==========================================================
  // PREVIOUS TAB
  // ==========================================================

  const previousTab = () => {
    if (activeTab === "account") {
      setActiveTab("internet");
    } else if (activeTab === "internet") {
      setActiveTab("basic");
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      className="container-fluid py-2 py-md-4 px-0 px-md-3"
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
      }}
    >
      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="bg-white border rounded-4 shadow-sm p-3 p-md-4 mb-3 mb-md-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          {/* Left Side: Icon & Title */}
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-none d-md-flex align-items-center justify-content-center rounded-3 bg-light border shadow-sm"
              style={{
                width: 48,
                height: 48,
                fontSize: 22,
              }}
            >
              👥
            </div>
            <div>
              <h3 className="fw-bold mb-1 text-brand">Subscriber Management</h3>
              <div className="small text-muted d-none d-md-block">
                Manage subscribers, PPPoE accounts, packages, routers and live
                connections.
              </div>
            </div>
          </div>

          {/* Right Side: Action Buttons - FOR SUPERADMIN & L2 ONLY */}
          {(isSuperAdmin || orgType === "L2") && (
            <div className="d-flex align-items-center gap-2">
              {/* Excel Import Dropdown */}
              <div className="dropdown">
                <button
                  className="btn btn-light border rounded-pill px-4 py-2 fw-semibold shadow-sm dropdown-toggle d-flex align-items-center gap-2"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  data-bs-auto-close="outside"
                >
                  <span>📥</span> Import Data
                </button>

                <div
                  className="dropdown-menu dropdown-menu-end border-0 shadow-lg rounded-4 p-4 mt-2"
                  style={{ minWidth: "750px" }}
                >
                  <h6 className="dropdown-header text-dark fw-bold px-0 mb-3 border-bottom pb-2">
                    Upload Excel File
                  </h6>
                  <SubscriberExcelImport />
                </div>
              </div>

              {/* Add Subscriber Button (Brand Theme) */}
              <button
                type="button"
                onClick={openAddSubscriber}
                className="btn btn-brand rounded-pill px-4 py-2 fw-bold shadow-sm d-flex align-items-center gap-1"
              >
                <span className="fs-5">+</span> Add Subscriber
              </button>
            </div>
          )}
        </div>
      </div>
     {/* ======================================================
    SUMMARY
======================================================= */}

<div className="row g-2 g-md-3 mb-4">
  <SummaryCard title="Total" value={total} icon="👥" color="#4f46e5" background="#eef2ff"
    active={statusFilter === "all"} onClick={() => changeStatusFilter("all")} />
  <SummaryCard title="Online" value={counts.online} icon="📡" color="#059669" background="#ecfdf5"
    active={statusFilter === "online"} onClick={() => changeStatusFilter("online")} />
  <SummaryCard title="Active (Offline)" value={counts.offline} icon="✓" color="#16a34a" background="#f0fdf4"
    active={statusFilter === "offline"} onClick={() => changeStatusFilter("offline")} />
  <SummaryCard title="Expired" value={counts.expired} icon="⏰" color="#dc2626" background="#fef2f2"
    active={statusFilter === "expired"} onClick={() => changeStatusFilter("expired")} />
  <SummaryCard title="Suspended" value={counts.suspended} icon="⛔" color="#b45309" background="#fffbeb"
    active={statusFilter === "suspended"} onClick={() => changeStatusFilter("suspended")} />
  <SummaryCard title="Disabled" value={counts.disabled} icon="🔌" color="#64748b" background="#f1f5f9"
    active={statusFilter === "disabled"} onClick={() => changeStatusFilter("disabled")} />
  <SummaryCard title="Wrong Password" value={counts.wrongPassword} icon="🔑" color="#7c3aed" background="#f5f3ff"
    active={statusFilter === "wrongpassword"} onClick={() => changeStatusFilter("wrongpassword")} />
</div>
      {/* ======================================================
          FILTER
      ======================================================= */}

      <div className="bg-white border rounded-4 shadow-sm p-3 mb-4">
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">🔎</span>

              <input
                className="form-control border-start-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subscriber, mobile, PPPoE, IP, MAC..."
              />
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => changeStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="active">Active (Online + Offline)</option>
              <option value="offline">Active but Offline</option>
              <option value="expired">Expired</option>
              <option value="expiring-today">Expiring Today</option>
              <option value="expiring-tomorrow">Expiring Tomorrow</option>
              <option value="expiring-week">Expiring in 7 Days</option>
              <option value="expired-month">Expired This Month</option>
              <option value="suspended">Suspended</option>
              <option value="disabled">Disabled</option>
              <option value="wrongpassword">Wrong Password</option>
              <option value="no-package">No Package</option>
            </select>
          </div>

          <div className="col-6 col-lg-3">
            <select
              className="form-select"
              value={routerFilter}
              onChange={(e) => {
                setRouterFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Routers</option>

              {routers.map((router) => (
                <option key={router.id} value={router.id}>
                  {router.nasName}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-lg-1">
            <button
              type="button"
              className="btn btn-light border w-100"
              onClick={() => fetchData(false)}
              disabled={refreshing}
              title="Refresh"
            >
              {refreshing ? "..." : "↻"}
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================
          TABLE
      ======================================================= */}

      <div className="bg-white border rounded-4 shadow-sm overflow-hidden">
        <div className="p-4 border-bottom">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h6 className="fw-bold text-brand mb-1">Subscriber Accounts</h6>

              <small className="text-muted">
                {totalRows === 0
                  ? "No records"
                  : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalRows)} of ${totalRows}`}
              </small>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <select
                className="form-select form-select-sm"
                style={{ width: 110 }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n} rows
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-light border text-nowrap"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "..." : "⬇ Export"}
              </button>
            </div>
          </div>
        </div>

        <div className="table-responsive" style={{ maxHeight: "70vh" }}>
          <table className="table table-sm table-hover align-middle mb-0 subscriber-table">
            <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr className="text-nowrap small">
                <th className="ps-3">#</th>
                <th>Status</th>
                <th>Username</th>
                <th>Full Name</th>
                <th className="d-none d-md-table-cell">Mobile</th>
                <th className="d-none d-xxl-table-cell">Address</th>
                <th className="d-none d-lg-table-cell">NAS</th>
                <th className="d-none d-md-table-cell">Package</th>
                <th>Expiry Date</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-5">
                    <div className="spinner-border text-warning" />
                    <div className="small text-muted mt-2">Loading subscribers...</div>
                  </td>
                </tr>
              ) : filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-5">
                    <div style={{ fontSize: 36 }}>👥</div>
                    <div className="fw-semibold mt-2">No subscribers found</div>
                    <div className="small text-muted">Try changing your filters.</div>
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((subscriber, index) => {
                  const router = getRouter(subscriber);
                  const pkg = getPackage(subscriber);
                  // Static IP users have no login name: show their MAC / IP instead
                  const username =
                    subscriber.pppoeUsername || subscriber.ppPoEUsername || subscriber.macAddress || subscriber.staticIp || "—";
                  const rowClass =
                    subscriber.status === "Online"
                      ? "row-online"
                      : subscriber.status === "Expired"
                        ? "row-expired"
                        : subscriber.status === "Suspended" || subscriber.status === "Disabled"
                          ? "row-blocked"
                          : "";
                  return (
                    <tr key={subscriber.id} className={`small ${rowClass}`}>
                      <td className="ps-3 text-muted">{(page - 1) * pageSize + index + 1}</td>
                      <td>
                        <SubscriberStatusBadge subscriber={subscriber} />
                        {subscriber.lastAuthReason &&
                          subscriber.status === "Active" &&
                          (subscriber as any).lastAuthResult === "REJECT" && (
                            <div className="text-muted mt-1" style={{ fontSize: 10 }}>
                              {subscriber.lastAuthReason}
                            </div>
                          )}
                      </td>
                      <td>
                        <a
                          href={`/subscribers/${subscriber.id}`}
                          className="fw-semibold text-decoration-none"
                          onMouseEnter={() => import("./SubscriberProfile")}
                          onClick={(e) => {
                            e.preventDefault();
                            primeSubscriber(subscriber);
                            navigate(`/subscribers/${subscriber.id}`);
                          }}
                        >
                          {username}
                        </a>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: 180 }}>{subscriber.fullName}</td>
                      <td className="d-none d-md-table-cell text-nowrap">{subscriber.mobile || "—"}</td>
                      <td className="d-none d-xxl-table-cell text-truncate" style={{ maxWidth: 200 }} title={subscriber.address}>
                        {subscriber.address || "—"}
                      </td>
                      <td className="d-none d-lg-table-cell text-nowrap">
                        {router?.nasName || subscriber.nasName || <span className="text-muted">—</span>}
                      </td>
                      <td className="d-none d-md-table-cell">
                        <div className="fw-semibold text-primary">{pkg?.packageName || subscriber.packageName || "—"}</div>
                        {pkg && (
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            {pkg.downloadMbps}/{pkg.uploadMbps} Mbps
                          </div>
                        )}
                      </td>
                      <td className="text-nowrap">
                        <ExpiryCell value={subscriber.expireDate} />
                      </td>
                      <td className="text-end pe-3">
                        <div className="d-flex justify-content-end align-items-center gap-1 flex-nowrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-brand rounded-pill px-2 text-nowrap"
                            onClick={() => setRechargeFor(subscriber)}
                            title="Recharge"
                          >
                            ⚡
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border rounded-pill px-2"
                            onClick={() => setSelectedSubscriber(subscriber)}
                            title="Live"
                          >
                            📊
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border rounded-pill px-2"
                            onClick={() => handleEdit(subscriber)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <div className="d-none d-xxl-block">
                            <SubscriberConnectionButton
                              subscriber={subscriber}
                              livePolling={false}
                              compact
                              onChanged={() => fetchData(false)}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center p-3 border-top flex-wrap gap-2">
            <small className="text-muted">
              Page {page} of {totalPages}
            </small>
            <div className="btn-group btn-group-sm">
              <button className="btn btn-light border" disabled={page <= 1} onClick={() => setPage(1)}>
                «
              </button>
              <button className="btn btn-light border" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ‹ Prev
              </button>
              <button className="btn btn-light border" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next ›
              </button>
              <button
                className="btn btn-light border"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {rechargeFor && (
        <RechargeModal
          subscriber={rechargeFor}
          onClose={() => setRechargeFor(null)}
          onDone={() => fetchData(false)}
        />
      )}

      {/* ======================================================
          ADD / EDIT MODAL
      ======================================================= */}

      {showModal && (
        <div
          className="modal show d-block"
          style={{
            background: "rgba(15,23,42,.48)",
            backdropFilter: "blur(5px)",
            zIndex: 1055,
          }}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-centered"
            style={{
              maxWidth: "1050px",
            }}
          >
            <div
              className="modal-content border-0 rounded-4 shadow-lg overflow-hidden"
              style={{
                maxHeight: "90vh",
              }}
            >
              {/* ==================================================
                  MODAL HEADER
              =================================================== */}

              <div
                className="modal-header px-4 py-3"
                style={{
                  background: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="d-flex align-items-center justify-content-center rounded-3"
                    style={{
                      width: 44,
                      height: 44,
                      background: "#eef2ff",
                      color: "#4f46e5",
                    }}
                  >
                    {isEdit ? "✏️" : "👤"}
                  </div>

                  <div>
                    <h5 className="fw-bold mb-0">
                      {isEdit ? "Edit Subscriber" : "Add Subscriber"}
                    </h5>

                    <small className="text-muted">
                      Complete subscriber configuration
                    </small>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                />
              </div>

              {/* ==================================================
                  TABS
              =================================================== */}

              <div
                className="px-4 pt-3"
                style={{
                  borderBottom: "1px solid #e2e8f0",
                  background: "#fff",
                }}
              >
                <div className="d-flex gap-1">
                  <TabButton
                    active={activeTab === "basic"}
                    onClick={() => setActiveTab("basic")}
                    icon="👤"
                    title="Basic Details"
                    subtitle="Personal & Address"
                  />

                  <TabButton
                    active={activeTab === "internet"}
                    onClick={() => setActiveTab("internet")}
                    icon="🌐"
                    title="Internet"
                    subtitle="RADIUS & Network"
                  />

                  <TabButton
                    active={activeTab === "account"}
                    onClick={() => setActiveTab("account")}
                    icon="🔐"
                    title="Account"
                    subtitle="Login & Status"
                  />
                </div>
              </div>

              {/* ==================================================
                  FORM
              =================================================== */}

              <form
                onSubmit={handleSubmit}
                className="d-flex flex-column"
                style={{
                  minHeight: 0,
                  flex: 1,
                }}
              >
                {/* =================================================
                    SCROLLABLE CONTENT
                ================================================== */}

                <div
                  className="modal-body px-4 py-4"
                  style={{
                    overflowY: "auto",
                    maxHeight: "calc(90vh - 210px)",
                  }}
                >
                  {/* =================================================
                      BASIC TAB
                  ================================================== */}

                  {activeTab === "basic" && (
                    <div className="row g-4">
                      <div className="col-12">
                        <SectionHeader
                          icon="👤"
                          title="Personal Information"
                          text="Subscriber basic details"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Subscriber Type
                        </label>

                        <select
                          className="form-select"
                          name="subscriberType"
                          value={formData.subscriberType}
                          onChange={handleChange}
                        >
                          <option value="Individual">Individual</option>

                          <option value="Corporate">Corporate</option>
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Full Name *
                        </label>

                        <input
                          className="form-control"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="Subscriber name"
                          required
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Company Name
                        </label>

                        <input
                          className="form-control"
                          name="companyName"
                          value={formData.companyName}
                          onChange={handleChange}
                          placeholder="Optional"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Mobile *
                        </label>

                        <input
                          className="form-control"
                          name="mobile"
                          value={formData.mobile}
                          onChange={handleChange}
                          maxLength={15}
                          required
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Email</label>

                        <input
                          type="email"
                          className="form-control"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          GST Number
                        </label>

                        <input
                          className="form-control"
                          name="gstNo"
                          value={formData.gstNo}
                          onChange={handleChange}
                        />
                      </div>

                      {/* ADDRESS */}

                      <div className="col-12 mt-2">
                        <SectionHeader
                          icon="📍"
                          title="Address"
                          text="Installation / billing address"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Pincode
                        </label>

                        <input
                          className="form-control"
                          name="zip"
                          value={formData.zip}
                          onChange={handlePincodeChange}
                          maxLength={6}
                          placeholder="302001"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">City</label>

                        <input
                          className="form-control"
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">State</label>

                        <input
                          className="form-control"
                          name="state"
                          value={formData.state}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label fw-semibold">
                          Address
                        </label>

                        <textarea
                          className="form-control"
                          rows={3}
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          placeholder="Complete address"
                        />
                      </div>

                      {/* SITE */}

                      <div className="col-12">
                        <div
                          className="rounded-3 p-3"
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div>
                              <div className="small text-muted">Site</div>

                              <div className="fw-bold">
                                {currentSite?.siteName ||
                                  currentSite?.companyName ||
                                  "Current Site"}
                              </div>
                            </div>

                            <span
                              className="badge rounded-pill"
                              style={{
                                background: "#eef2ff",
                                color: "#4f46e5",
                              }}
                            >
                              Auto Assigned
                            </span>
                          </div>

                          <div className="small text-muted mt-2">
                            Site is automatically selected according to your
                            logged-in account.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =================================================
                      INTERNET TAB
                  ================================================== */}

                  {activeTab === "internet" && (
                    <div className="row g-4">
                      <div className="col-12">
                        <SectionHeader
                          icon="🌐"
                          title="Internet & RADIUS"
                          text="Configure router, package and authentication"
                        />
                      </div>

                      {/* NAS */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          MikroTik Router / NAS
                        </label>

                        <select
                          className="form-select"
                          name="nasId"
                          value={formData.nasId}
                          onChange={handleChange}
                        >
                          <option value="">No Router Assigned</option>

                          {routers.map((router) => (
                            <option key={router.id} value={router.id}>
                              {router.nasName}

                              {router.nasIpAddress
                                ? ` (${router.nasIpAddress})`
                                : ""}
                            </option>
                          ))}
                        </select>

                        {formData.nasId && (
                          <div className="small text-muted mt-2">
                            {(() => {
                              const router = routers.find(
                                (x) => String(x.id) === String(formData.nasId),
                              );

                              if (!router) {
                                return "Router not found";
                              }

                              return router.isOnline
                                ? "🟢 Router Online"
                                : "⚪ Router Offline";
                            })()}
                          </div>
                        )}
                      </div>

                      {/* PACKAGE */}

<div className="col-md-6">
  <label className="form-label fw-semibold">
    Internet Package
  </label>

  <select
    className="form-select"
    name="packageId"
    value={formData.packageId}
    onChange={handleChange}
    disabled={isEdit} // ✅ Edit mode me package change nahi hoga (Disabled)
  >
    <option value="">No Package</option>

    {packages.map((pkg) => (
      <option key={pkg.id} value={pkg.id}>
        {pkg.packageName}

        {pkg.downloadMbps != null &&
        pkg.uploadMbps != null
          ? ` — ${pkg.downloadMbps}/${pkg.uploadMbps} Mbps`
          : ""}
      </option>
    ))}
  </select>
  
  {isEdit && (
    <div className="small text-muted mt-1">
      Package cannot be changed in edit mode.
    </div>
  )}
</div>

                      {/* SERVICE */}

                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Service
                        </label>

                        <select
                          className="form-select"
                          name="service"
                          value={formData.service}
                          onChange={handleChange}
                        >
                          <option value="PPPoE">PPPoE (username + password)</option>
                          <option value="Hotspot">Hotspot (login page or MAC)</option>
                          <option value="Static">Static IP / IPoE (login by MAC, fixed IP)</option>
                        </select>
                      </div>

                      {/* PPPOE */}

                      {/* PPPoE SECTION */}
                      {(formData.service === "PPPoE" || formData.service === "Hotspot") && (
                        <>
                          {/* Edit Checkbox sirf Password ke liye */}
                          {isEdit && (
                            <div className="col-12 mt-3">
                              <div className="form-check form-switch bg-light p-3 rounded-3 border d-flex align-items-center">
                                <input
                                  className="form-check-input ms-1"
                                  type="checkbox"
                                  id="editPPPoE"
                                  checked={enablePPPoEEdit}
                                  onChange={(e) => setEnablePPPoEEdit(e.target.checked)}
                                  style={{ cursor: "pointer", width: "40px", height: "20px" }}
                                />
                                <label className="form-check-label ms-3 fw-bold text-danger cursor-pointer" htmlFor="editPPPoE">
                                  Edit PPPoE Password
                                </label>
                              </div>
                            </div>
                          )}

                          <div className="col-md-6">
                            <label className="form-label fw-semibold">
                              {formData.service === "Hotspot" ? "Login Username" : "PPPoE Username *"}
                            </label>
                            <input
                              className={`form-control font-monospace ${isEdit ? "bg-light text-muted" : ""}`}
                              name="pppoeUsername"
                              value={formData.pppoeUsername}
                              onChange={handleChange}
                              readOnly={isEdit} // ✅ Username hamesha read-only rahega edit mode me
                              required={formData.service === "PPPoE"}
                              placeholder="username"
                            />
                          </div>

                          <div className="col-md-6">
                            <label className="form-label fw-semibold">
                              {formData.service === "Hotspot" ? "Login Password" : "PPPoE Password"} {!isEdit && formData.service === "PPPoE" && "*"}
                            </label>
                            <input
                              type="text" // ✅ Purana password saaf-saaf text format me dikhega
                              className={`form-control font-monospace ${isEdit && !enablePPPoEEdit ? "bg-light text-muted" : ""}`}
                              name="pppoePassword"
                              value={formData.pppoePassword}
                              onChange={handleChange}
                              readOnly={isEdit && !enablePPPoEEdit} // ✅ Checkbox on hone par hi edit hoga
                              required={formData.service === "PPPoE"}
                              placeholder="Password"
                            />
                          </div>
                        </>
                      )}

                      {/* MAC */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          MAC Address {formData.service === "Static" && !isEdit && "*"}
                        </label>

                        <input
                          className="form-control font-monospace"
                          name="macAddress"
                          value={formData.macAddress}
                          onChange={handleChange}
                          placeholder="58:04:4F:68:85:7D"
                        />
                      </div>

                      {/* STATIC IP */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Static IP
                        </label>

                        <input
                          className="form-control font-monospace"
                          name="staticIp"
                          value={formData.staticIp}
                          onChange={handleChange}
                          placeholder={formData.service === "Static" ? "e.g. 10.10.10.25" : "Optional"}
                        />
                        <div className="small text-muted mt-1">
                          Sent to the router as Framed-IP-Address (PPPoE / DHCP get this exact IP).
                        </div>
                      </div>

                      <div className="col-12">
                        <div
                          className="rounded-4 p-4"
                          style={{
                            background: "#eef2ff",
                            border: "1px solid #c7d2fe",
                          }}
                        >
                          <div className="fw-bold text-primary mb-2">
                            🌐 RADIUS Authentication
                          </div>

                          <div className="small text-muted">
                            {formData.service === "Static"
                              ? "The router (DHCP server or Hotspot with RADIUS enabled) sends the client's MAC. The subscriber gets the static IP, package speed and is cut off when the plan expires."
                              : formData.service === "Hotspot"
                                ? "Hotspot login with username/password, or automatic login by MAC address if a MAC is entered."
                                : "PPPoE login with the username and password above. Static IP (optional) is assigned by RADIUS."}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =================================================
                      ACCOUNT TAB
                  ================================================== */}

                  {activeTab === "account" && (
                    <div className="row g-4">
                      <div className="col-12">
                        <SectionHeader
                          icon="🔐"
                          title="Account & Portal"
                          text="Subscriber login and account status"
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Portal Username
                        </label>

                        <input
                          className="form-control"
                          name="portalUsername"
                          value={formData.portalUsername}
                          onChange={handleChange}
                          autoComplete="off"
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Portal Password
                        </label>

                        <input
                          type="password"
                          className="form-control"
                          name="portalPassword"
                          value={formData.portalPassword}
                          onChange={handleChange}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Expire Date
                        </label>

                        <input
                          type="date"
                          className="form-control"
                          name="expireDate"
                          value={formData.expireDate}
                          onChange={handleChange}
                        />

                        <div className="small text-muted mt-1">
                          Valid till the end of this day (India time).
                          {!isEdit && " Leave empty to calculate it from the selected package (starting now)."}
                          {isEdit && " For renewals use ⚡ Recharge, so the wallet and history are updated."}
                        </div>
                      </div>
                      {/* ACTIVE */}

                      <div className="col-md-6">
                        <div className="border rounded-4 p-4 h-100">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-bold">Account Status</div>

                              <div className="small text-muted">
                                Allow subscriber authentication
                              </div>
                            </div>

                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                name="isActive"
                                checked={formData.isActive}
                                onChange={handleChange}
                                style={{
                                  width: 42,
                                  height: 22,
                                }}
                              />
                            </div>
                          </div>

                          <div className="mt-3">
                            <span
                              className={`badge rounded-pill ${
                                formData.isActive ? "bg-success" : "bg-danger"
                              }`}
                            >
                              {formData.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CONNECTION */}

                      <div className="col-md-6">
                        <div className="border rounded-4 p-4 h-100">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-bold">Connection</div>

                              <div className="small text-muted">
                                Allow network connection
                              </div>
                            </div>

                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                name="connectionEnabled"
                                checked={formData.connectionEnabled}
                                onChange={handleChange}
                                style={{
                                  width: 42,
                                  height: 22,
                                }}
                              />
                            </div>
                          </div>

                          <div className="mt-3">
                            <span
                              className={`badge rounded-pill ${
                                formData.connectionEnabled
                                  ? "bg-success"
                                  : "bg-secondary"
                              }`}
                            >
                              {formData.connectionEnabled
                                ? "CONNECTION ON"
                                : "CONNECTION OFF"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* COMMENT */}

                      <div className="col-12">
                        <label className="form-label fw-semibold">
                          Internal Comment
                        </label>

                        <textarea
                          className="form-control"
                          rows={4}
                          name="comment"
                          value={formData.comment}
                          onChange={handleChange}
                          placeholder="Internal notes..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* =================================================
                    FOOTER
                ================================================== */}

                <div
                  className="modal-footer px-4 py-3"
                  style={{
                    background: "#f8fafc",
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  <div className="me-auto">
                    <span className="small text-muted">
                      Step{" "}
                      {activeTab === "basic"
                        ? "1"
                        : activeTab === "internet"
                          ? "2"
                          : "3"}{" "}
                      of 3
                    </span>
                  </div>

                  {activeTab !== "basic" && (
                    <button
                      type="button"
                      className="btn btn-light border rounded-pill px-4"
                      onClick={previousTab}
                    >
                      ← Previous
                    </button>
                  )}

                  {activeTab !== "account" ? (
                    <button
                      type="button"
                      className="btn btn-brand rounded-pill px-4 fw-semibold shadow-sm"
                      onClick={nextTab}
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn btn-brand rounded-pill px-5 fw-semibold shadow-sm"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Saving...
                        </>
                      ) : isEdit ? (
                        "Update Subscriber"
                      ) : (
                        "Create Subscriber"
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          LIVE MODAL
      ======================================================= */}

      {selectedSubscriber && (
        <SubscriberLiveModal
          subscriber={selectedSubscriber}
          onClose={() => setSelectedSubscriber(null)}
        />
      )}
    </div>
  );
};

// ============================================================
// SECTION HEADER
// ============================================================

const SectionHeader = ({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) => {
  return (
    <div
      className="d-flex align-items-center gap-3 pb-3"
      style={{
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div
        className="d-flex align-items-center justify-content-center rounded-3"
        style={{
          width: 42,
          height: 42,
          background: "#eef2ff",
          color: "#4f46e5",
          fontSize: 19,
        }}
      >
        {icon}
      </div>

      <div>
        <div className="fw-bold">{title}</div>

        <div className="small text-muted">{text}</div>
      </div>
    </div>
  );
};

// ============================================================
// TAB BUTTON
// ============================================================

const TabButton = ({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn text-start border-0 rounded-top-3 px-4 py-3"
      style={{
        minWidth: 210,
        background: active ? "#eef2ff" : "transparent",
        color: active ? "#4f46e5" : "#64748b",
        borderBottom: active ? "3px solid #4f46e5" : "3px solid transparent",
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <span
          style={{
            fontSize: 18,
          }}
        >
          {icon}
        </span>

        <div>
          <div className="fw-semibold">{title}</div>

          <div
            className="small"
            style={{
              opacity: active ? 0.8 : 0.7,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </button>
  );
};

// ============================================================
// SUMMARY CARD
// ============================================================

const SummaryCard = ({
  title,
  value,
  icon,
  color = "#4f46e5",
  background = "#eef2ff",
  active = false,
  onClick,
}: {
  title: string;
  value: number;
  icon: string;
  color?: string;
  background?: string;
  active?: boolean;
  onClick?: () => void;
}) => {
  return (
    <div className="col-4 col-md-4 col-xl">
      <div
        role={onClick ? "button" : undefined}
        onClick={onClick}
        className="bg-white h-100"
        style={{
          border: active ? `2px solid ${color}` : "1px solid #e5e7eb",
          borderRadius: 16,
          boxShadow: "0 3px 12px rgba(15, 23, 42, 0.06)",
          transition: "all 0.2s ease",
          cursor: onClick ? "pointer" : "default",
        }}
      >
        <div className="p-2 p-md-3">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="min-w-0">
              <div
                className="small fw-semibold mb-1 mb-md-2 text-truncate"
                style={{ color: "#64748b", fontSize: 11 }}
              >
                {title}
              </div>
              <div className="fw-bold" style={{ color, fontSize: "clamp(18px, 4.5vw, 26px)", lineHeight: 1 }}>
                {value}
              </div>
            </div>
            <div
              className="d-none d-sm-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background,
                color,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {icon}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Expiry date with colour: red = expired, orange = within 7 days, green = later. */
const ExpiryCell = ({ value }: { value?: string | null }) => {
  if (!value) return <span className="text-muted">—</span>;
  const days = daysUntil(value) ?? 0;
  const expired = new Date(value).getTime() <= Date.now();
  const cls = expired
    ? "bg-danger-subtle text-danger-emphasis border-danger-subtle"
    : days <= 7
      ? "bg-warning-subtle text-warning-emphasis border-warning-subtle"
      : "bg-success-subtle text-success-emphasis border-success-subtle";
  return (
    <div>
      <span className={`badge border ${cls}`} style={{ fontSize: 12 }}>
        {formatDate(value, true)}
      </span>
      <div className="text-muted mt-1" style={{ fontSize: 11 }}>
        {expired ? `Expired ${Math.abs(days)} day(s) ago` : days <= 0 ? "Expires today" : `${days} day(s) left`}
      </div>
    </div>
  );
};

export default SubscriberManagement;

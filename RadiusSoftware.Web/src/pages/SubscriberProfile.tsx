import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import apiClient from "../services/api";

import SubscriberPhoto from "../components/subscriber/SubscriberPhoto";
import SubscriberConnectionButton from "../components/subscriber/SubscriberConnectionButton";
import SubscriberLiveModal from "../components/subscriber/SubscriberLiveModal";
import SubscriberPersonalTab from "../components/subscriber/SubscriberPersonalTab";
import SubscriberLiveSession from "../components/subscriber/SubscriberLiveSession";
import SubscriberUsageTab from "../components/subscriber/SubscriberUsageTab";
import SubscriberHistoryTab from "../components/subscriber/SubscriberHistoryTab";
import SubscriberPackageHistoryTab from "../components/subscriber/SubscriberPackageHistoryTab";
import SubscriberPackageCard from "../components/subscriber/SubscriberPackageCard";
import SubscriberDocumentsTab from "../components/subscriber/SubscriberDocumentsTab";


type Tab =
  | "overview"
  | "personal"
  | "technical"
  | "live"
  | "usage"
  | "history"
  | "packages"
  | "finance"
  | "documents"
  | "settings";

const SubscriberProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [subscriber, setSubscriber] = useState<any>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [error, setError] = useState("");

  const loadSubscriber = useCallback(async () => {
  if (!id) return;

  try {
    setLoading(true);
    setError("");

    const response = await apiClient.get(`/Subscribers/${id}`);
    let data = response.data?.data ?? response.data;

    // Get dynamic domain root from apiClient base URL (e.g. https://api.bharatradius.com)
    const apiHost = apiClient.defaults.baseURL 
      ? apiClient.defaults.baseURL.replace("/api", "") 
      : "";

    // Fix image URL if it's relative
    if (data && data.photoUrl && data.photoUrl.startsWith("/")) {
      data.photoUrl = `${apiHost}${data.photoUrl}`;
    }
    if (data && data.PhotoUrl && data.PhotoUrl.startsWith("/")) {
      data.PhotoUrl = `${apiHost}${data.PhotoUrl}`;
    }

    setSubscriber(data);
  } catch (error: unknown) {
    console.error("Subscriber profile loading failed:", error);
    const errObj = error as { response?: { data?: { message?: string } } };
    setError(
      errObj?.response?.data?.message ||
        "Unable to load subscriber profile."
    );
  } finally {
    setLoading(false);
  }
}, [id]);

  const loadLiveStatus = useCallback(async () => {
    if (!id) return;

    try {
      setLiveLoading(true);
      const response = await apiClient.get(
        `/Subscribers/${id}/connection-status`
      );
      const data = response.data?.data ?? response.data;
      setLiveData(data);
    } catch (error) {
      console.error("Subscriber live status error:", error);
    } finally {
      setLiveLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSubscriber();
    loadLiveStatus();

    const timer = window.setInterval(() => {
      loadLiveStatus();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadSubscriber, loadLiveStatus]);

  const handlePhotoUpdated = async (photoUrl: string) => {
  // Get dynamic domain root from apiClient base URL (e.g. https://api.bharatradius.com)
  const apiHost = apiClient.defaults.baseURL 
    ? apiClient.defaults.baseURL.replace("/api", "") 
    : "";

  const fullPhotoUrl = photoUrl.startsWith("/")
    ? `${apiHost}${photoUrl}`
    : photoUrl;

    setSubscriber((prev: any) => ({
      ...prev,
      photoUrl: fullPhotoUrl,
      PhotoUrl: fullPhotoUrl,
    }));

    await loadSubscriber();
  };

  const handleConnectionChanged = async () => {
    await loadSubscriber();
    await loadLiveStatus();
  };

  const openLive = () => {
    setShowLiveModal(true);
    setActiveTab("live");
    loadLiveStatus();
  };

  const isOnline = Boolean(liveData?.isOnline);
  const connectionEnabled = Boolean(
    liveData?.connectionEnabled ?? subscriber?.connectionEnabled
  );

  const photoSubscriber = {
    ...subscriber,
    photoUrl:
      subscriber?.photoUrl ||
      subscriber?.PhotoUrl ||
      subscriber?.profilePhotoUrl ||
      subscriber?.ProfilePhotoUrl ||
      null,
  };

  if (loading) {
    return (
      <div
        className="container-fluid py-5"
        style={{ background: "#f8fafc", minHeight: "100vh" }}
      >
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="text-center">
            <div
              className="spinner-border text-primary"
              style={{ width: 48, height: 48, borderWidth: "4px" }}
            />
            <div className="text-secondary fw-medium mt-3">
              Loading subscriber profile...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !subscriber) {
    return (
      <div
        className="container-fluid py-5"
        style={{ background: "#f8fafc", minHeight: "100vh" }}
      >
        <div className="container" style={{ maxWidth: 600 }}>
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body text-center py-5 px-4">
              <div
                className="rounded-circle bg-danger-subtle text-danger d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{ width: 70, height: 70, fontSize: 28 }}
              >
                ⚠️
              </div>
              <h4 className="fw-bold text-dark">Subscriber Not Found</h4>
              <p className="text-muted mb-4">
                {error || "Unable to load subscriber information."}
              </p>
              <button
                type="button"
                className="btn btn-primary rounded-pill px-4 shadow-sm"
                onClick={() => navigate("/subscribers")}
              >
                ← Back to Subscribers
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container-fluid py-4 px-lg-4"
      style={{ background: "#f8fafc", minHeight: "100vh" }}
    >
      {/* TOP NAVIGATION BAR */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <button
    type="button"
    className="btn bg-white border shadow-sm rounded-pill px-4 fw-semibold text-brand"
    onClick={() => navigate("/subscribers")}
    style={{ transition: "all 0.2s" }}
  >
    ← Back to Subscribers
  </button>
  <div className="text-muted small fw-semibold text-uppercase tracking-wider">
    Subscriber Management / <span className="text-brand">Profile</span>
  </div>
</div>

     {/* PROFILE HEADER */}
<div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
  {/* COVER BANNER */}
  <div
    style={{
      height: 140,
      background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    }}
  />

  {/* PROFILE BODY */}
  <div className="card-body position-relative pt-0">
    {/* PHOTO CONTAINER */}
    <div
      className="position-absolute shadow-sm rounded-circle bg-white p-1"
      style={{
        left: 30,
        top: -65,
        zIndex: 5,
        width: 132,
        height: 132,
      }}
    >
      <div className="w-100 h-100 rounded-circle overflow-hidden d-flex align-items-center justify-content-center bg-light position-relative">
        <SubscriberPhoto
          subscriber={photoSubscriber}
          size={124}
          editable={true}
          onUpdated={handlePhotoUpdated}
        />
      </div>
    </div>

    {/* MAIN HEADER DETAILS */}
    <div
      className="d-flex justify-content-between align-items-end flex-wrap gap-3 pt-3"
      style={{ paddingLeft: 165 }}
    >
      <div>
        {/* NAME ONLY (Status badge removed from here) */}
        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
          <h3 className="fw-bold mb-0 text-dark">
            {subscriber.fullName || "Unnamed Subscriber"}
          </h3>
        </div>

        <div className="text-secondary fw-medium mb-3">
          📞 {subscriber.mobile || "No mobile number"}
          {subscriber.email && ` • ✉️ ${subscriber.email}`}
        </div>

        {/* BADGES ROW (Connection ON/OFF and status badges are here properly) */}
        {/* BADGES ROW */}
<div className="d-flex flex-wrap gap-2 align-items-center">
  {subscriber.pppoeUsername && (
    <span className="badge bg-light text-secondary border px-3 py-2 rounded-pill font-monospace">
      👤 {subscriber.pppoeUsername}
    </span>
  )}


  {/* Online / Offline Status */}
  <span
    className={`badge px-3 py-2 rounded-pill fw-semibold ${
      isOnline
        ? "bg-success-subtle text-success border border-success-subtle"
        : "bg-secondary-subtle text-secondary border"
    }`}
  >
    {isOnline ? "● ONLINE" : "○ OFFLINE"}
  </span>

  {/* Single Dynamic Connection Badge */}
  <span
    className={`badge px-3 py-2 rounded-pill fw-semibold ${
      connectionEnabled
        ? "bg-primary-subtle text-primary border border-primary-subtle"
        : "bg-danger-subtle text-danger border border-danger-subtle"
    }`}
  >
    {connectionEnabled ? "CONNECTION ON" : "CONNECTION OFF"}
  </span>
</div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="d-flex gap-2 flex-wrap align-items-center pb-2">
        <SubscriberConnectionButton
          subscriber={subscriber}
          onChanged={handleConnectionChanged}
          onLive={openLive}
        />
        <button
          type="button"
          className="btn btn-white bg-white border shadow-sm rounded-pill px-3 fw-medium text-dark"
          onClick={openLive}
        >
          📊 Live Status
        </button>
        
      </div>
    </div>
  </div>
</div>
{/* ACTIVE PACKAGE */}
<SubscriberPackageCard
  subscriber={subscriber}
  onChanged={async () => {
    await loadSubscriber();
    await loadLiveStatus();
  }}
/>
      {/* QUICK INFO METRICS ROW */}
      <div className="row g- mb-4"> 
        <QuickInfoCard
          title="Current IP Address"
          value={liveData?.ipAddress || subscriber.staticIp || "Dynamic"}
          icon="🌐"
        />
        <QuickInfoCard
          title="NAS / Router"
          value={liveData?.nasName || subscriber.nasName || subscriber.nas?.nasName || "Not Assigned"}
          icon="🖧"
        />
        <QuickInfoCard
          title="Service Protocol"
          value={subscriber.service || "PPPoE"}
          icon="📡"
        />
      </div>

      {/* PROFILE TABS & CONTENT SECTION */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="card-body p-0">
          {/* TAB BAR */}
          <div
            className="border-bottom px-3 pt-3 bg-light bg-opacity-50"
            style={{ overflowX: "auto" }}
          >
            <div className="d-flex gap-2" style={{ minWidth: "max-content" }}>
              <ProfileTab active={activeTab === "overview"} onClick={() => setActiveTab("overview")} icon="🏠" title="Overview" />
              <ProfileTab active={activeTab === "personal"} onClick={() => setActiveTab("personal")} icon="👤" title="Personal" />
              <ProfileTab active={activeTab === "technical"} onClick={() => setActiveTab("technical")} icon="⚙️" title="Technical" />
              <ProfileTab active={activeTab === "live"} onClick={() => setActiveTab("live")} icon="📡" title="Live Session" />
              <ProfileTab active={activeTab === "usage"} onClick={() => setActiveTab("usage")} icon="📊" title="Usage" />
              <ProfileTab active={activeTab === "history"} onClick={() => setActiveTab("history")} icon="🕘" title="History" />
              <ProfileTab active={activeTab === "packages"} onClick={() => setActiveTab("packages")} icon="📦" title="Packages" />
              <ProfileTab active={activeTab === "finance"} onClick={() => setActiveTab("finance")} icon="₹" title="Finance" />
              <ProfileTab active={activeTab === "documents"} onClick={() => setActiveTab("documents")} icon="📄" title="Documents" />
              <ProfileTab active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon="⚙" title="Settings" />
            </div>
          </div>

          {/* TAB CONTENT VIEW */}
          <div className="p-4 bg-white">
            {activeTab === "overview" && <OverviewTab subscriber={subscriber} liveData={liveData} />}
          {activeTab === "personal" && (
  <SubscriberPersonalTab
    subscriber={subscriber}
    onSaved={async () => {
      await loadSubscriber();
    }}
  />
)}
            {activeTab === "technical" && <TechnicalTab subscriber={subscriber} liveData={liveData} />}
{activeTab === "live" && (
  <SubscriberLiveSession
    subscriber={subscriber}
    liveData={liveData}
    loading={liveLoading}
    onRefresh={loadLiveStatus}
  />
)}            {activeTab === "usage" && (
  <SubscriberUsageTab
    subscriber={subscriber}
    liveData={liveData}
    loading={liveLoading}
    onRefresh={loadLiveStatus}
  />
)}
{activeTab === "history" && (
  <SubscriberHistoryTab
    subscriber={subscriber}
  />
)}      
{activeTab === "packages" && (
  <SubscriberPackageHistoryTab
    subscriber={subscriber}
  />
)}
            {activeTab === "finance" && <ComingSoonTab icon="₹" title="Finance & Invoices" description="Recharges, invoices, payment history, and outstanding balances will appear here." />}
{activeTab === "documents" && (
  <SubscriberDocumentsTab subscriberId={subscriber.id} />
)}            {activeTab === "settings" && <ComingSoonTab icon="⚙️" title="Subscriber Settings" description="Account configurations and specific routing rules will appear here." />}
          </div>
        </div>
      </div>

      {/* LIVE MODAL */}
      {showLiveModal && (
        <SubscriberLiveModal subscriber={subscriber} onClose={() => setShowLiveModal(false)} />
      )}
    </div>
  );
};

// REUSABLE COMPONENTS WITH CLEAN LIGHT THEME STYLING

const QuickInfoCard = ({ title, value, icon }: { title: string; value: any; icon: string }) => (
  <div className="col-xl-4 col-md-6">
    <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
      <div className="card-body p-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 bg-primary-subtle text-primary"
            style={{ width: 48, height: 48, fontSize: 22 }}
          >
            {icon}
          </div>
          <div className="overflow-hidden" style={{ minWidth: 0 }}>
            <div className="text-secondary small fw-medium">{title}</div>
            <div className="fw-bold text-dark text-truncate fs-6 mt-1" title={String(value)}>
              {value || "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProfileTab = ({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: string; title: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`btn px-3 py-2 fw-medium border-0 rounded-top-3 transition-all ${
      active
        ? "bg-white text-primary border-bottom border-primary border-3 shadow-sm"
        : "text-secondary bg-transparent hover-bg-light"
    }`}
    style={{ whiteSpace: "nowrap" }}
  >
    <span className="me-1">{icon}</span> {title}
  </button>
);

const InfoRow = ({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) => (
  <div className="d-flex justify-content-between align-items-start gap-3 py-3 border-bottom border-light">
    <span className="text-secondary small fw-medium">{label}</span>
    <span className={`fw-semibold text-dark text-end ${mono ? "font-monospace text-primary" : ""}`}>
      {value !== null && value !== undefined && value !== "" ? value : "-"}
    </span>
  </div>
);

const SectionCard = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
  <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
    <div className="card-body p-4">
      <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom border-light">
        <div
          className="rounded-3 d-flex align-items-center justify-content-center bg-light text-dark"
          style={{ width: 36, height: 36, fontSize: 18 }}
        >
          {icon}
        </div>
        <h5 className="fw-bold mb-0 text-dark">{title}</h5>
      </div>
      {children}
    </div>
  </div>
);

const OverviewTab = ({ subscriber, liveData }: { subscriber: any; liveData: any }) => (
  <div className="row g-4">
    <div className="col-lg-8">
      <SectionCard title="Subscriber Information" icon="👤">
        <InfoRow label="Full Name" value={subscriber.fullName} />
        <InfoRow label="Subscriber Type" value={subscriber.subscriberType} />
        <InfoRow label="Mobile Number" value={subscriber.mobile} />
        <InfoRow label="Email Address" value={subscriber.email} />
        <InfoRow label="Company Name" value={subscriber.companyName} />
        <InfoRow label="GST Number" value={subscriber.gstNo} />
        <InfoRow
          label="Billing Address"
          value={[subscriber.address, subscriber.city, subscriber.state, subscriber.zip].filter(Boolean).join(", ")}
        />
      </SectionCard>
    </div>
    <div className="col-lg-4">
      <SectionCard title="Current Connection" icon="📡">
        <InfoRow label="Status" value={liveData?.isOnline ? "ONLINE" : "OFFLINE"} />
        <InfoRow label="Connection State" value={liveData?.connectionEnabled ?? subscriber.connectionEnabled ? "ENABLED" : "DISABLED"} />
        <InfoRow label="IP Address" value={liveData?.ipAddress} mono />
        <InfoRow label="MAC Address" value={liveData?.macAddress || subscriber.macAddress} mono />
        <InfoRow label="Assigned NAS" value={liveData?.nasName || subscriber.nasName} />
        <InfoRow label="Session Uptime" value={liveData?.uptime} />
        <InfoRow label="Session ID" value={liveData?.acctSessionId || liveData?.routerSessionId} mono />
      </SectionCard>
    </div>
  </div>
);



const TechnicalTab = ({ subscriber, liveData }: { subscriber: any; liveData: any }) => (
  <div className="row g-4">
    <div className="col-lg-6">
      <SectionCard title="RADIUS / PPPoE Credentials" icon="🔐">
        <InfoRow label="Service Type" value={subscriber.service} />
        <InfoRow label="PPPoE Username" value={subscriber.pppoeUsername} mono />
        <InfoRow label="PPPoE Password" value="••••••••" mono />
        <InfoRow label="Account Status" value={subscriber.isActive ? "ACTIVE" : "DISABLED"} />
        <InfoRow label="Assigned Package" value={subscriber.packageName || subscriber.package?.packageName} />
      </SectionCard>
    </div>
    <div className="col-lg-6">
      <SectionCard title="Network Configurations" icon="🌐">
        <InfoRow label="Static IP" value={subscriber.staticIp} mono />
        <InfoRow label="Current Live IP" value={liveData?.ipAddress} mono />
        <InfoRow label="MAC Address" value={liveData?.macAddress || subscriber.macAddress} mono />
        <InfoRow label="NAS / Router Name" value={liveData?.nasName || subscriber.nasName} />
        <InfoRow label="NAS IP Address" value={liveData?.nasIpAddress} mono />
      </SectionCard>
    </div>
  </div>
);



const LiveMetric = ({ title, value, success, large }: { title: string; value: any; success?: boolean; large?: boolean }) => (
  <div className="col-xl-3 col-md-6">
    <div className="card border rounded-4 h-100 bg-light bg-opacity-25 border-light">
      <div className="card-body">
        <div className="text-secondary small mb-1 fw-medium">{title}</div>
        <div className={`fw-bold ${large ? "fs-5" : "fs-6"} ${success ? "text-success" : "text-dark"}`}>
          {value || "-"}
        </div>
      </div>
    </div>
  </div>
);

const ComingSoonTab = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
  <div className="py-5 text-center">
    <div className="rounded-circle bg-light d-flex align-items-center justify-content-center mx-auto mb-3 text-secondary" style={{ width: 70, height: 70, fontSize: 28 }}>
      {icon}
    </div>
    <h5 className="fw-bold text-dark">{title}</h5>
    <p className="text-secondary mx-auto mb-3" style={{ maxWidth: 500 }}>
      {description}
    </p>
    <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-2 fw-medium">
      Module Ready in Next Update
    </span>
  </div>
);

export default SubscriberProfile;
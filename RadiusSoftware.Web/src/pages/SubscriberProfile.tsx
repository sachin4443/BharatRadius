import React, {
  Suspense,
  lazy,
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
import { usePolling } from "../hooks/usePolling";
import { getCachedSubscriber, normalizeSubscriber, primeSubscriber } from "../services/subscriberCache";

// Heavy parts are loaded only when they are opened (profile header shows instantly)
const SubscriberLiveModal = lazy(() => import("../components/subscriber/SubscriberLiveModal"));
const SubscriberPersonalTab = lazy(() => import("../components/subscriber/SubscriberPersonalTab"));
const SubscriberLiveSession = lazy(() => import("../components/subscriber/SubscriberLiveSession"));
const SubscriberUsageTab = lazy(() => import("../components/subscriber/SubscriberUsageTab"));
const SubscriberHistoryTab = lazy(() => import("../components/subscriber/SubscriberHistoryTab"));
const SubscriberPackageHistoryTab = lazy(() => import("../components/subscriber/SubscriberPackageHistoryTab"));
const SubscriberPackageCard = lazy(() => import("../components/subscriber/SubscriberPackageCard"));
const SubscriberDocumentsTab = lazy(() => import("../components/subscriber/SubscriberDocumentsTab"));
const RechargeModal = lazy(() => import("../components/subscriber/RechargeModal"));

/** Grey placeholder blocks shown while a part is loading. */
const SkeletonBlock = ({ height = 16, width = "100%", className = "" }: { height?: number; width?: number | string; className?: string }) => (
  <div className={`placeholder-glow ${className}`}>
    <span className="placeholder col-12 rounded-3" style={{ height, width, display: "block" }} />
  </div>
);

const SectionFallback = () => (
  <div className="py-2">
    <SkeletonBlock height={18} width="40%" className="mb-2" />
    <SkeletonBlock height={14} className="mb-2" />
    <SkeletonBlock height={14} width="85%" />
  </div>
);

const withPhotoHost = (data: any) => {
  if (!data) return data;
  const apiHost = apiClient.defaults.baseURL ? apiClient.defaults.baseURL.replace(/\/api\/?$/, "") : "";
  const fix = (url?: string) => (url && url.startsWith("/") ? `${apiHost}${url}` : url);
  return { ...data, photoUrl: fix(data.photoUrl), PhotoUrl: fix(data.PhotoUrl) };
};

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

  // Draw instantly from the list row (if we came from the list), refresh in background
  const [subscriber, setSubscriber] = useState<any>(() => getCachedSubscriber(id));
  const [showRecharge, setShowRecharge] = useState(false);
  const [liveData, setLiveData] = useState<any>(null);
  const [loading, setLoading] = useState(() => !getCachedSubscriber(id));
  const [liveLoading, setLiveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [error, setError] = useState("");

  const loadSubscriber = useCallback(async () => {
    if (!id) return;
    try {
      setError("");
      const response = await apiClient.get(`/Subscribers/${id}`);
      const data = withPhotoHost(normalizeSubscriber(response.data?.data ?? response.data));
      primeSubscriber(data);
      setSubscriber(data);
    } catch (error: unknown) {
      console.error("Subscriber profile loading failed:", error);
      const errObj = error as { response?: { data?: { message?: string } } };
      setError(errObj?.response?.data?.message || "Unable to load subscriber profile.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Opening another profile: show its cached row immediately
  useEffect(() => {
    const cached = getCachedSubscriber(id);
    setSubscriber(cached);
    setLiveData(null);
    setLoading(!cached);
    setActiveTab("overview");
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
  }, [loadSubscriber]);

  // Live status every 10 s, paused while the tab is hidden
  usePolling(loadLiveStatus, 10000, true, [loadLiveStatus]);

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

  const isOnline = Boolean(liveData ? liveData.isOnline : subscriber?.isOnline);
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

  if (loading && !subscriber) {
    return (
      <div className="container-fluid py-3 py-md-4 px-lg-4" style={{ background: "#f8fafc", minHeight: "100vh" }} aria-busy="true">
        <SkeletonBlock height={36} width={200} className="mb-4" />
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
          <div style={{ height: 140, background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", opacity: 0.35 }} />
          <div className="card-body d-flex gap-4 align-items-center">
            <div className="placeholder-glow">
              <span className="placeholder rounded-circle d-block" style={{ width: 96, height: 96 }} />
            </div>
            <div className="flex-grow-1">
              <SkeletonBlock height={26} width="45%" className="mb-2" />
              <SkeletonBlock height={16} width="30%" className="mb-3" />
              <SkeletonBlock height={28} width="60%" />
            </div>
          </div>
        </div>
        <div className="row g-3 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="col-md-4">
              <div className="card border-0 shadow-sm rounded-4 p-3">
                <SkeletonBlock height={44} />
              </div>
            </div>
          ))}
        </div>
        <div className="card border-0 shadow-sm rounded-4 p-4">
          <SectionFallback />
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
        <button
          type="button"
          className="btn btn-brand rounded-pill px-3 fw-semibold shadow-sm"
          onClick={() => setShowRecharge(true)}
        >
          ⚡ Recharge
        </button>
        <SubscriberConnectionButton
          subscriber={{ ...subscriber, isOnline, connectionEnabled }}
          livePolling={false}
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
{showRecharge && (
  <Suspense fallback={null}>
  <RechargeModal
    subscriber={{
      ...subscriber,
      pppoeUsername: subscriber.pppoeUsername || subscriber.ppPoEUsername,
    }}
    onClose={() => setShowRecharge(false)}
    onDone={async () => {
      await loadSubscriber();
    }}
  />
  </Suspense>
)}
{/* ACTIVE PACKAGE */}
<Suspense
  fallback={
    <div className="card border-0 shadow-sm rounded-4 mb-4 p-4">
      <SectionFallback />
    </div>
  }
>
  <SubscriberPackageCard
    subscriber={subscriber}
    onChanged={async () => {
      await loadSubscriber();
      await loadLiveStatus();
    }}
  />
</Suspense>
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
          <div className="p-3 p-md-4 bg-white">
            <Suspense fallback={<SectionFallback />}>
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
            </Suspense>
          </div>
        </div>
      </div>

      {/* LIVE MODAL */}
      {showLiveModal && (
        <Suspense fallback={null}>
          <SubscriberLiveModal subscriber={subscriber} onClose={() => setShowLiveModal(false)} />
        </Suspense>
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
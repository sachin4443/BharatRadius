import React, {
  useEffect,
  useState,
} from "react";
import apiClient from "../../services/api";

interface Props {
  subscriber: any;
  onChanged?: () => void;
}

interface PackageInfo {
  packageId: string;
  packageName: string;
  planCategory: string;
  downloadMbps: number;
  uploadMbps: number;
  downloadUnit: string;
  uploadUnit: string;
  price: number;
  expiryDays: number;
  validityType: string;
  assignedAt?: string;
  expiryDate?: string;
  expiresAt?: string;
  validityDate?: string;
  isCurrent: boolean;
}

const SubscriberPackageCard: React.FC<Props> = ({
  subscriber,
  onChanged,
}) => {
  const [data, setData] =
    useState<PackageInfo | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [showChange, setShowChange] =
    useState(false);

  const load = async () => {
    try {
      setLoading(true);

      const res =
        await apiClient.get(
          `/Subscribers/${subscriber.id}/package`,
        );

      setData(res.data);
    } catch (error) {
      console.error(
        "Subscriber package error:",
        error,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [subscriber.id]);

  const formatDate = (
    value?: string,
  ) => {
    if (!value) return "-";

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return "-";
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  };

  if (loading) {
    return (
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4 text-center">
          <div className="spinner-border spinner-border-sm text-primary" />

          <span className="ms-2 text-muted">
            Loading active package...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* =====================================================
          ACTIVE PACKAGE CARD
      ====================================================== */}

      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">

          {/* HEADER */}

          <div className="d-flex justify-content-between align-items-start">

            <div className="d-flex gap-3">

              <div
                className="rounded-4 bg-primary bg-opacity-10 d-flex align-items-center justify-content-center"
                style={{
                  width: 58,
                  height: 58,
                  fontSize: 26,
                  flexShrink: 0,
                }}
              >
                📦
              </div>

              <div>

                <div className="text-muted small fw-semibold">
                  ACTIVE PACKAGE
                </div>

                <h5 className="fw-bold mb-1 text-brand">
                  {data?.packageName ||
                    "No Package Assigned"}
                </h5>

                <div className="text-muted small">
                  {data?.planCategory ||
                    "No active plan"}
                </div>

              </div>

            </div>

            <button
              type="button"
              className="btn btn-brand rounded-pill px-4 fw-semibold text-white shadow-sm"
              onClick={() =>
                setShowChange(true)
              }
            >
              🔄 Renew Now
            </button>

          </div>

          {/* PACKAGE DETAILS */}

          {data ? (
            <>
              <div className="row g-3 mt-3">

                <PackageStat
                  label="Download"
                  value={`${data.downloadMbps} ${data.downloadUnit}`}
                  icon="⬇"
                  color="primary"
                />

                <PackageStat
                  label="Upload"
                  value={`${data.uploadMbps} ${data.uploadUnit}`}
                  icon="⬆"
                  color="success"
                />

                <PackageStat
                  label="Price"
                  value={`₹${Number(
                    data.price,
                  ).toLocaleString(
                    "en-IN",
                  )}`}
                  icon="₹"
                  color="warning"
                />

                <PackageStat
                  label="Validity"
                  value={`${data.expiryDays} ${data.validityType}`}
                  icon="📅"
                  color="info"
                />

              </div>

              <div className="row g-3 mt-1">

                <Info
                  label="Assigned On"
                  value={formatDate(
                    data.assignedAt,
                  )}
                />

                <Info
                  label="Expiry Date"
                  value={formatDate(
                    data.expiryDate || data.expiresAt || data.validityDate
                  )}
                />

                <Info
                  label="Package ID"
                  value={data.packageId}
                  mono
                />

                <Info
                  label="Connection"
                  value={
                    subscriber.connectionEnabled
                      ? "Enabled"
                      : "Disabled"
                  }
                />

              </div>

            </>
          ) : (
            <div className="bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-4 p-3 mt-4 mb-0">
              <div className="fw-semibold">
                No package is currently assigned.
              </div>

              <div className="small text-muted mt-1">
                Assign a package to start the
                subscriber service.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* =====================================================
          CHANGE PACKAGE MODAL
      ====================================================== */}

      {showChange && (
        <ChangePackageModal
          subscriber={subscriber}
          currentPackage={data}
          onClose={() =>
            setShowChange(false)
          }
          onChanged={async () => {
            setShowChange(false);

            await load();

            onChanged?.();
          }}
        />
      )}
    </>
  );
};


/* ============================================================
   PACKAGE STAT
============================================================ */

const PackageStat = ({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) => (
  <div className="col-xl-3 col-md-6">

    <div className="bg-light rounded-4 p-3 h-100">

      <div className="d-flex justify-content-between">

        <div>

          <div className="text-muted small">
            {label}
          </div>

          <div
            className={`fw-bold text-${color} mt-1`}
          >
            {value}
          </div>

        </div>

        <span
          style={{
            fontSize: 20,
          }}
        >
          {icon}
        </span>

      </div>

    </div>

  </div>
);


/* ============================================================
   INFO
============================================================ */

const Info = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="col-md-3">

    <div className="border rounded-3 p-3 h-100">

      <div className="text-muted small">
        {label}
      </div>

      <div
        className={`fw-semibold ${
          mono
            ? "font-monospace"
            : ""
        }`}
        style={{
          fontSize: mono
            ? 11
            : undefined,
          wordBreak: mono
            ? "break-all"
            : undefined,
        }}
      >
        {value || "-"}
      </div>

    </div>

  </div>
);


/* ============================================================
   CHANGE PACKAGE MODAL
============================================================ */

const ChangePackageModal = ({
  subscriber,
  currentPackage,
  onClose,
  onChanged,
}: {
  subscriber: any;
  currentPackage: PackageInfo | null;
  onClose: () => void;
  onChanged: () => void;
}) => {

  const [packages, setPackages] =
    useState<any[]>([]);

  const [selectedId, setSelectedId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  /* ---------------------------------------------------------
     CONFIRMATION
  --------------------------------------------------------- */

  const [showConfirm, setShowConfirm] =
    useState(false);

  /* ---------------------------------------------------------
     RESULT
  --------------------------------------------------------- */

  const [showResult, setShowResult] =
    useState(false);

  const [result, setResult] =
    useState<any>(null);

  /* ---------------------------------------------------------
     TIMER
  --------------------------------------------------------- */

  const [elapsed, setElapsed] =
    useState(0);


  /* =========================================================
     LOAD PACKAGES
  ========================================================= */

  useEffect(() => {

    const loadPackages =
      async () => {

        try {

          const res =
            await apiClient.get(
              "/Packages/list",
            );

          const list =
            (res.data || []).filter(
              (x: any) =>
                x.isActive !== false,
            );

          setPackages(list);

        } catch (err) {

          console.error(err);

          setError(
            "Unable to load packages.",
          );

        } finally {

          setLoading(false);
        }
      };

    loadPackages();

  }, []);


  /* =========================================================
     SELECTED PACKAGE
  ========================================================= */

  const selectedPackage =
    packages.find(
      (x) =>
        x.id === selectedId,
    );


  /* =========================================================
     OPEN CONFIRMATION
  ========================================================= */

  const handleChangeClick = () => {

    if (!selectedId) {

      setError(
        "Please select a package.",
      );

      return;
    }

    if (
      currentPackage?.packageId ===
      selectedId
    ) {

      setError(
        "This package is already active.",
      );

      return;
    }

    setError("");

    setShowConfirm(true);
  };


  /* =========================================================
     ACTUAL PACKAGE CHANGE
  ========================================================= */

  const handleChange = async () => {

    setShowConfirm(false);

    setSaving(true);
    setError("");
    setElapsed(0);

    const startedAt =
      performance.now();

    const timer =
      window.setInterval(() => {

        setElapsed(
          performance.now() -
            startedAt,
        );

      }, 50);

    try {

      const response =
        await apiClient.post(
          `/Subscribers/${subscriber.id}/change-package`,
          {
            packageId:
              selectedId,
          },
        );

      window.clearInterval(timer);

      const responseTime =
        performance.now() -
        startedAt;

      setElapsed(responseTime);

      if (
        response.data?.success ===
        false
      ) {

        throw new Error(
          response.data?.message ||
            "Package change failed.",
        );
      }

      const responseData =
        response.data || {};

      setResult({
        ...responseData,

        responseTime,

        newPackage:
          selectedPackage?.packageName ||
          responseData.packageName,

        rateLimit:
          `${selectedPackage?.uploadMbps || 0}M/${selectedPackage?.downloadMbps || 0}M`,
      });

      setShowResult(true);

    } catch (err: any) {

      window.clearInterval(timer);

      console.error(
        "Package change error:",
        err,
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Unable to change package.",
      );

    } finally {

      setSaving(false);
    }
  };


  /* =========================================================
     CLOSE RESULT
  ========================================================= */

  const closeResult = async () => {

    setShowResult(false);

    await onChanged();
  };


  return (
    <>
      {/* =====================================================
          MAIN PACKAGE MODAL
      ====================================================== */}

      <div
        className="modal show d-block"
        style={{
          background:
            "rgba(15,23,42,.55)",
          backdropFilter:
            "blur(5px)",
          zIndex: 1050,
        }}
      >

        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">

          <div
            className="modal-content border-0 rounded-4 shadow-lg position-relative"
          >

            {/* =================================================
                PROCESSING OVERLAY
            ================================================== */}

            {saving && (
              <div
                className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{
                  background:
                    "rgba(255,255,255,.94)",
                  backdropFilter:
                    "blur(4px)",
                  zIndex: 50,
                  borderRadius:
                    "1rem",
                }}
              >

                <div
                  className="text-center p-4"
                  style={{
                    minWidth: 300,
                  }}
                >

                  <div
                    className="spinner-border text-primary mb-4"
                    style={{
                      width: 48,
                      height: 48,
                    }}
                  />

                  <h5 className="fw-bold mb-2">
                    Applying Package Change
                  </h5>

                  <div className="text-muted mb-4">
                    Updating subscriber and
                    communicating with
                    MikroTik...
                  </div>

                  <div
                    className="fw-bold font-monospace"
                    style={{
                      fontSize: 22,
                    }}
                  >
                    {(
                      elapsed / 1000
                    ).toFixed(2)}{" "}
                    sec
                  </div>

                  <div className="small text-muted mt-2">
                    Waiting for RADIUS CoA
                    response
                  </div>

                  <div className="progress mt-4">
                    <div
                      className="progress-bar progress-bar-striped progress-bar-animated"
                      style={{
                        width: "100%",
                      }}
                    />
                  </div>

                </div>

              </div>
            )}


            {/* =================================================
                HEADER
            ================================================== */}

            <div className="modal-header bg-dark text-white">

              <div>

                <div className="small opacity-75">
                  SUBSCRIBER PACKAGE
                </div>

                <h5 className="mb-0 fw-bold">
                  Change Package
                </h5>

                <div className="small opacity-75 mt-1">
                  {subscriber.fullName}
                  {subscriber.mobile
                    ? ` • ${subscriber.mobile}`
                    : ""}
                </div>

              </div>

              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                disabled={saving}
              />

            </div>


            {/* =================================================
                BODY
            ================================================== */}

            <div className="modal-body p-4">

              {/* ERROR */}

              {error && (
                <div className="bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-4 p-3 mb-4">

                  <div className="d-flex gap-2">

                    <span>
                      ⚠️
                    </span>

                    <div>

                      <div className="fw-semibold text-danger">
                        Unable to continue
                      </div>

                      <div className="small text-muted">
                        {error}
                      </div>

                    </div>

                  </div>

                </div>
              )}


              {/* =================================================
                  CURRENT PACKAGE
              ================================================== */}

              <div className="mb-4">

                <div className="text-muted small fw-semibold mb-2">
                  CURRENT PACKAGE
                </div>

                <div className="border rounded-4 p-3">

                  {currentPackage ? (

                    <div className="row align-items-center g-3">

                      <div className="col-md-5">

                        <div className="fw-bold">
                          {currentPackage.packageName}
                        </div>

                        <div className="text-muted small">
                          {currentPackage.planCategory ||
                            "Active now"}
                        </div>

                      </div>


                      <div className="col-md-2">

                        <small className="text-muted">
                          Download
                        </small>

                        <div className="fw-semibold">
                          {
                            currentPackage.downloadMbps
                          }{" "}
                          {
                            currentPackage.downloadUnit
                          }
                        </div>

                      </div>


                      <div className="col-md-2">

                        <small className="text-muted">
                          Upload
                        </small>

                        <div className="fw-semibold">
                          {
                            currentPackage.uploadMbps
                          }{" "}
                          {
                            currentPackage.uploadUnit
                          }
                        </div>

                      </div>


                      <div className="col-md-3">

                        <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3 py-2">
                          ✓ CURRENT
                        </span>

                      </div>

                    </div>

                  ) : (

                    <div className="text-muted">
                      No package assigned
                    </div>

                  )}

                </div>

              </div>


              {/* =================================================
                  NEW PACKAGE SELECT
              ================================================== */}

              <div className="mb-4">

                <label className="form-label fw-semibold">
                  Select New Package *
                </label>

                {loading ? (

                  <div className="border rounded-4 p-4 text-center">

                    <span className="spinner-border spinner-border-sm me-2" />

                    Loading packages...

                  </div>

                ) : (

                  <select
                    className="form-select form-select-lg rounded-3"
                    value={selectedId}
                    onChange={(e) => {
                      setSelectedId(
                        e.target.value,
                      );

                      setError("");
                    }}
                  >

                    <option value="">
                      -- Select Package --
                    </option>

                    {packages.map(
                      (pkg) => (

                        <option
                          key={pkg.id}
                          value={pkg.id}
                        >

                          {pkg.packageName}
                          {" — "}
                          {pkg.downloadMbps}/
                          {pkg.uploadMbps}
                          {" Mbps — ₹"}
                          {pkg.price}

                        </option>

                      ),
                    )}

                  </select>

                )}

              </div>


              {/* =================================================
                  NEW PACKAGE PREVIEW
              ================================================== */}

              {selectedPackage && (

                <div className="border border-primary border-opacity-25 bg-primary bg-opacity-10 rounded-4">

                  <div className="p-4">

                    <div className="d-flex justify-content-between">

                      <div>

                        <div className="text-muted small">
                          NEW PACKAGE
                        </div>

                        <h5 className="fw-bold mb-0">
                          {
                            selectedPackage.packageName
                          }
                        </h5>

                        <div className="small text-muted mt-1">
                          {
                            selectedPackage.planCategory ||
                            "Package"
                          }
                        </div>

                      </div>

                      <span className="badge bg-primary rounded-pill align-self-start px-3 py-2">
                        NEW
                      </span>

                    </div>


                    <div className="row g-3 mt-2">

                      <PackageInfoBox
                        label="Download"
                        value={`${selectedPackage.downloadMbps} ${selectedPackage.downloadUnit}`}
                      />

                      <PackageInfoBox
                        label="Upload"
                        value={`${selectedPackage.uploadMbps} ${selectedPackage.uploadUnit}`}
                      />

                      <PackageInfoBox
                        label="Price"
                        value={`₹${Number(
                          selectedPackage.price,
                        ).toLocaleString(
                          "en-IN",
                        )}`}
                      />

                      <PackageInfoBox
                        label="Validity"
                        value={`${selectedPackage.expiryDays} ${selectedPackage.validityType}`}
                      />

                    </div>

                  </div>

                </div>

              )}


              {/* =================================================
                  CONNECTION INFO
              ================================================== */}

              <div className="bg-light border rounded-4 p-3 mt-4">

                <div className="fw-semibold small mb-1">
                  ⚡ Live Connection Handling
                </div>

                <div className="small text-muted">

                  If the subscriber is online,
                  the system will first try to
                  update the active MikroTik
                  session using RADIUS CoA.

                  If CoA fails, the active
                  session will be disconnected
                  and the new package will apply
                  when the subscriber reconnects.

                </div>

              </div>

            </div>


            {/* =================================================
                FOOTER
            ================================================== */}

            <div className="modal-footer">

              <button
                type="button"
                className="btn btn-light border rounded-pill px-4"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-brand rounded-pill px-4 text-white shadow-sm"
                onClick={
                  handleChangeClick
                }
                disabled={
                  saving ||
                  !selectedId ||
                  loading
                }
              >
                🔄 Change Package
              </button>

            </div>

          </div>

        </div>

      </div>


      {/* =======================================================
          CONFIRMATION MODAL
      ======================================================== */}

      {showConfirm && (

        <div
          className="modal show d-block"
          style={{
            background:
              "rgba(15,23,42,.65)",
            backdropFilter:
              "blur(6px)",
            zIndex: 1080,
          }}
        >

          <div className="modal-dialog modal-dialog-centered">

            <div className="modal-content border-0 rounded-4 shadow-lg">

              <div className="modal-body p-4">

                <div className="text-center">

                  <div
                    className="rounded-circle bg-warning bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{
                      width: 70,
                      height: 70,
                      fontSize: 30,
                    }}
                  >
                    🔄
                  </div>

                  <h5 className="fw-bold">
                    Change Package?
                  </h5>

                  <p className="text-muted mb-4">

                    Are you sure you want to
                    change{" "}

                    <strong>
                      {subscriber.fullName}
                    </strong>

                    {" "}from{" "}

                    <strong>
                      {currentPackage?.packageName ||
                        "No Package"}
                    </strong>

                    {" "}to{" "}

                    <strong>
                      {
                        selectedPackage?.packageName
                      }
                    </strong>
                    ?

                  </p>

                </div>


                {/* CURRENT → NEW */}

                <div className="row g-2 align-items-center mb-4">

                  <div className="col-5">

                    <div className="border rounded-4 p-3 text-center">

                      <div className="small text-muted">
                        CURRENT
                      </div>

                      <div className="fw-bold">
                        {
                          currentPackage?.packageName ||
                          "None"
                        }
                      </div>

                      {currentPackage && (
                        <div className="small text-muted">
                          {
                            currentPackage.downloadMbps
                          }/
                          {
                            currentPackage.uploadMbps
                          } Mbps
                        </div>
                      )}

                    </div>

                  </div>


                  <div className="col-2 text-center">
                    →
                  </div>


                  <div className="col-5">

                    <div className="border border-primary bg-primary bg-opacity-10 rounded-4 p-3 text-center">

                      <div className="small text-primary">
                        NEW
                      </div>

                      <div className="fw-bold">
                        {
                          selectedPackage?.packageName
                        }
                      </div>

                      <div className="small text-muted">
                        {
                          selectedPackage?.downloadMbps
                        }/
                        {
                          selectedPackage?.uploadMbps
                        } Mbps
                      </div>

                    </div>

                  </div>

                </div>


                {/* ONLINE WARNING */}

                <div className="bg-info bg-opacity-10 border border-info border-opacity-25 rounded-4 p-3 mb-4">

                  <div className="small">

                    <strong>
                      ℹ Live subscriber:
                    </strong>

                    {" "}If the subscriber is
                    currently online, the system
                    will attempt RADIUS CoA first.
                    If CoA fails, the current
                    session may be disconnected
                    so the new package can apply
                    on reconnect.

                  </div>

                </div>


                <div className="d-flex justify-content-end gap-2">

                  <button
                    type="button"
                    className="btn btn-light border rounded-pill px-4"
                    onClick={() =>
                      setShowConfirm(false)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-brand rounded-pill px-4 text-white shadow-sm"
                    onClick={handleChange}
                  >
                    Yes, Change Package
                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>

      )}


      {/* =======================================================
          RESULT MODAL
      ======================================================== */}

      {showResult && (

        <PackageChangeResultModal
          result={result}
          elapsed={elapsed}
          onClose={closeResult}
        />

      )}

    </>
  );
};


/* ============================================================
   RESULT MODAL
============================================================ */

const PackageChangeResultModal = ({
  result,
  elapsed,
  onClose,
}: {
  result: any;
  elapsed: number;
  onClose: () => void;
}) => {

  const coaSuccess =
    result?.coaSuccess === true;

  const wasOnline =
    result?.wasOnline === true;

  const disconnected =
    result?.disconnected === true;

  const sessionContinued =
    result?.sessionContinued === true;


  let title =
    "Package Updated";

  let icon =
    "✓";

  let iconClass =
    "bg-primary bg-opacity-10 text-primary";

  if (coaSuccess) {

    title =
      "Package Changed Successfully";

    icon =
      "✓";

    iconClass =
      "bg-success bg-opacity-10 text-success";

  } else if (
    wasOnline &&
    disconnected
  ) {

    title =
      "Package Changed";

    icon =
      "⚠";

    iconClass =
      "bg-warning bg-opacity-10 text-warning";

  }


  return (
    <div
      className="modal show d-block"
      style={{
        background:
          "rgba(15,23,42,.70)",
        backdropFilter:
          "blur(6px)",
        zIndex: 1200,
      }}
    >

      <div className="modal-dialog modal-dialog-centered">

        <div className="modal-content border-0 rounded-4 shadow-lg">

          {/* HEADER */}

          <div className="modal-header border-0">

            <div>

              <div className="small text-muted">
                PACKAGE CHANGE RESULT
              </div>

              <h5 className="fw-bold mb-0">
                {title}
              </h5>

            </div>

            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            />

          </div>


          <div className="modal-body p-4 pt-2">

            {/* ICON */}

            <div className="text-center mb-4">

              <div
                className={`rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 ${iconClass}`}
                style={{
                  width: 76,
                  height: 76,
                  fontSize: 34,
                }}
              >
                {icon}
              </div>

              <h5 className="fw-bold mb-1">
                {result?.newPackage ||
                  result?.packageName}
              </h5>

              <div className="text-muted">
                New package assigned
              </div>

            </div>


            {/* STATUS */}

            <div className="border rounded-4 p-3 mb-3">

              <StatusRow
                label="Database"
                value="Updated"
                success
              />

              <StatusRow
                label="Package History"
                value="Updated"
                success
              />


              {wasOnline && (

                <StatusRow
                  label="Active Session"
                  value={
                    sessionContinued
                      ? "Continued"
                      : disconnected
                        ? "Disconnected"
                        : "Detected"
                  }
                  success={
                    sessionContinued ||
                    disconnected
                  }
                />

              )}


              {wasOnline && (

                <StatusRow
                  label="RADIUS CoA"
                  value={
                    coaSuccess
                      ? "CoA-ACK received"
                      : "Failed / Timeout"
                  }
                  success={
                    coaSuccess
                  }
                />

              )}

            </div>


            {/* SESSION */}

            {result?.acctSessionId && (

              <div className="bg-light rounded-4 p-3 mb-3">

                <div className="text-muted small">
                  RADIUS SESSION ID
                </div>

                <div className="font-monospace fw-bold">
                  {
                    result.acctSessionId
                  }
                </div>

              </div>

            )}


            {/* SPEED + RESPONSE */}

            <div className="row g-3 mb-3">

              {result?.rateLimit && (

                <div className="col-6">

                  <div className="bg-primary bg-opacity-10 rounded-4 p-3 h-100">

                    <div className="text-muted small">
                      NEW RATE LIMIT
                    </div>

                    <div className="fw-bold text-primary mt-1">
                      {
                        result.rateLimit
                      }
                    </div>

                  </div>

                </div>

              )}


              <div
                className={
                  result?.rateLimit
                    ? "col-6"
                    : "col-12"
                }
              >

                <div className="bg-light rounded-4 p-3 h-100">

                  <div className="text-muted small">
                    API RESPONSE TIME
                  </div>

                  <div className="fw-bold mt-1">
                    {(
                      (result?.responseTime ??
                        elapsed) /
                      1000
                    ).toFixed(3)}{" "}
                    sec
                  </div>

                </div>

              </div>

            </div>


            {/* CONNECTION STATUS */}

            {coaSuccess && (

              <div className="bg-success bg-opacity-10 border border-success border-opacity-25 rounded-4 p-3 mb-3">

                <div className="fw-semibold text-success">
                  ✓ Live connection updated
                </div>

                <div className="small text-muted mt-1">

                  The subscriber's existing
                  PPPoE session was kept alive
                  and the new package rate-limit
                  was sent through RADIUS CoA.

                </div>

              </div>

            )}


            {wasOnline &&
              !coaSuccess &&
              disconnected && (

                <div className="bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-4 p-3 mb-3">

                  <div className="fw-semibold text-warning-emphasis">
                    ⚠ Session reconnect required
                  </div>

                  <div className="small text-muted mt-1">

                    The package was changed, but
                    the live CoA could not be
                    applied. The old session was
                    disconnected. The subscriber
                    will receive the new package
                    on the next PPPoE connection.

                  </div>

                </div>

              )}


            {/* SERVER MESSAGE */}

            {result?.message && (

              <div className="bg-light border rounded-4 p-3">

                <div className="text-muted small mb-1">
                  SERVER RESPONSE
                </div>

                <div className="small">
                  {result.message}
                </div>

              </div>

            )}

          </div>


          {/* FOOTER */}

          <div className="modal-footer border-0">

            <button
              type="button"
              className="btn btn-dark rounded-pill px-4"
              onClick={onClose}
            >
              Done
            </button>

          </div>

        </div>

      </div>

    </div>
  );
};


/* ============================================================
   STATUS ROW
============================================================ */

const StatusRow = ({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success: boolean;
}) => (
  <div className="d-flex justify-content-between align-items-center py-2 border-bottom">

    <span className="text-muted">
      {label}
    </span>

    <span
      className={
        success
          ? "fw-semibold text-success"
          : "fw-semibold text-danger"
      }
    >
      {success
        ? "✓ "
        : "✕ "}

      {value}
    </span>

  </div>
);


/* ============================================================
   PACKAGE INFO BOX
============================================================ */

const PackageInfoBox = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="col-md-3">

    <div className="bg-white rounded-3 p-3 h-100 border border-primary border-opacity-10">

      <div className="text-muted small">
        {label}
      </div>

      <div className="fw-bold mt-1">
        {value}
      </div>

    </div>

  </div>
);


export default SubscriberPackageCard;
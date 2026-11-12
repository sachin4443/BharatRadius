import React, { useEffect, useMemo, useRef, useState } from "react";
import apiClient from "../services/api";

// ============================================================
// TYPES
// ============================================================

interface Subscriber {
  id: string;
  siteId: string;
  nasId?: string | null;
  packageId?: string | null;

  subscriberType?: string;
  fullName?: string;
  companyName?: string;

  mobile?: string;
  email?: string;

  address?: string;
  zip?: string;
  city?: string;
  state?: string;

  gstNo?: string;
  comment?: string;

  service?: string;
  pppoeUsername?: string;
  pppoePassword?: string;

  macAddress?: string;
  staticIp?: string;

  connectionEnabled?: boolean;
  isActive?: boolean;

  photoUrl?: string | null;

  expireDate?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

interface Site {
  id: string;
  siteName?: string;
  companyName?: string;
  siteEmail?: string;
  siteMobileNo?: string;
}

interface PackageProfile {
  id: string;
  packageName?: string;
  planCategory?: string;

  downloadMbps?: number;
  downloadUnit?: string;

  uploadMbps?: number;
  uploadUnit?: string;

  price?: number;
  expiryDays?: number;
  validityType?: string;

  description?: string;
}

interface CAFDocument {
  id?: string;
  documentType: string;
  uploaded: boolean;
  fileName?: string | null;
  relativePath?: string | null;
  uploadedAt?: string | null;
}

interface SubscriberDetailsResponse {
  subscriber: Subscriber;
  site: Site | null;
  package: PackageProfile | null;
  documents?: CAFDocument[];
}

interface CAFHistoryItem {
  id: string;
  cafNumber: number;
  generatedAt: string;
  pdfPath?: string | null;
}

// ============================================================
// DOCUMENT TYPES
// ============================================================

const DOCUMENT_TYPES = [
  {
    key: "Aadhaar",
    title: "Aadhaar Card",
    icon: "bi-person-vcard-fill",
    description: "Identity proof",
  },
  {
    key: "PAN",
    title: "PAN Card",
    icon: "bi-credit-card-2-front-fill",
    description: "PAN identity proof",
  },
  {
    key: "DrivingLicence",
    title: "Driving Licence",
    icon: "bi-car-front-fill",
    description: "Driving licence",
  },
  {
    key: "Agreement",
    title: "Agreement",
    icon: "bi-file-earmark-text-fill",
    description: "Customer agreement",
  },
];

// ============================================================
// HELPERS
// ============================================================

const getErrorMessage = (
  error: any,
  fallback: string
): string => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  if (error?.message) {
    return error.message;
  }

  return fallback;
};

const normalizeSubscriberResponse = (
  data: any
): Subscriber[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.subscribers)) {
    return data.subscribers;
  }

  return [];
};

const safeText = (
  value?: string | null
): string => {
  return value?.trim() || "-";
};

const formatDate = (
  value?: string | null
): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMoney = (
  value?: number
): string => {
  if (value === undefined || value === null) {
    return "-";
  }

  return `₹ ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatSpeed = (
  speed?: number,
  unit?: string
): string => {
  if (speed === undefined || speed === null) {
    return "-";
  }

  return `${speed} ${unit || ""}`.trim();
};

const formatValidity = (
  days?: number,
  type?: string
): string => {
  if (days === undefined || days === null) {
    return "-";
  }

  const normalized =
    (type || "Days").trim();

  if (
    normalized.toLowerCase() === "day" ||
    normalized.toLowerCase() === "days"
  ) {
    return `${days} ${days === 1 ? "Day" : "Days"}`;
  }

  if (
    normalized.toLowerCase() === "month" ||
    normalized.toLowerCase() === "months"
  ) {
    return `${days} ${days === 1 ? "Month" : "Months"}`;
  }

  return `${days} ${normalized}`;
};

// ============================================================
// COMPONENT
// ============================================================

const CAF: React.FC = () => {
  const [subscribers, setSubscribers] =
    useState<Subscriber[]>([]);

  const [selectedSubscriber, setSelectedSubscriber] =
    useState<Subscriber | null>(null);

  const [site, setSite] =
    useState<Site | null>(null);

  const [packageProfile, setPackageProfile] =
    useState<PackageProfile | null>(null);

  const [documents, setDocuments] =
    useState<CAFDocument[]>([]);

  const [cafHistory, setCafHistory] =
    useState<CAFHistoryItem[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [uploadingType, setUploadingType] =
    useState<string | null>(null);

  const [generating, setGenerating] =
    useState(false);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const fileInputRefs =
    useRef<Record<string, HTMLInputElement | null>>({});

  // ==========================================================
  // LOAD SUBSCRIBERS
  // ==========================================================

  useEffect(() => {
    loadSubscribers();
  }, []);

  const loadSubscribers = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await apiClient.get(
          "/CAF/subscribers"
        );

      setSubscribers(
        normalizeSubscriberResponse(
          response.data
        )
      );
    } catch (err: any) {
      console.error(
        "CAF subscriber loading error:",
        err
      );

      setSubscribers([]);

      setError(
        getErrorMessage(
          err,
          "Unable to load subscribers."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // SELECT SUBSCRIBER
  // ==========================================================

  const selectSubscriber = async (
    subscriber: Subscriber
  ) => {
    try {
      setDetailsLoading(true);
      setError("");
      setMessage("");

      setSelectedSubscriber(
        subscriber
      );

      setSite(null);
      setPackageProfile(null);
      setDocuments([]);
      setCafHistory([]);

      const response =
        await apiClient.get<SubscriberDetailsResponse>(
          `/CAF/subscribers/${subscriber.id}`
        );

      setSelectedSubscriber(
        response.data.subscriber
      );

      setSite(
        response.data.site || null
      );

      setPackageProfile(
        response.data.package || null
      );

      setDocuments(
        Array.isArray(
          response.data.documents
        )
          ? response.data.documents
          : []
      );

      await loadCAFHistory(
        subscriber.id
      );
    } catch (err: any) {
      console.error(
        "CAF subscriber details error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Unable to load subscriber details."
        )
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  // ==========================================================
  // LOAD HISTORY
  // ==========================================================

  const loadCAFHistory = async (
    subscriberId: string
  ) => {
    try {
      setHistoryLoading(true);

      const response =
        await apiClient.get(
          `/CAF/history/${subscriberId}`
        );

      const data =
        response.data;

      let history: CAFHistoryItem[] = [];

      if (Array.isArray(data)) {
        history = data;
      } else if (
        Array.isArray(data?.data)
      ) {
        history = data.data;
      }

      setCafHistory(history);
    } catch (err: any) {
      console.error(
        "CAF history error:",
        err
      );

      setCafHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ==========================================================
  // REFRESH SELECTED CUSTOMER DETAILS
  // ==========================================================

  const refreshSelectedDetails = async () => {
    if (!selectedSubscriber) {
      return;
    }

    const response =
      await apiClient.get<SubscriberDetailsResponse>(
        `/CAF/subscribers/${selectedSubscriber.id}`
      );

    setSelectedSubscriber(
      response.data.subscriber
    );

    setSite(
      response.data.site || null
    );

    setPackageProfile(
      response.data.package || null
    );

    setDocuments(
      Array.isArray(
        response.data.documents
      )
        ? response.data.documents
        : []
    );
  };

  // ==========================================================
  // UPLOAD DOCUMENT
  // ==========================================================

  const uploadDocument = async (
    documentType: string,
    file: File
  ) => {
    if (!selectedSubscriber) {
      return;
    }

    const allowedExtensions = [
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
    ];

    const extension =
      "." +
      (
        file.name
          .split(".")
          .pop() || ""
      ).toLowerCase();

    if (
      !allowedExtensions.includes(
        extension
      )
    ) {
      setError(
        "Only PDF, JPG, JPEG and PNG files are allowed."
      );
      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setError(
        "Maximum file size is 10 MB."
      );
      return;
    }

    const existing =
      documents.find(
        (doc) =>
          doc.documentType ===
          documentType
      );

    if (existing?.uploaded) {
      setError(
        `${documentType} has already been uploaded and cannot be replaced.`
      );
      return;
    }

    try {
      setUploadingType(
        documentType
      );

      setError("");
      setMessage("");

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      await apiClient.post(
        `/CAF/subscribers/${selectedSubscriber.id}/documents/${documentType}`,
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

      setMessage(
        `${documentType} uploaded successfully.`
      );

      await refreshSelectedDetails();
    } catch (err: any) {
      console.error(
        "CAF document upload error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Unable to upload document."
        )
      );
    } finally {
      setUploadingType(null);

      if (
        fileInputRefs.current[
          documentType
        ]
      ) {
        fileInputRefs.current[
          documentType
        ]!.value = "";
      }
    }
  };

  // ==========================================================
  // DOWNLOAD DOCUMENT
  // ==========================================================

  const downloadDocument = async (
    documentId: string,
    fileName: string
  ) => {
    try {
      setError("");

      const response =
        await apiClient.get(
          `/CAF/documents/${documentId}/download`,
          {
            responseType: "blob",
          }
        );

      const blob =
        new Blob(
          [response.data]
        );

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download =
        fileName || "document";

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      window.URL.revokeObjectURL(
        url
      );
    } catch (err: any) {
      console.error(
        "Document download error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Unable to download document."
        )
      );
    }
  };

  // ==========================================================
  // GENERATE CAF
  // ==========================================================

  const generateCAF = async () => {
    if (!selectedSubscriber) {
      setError(
        "Please select a subscriber first."
      );
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setMessage("");

      const response =
        await apiClient.get(
          `/CAF/generate/${selectedSubscriber.id}`,
          {
            responseType: "blob",
          }
        );

      const blob =
        new Blob(
          [response.data],
          {
            type: "application/pdf",
          }
        );

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      const safeName =
        (
          selectedSubscriber.fullName ||
          "Customer"
        )
          .replace(
            /[^a-zA-Z0-9-_ ]/g,
            ""
          )
          .trim();

      link.download =
        `CAF-${safeName || "Customer"}.pdf`;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      window.URL.revokeObjectURL(
        url
      );

      setMessage(
        "CAF generated and downloaded successfully."
      );

      await loadCAFHistory(
        selectedSubscriber.id
      );
    } catch (err: any) {
      console.error(
        "CAF generation error:",
        err
      );

      let errorMessage =
        "Unable to generate CAF.";

      try {
        if (
          err?.response?.data instanceof Blob
        ) {
          const text =
            await err.response.data.text();

          if (text) {
            const json =
              JSON.parse(text);

            if (json?.message) {
              errorMessage =
                json.message;
            } else if (json?.error) {
              errorMessage =
                json.error;
            }
          }
        } else {
          errorMessage =
            getErrorMessage(
              err,
              errorMessage
            );
        }
      } catch {
        errorMessage =
          getErrorMessage(
            err,
            errorMessage
          );
      }

      setError(
        errorMessage
      );
    } finally {
      setGenerating(false);
    }
  };

  // ==========================================================
  // OPEN OLD CAF
  // ==========================================================

  const downloadCAF = (
    caf: CAFHistoryItem
  ) => {
    try {
      setError("");

      if (!caf.pdfPath) {
        setError(
          "CAF PDF path is not available."
        );
        return;
      }

      const baseUrl =
        apiClient.defaults.baseURL ||
        "";

      const serverUrl =
        baseUrl.replace(
          /\/api\/?$/,
          ""
        );

      const pdfUrl =
        `${serverUrl}${caf.pdfPath}`;

      window.open(
        pdfUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err: any) {
      console.error(
        "Old CAF open error:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Unable to open CAF."
        )
      );
    }
  };

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredSubscribers =
    useMemo(() => {
      if (
        !Array.isArray(
          subscribers
        )
      ) {
        return [];
      }

      const searchText =
        search
          .trim()
          .toLowerCase();

      if (!searchText) {
        return subscribers;
      }

      return subscribers.filter(
        (subscriber) => {
          const searchableText =
            [
              subscriber.fullName,
              subscriber.mobile,
              subscriber.email,
              subscriber.pppoeUsername,
              subscriber.city,
              subscriber.state,
              subscriber.service,
              subscriber.companyName,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchableText.includes(
            searchText
          );
        }
      );
    }, [
      subscribers,
      search,
    ]);

  const getDocument = (
    documentType: string
  ) => {
    return documents.find(
      (document) =>
        document.documentType ===
        documentType
    );
  };

  const uploadedDocumentCount =
    Array.isArray(documents)
      ? documents.filter(
          (x) => x.uploaded
        ).length
      : 0;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      className="container-fluid py-3"
      style={
        {
          "--caf-navy":
            "#111d37",
          "--caf-orange":
            "#ff6c0f",
        } as React.CSSProperties
      }
    >
      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
        <div>
          <h4 className="fw-bold text-dark mb-1">
            <i
              className="bi bi-file-earmark-person-fill me-2"
              style={{
                color: "var(--caf-orange)",
              }}
            />
            Customer Application Form
          </h4>

          <div className="text-muted small">
            Generate CAF and manage customer documents
          </div>
        </div>

        {selectedSubscriber && (
          <div className="mt-3 mt-md-0">
            <span
              className="badge px-3 py-2"
              style={{
                background:
                  "rgba(255,108,15,.12)",
                color:
                  "var(--caf-orange)",
              }}
            >
              <i className="bi bi-person-check-fill me-1" />
              {safeText(
                selectedSubscriber.fullName
              )}
            </span>
          </div>
        )}
      </div>

      {/* ====================================================
          ALERTS
      ==================================================== */}

      {message && (
        <div
          className="alert alert-success alert-dismissible fade show"
          role="alert"
        >
          <i className="bi bi-check-circle-fill me-2" />
          {message}

          <button
            type="button"
            className="btn-close"
            onClick={() =>
              setMessage("")
            }
          />
        </div>
      )}

      {error && (
        <div
          className="alert alert-danger alert-dismissible fade show"
          role="alert"
        >
          <i className="bi bi-exclamation-triangle-fill me-2" />
          {error}

          <button
            type="button"
            className="btn-close"
            onClick={() =>
              setError("")
            }
          />
        </div>
      )}

      <div className="row g-4">
        {/* ==================================================
            LEFT - SUBSCRIBERS
        ================================================== */}

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="fw-bold mb-1">
                    <i
                      className="bi bi-people-fill me-2"
                      style={{
                        color:
                          "var(--caf-orange)",
                      }}
                    />
                    Subscribers
                  </h6>

                  <div className="text-muted small">
                    Select customer for CAF
                  </div>
                </div>

                <span
                  className="badge rounded-pill"
                  style={{
                    background:
                      "var(--caf-navy)",
                  }}
                >
                  {subscribers.length}
                </span>
              </div>

              <div className="input-group mt-3 mb-2">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search" />
                </span>

                <input
                  type="text"
                  className="form-control bg-light border-start-0"
                  placeholder="Search name, mobile, email..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />

                {search && (
                  <button
                    type="button"
                    className="btn btn-light border"
                    onClick={() =>
                      setSearch("")
                    }
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
            </div>

            <div
              className="card-body p-0"
              style={{
                maxHeight:
                  "650px",
                overflowY:
                  "auto",
              }}
            >
              {loading ? (
                <div className="text-center py-5">
                  <div
                    className="spinner-border"
                    style={{
                      color:
                        "var(--caf-orange)",
                    }}
                    role="status"
                  />

                  <div className="small text-muted mt-2">
                    Loading subscribers...
                  </div>
                </div>
              ) : filteredSubscribers.length === 0 ? (
                <div className="text-center py-5 px-3">
                  <i className="bi bi-person-x fs-1 text-muted d-block mb-2" />
                  <div className="fw-semibold text-muted">
                    No subscribers found
                  </div>
                  <div className="small text-muted mt-1">
                    Try another search.
                  </div>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {filteredSubscribers.map(
                    (subscriber) => {
                      const selected =
                        selectedSubscriber?.id ===
                        subscriber.id;

                      return (
                        <button
                          key={
                            subscriber.id
                          }
                          type="button"
                          className={`list-group-item list-group-item-action border-0 py-3 ${
                            selected
                              ? "text-white"
                              : ""
                          }`}
                          style={
                            selected
                              ? {
                                  background:
                                    "var(--caf-navy)",
                                }
                              : undefined
                          }
                          onClick={() =>
                            selectSubscriber(
                              subscriber
                            )
                          }
                        >
                          <div className="d-flex align-items-center">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 me-3"
                              style={{
                                width: 44,
                                height: 44,
                                background:
                                  selected
                                    ? "rgba(255,255,255,.15)"
                                    : "rgba(255,108,15,.10)",
                                color:
                                  selected
                                    ? "#fff"
                                    : "var(--caf-orange)",
                              }}
                            >
                              <i className="bi bi-person-fill fs-5" />
                            </div>

                            <div className="flex-grow-1 text-start min-w-0">
                              <div className="fw-semibold text-truncate">
                                {safeText(
                                  subscriber.fullName
                                )}
                              </div>

                              <div
                                className={`small ${
                                  selected
                                    ? "text-white-50"
                                    : "text-muted"
                                }`}
                              >
                                <i className="bi bi-phone me-1" />
                                {safeText(
                                  subscriber.mobile
                                )}
                              </div>

                              <div
                                className={`small text-truncate ${
                                  selected
                                    ? "text-white-50"
                                    : "text-muted"
                                }`}
                              >
                                <i className="bi bi-router me-1" />
                                {safeText(
                                  subscriber.service
                                )}
                              </div>
                            </div>

                            <i className="bi bi-chevron-right" />
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================================================
            RIGHT
        ================================================== */}

        <div className="col-lg-8">
          {!selectedSubscriber ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-5">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{
                    width: 90,
                    height: 90,
                    background:
                      "rgba(255,108,15,.10)",
                    color:
                      "var(--caf-orange)",
                  }}
                >
                  <i className="bi bi-file-earmark-person fs-1" />
                </div>

                <h5 className="fw-bold">
                  Select a Subscriber
                </h5>

                <p className="text-muted mb-0">
                  Select a subscriber from the left
                  side to generate their CAF.
                </p>
              </div>
            </div>
          ) : detailsLoading ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-5">
                <div
                  className="spinner-border"
                  style={{
                    color:
                      "var(--caf-orange)",
                  }}
                  role="status"
                />

                <div className="text-muted mt-3">
                  Loading customer details...
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* =================================================
                  CUSTOMER CARD
              ================================================= */}

              <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-0 pt-3">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <div>
                      <h5 className="fw-bold mb-1">
                        {safeText(
                          selectedSubscriber.fullName
                        )}
                      </h5>

                      <div className="text-muted small">
                        <i className="bi bi-phone me-1" />
                        {safeText(
                          selectedSubscriber.mobile
                        )}

                        <span className="mx-2">
                          •
                        </span>

                        <i className="bi bi-router me-1" />
                        {safeText(
                          selectedSubscriber.service
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn text-white px-4"
                      style={{
                        background:
                          "var(--caf-orange)",
                      }}
                      disabled={generating}
                      onClick={
                        generateCAF
                      }
                    >
                      {generating ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-file-earmark-pdf-fill me-2" />
                          Generate CAF
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="card-body">
                  {/* SITE */}
                  <div
                    className="rounded-3 p-3 mb-4 d-flex align-items-center"
                    style={{
                      background:
                        "rgba(17,29,55,.05)",
                      borderLeft:
                        "4px solid var(--caf-orange)",
                    }}
                  >
                    <i
                      className="bi bi-building fs-4 me-3"
                      style={{
                        color:
                          "var(--caf-orange)",
                      }}
                    />

                    <div>
                      <div className="small text-muted">
                        Site / Company
                      </div>

                      <div className="fw-bold">
                        {safeText(
                          site?.siteName
                        )}
                        {site?.companyName
                          ? ` — ${site.companyName}`
                          : ""}
                      </div>
                    </div>
                  </div>

                  {/* CUSTOMER DETAILS */}
                  <div className="fw-bold mb-3">
                    <i
                      className="bi bi-person-vcard-fill me-2"
                      style={{
                        color:
                          "var(--caf-orange)",
                      }}
                    />
                    Customer Details
                  </div>

                  <div className="row g-3">
                    {[
                      [
                        "Full Name",
                        selectedSubscriber.fullName,
                      ],
                      [
                        "Mobile",
                        selectedSubscriber.mobile,
                      ],
                      [
                        "Email",
                        selectedSubscriber.email,
                      ],
                      [
                        "Subscriber Type",
                        selectedSubscriber.subscriberType,
                      ],
                      [
                        "GST No.",
                        selectedSubscriber.gstNo,
                      ],
                      [
                        "City",
                        selectedSubscriber.city,
                      ],
                      [
                        "State",
                        selectedSubscriber.state,
                      ],
                      [
                        "PIN / ZIP",
                        selectedSubscriber.zip,
                      ],
                    ].map(
                      ([label, value]) => (
                        <div
                          className="col-md-6"
                          key={label}
                        >
                          <div className="small text-muted">
                            {label}
                          </div>
                          <div className="fw-semibold text-break">
                            {safeText(
                              value as string
                            )}
                          </div>
                        </div>
                      )
                    )}

                    <div className="col-12">
                      <div className="small text-muted">
                        Address
                      </div>

                      <div className="fw-semibold">
                        {safeText(
                          selectedSubscriber.address
                        )}
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      PACKAGE
                  ================================================= */}

                  <div className="border-top mt-4 pt-4">
                    <div className="fw-bold mb-3">
                      <i
                        className="bi bi-box-seam-fill me-2"
                        style={{
                          color:
                            "var(--caf-orange)",
                        }}
                      />
                      Plan / Package Details
                    </div>

                    {packageProfile ? (
                      <>
                        <div className="row g-3">
                          <div className="col-md-4">
                            <div className="small text-muted">
                              Package
                            </div>
                            <div className="fw-semibold">
                              {safeText(
                                packageProfile.packageName
                              )}
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="small text-muted">
                              Category
                            </div>
                            <div className="fw-semibold">
                              {safeText(
                                packageProfile.planCategory
                              )}
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="small text-muted">
                              Price
                            </div>
                            <div
                              className="fw-bold"
                              style={{
                                color:
                                  "var(--caf-orange)",
                              }}
                            >
                              {formatMoney(
                                packageProfile.price
                              )}
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="small text-muted">
                              Download
                            </div>
                            <div className="fw-semibold">
                              {formatSpeed(
                                packageProfile.downloadMbps,
                                packageProfile.downloadUnit
                              )}
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="small text-muted">
                              Upload
                            </div>
                            <div className="fw-semibold">
                              {formatSpeed(
                                packageProfile.uploadMbps,
                                packageProfile.uploadUnit
                              )}
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="small text-muted">
                              Validity
                            </div>
                            <div className="fw-semibold">
                              {formatValidity(
                                packageProfile.expiryDays,
                                packageProfile.validityType
                              )}
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="small text-muted">
                              Valid Until
                            </div>
                            <div className="fw-semibold">
                              {formatDate(
                                selectedSubscriber.expireDate
                              )}
                            </div>
                          </div>

                          <div className="col-md-8">
                            <div className="small text-muted">
                              Description
                            </div>
                            <div className="fw-semibold">
                              {safeText(
                                packageProfile.description
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="alert alert-warning mb-0">
                        <i className="bi bi-exclamation-circle me-2" />
                        No package is assigned to this subscriber.
                      </div>
                    )}
                  </div>

                  {/* CONNECTION */}
                  <div className="border-top mt-4 pt-4">
                    <div className="fw-bold mb-3">
                      <i
                        className="bi bi-router-fill me-2"
                        style={{
                          color:
                            "var(--caf-orange)",
                        }}
                      />
                      Connection Details
                    </div>

                    <div className="row g-3">
                      <div className="col-md-4">
                        <div className="small text-muted">
                          Service
                        </div>
                        <div className="fw-semibold">
                          {safeText(
                            selectedSubscriber.service
                          )}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="small text-muted">
                          PPPoE Username
                        </div>
                        <div className="fw-semibold text-break">
                          {safeText(
                            selectedSubscriber.pppoeUsername
                          )}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="small text-muted">
                          MAC Address
                        </div>
                        <div className="fw-semibold">
                          {safeText(
                            selectedSubscriber.macAddress
                          )}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="small text-muted">
                          Static IP
                        </div>
                        <div className="fw-semibold">
                          {safeText(
                            selectedSubscriber.staticIp
                          )}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="small text-muted">
                          Expiry Date
                        </div>
                        <div className="fw-semibold">
                          {formatDate(
                            selectedSubscriber.expireDate
                          )}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="small text-muted">
                          Connection
                        </div>

                        {selectedSubscriber.connectionEnabled ? (
                          <span className="badge bg-success">
                            <i className="bi bi-check-circle me-1" />
                            Enabled
                          </span>
                        ) : (
                          <span className="badge bg-danger">
                            <i className="bi bi-x-circle me-1" />
                            Disabled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* =================================================
                  DOCUMENTS
              ================================================= */}

              <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-0 pt-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="fw-bold mb-1">
                        <i
                          className="bi bi-folder2-open me-2"
                          style={{
                            color:
                              "var(--caf-orange)",
                          }}
                        />
                        Customer Documents
                      </h6>

                      <div className="text-muted small">
                        Documents are optional
                      </div>
                    </div>

                    <span className="badge bg-success rounded-pill">
                      {uploadedDocumentCount}/
                      {DOCUMENT_TYPES.length}
                    </span>
                  </div>
                </div>

                <div className="card-body">
                  <div className="row g-3">
                    {DOCUMENT_TYPES.map(
                      (docType) => {
                        const document =
                          getDocument(
                            docType.key
                          );

                        const uploaded =
                          document?.uploaded ===
                          true;

                        const uploading =
                          uploadingType ===
                          docType.key;

                        return (
                          <div
                            className="col-md-6"
                            key={
                              docType.key
                            }
                          >
                            <div
                              className={`border rounded-3 p-3 h-100 ${
                                uploaded
                                  ? "border-success bg-success-subtle"
                                  : "bg-light"
                              }`}
                            >
                              <div className="d-flex align-items-start">
                                <div
                                  className="rounded-3 d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                                  style={{
                                    width: 46,
                                    height: 46,
                                    background:
                                      uploaded
                                        ? "#198754"
                                        : "var(--caf-navy)",
                                    color:
                                      "#fff",
                                  }}
                                >
                                  <i
                                    className={`bi ${docType.icon} fs-5`}
                                  />
                                </div>

                                <div className="flex-grow-1 min-w-0">
                                  <div className="fw-bold">
                                    {docType.title}
                                  </div>

                                  <div className="small text-muted mb-2">
                                    {
                                      docType.description
                                    }
                                  </div>

                                  {uploaded ? (
                                    <>
                                      <div className="d-flex align-items-center text-success small fw-semibold mb-2">
                                        <i className="bi bi-check-circle-fill me-1" />
                                        Uploaded
                                      </div>

                                      <div
                                        className="small text-truncate"
                                        title={
                                          document?.fileName ||
                                          ""
                                        }
                                      >
                                        <i className="bi bi-file-earmark me-1" />
                                        {document?.fileName ||
                                          "Uploaded document"}
                                      </div>

                                      {document?.uploadedAt && (
                                        <div className="small text-muted mt-1">
                                          Uploaded:{" "}
                                          {formatDate(
                                            document.uploadedAt
                                          )}
                                        </div>
                                      )}

                                      {document?.id && (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-success mt-2"
                                          onClick={() =>
                                            downloadDocument(
                                              document.id!,
                                              document.fileName ||
                                                "document"
                                            )
                                          }
                                        >
                                          <i className="bi bi-download me-1" />
                                          Download
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div className="small text-muted mb-2">
                                        Not uploaded
                                      </div>

                                      <input
                                        ref={(
                                          element
                                        ) => {
                                          fileInputRefs.current[
                                            docType.key
                                          ] =
                                            element;
                                        }}
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="d-none"
                                        onChange={(
                                          e
                                        ) => {
                                          const file =
                                            e.target
                                              .files?.[0];

                                          if (
                                            file
                                          ) {
                                            uploadDocument(
                                              docType.key,
                                              file
                                            );
                                          }
                                        }}
                                      />

                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        disabled={
                                          uploading
                                        }
                                        onClick={() =>
                                          fileInputRefs.current[
                                            docType.key
                                          ]?.click()
                                        }
                                      >
                                        {uploading ? (
                                          <>
                                            <span className="spinner-border spinner-border-sm me-1" />
                                            Uploading...
                                          </>
                                        ) : (
                                          <>
                                            <i className="bi bi-cloud-arrow-up me-1" />
                                            Upload
                                          </>
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="alert alert-light border mt-3 mb-0 small">
                    <i
                      className="bi bi-info-circle-fill me-2"
                      style={{
                        color:
                          "var(--caf-orange)",
                      }}
                    />
                    Uploaded documents will be appended to the generated CAF PDF.
                  </div>
                </div>
              </div>

              {/* =================================================
                  CAF HISTORY
              ================================================= */}

              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 pt-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="fw-bold mb-1">
                        <i
                          className="bi bi-clock-history me-2"
                          style={{
                            color:
                              "var(--caf-orange)",
                          }}
                        />
                        CAF History
                      </h6>

                      <div className="text-muted small">
                        Previously generated CAF forms
                      </div>
                    </div>

                    <span
                      className="badge rounded-pill"
                      style={{
                        background:
                          "var(--caf-navy)",
                      }}
                    >
                      {cafHistory.length}
                    </span>
                  </div>
                </div>

                <div className="card-body p-0">
                  {historyLoading ? (
                    <div className="text-center py-4">
                      <div
                        className="spinner-border spinner-border-sm"
                        style={{
                          color:
                            "var(--caf-orange)",
                        }}
                      />

                      <div className="small text-muted mt-2">
                        Loading CAF history...
                      </div>
                    </div>
                  ) : cafHistory.length === 0 ? (
                    <div className="text-center py-4 px-3">
                      <i className="bi bi-file-earmark-x fs-2 text-muted" />
                      <div className="text-muted small mt-2">
                        No CAF generated yet.
                      </div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th className="ps-3">
                              CAF Number
                            </th>
                            <th>
                              Generated Date
                            </th>
                            <th className="text-end pe-3">
                              Action
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {cafHistory.map(
                            (caf) => (
                              <tr
                                key={
                                  caf.id
                                }
                              >
                                <td className="ps-3">
                                  <span
                                    className="badge"
                                    style={{
                                      background:
                                        "rgba(17,29,55,.10)",
                                      color:
                                        "var(--caf-navy)",
                                    }}
                                  >
                                    CAF-
                                    {
                                      caf.cafNumber
                                    }
                                  </span>
                                </td>

                                <td>
                                  <span className="small">
                                    {formatDate(
                                      caf.generatedAt
                                    )}
                                  </span>
                                </td>

                                <td className="text-end pe-3">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() =>
                                      downloadCAF(
                                        caf
                                      )
                                    }
                                  >
                                    <i className="bi bi-file-earmark-pdf me-1" />
                                    Open PDF
                                  </button>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CAF;

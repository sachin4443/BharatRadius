import React, { useCallback, useEffect, useState } from "react";
import apiClient from "../../services/api";
import { openCafPdf } from "../../services/openCafPdf";

interface CAFDocument {
  id?: string;
  documentType: string;
  uploaded: boolean;
  fileName?: string | null;
  relativePath?: string | null;
  uploadedAt?: string | null;
}

interface CAFHistoryItem {
  id: string;
  cafNumber: number;
  generatedAt: string;
  pdfPath?: string | null;
}

const DOCUMENT_TYPES = [
  { key: "Aadhaar", title: "Aadhaar Card", icon: "bi-person-vcard-fill", description: "Identity proof" },
  { key: "PAN", title: "PAN Card", icon: "bi-credit-card-2-front-fill", description: "PAN identity proof" },
  { key: "DrivingLicence", title: "Driving Licence", icon: "bi-car-front-fill", description: "Driving licence" },
  { key: "Agreement", title: "Agreement", icon: "bi-file-earmark-text-fill", description: "Customer agreement" },
];

const SubscriberDocumentsTab: React.FC<{ subscriberId: string }> = ({ subscriberId }) => {
  const [documents, setDocuments] = useState<CAFDocument[]>([]);
  const [cafHistory, setCafHistory] = useState<CAFHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [docRes, historyRes] = await Promise.all([
        apiClient.get(`/CAF/subscribers/${subscriberId}/documents`),
        apiClient.get(`/CAF/history/${subscriberId}`),
      ]);

      setDocuments(Array.isArray(docRes.data) ? docRes.data : []);
      
      const historyData = historyRes.data;
      let historyList: CAFHistoryItem[] = [];
      if (Array.isArray(historyData)) {
        historyList = historyData;
      } else if (Array.isArray(historyData?.data)) {
        historyList = historyData.data;
      }
      setCafHistory(historyList);
    } catch (err: any) {
      console.error("Failed to load documents or history:", err);
      setError("Unable to load verification records.");
    } finally {
      setLoading(false);
    }
  }, [subscriberId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await apiClient.get(`/CAF/documents/${documentId}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download document.");
    }
  };

  const handleOpenCafPdf = async (cafId?: string | null) => {
    if (!cafId) {
      alert("CAF PDF is not available.");
      return;
    }
    try {
      await openCafPdf(cafId);
    } catch {
      alert("Unable to open CAF PDF.");
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
        <div className="small text-muted mt-2">Loading records...</div>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      {/* KYC DOCUMENTS SECTION */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-1">Customer KYC Documents</h5>
          <div className="text-muted small">Verification proofs uploaded for this subscriber</div>
        </div>
      </div>

      <div className="row g-3 mb-5">
        {DOCUMENT_TYPES.map((docType) => {
          const doc = documents.find((d) => d.documentType === docType.key);
          const uploaded = doc?.uploaded === true;

          return (
            <div className="col-md-6" key={docType.key}>
              <div
                className={`border rounded-4 p-3 h-100 position-relative ${
                  uploaded ? "border-success bg-success-subtle bg-opacity-10" : "bg-light border-light"
                }`}
              >
                {/* Status Badge Icon Top-Right */}
                <span
                  className={`position-absolute top-0 end-0 translate-middle-y badge rounded-circle p-2 me-3 mt-4 ${
                    uploaded ? "bg-success text-white" : "bg-danger text-white"
                  }`}
                  style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}
                  title={uploaded ? "Uploaded" : "Not Uploaded"}
                >
                  {uploaded ? "✓" : "✕"}
                </span>

                <div className="d-flex align-items-start">
                  <div
                    className={`rounded-3 d-flex align-items-center justify-content-center me-3 flex-shrink-0 ${
                      uploaded ? "bg-success text-white" : "bg-secondary text-white bg-opacity-50"
                    }`}
                    style={{ width: 46, height: 46 }}
                  >
                    <i className={`bi ${docType.icon} fs-5`} />
                  </div>

                  <div className="flex-grow-1 min-w-0 pe-4">
                    <div className="fw-bold text-dark">{docType.title}</div>
                    <div className="small text-muted mb-2">{docType.description}</div>

                    {uploaded ? (
                      <>
                        <div className="d-flex align-items-center text-success small fw-semibold mb-1">
                          <i className="bi bi-check-circle-fill me-1" /> Uploaded Successfully
                        </div>
                        <div className="small text-truncate mb-1 text-dark" title={doc?.fileName || ""}>
                          <i className="bi bi-file-earmark me-1" /> {doc?.fileName || "Document"}
                        </div>
                        {doc?.uploadedAt && (
                          <div className="small text-muted mb-2">Uploaded on: {formatDate(doc.uploadedAt)}</div>
                        )}
                        {doc?.id && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success rounded-pill px-3"
                            onClick={() => handleDownloadDocument(doc.id!, doc.fileName || "document")}
                          >
                            <i className="bi bi-download me-1" /> Download File
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="small text-danger fw-medium fst-italic mt-2">
                        <i className="bi bi-exclamation-circle me-1" /> Not uploaded yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* GENERATED CAF FORMS HISTORY SECTION */}
      <div className="d-flex justify-content-between align-items-center mb-3 pt-3 border-top">
        <div>
          <h5 className="fw-bold mb-1">Generated CAF Forms</h5>
          <div className="text-muted small">Download or view previously generated Customer Application Forms</div>
        </div>
        <span className="badge bg-primary rounded-pill px-3 py-2">{cafHistory.length} Forms</span>
      </div>

      {cafHistory.length === 0 ? (
        <div className="text-center py-4 bg-light rounded-4 border border-light">
          <i className="bi bi-file-earmark-x fs-2 text-muted d-block mb-2"></i>
          <div className="text-muted small">No CAF forms have been generated for this subscriber yet.</div>
        </div>
      ) : (
        <div className="table-responsive border rounded-4 overflow-hidden">
          <table className="table table-hover align-middle mb-0 bg-white">
            <thead className="table-light">
              <tr>
                <th className="ps-4 py-3">CAF Number</th>
                <th>Generated Date & Time</th>
                <th className="text-end pe-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {cafHistory.map((caf) => (
                <tr key={caf.id}>
                  <td className="ps-4">
                    <span className="badge bg-primary-subtle text-primary fw-bold px-3 py-2">
                      CAF-{caf.cafNumber}
                    </span>
                  </td>
                  <td>
                    <span className="small text-secondary fw-medium">
                      {new Date(caf.generatedAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="text-end pe-4">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm"
                      onClick={() => handleOpenCafPdf(caf.id)}
                    >
                      <i className="bi bi-file-earmark-pdf-fill me-1" /> Open PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubscriberDocumentsTab;
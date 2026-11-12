import React, { useRef, useState } from "react";
import {
  FaCloudUploadAlt,
  FaDownload,
  FaFileExcel,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimes,
  FaUpload,
} from "react-icons/fa";
import apiClient from "../../services/api";

interface ImportError {
  row: number;
  message: string;
}

interface ImportResponse {
  message: string;
  imported: number;
  failed: number;
  errors: ImportError[];
}

const SubscriberExcelImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [dragging, setDragging] = useState(false);

  // ============================================================
  // DOWNLOAD EXCEL FORMAT
  // ============================================================
  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/Subscriber_Import_Template.xlsx";
    link.download = "Subscriber_Import_Template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ============================================================
  // SELECT FILE
  // ============================================================
  const selectFile = (selectedFile: File | null) => {
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      alert("Please select a valid .xlsx Excel file.");
      return;
    }

    setFile(selectedFile);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    selectFile(selectedFile);
  };

  // ============================================================
  // DRAG & DROP
  // ============================================================
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    selectFile(droppedFile || null);
  };

  // ============================================================
  // REMOVE FILE
  // ============================================================
  const removeFile = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ============================================================
  // UPLOAD
  // ============================================================
  const handleUpload = async () => {
    if (!file) {
      alert("Please select an Excel file first.");
      return;
    }

    try {
      setUploading(true);
      setResult(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<ImportResponse>(
        "/subscriber-import/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(response.data);

      window.dispatchEvent(
        new CustomEvent("subscribersImported")
      );

      if (response.data.imported > 0) {
        alert(`${response.data.imported} subscriber(s) imported successfully.`);
      }
      
      // NOTE: removeFile() yahan se hata diya gaya hai taaki dropdown/result gayab na ho.
    } catch (error: unknown) {
      console.error("Subscriber Excel import error:", error);
      const errObj = error as { response?: { data?: { message?: string } } };
      const message =
        errObj?.response?.data?.message ||
        "Failed to import subscribers.";
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // FORMAT FILE SIZE
  // ============================================================
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (
      Math.round((bytes / Math.pow(1024, i)) * 100) / 100 +
      " " +
      sizes[i]
    );
  };

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="row g-4">
      
      {/* ==================================================
          LEFT SIDE: Instructions & Download Button
      =================================================== */}
      <div className="col-md-6 d-flex flex-column gap-3 border-end pe-4">
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center rounded-3"
            style={{
              width: "48px",
              height: "48px",
              background: "rgba(25, 135, 84, 0.10)",
            }}
          >
            <FaFileExcel size={24} className="text-success" />
          </div>
          <div>
            <h6 className="fw-bold mb-1 text-dark">Import Subscribers</h6>
            <p className="text-muted small mb-0">
              Add multiple subscribers using an Excel file.
            </p>
          </div>
        </div>

        {/* DOWNLOAD BUTTON */}
        <button
          type="button"
          className="btn btn-outline-success rounded-pill px-4 fw-semibold w-100"
          onClick={handleDownloadTemplate}
        >
          <FaDownload className="me-2" />
          Download Excel Format
        </button>

        {/* INFO BOX */}
        <div
          className="p-3 rounded-3 mt-1"
          style={{
            background: "rgba(13, 110, 253, 0.05)",
            border: "1px solid rgba(13, 110, 253, 0.12)",
          }}
        >
          <div className="d-flex gap-2">
            <span className="text-primary fw-bold">ℹ</span>
            <div className="small text-secondary">
              <strong>Before uploading:</strong>
              <ul className="mb-0 mt-1 ps-3">
                <li>Download the Excel format first.</li>
                <li>Do not change the column names.</li>
                <li>
                  <strong>SiteId</strong> does not need to be entered. It is assigned automatically from your login.
                </li>
                <li>
                  NAS and Package can be provided using either <strong>ID</strong> or <strong>Name</strong>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================
          RIGHT SIDE: Drag & Drop Box & Results
      =================================================== */}
      <div className="col-md-6 ps-md-2 d-flex flex-column">
        
        {/* UPLOAD AREA */}
        <div
          className="rounded-4 p-4 text-center flex-grow-1 d-flex flex-column align-items-center justify-content-center"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          style={{
            cursor: file ? "default" : "pointer",
            border: dragging ? "2px dashed #198754" : "2px dashed #ced4da",
            background: dragging ? "rgba(25,135,84,0.05)" : "#fafafa",
            transition: "all 0.2s ease",
            minHeight: "220px",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="d-none"
            onChange={handleFileChange}
          />

          {!file && (
            <>
              <div
                className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle shadow-sm"
                style={{ width: "60px", height: "60px", background: "rgba(25,135,84,0.10)" }}
              >
                <FaCloudUploadAlt size={28} className="text-success" />
              </div>
              <h6 className="fw-bold mb-1">Drop your Excel file here</h6>
              <p className="text-muted small mb-2">or click to browse from your computer</p>
              <span className="badge bg-light text-secondary border px-3 py-1">
                .XLSX files only
              </span>
            </>
          )}

          {file && (
            <div onClick={(e) => e.stopPropagation()} className="w-100">
              <div className="d-flex align-items-center justify-content-center gap-3 mb-3">
                <div
                  className="d-flex align-items-center justify-content-center rounded-3"
                  style={{ width: "45px", height: "45px", background: "rgba(25,135,84,0.10)" }}
                >
                  <FaFileExcel size={24} className="text-success" />
                </div>
                <div className="text-start">
                  <div className="fw-semibold text-truncate" style={{ maxWidth: "160px" }}>{file.name}</div>
                  <div className="text-muted small">{formatFileSize(file.size)}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-light border rounded-circle ms-auto"
                  onClick={removeFile}
                  disabled={uploading}
                  style={{ width: "32px", height: "32px" }}
                >
                  <FaTimes />
                </button>
              </div>

              {!result && (
                <button
                  type="button"
                  className="btn btn-primary rounded-pill px-4 fw-semibold w-100"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FaUpload className="me-2" />
                      Upload & Import
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ==================================================
            RESULT SECTION
        =================================================== */}
        {result && (
          <div className="mt-3">
            <div
              className="p-3 rounded-3"
              style={{
                background: result.failed > 0 ? "rgba(255,193,7,0.08)" : "rgba(25,135,84,0.08)",
                border: result.failed > 0 ? "1px solid rgba(255,193,7,0.25)" : "1px solid rgba(25,135,84,0.20)",
              }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                {result.failed > 0 ? <FaExclamationTriangle className="text-warning" /> : <FaCheckCircle className="text-success" />}
                <strong>Import Completed</strong>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="bg-white rounded-3 p-2 border text-center">
                    <div className="text-muted small" style={{ fontSize: "11px" }}>Successfully Imported</div>
                    <div className="fs-5 fw-bold text-success">{result.imported}</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-white rounded-3 p-2 border text-center">
                    <div className="text-muted small" style={{ fontSize: "11px" }}>Failed Rows</div>
                    <div className="fs-5 fw-bold text-danger">{result.failed}</div>
                  </div>
                </div>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="mt-2">
                <h6 className="fw-bold text-danger small mb-1">Import Errors</h6>
                <div className="border rounded-3 overflow-auto" style={{ maxHeight: "120px" }}>
                  <table className="table table-sm mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="small">Row</th>
                        <th className="small">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((error, index) => (
                        <tr key={index}>
                          <td>
                            <span className="badge bg-danger bg-opacity-10 text-danger" style={{ fontSize: "10px" }}>
                              Row {error.row}
                            </span>
                          </td>
                          <td className="small text-muted">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <button 
              className="btn btn-outline-secondary btn-sm w-100 mt-2 rounded-pill fw-semibold"
              onClick={removeFile}
            >
              Upload Another File
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SubscriberExcelImport;
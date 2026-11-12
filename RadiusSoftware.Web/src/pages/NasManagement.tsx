import React, { useState, useEffect } from "react";
import { RouterLiveInfoModal } from "../components/RouterLiveInfoModal"; // 👈 Naya Standalone Modal Component
import { NasConfigureButton } from "../components/nas/NasConfigureButton";
import apiClient from "../services/api";

export const NasManagement: React.FC = () => {
  const [nasList, setNasList] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ✨ Live Stats Modal State
  const [selectedNasForLive, setSelectedNasForLive] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    id: "",
    siteId: "",
    nasName: "",
    nasType: "MikroTik",
    nasIpAddress: "",
    sharedSecret: "",
    coapPort: 3799,
    interimTime: 300,
    isEnabled: true,
    apiUsername: "",
    apiPassword: "",
    apiPort: 8728,
    winboxPort: 8291,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const resNas = await apiClient.get("/Nas/list");
      setNasList(resNas.data);
      const resSites = await apiClient.get("/Sites/list");
      setSites(resSites.data);
      if (resSites.data.length > 0 && !formData.siteId) {
        setFormData((prev) => ({ ...prev, siteId: resSites.data[0].id }));
      }
    } catch (err) {
      console.error("Error loading NAS data");
    }
  };

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

 const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        id: formData.id ? formData.id : "00000000-0000-0000-0000-000000000000",
        siteId: "00000000-0000-0000-0000-000000000000", // 🔥 Backend handle karega
        coapPort: Number(formData.coapPort),
        interimTime: Number(formData.interimTime),
        apiPort: Number(formData.apiPort),
        winboxPort: Number(formData.winboxPort),
      };

      await apiClient.post("/Nas/save", payload);
      setMessage("MikroTik NAS saved successfully!");
      setShowModal(false);
      fetchData();
      resetForm();
    } catch (err: any) {
      console.error(err.response?.data);
      alert("Failed to save NAS device. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const res = await apiClient.post(`/Nas/test-connection/${id}`);
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert("Connection test failed.");
    }
  };

  const handleEdit = (item: any) => {
    setIsEdit(true);
    setFormData({
      id: item.id,
      siteId: item.siteId,
      nasName: item.nasName,
      nasType: item.nasType,
      nasIpAddress: item.nasIpAddress,
      sharedSecret: item.sharedSecret,
      coapPort: item.coaPort,
      interimTime: item.interimTime,
      isEnabled: item.isEnabled,
      apiUsername: item.apiUsername,
      apiPassword: item.apiPassword,
      apiPort: item.apiPort,
      winboxPort: item.winboxPort,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this MikroTik NAS?")) return;
    await apiClient.delete(`/Nas/delete/${id}`);
    fetchData();
  };

  const resetForm = () => {
    setIsEdit(false);
    setFormData({
      id: "",
      siteId: sites[0]?.id || "",
      nasName: "",
      nasType: "MikroTik",
      nasIpAddress: "",
      sharedSecret: "",
      coapPort: 3799,
      interimTime: 300,
      isEnabled: true,
      apiUsername: "",
      apiPassword: "",
      apiPort: 8728,
      winboxPort: 8291,
    });
  };

  return (
    <div
      className="container-fluid py-3"
      style={{ background: "#f8fafc", minHeight: "90vh" }}
    >
     <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-4 rounded-4 shadow-sm border">
  <div>
    <h4 className="fw-bold text-brand mb-1">🗄️ MikroTik NAS Management</h4>
    <p className="text-muted small mb-0">
      Configure router IP, API credentials, and test live connection status.
    </p>
  </div>
  <button
    className="btn btn-brand px-4 fw-semibold rounded-pill shadow-sm"
    onClick={() => {
      resetForm();
      setShowModal(true);
    }}
  >
    + Add MikroTik Router
  </button>
</div>

      {message && <div className="alert alert-success">{message}</div>}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover">
            <thead className="bg-light text-secondary small text-uppercase">
              <tr>
                <th className="py-3 ps-4">Router Name</th>
                <th>IP Address</th>
                <th>API / Winbox</th>
                <th>Status</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {nasList.length > 0 ? (
                nasList.map((nas) => (
                  <tr key={nas.id} className="border-bottom">
                    <td className="ps-4 py-3">
                      <div className="fw-bold text-dark">{nas.nasName}</div>
                      <div className="text-primary small fw-semibold">
                        🏢 Site: {nas.site?.siteName || "N/A"}
                      </div>
                      <span
                        className="badge bg-secondary"
                        style={{ fontSize: "10px" }}
                      >
                        {nas.nasType}
                      </span>
                    </td>
                    <td>
                      <div className="font-monospace text-primary fw-semibold">
                        {nas.nasIpAddress}
                      </div>
                      <small className="text-muted">
                        Secret: {nas.sharedSecret}
                      </small>
                    </td>
                    <td>
                      <div className="small">
                        API: <strong>{nas.apiPort}</strong> | Winbox:{" "}
                        <strong>{nas.winboxPort}</strong>
                      </div>
                      <small className="text-muted">
                        User: {nas.apiUsername}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`badge px-3 py-2 rounded-pill ${nas.isOnline ? "bg-success" : "bg-danger"}`}
                      >
                        {nas.isOnline ? "🟢 Online" : "🔴 Offline"}
                      </span>
                    </td>
                   <td className="text-end pe-4">
  {/* Live Stats */}
  {nas.isOnline && (
    <button
      className="btn btn-sm btn-outline-success rounded-pill px-3 me-2 shadow-sm"
      onClick={() =>
        setSelectedNasForLive({
          id: nas.id,
          name: nas.nasName,
        })
      }
    >
      📊 Live Stats
    </button>
  )}

  {/* RADIUS Configure */}
  <NasConfigureButton
    nasId={nas.id}
    isConfigured={nas.isRadiusConfigured}
    onConfigured={fetchData}
  />

  {/* Test Connection */}
  <button
    className="btn btn-sm btn-outline-primary rounded-pill px-3 me-2"
    onClick={() => handleTestConnection(nas.id)}
  >
    ⚡ Test Connection
  </button>

  {/* Edit */}
  <button
    className="btn btn-sm btn-light border me-2 rounded-pill px-3"
    onClick={() => handleEdit(nas)}
  >
    ✏️ Edit
  </button>

  {/* Delete */}
  <button
    className="btn btn-sm btn-danger rounded-pill px-3"
    onClick={() => handleDelete(nas.id)}
  >
    🗑️ Delete
  </button>
</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    No NAS routers found. Add one to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Add / Edit */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{
            backgroundColor: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">
              <div className="modal-header bg-dark text-white px-4 py-3">
                <h5 className="modal-title fw-bold">
                  {isEdit ? " Edit NAS Router" : "Add MikroTik NAS"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div
                  className="modal-body p-4"
                  style={{ maxHeight: "75vh", overflowY: "auto" }}
                >
                 <div className="row g-3">
                    {/* Select Site Dropdown Removed completely as per backend auto-assignment */}
                    
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Router Name *
                      </label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        name="nasName"
                        value={formData.nasName}
                        onChange={handleChange}
                        required
                        placeholder="Main-MikroTik-01"
                      />
                    </div>
                    
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        NAS IP Address *
                      </label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        name="nasIpAddress"
                        value={formData.nasIpAddress}
                        onChange={handleChange}
                        required
                        placeholder="192.168.88.1"
                      />
                    </div>

                    <div className="col-md-12">
                      <label className="form-label small fw-semibold">
                        RADIUS Shared Secret *
                      </label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        name="sharedSecret"
                        value={formData.sharedSecret}
                        onChange={handleChange}
                        required
                        placeholder="radius_secret"
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        API Username *
                      </label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        name="apiUsername"
                        value={formData.apiUsername}
                        onChange={handleChange}
                        required
                        placeholder="admin"
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        API Password *
                      </label>
                      <input
                        type="password"
                        className="form-control rounded-3"
                        name="apiPassword"
                        value={formData.apiPassword}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        API Port
                      </label>
                      <input
                        type="number"
                        className="form-control rounded-3"
                        name="apiPort"
                        value={formData.apiPort}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        Winbox Port
                      </label>
                      <input
                        type="number"
                        className="form-control rounded-3"
                        name="winboxPort"
                        value={formData.winboxPort}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        CoA Port
                      </label>
                      <input
                        type="number"
                        className="form-control rounded-3"
                        name="coapPort"
                        value={formData.coapPort}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        Interim Time (Sec)
                      </label>
                      <input
                        type="number"
                        className="form-control rounded-3"
                        name="interimTime"
                        value={formData.interimTime}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light px-4 py-3">
  <button
    type="button"
    className="btn btn-light border px-4 rounded-pill"
    onClick={() => setShowModal(false)}
  >
    Cancel
  </button>
  <button
    type="submit"
    className="btn btn-brand px-4 rounded-pill shadow-sm"
    disabled={loading}
  >
    {loading ? "Saving..." : "💾 Save Router Details"}
  </button>
</div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Standalone Live Stats Modal Component */}
      {selectedNasForLive && (
        <RouterLiveInfoModal
          nasId={selectedNasForLive.id}
          nasName={selectedNasForLive.name}
          onClose={() => setSelectedNasForLive(null)}
        />
      )}
    </div>
  );
};

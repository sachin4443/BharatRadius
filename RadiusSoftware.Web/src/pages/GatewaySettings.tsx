import React, { useEffect, useState } from "react";
import apiClient from "../services/api";
import { apiError, currentLevel, formatDate } from "../utils/format";

type Tab = "sms" | "payment" | "logs";

const emptySms = {
  id: "",
  siteId: "",
  providerName: "Custom",
  apiUrl: "",
  httpMethod: "GET",
  postBodyTemplate: "",
  contentType: "application/json",
  apiKey: "",
  senderId: "",
  successKeyword: "",
  sendOnRecharge: true,
  sendExpiryReminder: true,
  reminderDaysBefore: 3,
  sendOnExpiry: true,
  rechargeTemplate: "",
  reminderTemplate: "",
  expiredTemplate: "",
  rechargeTemplateId: "",
  reminderTemplateId: "",
  expiredTemplateId: "",
  isActive: true,
};

const emptyPayment = {
  id: "",
  siteId: "",
  provider: "Razorpay",
  displayName: "",
  mode: "TEST",
  merchantId: "",
  apiKey: "",
  apiSecret: "",
  saltOrWebhookSecret: "",
  callbackUrl: "",
  isActive: true,
  isDefault: true,
};

/**
 * L1 master: SMS gateway (recharge SMS, expiry reminders) and payment gateway keys.
 * A setting can be the default for all sites or for one particular site.
 */
const GatewaySettings: React.FC = () => {
  const level = currentLevel();
  const allowed = level === "L0" || level === "L1";
  const [tab, setTab] = useState<Tab>("sms");
  const [sites, setSites] = useState<any[]>([]);
  const [smsList, setSmsList] = useState<any[]>([]);
  const [payList, setPayList] = useState<any[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [logs, setLogs] = useState<any | null>(null);
  const [smsForm, setSmsForm] = useState<any | null>(null);
  const [payForm, setPayForm] = useState<any | null>(null);
  const [testFor, setTestFor] = useState<any | null>(null);
  const [testMobile, setTestMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [s, sms, pay, prov] = await Promise.all([
        apiClient.get("/Sites/list"),
        apiClient.get("/Gateways/sms"),
        apiClient.get("/Gateways/payment"),
        apiClient.get("/Gateways/payment/providers"),
      ]);
      setSites(Array.isArray(s.data) ? s.data : s.data?.data ?? []);
      setSmsList(sms.data ?? []);
      setPayList(pay.data ?? []);
      setProviders(prov.data ?? []);
      setError("");
    } catch (err) {
      setError(apiError(err, "Unable to load settings."));
    }
  };

  useEffect(() => {
    if (allowed) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "logs" && allowed) {
      apiClient.get("/Gateways/sms/logs").then((r) => setLogs(r.data)).catch((err) => setError(apiError(err, "Unable to load SMS log.")));
    }
  }, [tab, allowed]);

  if (!allowed) {
    return <div className="alert alert-warning m-3">Only L1 admins can manage SMS and payment gateway settings.</div>;
  }

  const saveSms = async () => {
    setBusy(true);
    try {
      await apiClient.post("/Gateways/sms", { ...smsForm, id: smsForm.id || null, siteId: smsForm.siteId || null });
      setSmsForm(null);
      setMessage("SMS gateway saved.");
      load();
    } catch (err) {
      alert(apiError(err, "Unable to save."));
    } finally {
      setBusy(false);
    }
  };

  const savePay = async () => {
    setBusy(true);
    try {
      await apiClient.post("/Gateways/payment", { ...payForm, id: payForm.id || null, siteId: payForm.siteId || null });
      setPayForm(null);
      setMessage("Payment gateway saved.");
      load();
    } catch (err) {
      alert(apiError(err, "Unable to save."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (kind: "sms" | "payment", id: string) => {
    if (!confirm("Delete this setting?")) return;
    try {
      await apiClient.delete(`/Gateways/${kind}/${id}`);
      load();
    } catch (err) {
      alert(apiError(err, "Unable to delete."));
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post(`/Gateways/sms/${testFor.id}/test`, { mobile: testMobile });
      alert(res.data?.message || "SMS sent.");
      setTestFor(null);
    } catch (err) {
      alert(apiError(err, "Test SMS failed."));
    } finally {
      setBusy(false);
    }
  };

  const siteSelect = (value: string, onChange: (v: string) => void) => (
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All sites (default)</option>
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.siteName} {s.siteLevel ? `(L${s.siteLevel})` : ""}
        </option>
      ))}
    </select>
  );

  const field = (form: any, set: (f: any) => void, key: string, label: string, props: any = {}) => (
    <div className={props.col || "col-12 col-md-6"}>
      <label className="form-label small fw-semibold mb-1">{label}</label>
      <input
        className="form-control form-control-sm"
        value={form[key] ?? ""}
        onChange={(e) => set({ ...form, [key]: e.target.value })}
        {...(props.input || {})}
      />
      {props.help && <div className="form-text">{props.help}</div>}
    </div>
  );

  const check = (form: any, set: (f: any) => void, key: string, label: string) => (
    <label className="d-flex align-items-center gap-2 small me-3">
      <input type="checkbox" className="form-check-input mt-0" checked={!!form[key]} onChange={(e) => set({ ...form, [key]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <div className="container-fluid py-2 px-0 px-md-3">
      <div className="bg-white border rounded-4 shadow-sm p-3 p-md-4 mb-3">
        <h4 className="fw-bold text-brand mb-1">💳 SMS & Payment Gateway</h4>
        <div className="small text-muted">
          Set the API keys once for all your sites, or separately for a site. A site uses its own setting first, then its parent's, then the default.
        </div>
      </div>

      <ul className="nav nav-pills mb-3 gap-1 flex-nowrap overflow-auto">
        {([["sms", "📱 SMS Gateway"], ["payment", "💳 Payment Gateway"], ["logs", "🧾 SMS Log"]] as [Tab, string][]).map(([k, l]) => (
          <li key={k} className="nav-item">
            <button className={`nav-link text-nowrap ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
          </li>
        ))}
      </ul>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {message && <div className="alert alert-success py-2 small" onClick={() => setMessage("")}>{message}</div>}

      {tab === "sms" && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex justify-content-between mb-2">
              <h6 className="fw-bold mb-0">SMS gateways</h6>
              <button className="btn btn-sm btn-brand rounded-pill px-3" onClick={() => setSmsForm({ ...emptySms })}>+ Add</button>
            </div>
            <div className="table-responsive">
              <table className="table table-sm small align-middle mb-0">
                <thead className="table-light">
                  <tr><th>For</th><th>Provider</th><th className="d-none d-md-table-cell">API URL</th><th>API key</th><th>Sends</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {smsList.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-3">No SMS gateway configured.</td></tr>}
                  {smsList.map((c) => (
                    <tr key={c.id}>
                      <td>{c.siteName}</td>
                      <td>{c.providerName}</td>
                      <td className="d-none d-md-table-cell text-truncate" style={{ maxWidth: 260 }}>{c.apiUrl}</td>
                      <td className="font-monospace">{c.apiKeyMasked || "—"}</td>
                      <td>
                        {[c.sendOnRecharge && "Recharge", c.sendExpiryReminder && `Reminder (${c.reminderDaysBefore}d)`, c.sendOnExpiry && "Expired"].filter(Boolean).join(", ")}
                      </td>
                      <td>{c.isActive ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Off</span>}</td>
                      <td className="text-end text-nowrap">
                        <button className="btn btn-sm btn-light border me-1" onClick={() => { setTestFor(c); setTestMobile(""); }}>Test</button>
                        <button className="btn btn-sm btn-light border me-1" onClick={() => setSmsForm({ ...emptySms, ...c, siteId: c.siteId || "", apiKey: "" })}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => remove("sms", c.id)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "payment" && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex justify-content-between mb-2">
              <h6 className="fw-bold mb-0">Payment gateways</h6>
              <button className="btn btn-sm btn-brand rounded-pill px-3" onClick={() => setPayForm({ ...emptyPayment })}>+ Add</button>
            </div>
            <div className="table-responsive">
              <table className="table table-sm small align-middle mb-0">
                <thead className="table-light">
                  <tr><th>For</th><th>Provider</th><th>Mode</th><th>Key / Merchant</th><th>Secret</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {payList.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-3">No payment gateway configured.</td></tr>}
                  {payList.map((c) => (
                    <tr key={c.id}>
                      <td>{c.siteName}</td>
                      <td>{c.displayName || c.provider} {c.isDefault && <span className="badge bg-info-subtle text-info-emphasis border ms-1">Default</span>}</td>
                      <td><span className={`badge ${c.mode === "LIVE" ? "bg-danger" : "bg-secondary"}`}>{c.mode}</span></td>
                      <td className="font-monospace text-truncate" style={{ maxWidth: 180 }}>{c.apiKey || c.merchantId}</td>
                      <td className="font-monospace">{c.apiSecretMasked || "—"}</td>
                      <td>{c.isActive ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Off</span>}</td>
                      <td className="text-end text-nowrap">
                        <button className="btn btn-sm btn-light border me-1" onClick={() => setPayForm({ ...emptyPayment, ...c, siteId: c.siteId || "", apiSecret: "", saltOrWebhookSecret: "" })}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => remove("payment", c.id)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-sm small align-middle mb-0">
                <thead className="table-light">
                  <tr><th>Date</th><th>Mobile</th><th>Type</th><th>Status</th><th className="d-none d-md-table-cell">Message</th></tr>
                </thead>
                <tbody>
                  {(logs?.items ?? []).length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No SMS sent yet.</td></tr>}
                  {(logs?.items ?? []).map((l: any) => (
                    <tr key={l.id}>
                      <td className="text-nowrap">{formatDate(l.createdAt, true)}</td>
                      <td>{l.mobile}</td>
                      <td>{l.purpose}</td>
                      <td>
                        <span className={`badge ${l.status === "SENT" ? "bg-success" : "bg-danger"}`} title={l.providerResponse || ""}>{l.status}</span>
                      </td>
                      <td className="d-none d-md-table-cell text-truncate" style={{ maxWidth: 420 }}>{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SMS FORM */}
      {smsForm && (
        <div className="modal show d-block" style={{ background: "rgba(15,23,42,.5)", zIndex: 1060 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header">
                <h6 className="modal-title fw-bold">{smsForm.id ? "Edit" : "Add"} SMS gateway</h6>
                <button className="btn-close" onClick={() => setSmsForm(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold mb-1">Applies to</label>
                    {siteSelect(smsForm.siteId, (v) => setSmsForm({ ...smsForm, siteId: v }))}
                  </div>
                  {field(smsForm, setSmsForm, "providerName", "Provider name", { input: { placeholder: "e.g. MSG91, Fast2SMS, TextLocal" } })}
                  {field(smsForm, setSmsForm, "apiUrl", "API URL", {
                    col: "col-12",
                    input: { placeholder: "https://provider.com/send?apikey={apikey}&sender={senderid}&to={mobile}&msg={message}&template={templateid}" },
                    help: "Placeholders: {mobile} {message} {apikey} {senderid} {templateid}",
                  })}
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold mb-1">Method</label>
                    <select className="form-select form-select-sm" value={smsForm.httpMethod} onChange={(e) => setSmsForm({ ...smsForm, httpMethod: e.target.value })}>
                      <option>GET</option>
                      <option>POST</option>
                    </select>
                  </div>
                  {field(smsForm, setSmsForm, "senderId", "Sender ID", { col: "col-6 col-md-3" })}
                  {field(smsForm, setSmsForm, "apiKey", "API key", {
                    input: { type: "password", placeholder: smsForm.id ? "(unchanged)" : "" },
                    help: smsForm.id ? "Leave empty to keep the saved key." : undefined,
                  })}
                  {smsForm.httpMethod === "POST" && (
                    <>
                      {field(smsForm, setSmsForm, "contentType", "Content type", { col: "col-12 col-md-4" })}
                      <div className="col-12 col-md-8">
                        <label className="form-label small fw-semibold mb-1">POST body</label>
                        <textarea className="form-control form-control-sm" rows={3} value={smsForm.postBodyTemplate || ""}
                          placeholder='{"to":"{mobile}","text":"{message}","sender":"{senderid}"}'
                          onChange={(e) => setSmsForm({ ...smsForm, postBodyTemplate: e.target.value })} />
                      </div>
                    </>
                  )}
                  {field(smsForm, setSmsForm, "successKeyword", "Success word in reply (optional)", { input: { placeholder: "e.g. success" } })}

                  <div className="col-12 mt-2">
                    <div className="fw-semibold small mb-1">Send SMS</div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      {check(smsForm, setSmsForm, "sendOnRecharge", "On recharge")}
                      {check(smsForm, setSmsForm, "sendExpiryReminder", "Expiry reminder")}
                      <input type="number" min={0} max={30} className="form-control form-control-sm" style={{ width: 70 }}
                        value={smsForm.reminderDaysBefore} onChange={(e) => setSmsForm({ ...smsForm, reminderDaysBefore: Number(e.target.value) })} />
                      <span className="small me-3">days before</span>
                      {check(smsForm, setSmsForm, "sendOnExpiry", "When expired")}
                      {check(smsForm, setSmsForm, "isActive", "Active")}
                    </div>
                  </div>

                  <div className="col-12 mt-2 small text-muted">
                    Message placeholders: {"{name} {username} {package} {expiry} {amount} {company}"}. Leave empty for the default text.
                  </div>
                  {[["rechargeTemplate", "rechargeTemplateId", "Recharge message"], ["reminderTemplate", "reminderTemplateId", "Reminder message"], ["expiredTemplate", "expiredTemplateId", "Expired message"]].map(([k, id, label]) => (
                    <React.Fragment key={k}>
                      <div className="col-12 col-md-9">
                        <label className="form-label small fw-semibold mb-1">{label}</label>
                        <textarea className="form-control form-control-sm" rows={2} value={smsForm[k] || ""} onChange={(e) => setSmsForm({ ...smsForm, [k]: e.target.value })} />
                      </div>
                      {field(smsForm, setSmsForm, id, "DLT template ID", { col: "col-12 col-md-3" })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light border rounded-pill" onClick={() => setSmsForm(null)}>Close</button>
                <button className="btn btn-brand rounded-pill px-4" disabled={busy} onClick={saveSms}>{busy ? "Saving..." : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT FORM */}
      {payForm && (
        <div className="modal show d-block" style={{ background: "rgba(15,23,42,.5)", zIndex: 1060 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-header">
                <h6 className="modal-title fw-bold">{payForm.id ? "Edit" : "Add"} payment gateway</h6>
                <button className="btn-close" onClick={() => setPayForm(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold mb-1">Applies to</label>
                    {siteSelect(payForm.siteId, (v) => setPayForm({ ...payForm, siteId: v }))}
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold mb-1">Provider</label>
                    <select className="form-select form-select-sm" value={payForm.provider} onChange={(e) => setPayForm({ ...payForm, provider: e.target.value })}>
                      {providers.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold mb-1">Mode</label>
                    <select className="form-select form-select-sm" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                      <option value="TEST">Test</option>
                      <option value="LIVE">Live</option>
                    </select>
                  </div>
                  {field(payForm, setPayForm, "displayName", "Display name")}
                  {field(payForm, setPayForm, "merchantId", "Merchant ID")}
                  {field(payForm, setPayForm, "apiKey", "API key / Key ID")}
                  {field(payForm, setPayForm, "apiSecret", "API secret", {
                    input: { type: "password", placeholder: payForm.id ? "(unchanged)" : "" },
                    help: payForm.id ? "Leave empty to keep the saved secret." : undefined,
                  })}
                  {field(payForm, setPayForm, "saltOrWebhookSecret", "Salt / Webhook secret", {
                    input: { type: "password", placeholder: payForm.id ? "(unchanged)" : "" },
                  })}
                  {field(payForm, setPayForm, "callbackUrl", "Callback URL (optional)")}
                  <div className="col-12 d-flex gap-3 mt-2">
                    {check(payForm, setPayForm, "isActive", "Active")}
                    {check(payForm, setPayForm, "isDefault", "Default gateway")}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light border rounded-pill" onClick={() => setPayForm(null)}>Close</button>
                <button className="btn btn-brand rounded-pill px-4" disabled={busy} onClick={savePay}>{busy ? "Saving..." : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEST SMS */}
      {testFor && (
        <div className="modal show d-block" style={{ background: "rgba(15,23,42,.5)", zIndex: 1060 }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content border-0 rounded-4">
              <div className="modal-body">
                <h6 className="fw-bold">Send test SMS</h6>
                <input className="form-control" placeholder="Mobile number" value={testMobile} onChange={(e) => setTestMobile(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-light border rounded-pill" onClick={() => setTestFor(null)}>Close</button>
                <button className="btn btn-brand rounded-pill" disabled={busy || testMobile.length < 10} onClick={sendTest}>Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GatewaySettings;

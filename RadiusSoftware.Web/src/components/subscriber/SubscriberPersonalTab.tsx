import React, { useEffect, useState } from "react";
import apiClient from "../../services/api";

interface Props {
  subscriber: any;
  onSaved?: (subscriber: any) => void;
}

const SubscriberPersonalTab: React.FC<Props> = ({
  subscriber,
  onSaved,
}) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
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
  });

  useEffect(() => {
    if (!subscriber) return;

    setForm({
      id: subscriber.id ?? "",
      siteId: subscriber.siteId ?? "",
      nasId: subscriber.nasId ?? "",
      packageId: subscriber.packageId ?? "",

      subscriberType:
        subscriber.subscriberType ?? "Individual",

      fullName: subscriber.fullName ?? "",
      companyName: subscriber.companyName ?? "",
      mobile: subscriber.mobile ?? "",
      email: subscriber.email ?? "",

      portalUsername:
        subscriber.portalUsername ?? "",

      portalPassword:
        subscriber.portalPassword ?? "",

      address: subscriber.address ?? "",
      zip: subscriber.zip ?? "",
      city: subscriber.city ?? "",
      state: subscriber.state ?? "",

      gstNo: subscriber.gstNo ?? "",
      comment: subscriber.comment ?? "",

      service: subscriber.service ?? "PPPoE",

      pppoeUsername:
        subscriber.pppoeUsername ?? "",

      pppoePassword:
        subscriber.pppoePassword ?? "",

      macAddress:
        subscriber.macAddress ?? "",

      staticIp:
        subscriber.staticIp ?? "",

      connectionEnabled:
        subscriber.connectionEnabled ?? true,

      isActive:
        subscriber.isActive ?? true,
    });
  }, [subscriber]);

  const updateField = (
    field: string,
    value: any,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCancel = () => {
    if (!subscriber) return;

    setForm({
      id: subscriber.id ?? "",
      siteId: subscriber.siteId ?? "",
      nasId: subscriber.nasId ?? "",
      packageId: subscriber.packageId ?? "",

      subscriberType:
        subscriber.subscriberType ?? "Individual",

      fullName: subscriber.fullName ?? "",
      companyName: subscriber.companyName ?? "",
      mobile: subscriber.mobile ?? "",
      email: subscriber.email ?? "",

      portalUsername:
        subscriber.portalUsername ?? "",

      portalPassword:
        subscriber.portalPassword ?? "",

      address: subscriber.address ?? "",
      zip: subscriber.zip ?? "",
      city: subscriber.city ?? "",
      state: subscriber.state ?? "",

      gstNo: subscriber.gstNo ?? "",
      comment: subscriber.comment ?? "",

      service: subscriber.service ?? "PPPoE",

      pppoeUsername:
        subscriber.pppoeUsername ?? "",

      pppoePassword:
        subscriber.pppoePassword ?? "",

      macAddress:
        subscriber.macAddress ?? "",

      staticIp:
        subscriber.staticIp ?? "",

      connectionEnabled:
        subscriber.connectionEnabled ?? true,

      isActive:
        subscriber.isActive ?? true,
    });

    setEditing(false);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      alert("Full Name is required.");
      return;
    }

    if (!form.mobile.trim()) {
      alert("Mobile number is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,

        id:
          form.id ||
          "00000000-0000-0000-0000-000000000000",

        nasId: form.nasId || null,
        packageId: form.packageId || null,

        fullName: form.fullName.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),

        companyName:
          form.companyName?.trim() ?? "",

        address:
          form.address?.trim() ?? "",

        zip:
          form.zip?.trim() ?? "",

        city:
          form.city?.trim() ?? "",

        state:
          form.state?.trim() ?? "",

        gstNo:
          form.gstNo?.trim() ?? "",

        comment:
          form.comment?.trim() ?? "",

        portalUsername:
          form.portalUsername?.trim() ?? "",

        service:
          form.service || "PPPoE",

        pppoeUsername:
          form.pppoeUsername?.trim() ?? "",

        macAddress:
          form.macAddress?.trim() ?? "",

        staticIp:
          form.staticIp?.trim() ?? "",

        connectionEnabled:
          Boolean(form.connectionEnabled),

        isActive:
          Boolean(form.isActive),
      };

      const response = await apiClient.post(
        "/Subscribers/save",
        payload,
      );

      const savedSubscriber =
        response.data?.data ??
        response.data;

      setEditing(false);

      onSaved?.(savedSubscriber);

      alert(
        response.data?.message ||
          "Subscriber personal information updated successfully.",
      );
    } catch (error: any) {
      console.error(
        "Subscriber personal information update failed:",
        error,
      );

      alert(
        error?.response?.data?.message ||
          "Unable to update subscriber information.",
      );
    } finally {
      setSaving(false);
    }
  };

  const ReadOnlyRow = ({
    label,
    value,
  }: {
    label: string;
    value: any;
  }) => (
    <div className="d-flex justify-content-between align-items-center py-3 border-bottom">
      <div className="text-muted small">
        {label}
      </div>

      <div className="fw-semibold text-dark text-end">
        {value || "-"}
      </div>
    </div>
  );

  const Input = ({
    label,
    field,
    type = "text",
    placeholder = "",
  }: {
    label: string;
    field: string;
    type?: string;
    placeholder?: string;
  }) => (
    <div className="col-md-6">
      <label className="form-label fw-semibold small text-dark">
        {label}
      </label>

      <input
        type={type}
        className="form-control rounded-3"
        value={(form as any)[field] ?? ""}
        placeholder={placeholder}
        onChange={(e) =>
          updateField(field, e.target.value)
        }
      />
    </div>
  );

  if (!subscriber) {
    return null;
  }

  return (
    <div>
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="fw-bold mb-1">
            👤 Personal Information
          </h5>

          <div className="text-muted small">
            Manage subscriber personal and contact details.
          </div>
        </div>

        {!editing ? (
          <button
            type="button"
            className="btn btn-primary rounded-pill px-4"
            onClick={() => setEditing(true)}
          >
            ✏️ Edit Information
          </button>
        ) : (
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-light border rounded-pill px-4"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn-primary rounded-pill px-4"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  />
                  Saving...
                </>
              ) : (
                <>💾 Save Changes</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* =====================================================
          EDIT MODE
      ===================================================== */}

      {editing ? (
        <div className="row g-4">
          {/* PERSONAL */}

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4">
                  👤 Basic Information
                </h6>

                <div className="row g-3">
                  <Input
                    label="Full Name"
                    field="fullName"
                    placeholder="Enter full name"
                  />

                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">
                      Subscriber Type
                    </label>

                    <select
                      className="form-select rounded-3"
                      value={form.subscriberType}
                      onChange={(e) =>
                        updateField(
                          "subscriberType",
                          e.target.value,
                        )
                      }
                    >
                      <option value="Individual">
                        Individual
                      </option>

                      <option value="Corporate">
                        Corporate
                      </option>
                    </select>
                  </div>

                  <Input
                    label="Company Name"
                    field="companyName"
                    placeholder="Company name"
                  />

                  <Input
                    label="Mobile"
                    field="mobile"
                    type="tel"
                    placeholder="Mobile number"
                  />

                  <Input
                    label="Email"
                    field="email"
                    type="email"
                    placeholder="Email address"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PORTAL */}

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4">
                  🔐 Portal Account
                </h6>

                <div className="row g-3">
                  <Input
                    label="Portal Username"
                    field="portalUsername"
                    placeholder="Portal username"
                  />

                  <Input
                    label="Portal Password"
                    field="portalPassword"
                    type="password"
                    placeholder="Portal password"
                  />
                </div>

                <div className="alert alert-light border mt-4 mb-0 small">
                  Portal credentials are separate from the
                  PPPoE authentication credentials.
                </div>
              </div>
            </div>
          </div>

          {/* ADDRESS */}

          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4">
                  📍 Address Information
                </h6>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold small">
                      Address
                    </label>

                    <textarea
                      className="form-control rounded-3"
                      rows={3}
                      value={form.address}
                      placeholder="Complete address"
                      onChange={(e) =>
                        updateField(
                          "address",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <Input
                    label="Pincode"
                    field="zip"
                    placeholder="Pincode"
                  />

                  <Input
                    label="City"
                    field="city"
                    placeholder="City"
                  />

                  <Input
                    label="State"
                    field="state"
                    placeholder="State"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BILLING */}

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4">
                  🧾 Billing Information
                </h6>

                <div className="mb-3">
                  <label className="form-label fw-semibold small">
                    GST Number
                  </label>

                  <input
                    className="form-control rounded-3"
                    value={form.gstNo}
                    placeholder="GST number"
                    onChange={(e) =>
                      updateField(
                        "gstNo",
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div>
                  <label className="form-label fw-semibold small">
                    Comment
                  </label>

                  <textarea
                    className="form-control rounded-3"
                    rows={4}
                    value={form.comment}
                    placeholder="Internal notes / comments"
                    onChange={(e) =>
                      updateField(
                        "comment",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ACCOUNT STATUS */}

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4">
                  ⚡ Account Status
                </h6>

                <div className="d-flex justify-content-between align-items-center border rounded-3 p-3 mb-3">
                  <div>
                    <div className="fw-semibold">
                      Account Active
                    </div>

                    <div className="text-muted small">
                      Subscriber account can be used.
                    </div>
                  </div>

                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        updateField(
                          "isActive",
                          e.target.checked,
                        )
                      }
                      style={{
                        width: 45,
                        height: 22,
                      }}
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center border rounded-3 p-3">
                  <div>
                    <div className="fw-semibold">
                      Connection Enabled
                    </div>

                    <div className="text-muted small">
                      Allows PPPoE/RADIUS authentication.
                    </div>
                  </div>

                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={form.connectionEnabled}
                      onChange={(e) =>
                        updateField(
                          "connectionEnabled",
                          e.target.checked,
                        )
                      }
                      style={{
                        width: 45,
                        height: 22,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =====================================================
           READ ONLY MODE
        ===================================================== */

        <div className="row g-4">
          {/* BASIC */}

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3">
                  👤 Basic Information
                </h6>

                <ReadOnlyRow
                  label="Full Name"
                  value={subscriber.fullName}
                />

                <ReadOnlyRow
                  label="Subscriber Type"
                  value={subscriber.subscriberType}
                />

                <ReadOnlyRow
                  label="Company Name"
                  value={subscriber.companyName}
                />

                <ReadOnlyRow
                  label="Mobile"
                  value={subscriber.mobile}
                />

                <ReadOnlyRow
                  label="Email"
                  value={subscriber.email}
                />
              </div>
            </div>
          </div>

          {/* PORTAL */}

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3">
                  🔐 Portal Account
                </h6>

                <ReadOnlyRow
                  label="Username"
                  value={subscriber.portalUsername}
                />

                <ReadOnlyRow
                  label="Password"
                  value={
                    subscriber.portalPassword
                      ? "••••••••"
                      : "-"
                  }
                />

                <div className="alert alert-light border mt-3 mb-0 small">
                  Password is hidden for security.
                </div>
              </div>
            </div>
          </div>

          {/* ADDRESS */}

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3">
                  📍 Address
                </h6>

                <ReadOnlyRow
                  label="Address"
                  value={subscriber.address}
                />

                <ReadOnlyRow
                  label="Pincode"
                  value={subscriber.zip}
                />

                <ReadOnlyRow
                  label="City"
                  value={subscriber.city}
                />

                <ReadOnlyRow
                  label="State"
                  value={subscriber.state}
                />
              </div>
            </div>
          </div>

          {/* BILLING */}

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3">
                  🧾 Billing
                </h6>

                <ReadOnlyRow
                  label="GST Number"
                  value={subscriber.gstNo}
                />

                <ReadOnlyRow
                  label="Comment"
                  value={subscriber.comment}
                />

                <ReadOnlyRow
                  label="Created"
                  value={
                    subscriber.createdAt
                      ? new Date(
                          subscriber.createdAt,
                        ).toLocaleString()
                      : "-"
                  }
                />

                <ReadOnlyRow
                  label="Last Updated"
                  value={
                    subscriber.updatedAt
                      ? new Date(
                          subscriber.updatedAt,
                        ).toLocaleString()
                      : "-"
                  }
                />
              </div>
            </div>
          </div>

          {/* STATUS */}

          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3">
                  ⚡ Account Status
                </h6>

                <div className="d-flex flex-wrap gap-3">
                  <span
                    className={`badge rounded-pill px-3 py-2 ${
                      subscriber.isActive
                        ? "bg-success"
                        : "bg-danger"
                    }`}
                  >
                    {subscriber.isActive
                      ? "● ACCOUNT ACTIVE"
                      : "● ACCOUNT DISABLED"}
                  </span>

                  <span
                    className={`badge rounded-pill px-3 py-2 ${
                      subscriber.connectionEnabled
                        ? "bg-primary"
                        : "bg-secondary"
                    }`}
                  >
                    {subscriber.connectionEnabled
                      ? "● CONNECTION ENABLED"
                      : "● CONNECTION DISABLED"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriberPersonalTab;
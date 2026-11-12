import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../services/api";

// --- TypeScript Interfaces (Removed all 'any' types) ---
interface Organization {
  id: string;
  name: string;
}

interface Menu {
  id: string;
  code: string;
  title: string;
  route: string;
  icon: string;
  parentMenuCode: string | null;
}

interface RoleMenuPermission {
  menuId: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  isMyRole?: boolean;
  roleMenuPermissions: RoleMenuPermission[];
  menus: string[];
}

interface AppUser {
  id: string;
  fullName: string;
  email: string;
}

interface RbacOrg {
  id: string;
  name: string;
  type: string;
  level: number;
  users: AppUser[];
  roles: Role[];
}

interface SetupData {
  roles: Role[];
  menus: Menu[];
  users: AppUser[];
}

export const UserManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [setupData, setSetupData] = useState<SetupData>({ roles: [], menus: [], users: [] });
  const [rbacTree, setRbacTree] = useState<RbacOrg[]>([]);
  const [activeTab, setActiveTab] = useState<"matrix" | "assign" | "tree">("matrix");

  // Role Form State
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);

  // Assign Role State
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [assignRoleId, setAssignRoleId] = useState<string>("");

  const [message, setMessage] = useState<string>("");

  // --- 1. Core Functions (Declared BEFORE useEffect to fix "accessed before declared" error) ---
  const resetRoleForm = useCallback(() => {
    setIsEditMode(false);
    setEditingRoleId(null);
    setRoleName("");
    setDescription("");
    setSelectedMenuIds([]);
  }, []);

  const fetchSetup = useCallback(async (orgId: string) => {
    if (!orgId) return;
    try {
      const res = await apiClient.get(`/RoleManagement/company-setup/${orgId}`);
      setSetupData(res.data);
    } catch (err) {
      console.error("Error fetching company setup", err);
    }
  }, []);

  // --- 2. Effects ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const orgRes = await apiClient.get("/Organizations/list");
        setOrganizations(orgRes.data);
        if (orgRes.data.length > 0) setSelectedOrgId(orgRes.data[0].id);
        const treeRes = await apiClient.get("/RoleManagement/rbac-tree");
        setRbacTree(treeRes.data);
      } catch (err) {
        console.error("Error fetching initial RBAC data", err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    // FIX: Wrapped in async function to prevent cascading render error
    const loadCompanySetup = async () => {
      if (selectedOrgId) {
        await fetchSetup(selectedOrgId);
        resetRoleForm();
      }
    };
    loadCompanySetup();
  }, [selectedOrgId, fetchSetup, resetRoleForm]);

  // --- 3. Event Handlers ---
  const handleMenuToggle = (menu: Menu, isChecked: boolean) => {
    let newSelection = [...selectedMenuIds];

    if (isChecked) {
      if (!newSelection.includes(menu.id)) newSelection.push(menu.id);

      const subMenus = setupData.menus.filter((m) => m.parentMenuCode === menu.code);
      subMenus.forEach((sub) => {
        if (!newSelection.includes(sub.id)) newSelection.push(sub.id);
      });
    } else {
      newSelection = newSelection.filter((id) => id !== menu.id);

      const subMenus = setupData.menus.filter((m) => m.parentMenuCode === menu.code);
      subMenus.forEach((sub) => {
        newSelection = newSelection.filter((id) => id !== sub.id);
      });
    }
    setSelectedMenuIds(newSelection);
  };

  const handleEditRole = (role: Role) => {
    setIsEditMode(true);
    setEditingRoleId(role.id);
    setRoleName(role.name);
    setDescription(role.description || "");
    setSelectedMenuIds(role.roleMenuPermissions.map((rpm) => rpm.menuId));
  };

  const handleDeleteRole = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    try {
      await apiClient.delete(`/RoleManagement/delete-role/${id}`);
      setMessage("Role deleted successfully!");
      fetchSetup(selectedOrgId);
    } catch (err) {
      console.error(err); // FIX: logged unused err variable
      alert("Failed to delete role.");
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        organizationId: selectedOrgId,
        roleName,
        description,
        menuIds: selectedMenuIds,
      };
      if (isEditMode && editingRoleId) {
        await apiClient.put(`/RoleManagement/update-role/${editingRoleId}`, payload);
        setMessage("Role updated successfully!");
      } else {
        await apiClient.post("/RoleManagement/save-role", payload);
        setMessage("Role created successfully!");
      }
      resetRoleForm();
      fetchSetup(selectedOrgId);
    } catch (err: unknown) {
      const errorData = err as { response?: { data?: { message?: string } } };
      console.error(err);
      alert(errorData.response?.data?.message || "Failed to save role.");
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/RoleManagement/assign-role", {
        userId: assignUserId,
        roleId: assignRoleId,
      });
      setMessage("Role assigned to user successfully!");
      setAssignUserId("");
      setAssignRoleId("");
    } catch (err) {
      console.error(err);
      alert("Failed to assign role.");
    }
  };

  const renderMenus = (parentCode: string | null = null, depth: number = 0) => {
    const menusToRender = setupData.menus.filter((m) =>
      parentCode ? m.parentMenuCode === parentCode : !m.parentMenuCode,
    );

    return menusToRender.map((menu) => (
      <div key={menu.id} className="mb-1" style={{ marginLeft: `${depth * 20}px` }}>
        <div className={`form-check d-flex align-items-center py-1 px-2 rounded-3 ${depth === 0 ? "bg-light border mb-2" : "hover-bg-light"}`}>
          <input
            type="checkbox"
            className="form-check-input me-2 mt-0"
            id={`menu-${menu.id}`}
            checked={selectedMenuIds.includes(menu.id)}
            onChange={(e) => handleMenuToggle(menu, e.target.checked)}
            style={{ width: "1.2em", height: "1.2em", cursor: "pointer" }}
          />
          <label className="form-check-label small fw-semibold text-dark cursor-pointer d-flex align-items-center gap-2 w-100" htmlFor={`menu-${menu.id}`}>
            <span style={{ fontSize: depth === 0 ? "16px" : "14px" }}>{menu.icon}</span>
            {menu.title}
            <span className="text-muted ms-auto font-monospace" style={{ fontSize: "10px" }}>({menu.route})</span>
          </label>
        </div>
        {renderMenus(menu.code || menu.route, depth + 1)}
      </div>
    ));
  };

  return (
    <>
      <style>
        {`
          .text-brand {
            background: linear-gradient(135deg, rgb(245, 113, 22) 0%, rgb(234, 88, 12) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .bg-brand {
            background: linear-gradient(135deg, rgb(245, 113, 22) 0%, rgb(234, 88, 12) 100%) !important;
            color: #ffffff !important;
          }
        `}
      </style>

      <div className="container-fluid py-3" style={{ background: "#f8fafc", minHeight: "90vh" }}>
        {/* Header & Company Selector */}
        <div className="bg-white p-4 rounded-4 shadow-sm border mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h4 className="fw-bold text-brand mb-1">🔐 Roles & Rights Management</h4>
            <p className="text-muted small mb-0">Build scalable roles, map hierarchical menus, and assign to users.</p>
          </div>
          <div className="d-flex align-items-center gap-2 bg-light p-2 rounded-pill border">
            <label className="fw-semibold small text-muted ps-2">Company:</label>
            <select
              className="form-select form-select-sm rounded-pill border-0 bg-transparent shadow-none fw-bold text-dark"
              style={{ width: "220px", cursor: "pointer" }}
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Modern Tabs */}
        <ul className="nav nav-pills mb-4 gap-2 border-bottom pb-3">
          <li className="nav-item">
            <button
              className={`nav-link rounded-pill px-4 fw-semibold shadow-sm transition-all ${activeTab === "matrix" ? "active bg-brand border-0" : "bg-white text-dark border"}`}
              onClick={() => setActiveTab("matrix")}
            >
              🛠️ Role Builder
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link rounded-pill px-4 fw-semibold shadow-sm transition-all ${activeTab === "assign" ? "active bg-brand border-0" : "bg-white text-dark border"}`}
              onClick={() => setActiveTab("assign")}
            >
              👥 Assign Roles
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link rounded-pill px-4 fw-semibold shadow-sm transition-all ${activeTab === "tree" ? "active bg-brand border-0" : "bg-white text-dark border"}`}
              onClick={() => setActiveTab("tree")}
            >
              🌳 Hierarchy Overview
            </button>
          </li>
        </ul>

        {message && (
          <div className="alert alert-success border-0 bg-success bg-opacity-10 text-success fw-semibold shadow-sm rounded-3 d-flex justify-content-between align-items-center">
            <span>✅ {message}</span>
            <button type="button" className="btn-close" onClick={() => setMessage("")}></button>
          </div>
        )}

        {/* TAB 1: ROLE & MENU BUILDER */}
        {activeTab === "matrix" && (
          <div className="row g-4">
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white sticky-top" style={{ top: "85px" }}>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold text-brand mb-0">
                    {isEditMode ? "✏️ Edit Role Configuration" : "✨ Create New Role"}
                  </h5>
                  {isEditMode && (
                    <button className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={resetRoleForm}>
                      Cancel Edit
                    </button>
                  )}
                </div>
                <form onSubmit={handleSaveRole}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-muted">Role Name *</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      required
                      placeholder="e.g. Finance Manager"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="form-label small fw-semibold text-muted">Description</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief responsibilities..."
                    />
                  </div>
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label small fw-semibold text-muted mb-0">Hierarchy Menu Assignment *</label>
                      <span className="badge bg-brand bg-opacity-10 text-white rounded-pill">
                        {selectedMenuIds.length} Selected
                      </span>
                    </div>
                    <div className="border rounded-4 p-3 bg-white shadow-sm" style={{ maxHeight: "350px", overflowY: "auto" }}>
                      {setupData.menus.length > 0 ? (
                        renderMenus()
                      ) : (
                        <p className="text-muted small text-center my-3">No menus configured in system.</p>
                      )}
                    </div>
                  </div>
                  <button type="submit" className="btn btn-brand w-100 rounded-pill py-2 fw-bold shadow-sm tracking-wider">
                    {isEditMode ? "💾 Update Role Details" : "💾 Save New Role"}
                  </button>
                </form>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                <h5 className="fw-bold text-brand mb-4">
                  📋 Available Roles ({organizations.find((o) => o.id === selectedOrgId)?.name})
                </h5>
                <div className="table-responsive">
                  <table className="table align-middle table-hover">
                    <thead className="table-light small text-uppercase text-secondary">
                      <tr>
                        <th className="ps-3">Role Details</th>
                        <th>Access Level</th>
                        <th className="text-end pe-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {setupData.roles.length > 0 ? (
                        setupData.roles.map((role) => (
                          <tr key={role.id} className="border-bottom">
                            <td className="ps-3 py-3">
                              <div className="fw-bold text-dark">{role.name}</div>
                              <div className="text-muted small">{role.description || "No description provided"}</div>
                            </td>
                            <td>
                              <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-pill">
                                {role.roleMenuPermissions?.length || 0} Modules Assigned
                              </span>
                            </td>
                            <td className="text-end pe-3">
                              {role.isMyRole ? (
                                <span className="badge bg-danger bg-opacity-10 text-danger px-2 py-1 border border-danger border-opacity-25 me-2">
                                  🔒 Primary Role (Locked)
                                </span>
                              ) : (
                                <>
                                  <button className="btn btn-sm btn-light border text-dark fw-semibold rounded-pill px-3 me-2" onClick={() => handleEditRole(role)}>
                                    ✏️ Edit
                                  </button>
                                  <button className="btn btn-sm btn-light border text-danger fw-semibold rounded-pill px-3" onClick={() => handleDeleteRole(role.id)}>
                                    🗑️ Delete
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="text-center py-5 text-muted">
                            <div className="fs-1 mb-2">📭</div>
                            No roles configured for this company yet. Build one from the left panel.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ASSIGN ROLES TO USERS */}
        {activeTab === "assign" && (
          <div className="row justify-content-center">
            <div className="col-md-7">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mt-4">
                <div className="text-center mb-4">
                  <h5 className="fw-bold text-brand mb-1">👥 Map Roles to Users</h5>
                  <p className="badge bg-brand bg-opacity-10 text-white px-3 py-1 rounded-pill mt-2">
                    For: {organizations.find((o) => o.id === selectedOrgId)?.name}
                  </p>
                </div>

                <form onSubmit={handleAssignRole}>
                  <div className="mb-4">
                    <label className="form-label small fw-semibold text-muted">Select User *</label>
                    <select className="form-select rounded-3 py-2 border shadow-sm" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} required>
                      <option value="">-- Choose User --</option>
                      {setupData.users.map((u) => (
                        <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="form-label small fw-semibold text-muted">Select Role to Assign *</label>
                    <select className="form-select rounded-3 py-2 border shadow-sm fw-semibold text-dark" value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)} required>
                      <option value="">-- Choose Configured Role --</option>
                      {setupData.roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>

                    {assignRoleId && (
                      <div className="mt-3 p-3 bg-light rounded-3 border shadow-sm transition-all">
                        <h6 className="fw-bold text-brand mb-3 d-flex align-items-center gap-2" style={{ fontSize: "14px" }}>
                          <span>🛡️</span> Granted Permissions
                        </h6>
                        <div className="d-flex flex-wrap gap-2">
                          {(() => {
                            const selectedRoleObj = setupData.roles.find((r) => r.id === assignRoleId);
                            const roleMenuIds = selectedRoleObj ? selectedRoleObj.roleMenuPermissions.map((rmp) => rmp.menuId) : [];
                            const roleMenus = setupData.menus.filter((m) => roleMenuIds.includes(m.id));

                            if (roleMenus.length === 0) return <span className="text-muted small">No menus mapped to this role yet.</span>;

                            return roleMenus.map((m) => (
                              <span key={m.id} className="badge bg-white text-dark border shadow-sm px-3 py-2 d-flex align-items-center gap-2" style={{ fontWeight: "500" }}>
                                <span style={{ fontSize: "14px" }}>{m.icon}</span> {m.title}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {setupData.roles.length === 0 && (
                    <div className="alert alert-warning small py-2 border-0 shadow-sm">
                      ⚠️ No roles exist for this company. Please create a role in the "Role Builder" tab first.
                    </div>
                  )}

                  <button type="submit" className="btn btn-brand w-100 rounded-pill py-2.5 fw-bold shadow-sm" disabled={!assignUserId || !assignRoleId}>
                    🔗 Grant Access & Link Role
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TREE VIEW */}
        {activeTab === "tree" && (
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
            <h5 className="fw-bold text-brand mb-4">🌳 Global Architecture Overview</h5>
            <div className="accordion" id="rbacTreeAccordion">
              {rbacTree.map((org, idx) => (
                <div className="accordion-item border-0 mb-3 rounded-4 shadow-sm overflow-hidden bg-light" key={org.id}>
                  <h2 className="accordion-header" id={`heading-${org.id}`}>
                    <button className="accordion-button fw-bold bg-white text-dark shadow-none border-bottom" type="button" data-bs-toggle="collapse" data-bs-target={`#collapse-${org.id}`}>
                      <span className="fs-5 me-2">🏢</span> {org.name}
                      <span className="badge bg-secondary ms-3">{org.type} (Level {org.level})</span>
                    </button>
                  </h2>
                  <div id={`collapse-${org.id}`} className={`accordion-collapse collapse ${idx === 0 ? "show" : ""}`} data-bs-parent="#rbacTreeAccordion">
                    <div className="accordion-body p-4 bg-white">
                      <div className="row g-4">
                        <div className="col-md-6 border-end pe-4">
                          <h6 className="fw-bold text-brand mb-3">👤 Directory Users</h6>
                          {org.users.length > 0 ? (
                            <div className="d-flex flex-column gap-2">
                              {org.users.map((u) => (
                                <div key={u.id} className="d-flex justify-content-between align-items-center p-2 border rounded-3 bg-light">
                                  <div>
                                    <div className="fw-semibold text-dark">{u.fullName}</div>
                                    <div className="text-muted" style={{ fontSize: "11px" }}>{u.email}</div>
                                  </div>
                                  <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2">Active</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted small">No users found.</p>
                          )}
                        </div>
                        <div className="col-md-6 ps-4">
                          <h6 className="fw-bold text-brand mb-3">🛡️ Access Policies</h6>
                          {org.roles.length > 0 ? (
                            <div className="d-flex flex-column gap-3">
                              {org.roles.map((r) => (
                                <div key={r.id} className="p-3 bg-white rounded-3 border shadow-sm">
                                  <div className="fw-bold text-dark mb-1">{r.name}</div>
                                  <div className="text-muted small mb-3">{r.description}</div>
                                  <div className="d-flex flex-wrap gap-1">
                                    {r.menus.map((m, mIdx) => (
                                      <span key={mIdx} className="badge bg-dark bg-opacity-10 text-dark border px-2 py-1 fw-normal" style={{ fontSize: "11px" }}>
                                        {m}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted small">No roles configured.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
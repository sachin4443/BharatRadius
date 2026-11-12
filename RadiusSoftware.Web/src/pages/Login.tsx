import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  // "Remember Me": the login id is kept on this device and the session lasts 7 days
  const [rememberMe, setRememberMe] = useState<boolean>(
    () => localStorage.getItem("rememberLogin") === "1"
  );
  const [form, setForm] = useState({
    email: localStorage.getItem("rememberLogin") === "1" ? localStorage.getItem("rememberedUser") || "" : "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const [showForgot, setShowForgot] = useState(false);
  const [step, setStep] = useState(1);

  const [resetData, setResetData] = useState({
    email: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Already logged in with a valid (not expired) token -> skip the login page
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload?.exp && payload.exp * 1000 > Date.now() + 60_000) {
        navigate("/dashboard");
      }
    } catch {
      // invalid token -> stay on login
    }
  }, [navigate]);

  // LOGIN FUNCTION
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { ...form, rememberMe });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data));
      // A fresh login never continues an old "login as child site" chain
      localStorage.removeItem("adminSessionStack");
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      if (rememberMe) {
        localStorage.setItem("rememberLogin", "1");
        localStorage.setItem("rememberedUser", form.email);
        if (res.data.logoUrl) localStorage.setItem("rememberedLogo", res.data.logoUrl);
        else localStorage.removeItem("rememberedLogo");
      } else {
        localStorage.removeItem("rememberLogin");
        localStorage.removeItem("rememberedUser");
        localStorage.removeItem("rememberedLogo");
      }

      setSuccessMsg("Login Success");

      if (res.data.userType === "Admin") {
        navigate("/admin-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid Credentials");
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD - SEND OTP
  const sendOtp = async () => {
    setError("");
    setSuccessMsg("");
    try {
      const res = await API.post("/auth/forgot-password", {
        email: resetData.email,
      });
      setSuccessMsg(res.data?.message || "OTP Sent Successfully");
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || "Failed to send OTP");
    }
  };

  // VERIFY OTP
  const verifyOtp = async () => {
    setError("");
    setSuccessMsg("");
    try {
      const res = await API.post("/auth/verify-otp", {
        email: resetData.email,
        otp: resetData.otp,
      });
      setSuccessMsg(res.data?.message || "OTP Verified");
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || "Invalid OTP");
    }
  };

  // RESET PASSWORD
  const resetPassword = async () => {
    setError("");
    setSuccessMsg("");
    if (resetData.newPassword !== resetData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await API.post("/auth/reset-password", {
        email: resetData.email,
        otp: resetData.otp,
        newPassword: resetData.newPassword,
      });

      setSuccessMsg(res.data?.message || "Password Changed Successfully");
      setShowForgot(false);
      setStep(1);
      setResetData({
        email: "",
        otp: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || "Failed to reset password");
    }
  };

  return (
    <div className="container-fluid vh-100 p-0 overflow-hidden bg-light">
      <div className="row h-100 m-0">
        
        {/* LEFT SIDE: Login Form inside a Card */}
        <div className="col-12 col-lg-5 d-flex justify-content-center align-items-center p-3 p-md-4">
          <div className="card border-0 shadow-sm p-4 p-md-5 rounded-4 bg-white w-100" style={{ maxWidth: "450px" }}>
            
            {/* Header / Logo */}
            <div className="text-center mb-4">
              <img
                src={(localStorage.getItem("rememberLogin") === "1" && localStorage.getItem("rememberedLogo")) || "/logo.png"}
                alt="Bharat Radius"
                className="mb-2"
                style={{ height: "65px", width: "auto", objectFit: "contain" }}
              />
              <div className="mb-2">
                <span 
                  className="badge px-3 py-1.5 rounded-pill fw-medium" 
                  style={{ 
                    backgroundColor: "#e0f2fe", 
                    color: "#0284c7", 
                    fontSize: "11px", 
                    letterSpacing: "0.5px" 
                  }}
                >
                  ISP Billing & Radius Management
                </span>
              </div>
              <h3 className="fw-bold text-dark mb-1" style={{ fontSize: "24px" }}>Welcome Back</h3>
              <p className="text-muted small mb-0">ISP Billing & Network Management Platform</p>
            </div>

            {/* Alerts */}
            {error && (
              <div className="alert alert-danger border-0 bg-danger bg-opacity-10 text-danger text-center py-2 small rounded-3 mb-3 fw-semibold">
                ⚠️ {error}
              </div>
            )}
            {successMsg && (
              <div className="alert alert-success border-0 bg-success bg-opacity-10 text-success text-center py-2 small rounded-3 mb-3 fw-semibold">
                ✅ {successMsg}
              </div>
            )}

            {/* Form */}
            <form onSubmit={login}>
              
              {/* Email / Username Input */}
              <div className="mb-3">
                <label className="form-label text-secondary small fw-bold">Email Address or Username</label>
                <div className="input-group border rounded-3 overflow-hidden bg-white" style={{ borderColor: "#cbd5e1" }}>
                  <span className="input-group-text bg-transparent border-0 text-secondary px-3">
                    📧
                  </span>
                  <input
                    type="text"
                    className="form-control border-0 shadow-none py-2.5 px-2 bg-transparent"
                    placeholder="Enter email or username"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    style={{ fontSize: "14px", color: "#334155" }}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-3">
                <label className="form-label text-secondary small fw-bold">Password</label>
                <div className="input-group border rounded-3 overflow-hidden bg-white" style={{ borderColor: "#cbd5e1" }}>
                  <span className="input-group-text bg-transparent border-0 text-secondary px-3">
                    🔒
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control border-0 shadow-none py-2.5 px-2 bg-transparent"
                    placeholder="Enter Password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    style={{ fontSize: "14px", color: "#334155" }}
                  />
                  <button
                    type="button"
                    className="btn bg-transparent border-0 text-secondary px-3 shadow-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="form-check d-flex align-items-center gap-2 m-0">
                  <input
                    className="form-check-input mt-0 shadow-none border-secondary"
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ cursor: "pointer", width: "16px", height: "16px" }}
                  />
                  <label className="form-check-label small text-secondary pt-1" htmlFor="remember" style={{ cursor: "pointer" }}>
                    Remember Me
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none small fw-semibold shadow-none"
                  style={{ color: "#2563eb" }}
                  onClick={() => {
                    setError("");
                    setSuccessMsg("");
                    setShowForgot(true);
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="btn w-100 py-2.5 fw-bold rounded-3 text-white text-uppercase shadow-sm"
                style={{
                  backgroundColor: "#f97316",
                  border: "none",
                  letterSpacing: "0.5px",
                  fontSize: "14px",
                }}
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                ) : null}
                {loading ? "Authenticating..." : "Login"}
              </button>
            </form>

          </div>
        </div>

        {/* RIGHT SIDE: Branding Banner */}
        <div 
          className="col-12 col-lg-7 d-none d-lg-flex flex-column justify-content-center align-items-center text-center p-5"
          style={{ 
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
            color: "white"
          }}
        >
          <div style={{ maxWidth: "600px" }}>
            <span 
              className="badge px-3 py-2 rounded-pill mb-4 fw-normal" 
              style={{ 
                backgroundColor: "rgba(255, 255, 255, 0.1)", 
                border: "1px solid rgba(255, 255, 255, 0.2)",
                fontSize: "12px", 
                letterSpacing: "1px"
              }}
            >
              Bharat Radius ISP Suite
            </span>
            <h1 className="fw-bold mb-4" style={{ fontSize: "40px", lineHeight: "1.3" }}>
              ISP Management &<br />Billing Platform
            </h1>
            <p className="opacity-75 mb-0" style={{ fontSize: "15px", lineHeight: "1.8", color: "#e2e8f0" }}>
              Radius Authentication • MikroTik Integration • Subscriber Management <br /> IPv4 / IPv6 • Billing Automation
            </p>
          </div>
        </div>

      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgot && (
        <div
          className="modal d-block"
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 p-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-dark fs-5">Reset Password</h5>
                <button
                  type="button"
                  className="btn-close shadow-none"
                  onClick={() => {
                    setShowForgot(false);
                    setStep(1);
                    setError("");
                    setSuccessMsg("");
                  }}
                />
              </div>

              <div className="modal-body pt-3">
                {error && (
                  <div className="alert alert-danger border-0 bg-danger bg-opacity-10 text-danger text-center py-2 small rounded-3 mb-3 fw-semibold">
                    ⚠️ {error}
                  </div>
                )}
                {successMsg && (
                  <div className="alert alert-success border-0 bg-success bg-opacity-10 text-success text-center py-2 small rounded-3 mb-3 fw-semibold">
                    ✅ {successMsg}
                  </div>
                )}

                {step === 1 && (
                  <>
                    <label className="form-label small text-secondary fw-semibold">Enter Registered Email</label>
                    <input
                      type="email"
                      className="form-control py-2.5 px-3 shadow-none border rounded-3 mb-3"
                      placeholder="name@example.com"
                      value={resetData.email}
                      onChange={(e) => setResetData({ ...resetData, email: e.target.value })}
                    />
                    <button 
                      className="btn w-100 py-2.5 fw-bold rounded-3 text-white shadow-sm" 
                      style={{ backgroundColor: "#2563eb" }}
                      onClick={sendOtp}
                    >
                      Send OTP
                    </button>
                  </>
                )}

                {step === 2 && (
                  <>
                    <label className="form-label small text-secondary fw-semibold">Enter Verification OTP</label>
                    <input
                      type="text"
                      className="form-control py-2.5 shadow-none border rounded-3 text-center fs-5 tracking-widest mb-3"
                      placeholder="------"
                      maxLength={6}
                      value={resetData.otp}
                      onChange={(e) => setResetData({ ...resetData, otp: e.target.value })}
                    />
                    <button 
                      className="btn btn-success w-100 py-2.5 fw-bold rounded-3 shadow-sm" 
                      onClick={verifyOtp}
                    >
                      Verify OTP
                    </button>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className="mb-3">
                      <label className="form-label small text-secondary fw-semibold">New Password</label>
                      <input
                        type="password"
                        className="form-control py-2.5 px-3 shadow-none border rounded-3"
                        placeholder="Enter new password"
                        value={resetData.newPassword}
                        onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="form-label small text-secondary fw-semibold">Confirm Password</label>
                      <input
                        type="password"
                        className="form-control py-2.5 px-3 shadow-none border rounded-3"
                        placeholder="Confirm new password"
                        value={resetData.confirmPassword}
                        onChange={(e) => setResetData({ ...resetData, confirmPassword: e.target.value })}
                      />
                    </div>
                    <button 
                      className="btn w-100 py-2.5 fw-bold rounded-3 text-white shadow-sm" 
                      style={{ backgroundColor: "#2563eb" }}
                      onClick={resetPassword}
                    >
                      Change Password
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
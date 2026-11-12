import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import { MainLayout } from "./layouts/MainLayout";

// Pages are loaded only when opened (smaller first download, faster panel)
const named = <T extends Record<string, any>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType<any> })));

const CompanyManagement = named(() => import("./pages/CompanyManagement"), "CompanyManagement");
const UserManagement = named(() => import("./pages/UserManagement"), "UserManagement");
const SitesManagement = named(() => import("./pages/SitesManagement"), "SitesManagement");
const Dashboard = named(() => import("./pages/Dashboard"), "Dashboard");
const NasManagement = named(() => import("./pages/NasManagement"), "NasManagement");
const PackageManagement = named(() => import("./pages/PackageManagement"), "PackageManagement");
const SubscriberManagement = lazy(() => import("./pages/SubscriberManagement"));
const SubscriberProfile = lazy(() => import("./pages/SubscriberProfile"));
const WalletChildSites = lazy(() => import("./pages/WalletChildSites"));
const WalletTransactions = lazy(() => import("./pages/WalletTransactions"));
const CAF = lazy(() => import("./pages/CAF"));
const Reports = lazy(() => import("./pages/Reports"));
const RadiusAuthLogs = lazy(() => import("./pages/RadiusAuthLogs"));
const GatewaySettings = lazy(() => import("./pages/GatewaySettings"));

const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center py-5">
    <div className="spinner-border text-warning" role="status" />
  </div>
);

export const App: React.FC = () => {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* =====================================================
            PUBLIC ROUTES
        ====================================================== */}
        {/* Landing Page 
        <Route
          path="/"
          element={<BharatRadiusLanding />}
        />*/}
        <Route path="/" element={<Login />} />

        {/* =====================================================
            PROTECTED ROUTES
            All pages inside MainLayout
        ====================================================== */}

        <Route element={<MainLayout />}>
          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />
          {/* Wallet Child Sites */}
<Route path="/child-sites" element={<WalletChildSites />} />
<Route path="/walletchildsites" element={<WalletChildSites />} />

{/* Transactions */}
<Route path="/transactions" element={<WalletTransactions />} />
          {/* Company Management */}
          <Route
            path="/companies"
            element={<CompanyManagement />}
          />

          {/* User Management */}
          <Route
            path="/users"
            element={<UserManagement />}
          />
<Route
    path="/caf"
    element={<CAF />}
/>
          {/* Sites Management */}
          <Route
            path="/sites"
            element={<SitesManagement />}
          />

          {/* NAS / Router Management */}
          <Route
            path="/networking/nas"
            element={<NasManagement />}
          />

          {/* Reports & tools */}
          <Route path="/reports" element={<Reports />} />
          <Route path="/radius-auth-logs" element={<RadiusAuthLogs />} />
          <Route path="/gateway-settings" element={<GatewaySettings />} />

          {/* Package Management */}
          <Route
            path="/packages"
            element={<PackageManagement />}
          />

          {/* =================================================
              SUBSCRIBER MANAGEMENT
          ================================================== */}

          <Route
            path="/subscribers"
            element={<SubscriberManagement />}
          />

          {/* =================================================
              SUBSCRIBER PROFILE

              IMPORTANT:
              SubscriberManagement uses:
              /subscribers/:id
          ================================================== */}

          <Route
            path="/subscribers/:id"
            element={<SubscriberProfile />}
          />

          {/* =================================================
              OLD PROFILE URL SUPPORT

              Agar kisi purane bookmark/menu se ye URL aaye:
              /networking/subscribers/:id

              to automatically new URL par redirect hoga.
          ================================================== */}

          <Route
            path="/networking/subscribers/:id"
            element={
              <Navigate
                to="/subscribers/:id"
                replace
              />
            }
          />

          {/* =================================================
              OLD REGISTER SITE ROUTE
          ================================================== */}

          <Route
            path="/register-site"
            element={
              <Navigate
                to="/companies"
                replace
              />
            }
          />
        </Route>

        {/* =====================================================
            ROOT REDIRECT
        ====================================================== */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        {/* =====================================================
            FALLBACK
        ====================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
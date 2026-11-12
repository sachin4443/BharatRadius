import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import BharatRadiusLanding from "./pages/BharatRadiusLanding";
import  Login  from "./pages/Login";
import { CompanyManagement } from "./pages/CompanyManagement";
import { UserManagement } from "./pages/UserManagement";
import { SitesManagement } from "./pages/SitesManagement";
import { MainLayout } from "./layouts/MainLayout";
import { Dashboard } from "./pages/Dashboard";
import { NasManagement } from "./pages/NasManagement";
import { PackageManagement } from "./pages/PackageManagement";

import SubscriberManagement from "./pages/SubscriberManagement";
import SubscriberProfile from "./pages/SubscriberProfile";
import WalletChildSites from "./pages/WalletChildSites";
import WalletTransactions from "./pages/WalletTransactions";
import CAF from "./pages/CAF";
import Reports from "./pages/Reports";
import RadiusAuthLogs from "./pages/RadiusAuthLogs";
import GatewaySettings from "./pages/GatewaySettings";
export const App: React.FC = () => {
  return (
    <Router>
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
    </Router>
  );
};

export default App;
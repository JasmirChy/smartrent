import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext';

import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import MobileBottomNav from './components/layout/MobileBottomNav';
import AuthModal from './components/modals/AuthModal';

import PublicLanding from './pages/PublicLanding';
import TenantDashboard from './pages/TenantDashboard';
import AdminCommandCenter from './pages/AdminCommandCenter';
import SupportHub from './pages/SupportHub';
import ProfileSettings from './pages/ProfileSettings';

// Automatically scroll to top whenever the route changes
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

// Guard for any authenticated user (Tenant or Admin)
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
        <p className="text-xs font-bold">Verifying SmartRent session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Strict RBAC Guard exclusively for Landlord Admin
function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
        <p className="text-xs font-bold">Verifying Admin privileges...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If a standard tenant tries to access /admin-deck via URL, send them to /tenant
  if (!isAdmin) {
    return <Navigate to="/tenant" replace />;
  }

  return children;
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 pb-16 lg:pb-0">
      <ScrollToTop />
      <Navbar />
      <AuthModal />

      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <Routes>
            {/* Public Homepage */}
            <Route path="/" element={<PublicLanding />} />

            {/* Protected Tenant Dashboard */}
            <Route
              path="/tenant"
              element={
                <ProtectedRoute>
                  <TenantDashboard />
                </ProtectedRoute>
              }
            />

            {/* Strict RBAC Landlord Command Center */}
            <Route
              path="/admin-deck"
              element={
                <AdminRoute>
                  <AdminCommandCenter />
                </AdminRoute>
              }
            />

            {/* Real-Time Messenger & Maintenance Tickets */}
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <SupportHub />
                </ProtectedRoute>
              }
            />

            {/* User Profile, Avatar & OTP Password Security */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfileSettings />
                </ProtectedRoute>
              }
            />

            {/* Fallback Catch-All */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
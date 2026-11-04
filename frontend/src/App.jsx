import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 pb-16 lg:pb-0">
      <Navbar />
      <AuthModal />

      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <Routes>
            <Route path="/" element={<PublicLanding />} />
            <Route
              path="/tenant"
              element={user ? <TenantDashboard /> : <Navigate to="/" replace />}
            />
            <Route
              path="/admin-deck"
              element={
                user && isAdmin ? <AdminCommandCenter /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="/support"
              element={user ? <SupportHub /> : <Navigate to="/" replace />}
            />
            <Route
              path="/profile"
              element={user ? <ProfileSettings /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
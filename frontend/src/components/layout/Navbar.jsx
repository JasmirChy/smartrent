import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Bell, LogIn, UserPlus, LogOut, ShieldCheck, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, isAdmin, openAuthModal, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Public Landing', path: '/' },
    ...(user
      ? [
          { label: 'Tenant Dashboard', path: '/tenant' },
          ...(isAdmin ? [{ label: 'Admin Command Center', path: '/admin-deck' }] : []),
          { label: 'Support & Real-Time Hub', path: '/support' },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 h-16 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between">
      {/* Left Logo */}
      <Link to="/" className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-none">
            SmartRent
          </span>
          <span className="text-[10px] font-medium text-slate-500 tracking-wide">
            Smart rental services by JASMIR
          </span>
        </div>
      </Link>

      {/* Center Navigation Pills (Visible on Desktop) */}
      <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right User Profile / Auth Actions */}
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-3">
            <Link
              to="/support"
              className="relative p-2 rounded-full text-slate-500 hover:bg-slate-100 transition"
              title="Messages & Support"
            >
              <Bell className="w-5 h-5" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2"></span>
            </Link>

            <Link
              to="/profile"
              className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-full hover:bg-slate-100 transition border border-slate-200/80"
            >
              {user.profile_picture_url ? (
                <img
                  src={user.profile_picture_url}
                  alt={user.full_name}
                  className="w-8 h-8 rounded-full object-cover border border-indigo-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                  {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">{user.full_name}</p>
                <p className="text-[10px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                  {isAdmin ? (
                    <>
                      <ShieldCheck className="w-3 h-3" /> Landlord Admin
                    </>
                  ) : user.assigned_room ? (
                    <>
                      <Home className="w-3 h-3" /> Room {user.assigned_room.room_number}
                    </>
                  ) : (
                    'Verified User'
                  )}
                </p>
              </div>
            </Link>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openAuthModal('LOGIN')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              Tenant Login
            </button>
            <button
              onClick={() => openAuthModal('SIGNUP')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
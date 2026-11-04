import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, ShieldAlert, MessageSquareText, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MobileBottomNav() {
  const { user, isAdmin, openAuthModal } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-900">SmartRent Portal</p>
          <p className="text-[11px] text-slate-500">Rooms A1–A4 & B1–B5</p>
        </div>
        <button
          onClick={() => openAuthModal('LOGIN')}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
        >
          Login / Sign Up
        </button>
      </div>
    );
  }

  const tabs = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'My Bill', path: '/tenant', icon: LayoutDashboard },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin-deck', icon: ShieldAlert }] : []),
    { label: 'Chat', path: '/support', icon: MessageSquareText },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[11px] font-semibold transition ${
              active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${active ? 'stroke-[2.5px]' : ''}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
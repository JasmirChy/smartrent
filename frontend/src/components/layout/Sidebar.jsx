import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, ShieldAlert, MessageSquareText, Settings, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  if (!user || location.pathname === '/') return null;

  const links = [
    { label: 'Public Landing', path: '/', icon: Home },
    { label: 'Tenant Dashboard', path: '/tenant', icon: LayoutDashboard },
    ...(isAdmin
      ? [{ label: 'Admin Command Center', path: '/admin-deck', icon: ShieldAlert }]
      : []),
    { label: 'Support & Real-Time Hub', path: '/support', icon: MessageSquareText },
    { label: 'Settings & Profile', path: '/profile', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 shrink-0 bg-white border-r border-slate-200/80 min-h-[calc(100vh-4rem)] p-4">
      <div>
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Operations
        </p>
        <nav className="space-y-1">
          {links.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Telemetry Status Box */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            Smart Telemetry
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <p className="text-xs font-bold text-slate-900">9 Sub-Meters Active</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Ground (A1–A4) • 2nd (B1–B5)</p>
      </div>
    </aside>
  );
}
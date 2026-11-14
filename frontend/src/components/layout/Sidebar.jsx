import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  ShieldAlert,
  MessageSquare,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function Sidebar() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  // Only show Sidebar when user is logged in and not on the public landing page
  if (!user || location.pathname === '/') {
    return null;
  }

  const menuLinks = [
    {
      label: t('Public Showcase', 'गृहपृष्ठ'),
      path: '/',
      icon: Home,
    },
    {
      label: t('Tenant Dashboard', 'भाडावाल ड्यासबोर्ड'),
      path: '/tenant',
      icon: LayoutDashboard,
    },
    ...(isAdmin
      ? [
          {
            label: t('Admin Command Deck', 'एडमिन कमाण्ड सेन्टर'),
            path: '/admin-deck',
            icon: ShieldAlert,
          },
        ]
      : []),
    {
      label: t('Messenger & Support', 'म्यासेन्जर र सहायता'),
      path: '/support',
      icon: MessageSquare,
    },
    {
      label: t('Profile & Security', 'प्रोफाइल र सुरक्षा'),
      path: '/profile',
      icon: UserCheck,
    },
  ];

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 bg-white border-r border-slate-200/80 min-h-[calc(100vh-4rem)] p-4 justify-between">
      <div className="space-y-1.5">
        <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          {t('Navigation Menu', 'नेभिगेसन मेनु')}
        </div>
        {menuLinks.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 space-y-1.5">
        <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-extrabold">
          <Sparkles className="w-4 h-4" />
          <span>{t('4s Live Auto-Sync', '४-सेकेन्ड लाइभ सिंक')}</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {t(
            'All bills, meter readings, and messages synchronize automatically every 4 seconds.',
            'सबै बिल, मिटर रिडिङ र सन्देशहरू प्रत्येक ४ सेकेन्डमा स्वतः अद्यावधिक हुन्छन्।'
          )}
        </p>
      </div>
    </aside>
  );
}
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  ShieldAlert,
  MessageSquare,
  User,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function MobileBottomNav() {
  const { user, isAdmin, openAuthModal } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (!user) {
    return (
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 flex items-center justify-around shadow-lg">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-xl text-[11px] font-extrabold ${
            location.pathname === '/' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>{t('Home', 'गृहपृष्ठ')}</span>
        </Link>

        <button
          type="button"
          onClick={() => openAuthModal('LOGIN')}
          className="flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-xl text-[11px] font-extrabold text-slate-600 hover:text-indigo-600"
        >
          <LogIn className="w-5 h-5" />
          <span>{t('Login', 'लगइन')}</span>
        </button>

        <button
          type="button"
          onClick={() => openAuthModal('SIGNUP')}
          className="flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-xl text-[11px] font-extrabold text-indigo-600"
        >
          <UserPlus className="w-5 h-5" />
          <span>{t('Sign Up', 'दर्ता')}</span>
        </button>
      </nav>
    );
  }

  const navItems = [
    {
      label: t('Home', 'गृहपृष्ठ'),
      path: '/',
      icon: Home,
    },
    {
      label: t('My Bill', 'मेरो बिल'),
      path: '/tenant',
      icon: LayoutGrid,
    },
    ...(isAdmin
      ? [
          {
            label: t('Admin', 'एडमिन'),
            path: '/admin-deck',
            icon: ShieldAlert,
          },
        ]
      : []),
    {
      label: t('Chat', 'च्याट'),
      path: '/support',
      icon: MessageSquare,
    },
    {
      label: t('Profile', 'प्रोफाइल'),
      path: '/profile',
      icon: User,
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-xl text-[10px] sm:text-[11px] font-extrabold transition ${
              active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <IconComponent className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
            <span className="truncate max-w-[64px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
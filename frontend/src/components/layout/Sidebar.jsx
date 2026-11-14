import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  ShieldCheck,
  MessageSquare,
  User,
  LogOut,
  LogIn,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

function getSafeMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return rawUrl;

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  let backendOrigin = 'http://localhost:8000';
  try {
    backendOrigin = new URL(apiBase).origin;
  } catch {
    backendOrigin = 'http://localhost:8000';
  }

  let finalUrl = rawUrl.trim();
  const mediaIndex = finalUrl.indexOf('/media/');
  if (mediaIndex !== -1) {
    finalUrl = `${backendOrigin}${finalUrl.substring(mediaIndex)}`;
  } else if (finalUrl.startsWith('/')) {
    finalUrl = `${backendOrigin}${finalUrl}`;
  }

  if (
    finalUrl.startsWith('http://') &&
    !finalUrl.includes('localhost') &&
    !finalUrl.includes('127.0.0.1') &&
    !finalUrl.includes('192.168.')
  ) {
    finalUrl = 'https://' + finalUrl.substring('http://'.length);
  }
  return finalUrl;
}

export default function Sidebar() {
  const { user, isAdmin, openAuthModal, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [avatarErr, setAvatarErr] = useState(false);

  useEffect(() => {
    setAvatarErr(false);
  }, [user?.profile_picture_path, user?.profile_picture_url, user?.profile_picture]);

  const avatarUrl = !avatarErr
    ? getSafeMediaUrl(
        user?.profile_picture_path || user?.profile_picture_url || user?.profile_picture
      )
    : null;

  const activeRoomNumber =
    user?.room_details?.room_number ||
    user?.assigned_room?.room_number ||
    user?.room_number ||
    null;

  const links = [
    {
      label: t('Public Landing', 'गृहपृष्ठ'),
      path: '/',
      icon: Home,
    },
    ...(user
      ? [
          {
            label: t('Tenant Dashboard', 'भाडावाल ड्यासबोर्ड'),
            path: '/tenant',
            icon: LayoutDashboard,
          },
          ...(isAdmin
            ? [
                {
                  label: t('Admin Command Center', 'एडमिन कमाण्ड सेन्टर'),
                  path: '/admin-deck',
                  icon: ShieldCheck,
                },
              ]
            : []),
          {
            label: t('Support & Messenger', 'सहायता र म्यासेन्जर'),
            path: '/support',
            icon: MessageSquare,
          },
          {
            label: t('Profile & Security', 'प्रोफाइल र सुरक्षा'),
            path: '/profile',
            icon: User,
          },
        ]
      : []),
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 shrink-0 bg-white border-r border-slate-200/80 p-4 min-h-[calc(100vh-4rem)] sticky top-16 self-start">
      <div className="space-y-6">
        {/* User Quick Summary Card */}
        {user ? (
          <Link
            to="/profile"
            className="p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/80 flex items-center gap-3 transition"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.full_name}
                onError={() => setAvatarErr(true)}
                className="w-11 h-11 rounded-xl object-cover border border-indigo-200 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-slate-900 truncate">
                {user.full_name}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                {isAdmin
                  ? t('Landlord Admin', 'घरधनी एडमिन')
                  : activeRoomNumber
                  ? `${t('Room', 'कोठा')} ${activeRoomNumber}`
                  : t('Verified Tenant', 'प्रमाणित भाडावाल')}
              </span>
            </div>
          </Link>
        ) : (
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>{t('Tenant Portal', 'भाडावाल पोर्टल')}</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {t(
                'Sign in to view sub-meter billing, digital lease, or book a room.',
                'सब-मिटर बिल, भाडा सम्झौता वा कोठा बुकिङका लागि लगइन गर्नुहोस्।'
              )}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openAuthModal('LOGIN')}
                className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                {t('Login', 'लगइन')}
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('SIGNUP')}
                className="py-2 px-2.5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-700 flex items-center justify-center gap-1 shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t('Sign Up', 'दर्ता')}
              </button>
            </div>
          </div>
        )}

        {/* Sidebar Navigation Links */}
        <nav className="space-y-1">
          <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
            {t('Main Navigation', 'मुख्य मेनु')}
          </p>
          {links.map((item) => {
            const IconComponent = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <IconComponent className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Sign Out Button */}
      {user && (
        <div className="pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={logout}
            className="w-full py-2.5 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            {t('Sign Out', 'लगआउट गर्नुहोस्')}
          </button>
        </div>
      )}
    </aside>
  );
}
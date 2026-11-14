import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Bell,
  LogIn,
  UserPlus,
  LogOut,
  ShieldCheck,
  Home,
  Megaphone,
  MessageSquare,
  ArrowRight,
  FileText,
  Globe,
  Menu,
  X,
  User,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import axiosClient, { fetchNotices } from '../../api/axiosClient';
import { formatDualDate } from '../../utils/nepaliDate';

function getSafeMediaUrl(rawUrl, cacheBuster = '') {
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

  if (cacheBuster) {
    const sep = finalUrl.includes('?') ? '&' : '?';
    return `${finalUrl}${sep}v=${cacheBuster}`;
  }
  return finalUrl;
}

export default function Navbar() {
  const { user, isAdmin, openAuthModal, logout } = useAuth();
  const { lang, setLang, t, td } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [pendingActionCount, setPendingActionCount] = useState(0);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.profile_picture_path, user?.profile_picture_url, user?.profile_picture]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setNotices([]);
      setUnreadChatsCount(0);
      setPendingActionCount(0);
      return;
    }

    const loadNotificationData = () => {
      fetchNotices()
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.results || [];
          setNotices(list);
        })
        .catch(() => {});

      axiosClient
        .get('/communication/contacts/')
        .then((res) => {
          const contacts = Array.isArray(res.data) ? res.data : res.data?.results || [];
          const totalUnread = contacts.reduce(
            (acc, c) => acc + (Number(c.unread_count) || 0),
            0
          );
          setUnreadChatsCount(totalUnread);
        })
        .catch(() => {});

      axiosClient
        .get('/billing/')
        .then((res) => {
          const bills = Array.isArray(res.data) ? res.data : res.data?.results || [];
          if (isAdmin) {
            const pendingAudit = bills.filter(
              (b) => b.status === 'PENDING_VERIFICATION'
            ).length;
            setPendingActionCount(pendingAudit);
          } else {
            const unpaid = bills.filter(
              (b) => b.status === 'UNPAID' || b.status === 'REJECTED'
            ).length;
            setPendingActionCount(unpaid);
          }
        })
        .catch(() => {});
    };

    loadNotificationData();
    const timer = setInterval(loadNotificationData, 10000);
    return () => clearInterval(timer);
  }, [user, isAdmin]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { label: t('Public Landing', 'गृहपृष्ठ'), path: '/', icon: Home },
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
            label: t('Support & Real-Time Hub', 'सहायता र म्यासेन्जर'),
            path: '/support',
            icon: MessageSquare,
            badge: unreadChatsCount > 0 ? unreadChatsCount : null,
          },
          {
            label: t('Profile & Security', 'प्रोफाइल र सुरक्षा'),
            path: '/profile',
            icon: User,
          },
        ]
      : []),
  ];

  const totalNotifications = notices.length + unreadChatsCount + pendingActionCount;
  const navAvatarUrl = !avatarLoadFailed
    ? getSafeMediaUrl(
        user?.profile_picture_path || user?.profile_picture_url || user?.profile_picture
      )
    : null;

  const activeRoomNumber =
    user?.room_details?.room_number ||
    user?.assigned_room?.room_number ||
    user?.room_number ||
    null;

  return (
    <>
      <header className="sticky top-0 z-40 h-16 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-5 lg:px-8 flex items-center justify-between gap-2">
        {/* Left: Mobile Sidebar Hamburger + Clean Untruncated Brand Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200/80 shrink-0 transition"
            title={t('Open Menu', 'मेनु खोल्नुहोस्')}
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 block leading-none whitespace-nowrap">
                {t('SmartRent', 'स्मार्टरेन्ट')}
              </span>
              <span className="hidden sm:block text-[10px] font-medium text-slate-500 tracking-wide whitespace-nowrap mt-0.5">
                {t(
                  'Smart rental services by JASMIR',
                  'जश्मिरद्वारा संचालित स्मार्ट कोठा भाडा सेवा'
                )}
              </span>
            </div>
          </Link>
        </div>

        {/* Center Navigation Pills (Desktop) */}
        <nav className="hidden xl:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
          {navItems.slice(0, 4).map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
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

        {/* Right: Compact EN | ने Toggle + Notifications + Profile / Auth Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div
            className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/90 shadow-2xs shrink-0"
            title="Switch Language (English / नेपाली)"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-600 ml-1.5 mr-0.5 hidden md:block" />
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ne')}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold transition cursor-pointer ${
                lang === 'ne'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ने
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2.5 relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowNotifications((prev) => !prev)}
                className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 transition border border-slate-200/80 shrink-0"
                title={t('Notifications & Alerts', 'सूचना तथा जानकारीहरू')}
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {totalNotifications > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
                    {totalNotifications}
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5" />
                )}
              </button>

              {showNotifications && (
                <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-12 w-[calc(100vw-1rem)] max-w-sm sm:w-96 rounded-3xl bg-white shadow-2xl border border-slate-200 p-4 z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-indigo-600" />{' '}
                      {t('Notifications Center', 'सूचना केन्द्र')}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                      {totalNotifications} {t('Active', 'सक्रिय')}
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {unreadChatsCount > 0 && (
                      <div
                        onClick={() => {
                          setShowNotifications(false);
                          navigate('/support');
                        }}
                        className="p-3 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/70 border border-indigo-100 cursor-pointer transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {unreadChatsCount}{' '}
                              {t('Unread Chat Message(s)', 'नपढिएका च्याट सन्देशहरू')}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {t(
                                'Tap to open Messenger & reply',
                                'म्यासेन्जर खोल्न र जवाफ दिन थिच्नुहोस्'
                              )}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-indigo-600 shrink-0" />
                      </div>
                    )}

                    {pendingActionCount > 0 && (
                      <div
                        onClick={() => {
                          setShowNotifications(false);
                          navigate(isAdmin ? '/admin-deck' : '/tenant');
                        }}
                        className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100/70 border border-amber-200 cursor-pointer transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {isAdmin
                                ? `${pendingActionCount} ${t(
                                    'Bill Proof(s) Awaiting Audit',
                                    'बिल प्रमाणहरू परीक्षणको प्रतीक्षामा'
                                  )}`
                                : `${pendingActionCount} ${t(
                                    'Monthly Bill Due / Action Needed',
                                    'मासिक बिल भुक्तानी बाँकी'
                                  )}`}
                            </p>
                            <p className="text-[11px] text-slate-600 truncate">
                              {isAdmin
                                ? t(
                                    'Review uploaded meter & payment slips',
                                    'मिटर र भुक्तानी भौचर जाँच गर्नुहोस्'
                                  )
                                : t(
                                    'Submit meter reading & payment proof',
                                    'मिटर रिडिङ र भुक्तानी प्रमाण पेश गर्नुहोस्'
                                  )}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-amber-700 shrink-0" />
                      </div>
                    )}

                    {notices.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setShowNotifications(false);
                          navigate('/');
                        }}
                        className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold text-indigo-600 uppercase flex items-center gap-1 shrink-0">
                            <Megaphone className="w-3 h-3" />{' '}
                            {td(n.category_display || n.category)}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {n.created_at
                              ? formatDualDate(
                                  new Date(n.created_at).toISOString().split('T')[0]
                                )
                              : ''}
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-slate-900 line-clamp-1">
                          {n.title}
                        </p>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{n.content}</p>
                      </div>
                    ))}

                    {totalNotifications === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400">
                        {t(
                          'All caught up! No new notifications right now.',
                          'अहिले कुनै नयाँ सूचना छैन।'
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/support');
                      }}
                      className="font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      {t('Open Messenger →', 'म्यासेन्जर खोल्नुहोस् →')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="font-semibold text-slate-400 hover:text-slate-600"
                    >
                      {t('Close', 'बन्द गर्नुहोस्')}
                    </button>
                  </div>
                </div>
              )}

              {/* Profile Avatar Pill */}
              <Link
                to="/profile"
                className="flex items-center gap-2 p-0.5 sm:pl-1 sm:pr-2.5 sm:py-1 rounded-full hover:bg-slate-100 transition border border-slate-200/80 shrink-0"
                title={t('Profile & Security', 'प्रोफाइल र सुरक्षा')}
              >
                {navAvatarUrl ? (
                  <img
                    src={navAvatarUrl}
                    alt={user.full_name}
                    onError={() => setAvatarLoadFailed(true)}
                    className="w-8 h-8 rounded-full object-cover border border-indigo-200 bg-slate-100 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-none truncate max-w-[110px]">
                    {user.full_name}
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                    {isAdmin ? (
                      <>
                        <ShieldCheck className="w-3 h-3" />{' '}
                        {t('Landlord Admin', 'घरधनी एडमिन')}
                      </>
                    ) : activeRoomNumber ? (
                      <>
                        <Home className="w-3 h-3" /> {t('Room', 'कोठा')}{' '}
                        {activeRoomNumber}
                      </>
                    ) : (
                      t('Verified User', 'प्रमाणित प्रयोगकर्ता')
                    )}
                  </p>
                </div>
              </Link>

              {/* Sign Out Button (Hidden on narrow mobile since it's in the ☰ Drawer; visible on sm+) */}
              <button
                onClick={logout}
                title={t('Sign Out', 'लगआउट गर्नुहोस्')}
                className="hidden sm:inline-flex p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => openAuthModal('LOGIN')}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 transition whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 hidden sm:inline" />
                {t('Login', 'लगइन')}
              </button>
              <button
                onClick={() => openAuthModal('SIGNUP')}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5 hidden sm:inline" />
                {t('Sign Up', 'दर्ता')}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MOBILE & TABLET SLIDE-OUT LEFT SIDEBAR DRAWER */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 backdrop-blur-xs flex"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[82vw] bg-white h-full shadow-2xl border-r border-slate-200 flex flex-col justify-between p-5 overflow-y-auto"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-base text-slate-900 block leading-none">
                      {t('SmartRent', 'स्मार्टरेन्ट')}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 block mt-0.5">
                      {t('By JASMIR', 'जश्मिरद्वारा संचालित')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {user ? (
                <div
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    navigate('/profile');
                  }}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 cursor-pointer hover:border-indigo-300 transition"
                >
                  {navAvatarUrl ? (
                    <img
                      src={navAvatarUrl}
                      alt={user.full_name}
                      onError={() => setAvatarLoadFailed(true)}
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
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                      {isAdmin
                        ? t('Landlord Admin', 'घरधनी एडमिन')
                        : activeRoomNumber
                        ? `${t('Room', 'कोठा')} ${activeRoomNumber}`
                        : t('Verified Tenant', 'प्रमाणित भाडावाल')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSidebarOpen(false);
                      openAuthModal('LOGIN');
                    }}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {t('Login', 'लगइन')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSidebarOpen(false);
                      openAuthModal('SIGNUP');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-700 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {t('Sign Up', 'दर्ता')}
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <p className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                  {t('Navigation Menu', 'नेभिगेसन मेनु')}
                </p>
                {navItems.map((item) => {
                  const IconComponent = item.icon;
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-extrabold transition ${
                        active
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <IconComponent className="w-4 h-4" />
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            active
                              ? 'bg-white text-indigo-600'
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition ${
                    lang === 'en'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('ne')}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition ${
                    lang === 'ne'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  ने
                </button>
              </div>

              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-2 transition"
                >
                  <LogOut className="w-4 h-4" />
                  {t('Sign Out', 'लगआउट गर्नुहोस्')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
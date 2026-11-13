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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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

  // Always attach /media/ paths to the active backendOrigin
  const mediaIndex = finalUrl.indexOf('/media/');
  if (mediaIndex !== -1) {
    finalUrl = `${backendOrigin}${finalUrl.substring(mediaIndex)}`;
  } else if (finalUrl.startsWith('/')) {
    finalUrl = `${backendOrigin}${finalUrl}`;
  }

  // Upgrade http:// to https:// whenever running on production (Vercel / Render)
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
  const location = useLocation();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notices, setNotices] = useState([]);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [pendingActionCount, setPendingActionCount] = useState(0);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.profile_picture_path, user?.profile_picture_url, user?.profile_picture]);

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
    { label: 'Public Landing', path: '/' },
    ...(user
      ? [
          { label: 'Tenant Dashboard', path: '/tenant' },
          ...(isAdmin ? [{ label: 'Admin Command Center', path: '/admin-deck' }] : []),
          { label: 'Support & Real-Time Hub', path: '/support' },
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

      {/* Center Navigation Pills */}
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
          <div className="flex items-center gap-3 relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 transition border border-slate-200/80"
              title="Notifications & Alerts"
            >
              <Bell className="w-5 h-5" />
              {totalNotifications > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                  {totalNotifications}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-3xl bg-white shadow-2xl border border-slate-200 p-4 z-50">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-indigo-600" /> Notifications Center
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                    {totalNotifications} Active
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
                            {unreadChatsCount} Unread Chat Message(s)
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            Tap to open Messenger & reply
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
                              ? `${pendingActionCount} Bill Proof(s) Awaiting Audit`
                              : `${pendingActionCount} Monthly Bill Due / Action Needed`}
                          </p>
                          <p className="text-[11px] text-slate-600 truncate">
                            {isAdmin
                              ? 'Review uploaded meter & payment slips'
                              : 'Submit meter reading & payment proof'}
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
                          <Megaphone className="w-3 h-3" /> {n.category_display || n.category}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {n.created_at
                            ? formatDualDate(new Date(n.created_at).toISOString().split('T')[0])
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
                      All caught up! No new notifications right now.
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
                    Open Messenger →
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            <Link
              to="/profile"
              className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-full hover:bg-slate-100 transition border border-slate-200/80"
            >
              {navAvatarUrl ? (
                <img
                  src={navAvatarUrl}
                  alt={user.full_name}
                  onError={() => setAvatarLoadFailed(true)}
                  className="w-8 h-8 rounded-full object-cover border border-indigo-200 bg-slate-100 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
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
                  ) : activeRoomNumber ? (
                    <>
                      <Home className="w-3 h-3" /> Room {activeRoomNumber}
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
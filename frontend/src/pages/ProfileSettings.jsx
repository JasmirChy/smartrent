import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  User,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Lock,
  Home,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  CreditCard,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import axiosClient, { downloadFileFromUrl } from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'svg',
  'heic',
  'heif',
  'avif',
  'jfif',
];

function resolveMobileSafeImageUrl(rawUrl, cacheBuster = '') {
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

  // If the URL contains a /media/ path (even if saved with localhost or http://),
  // always attach it to the active backendOrigin
  const mediaIndex = finalUrl.indexOf('/media/');
  if (mediaIndex !== -1) {
    finalUrl = `${backendOrigin}${finalUrl.substring(mediaIndex)}`;
  } else if (finalUrl.startsWith('/')) {
    finalUrl = `${backendOrigin}${finalUrl}`;
  }

  // Upgrade http:// to https:// whenever running on HTTPS (Vercel / Render)
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

export default function ProfileSettings() {
  const { user, isAdmin, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // Personal Info States
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');

  // Avatar & Cover Preview States
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imgLoadError, setImgLoadError] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [coverLoadError, setCoverLoadError] = useState(false);

  const [mediaVersion, setMediaVersion] = useState(() => Date.now());

  // Fullscreen Photo Lightbox States
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    items: [],
    currentIndex: 0,
    zoom: 1,
  });

  // Password OTP States
  const [resetStep, setResetStep] = useState(1);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Feedback Banner
  const [banner, setBanner] = useState({ type: '', text: '' });

  // Fetch latest enriched profile dossier (4-second live auto-sync)
  const { data: liveProfile, isLoading } = useQuery({
    queryKey: ['meProfileSettings'],
    queryFn: async () => (await axiosClient.get('/accounts/me/')).data,
    refetchInterval: 4000,
  });

  const activeUser = liveProfile || user || {};

  useEffect(() => {
    if (activeUser?.full_name && !fullName) {
      setFullName(activeUser.full_name);
    }
    if (activeUser?.phone_number && !phoneNumber) {
      setPhoneNumber(activeUser.phone_number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser?.full_name, activeUser?.phone_number]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [previewUrl, coverPreviewUrl]);

  const validateSelectedImage = (file, label) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setBanner({
        type: 'error',
        text: `${label} is ${sizeMB} MB. Maximum allowed size is 5 MB.`,
      });
      return false;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isImageMime = file.type && file.type.toLowerCase().startsWith('image/');
    if (!isImageMime && !ALLOWED_EXTENSIONS.includes(ext)) {
      setBanner({
        type: 'error',
        text: `Unsupported format for ${label}. Please choose a JPG, JPEG, PNG, WEBP, or HEIC image.`,
      });
      return false;
    }
    return true;
  };

  // Mutation: Save Profile, Avatar & Cover Banner
  const updateProfileMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axiosClient.patch('/accounts/me/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: async (data) => {
      const newVersion = Date.now();
      setMediaVersion(newVersion);
      setImgLoadError(false);
      setCoverLoadError(false);
      setPreviewUrl(null);
      setCoverPreviewUrl(null);

      try {
        const stored = JSON.parse(localStorage.getItem('smartrent_user') || '{}');
        const resolvedAvatar = resolveMobileSafeImageUrl(
          data.profile_picture_url || data.profile_picture_path || data.profile_picture,
          newVersion
        );
        const resolvedCover = resolveMobileSafeImageUrl(
          data.cover_picture_url || data.cover_picture_path,
          newVersion
        );
        localStorage.setItem(
          'smartrent_user',
          JSON.stringify({
            ...stored,
            ...data,
            profile_picture_url: resolvedAvatar || data.profile_picture_url,
            cover_picture_url: resolvedCover || data.cover_picture_url,
          })
        );
      } catch {
        // Ignore storage errors
      }

      if (typeof refreshProfile === 'function') {
        await refreshProfile();
      }
      queryClient.invalidateQueries({ queryKey: ['meProfileSettings'] });
      queryClient.invalidateQueries({ queryKey: ['tenantMeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['adminUsersManagement'] });

      setBanner({
        type: 'success',
        text: data.message || 'Updated successfully across all devices!',
      });
    },
    onError: (err) => {
      const errData = err.response?.data;
      const errMsg =
        errData?.error ||
        errData?.profile_picture?.[0] ||
        errData?.full_name?.[0] ||
        errData?.detail ||
        'Failed to update profile. Please try again.';
      setBanner({ type: 'error', text: errMsg });
    },
  });

  // Instant Upload when Camera Icon on Avatar is clicked
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateSelectedImage(file, 'Profile image')) {
      e.target.value = '';
      return;
    }
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setImgLoadError(false);
    setPreviewUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('profile_picture', file);
    if (fullName.trim()) formData.append('full_name', fullName.trim());
    if (phoneNumber.trim()) formData.append('phone_number', phoneNumber.trim());
    updateProfileMutation.mutate(formData);
    e.target.value = '';
  };

  // Instant Upload when Camera Icon on Cover Banner is clicked
  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateSelectedImage(file, 'Cover banner image')) {
      e.target.value = '';
      return;
    }
    if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    setCoverLoadError(false);
    setCoverPreviewUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('cover_picture', file);
    if (fullName.trim()) formData.append('full_name', fullName.trim());
    if (phoneNumber.trim()) formData.append('phone_number', phoneNumber.trim());
    updateProfileMutation.mutate(formData);
    e.target.value = '';
  };

  // Instant Remove Cover Banner
  const handleRemoveCover = () => {
    setCoverPreviewUrl(null);
    const formData = new FormData();
    formData.append('remove_cover_picture', 'true');
    if (fullName.trim()) formData.append('full_name', fullName.trim());
    if (phoneNumber.trim()) formData.append('phone_number', phoneNumber.trim());
    updateProfileMutation.mutate(formData);
  };

  // Save Text Details (Full Name & Mobile Number)
  const handleUpdateProfile = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('full_name', fullName.trim());
    formData.append('phone_number', phoneNumber.trim());
    updateProfileMutation.mutate(formData);
  };

  // Mutation: Request Password Reset OTP
  const requestOTPMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post('/accounts/password/request-otp/', {
        email: activeUser.email,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResetStep(2);
      setBanner({
        type: 'success',
        text: data.message || `6-digit verification OTP sent to ${activeUser.email}.`,
      });
    },
    onError: (err) => {
      setBanner({
        type: 'error',
        text: err.response?.data?.error || 'Failed to send OTP. Please try again.',
      });
    },
  });

  // Mutation: Confirm Password Reset with OTP
  const confirmOTPMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await axiosClient.post('/accounts/password/confirm-otp/', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setResetStep(1);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setBanner({
        type: 'success',
        text: data.message || 'Password updated successfully!',
      });
    },
    onError: (err) => {
      setBanner({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.otp_code?.[0] ||
          err.response?.data?.new_password?.[0] ||
          'Invalid or expired OTP code.',
      });
    },
  });

  const handleConfirmPasswordChange = (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setBanner({
        type: 'error',
        text: 'New password must be at least 6 characters long.',
      });
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      setBanner({
        type: 'error',
        text: 'New password and confirm password do not match.',
      });
      return;
    }
    confirmOTPMutation.mutate({
      email: activeUser.email,
      otp_code: otpCode.trim(),
      new_password: newPassword,
    });
  };

  const rawAvatarSource =
    activeUser?.profile_picture_path ||
    activeUser?.profile_picture_url ||
    activeUser?.profile_picture ||
    null;

  const displayedAvatarUrl =
    previewUrl ||
    (!imgLoadError ? resolveMobileSafeImageUrl(rawAvatarSource, mediaVersion) : null);

  const rawCoverSource =
    activeUser?.cover_picture_path || activeUser?.cover_picture_url || null;

  const displayedCoverUrl =
    coverPreviewUrl ||
    (!coverLoadError ? resolveMobileSafeImageUrl(rawCoverSource, mediaVersion) : null);

  const citFrontUrl = resolveMobileSafeImageUrl(activeUser?.citizenship_front_url);
  const citBackUrl = resolveMobileSafeImageUrl(activeUser?.citizenship_back_url);

  // Build Gallery Items for Fullscreen Photo Lightbox
  const galleryItems = [];
  if (displayedAvatarUrl) {
    galleryItems.push({
      key: 'AVATAR',
      url: displayedAvatarUrl,
      title: `${activeUser.full_name || 'User'} — Profile Photo`,
      subtitle: activeUser.email,
    });
  }
  if (displayedCoverUrl) {
    galleryItems.push({
      key: 'COVER',
      url: displayedCoverUrl,
      title: `${activeUser.full_name || 'User'} — Cover Banner`,
      subtitle: activeUser.email,
    });
  }
  if (citFrontUrl) {
    galleryItems.push({
      key: 'CIT_FRONT',
      url: citFrontUrl,
      title: 'Citizenship ID — Front Side',
      subtitle: `Citizenship No: ${activeUser.citizenship_number || 'N/A'}`,
    });
  }
  if (citBackUrl) {
    galleryItems.push({
      key: 'CIT_BACK',
      url: citBackUrl,
      title: 'Citizenship ID — Back Side',
      subtitle: `Citizenship No: ${activeUser.citizenship_number || 'N/A'}`,
    });
  }

  const openPhotoLightbox = (itemsList, startIndex = 0) => {
    const valid = itemsList.filter((i) => Boolean(i?.url));
    if (valid.length === 0) return;
    setLightboxState({
      isOpen: true,
      items: valid,
      currentIndex: Math.min(startIndex, valid.length - 1),
      zoom: 1,
    });
  };

  const closePhotoLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false, zoom: 1 }));
  };

  const roomDetails = activeUser?.room_details || activeUser?.assigned_room || null;
  const recentBills = Array.isArray(activeUser?.recent_bills) ? activeUser.recent_bills : [];

  if (isLoading && !activeUser?.email) {
    return (
      <div className="min-h-[65vh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs font-extrabold uppercase tracking-wider">
          Loading Profile & Telemetry...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Hidden File Inputs Triggered by Hero Camera Icons */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif"
        onChange={handleAvatarChange}
        className="hidden"
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif"
        onChange={handleCoverChange}
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* 1. HERO PROFILE HEADER CARD WITH DIRECT CAMERA UPLOADS & FULLSCREEN VIEW  */}
      {/* ========================================================================= */}
      <div className="relative rounded-3xl overflow-hidden bg-white border border-slate-200/90 shadow-sm">
        {/* Top Cover / Banner Image Area */}
        <div
          onClick={() => {
            if (displayedCoverUrl) {
              const idx = galleryItems.findIndex((g) => g.key === 'COVER');
              openPhotoLightbox(galleryItems, idx >= 0 ? idx : 0);
            } else {
              coverInputRef.current?.click();
            }
          }}
          className="h-44 sm:h-60 bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-500 relative overflow-hidden cursor-pointer group"
          title={
            displayedCoverUrl
              ? 'Click to view Cover Banner fullscreen'
              : 'Click to upload Cover Banner (up to 5 MB)'
          }
        >
          {displayedCoverUrl ? (
            <img
              src={displayedCoverUrl}
              alt="Profile Cover Banner"
              onError={() => setCoverLoadError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            />
          ) : (
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-900/15 to-transparent" />

          {/* Top Left Account Badge */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 left-4 sm:top-5 sm:left-6 flex flex-wrap items-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/55 backdrop-blur-md text-white text-[11px] font-extrabold border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {isAdmin ? 'Landlord Executive Account' : 'Verified SmartRent Member'}
            </span>
            {activeUser.joined_at && (
              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900/45 backdrop-blur-md text-white/90 text-[11px] font-bold border border-white/15">
                <Calendar className="w-3 h-3 text-indigo-300" /> Joined {activeUser.joined_at}
              </span>
            )}
          </div>

          {/* Top Right Camera & Lightbox Buttons for Cover Banner */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 sm:top-5 sm:right-6 flex items-center gap-2"
          >
            {galleryItems.length > 0 && (
              <button
                type="button"
                onClick={() => openPhotoLightbox(galleryItems, 0)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/65 hover:bg-slate-900 text-white text-xs font-extrabold backdrop-blur-md border border-white/20 transition"
                title="Open Photo Viewer"
              >
                <ZoomIn className="w-3.5 h-3.5 text-indigo-300" />
                <span className="hidden sm:inline">Photos ({galleryItems.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={updateProfileMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/95 hover:bg-white text-slate-900 text-xs font-extrabold shadow-lg backdrop-blur-md transition transform hover:scale-[1.02]"
              title="Upload Cover Banner (JPG, PNG, WEBP, HEIC up to 5 MB)"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>{displayedCoverUrl ? 'Change Cover' : 'Add Cover'}</span>
            </button>

            {displayedCoverUrl && (
              <button
                type="button"
                onClick={handleRemoveCover}
                disabled={updateProfileMutation.isPending}
                className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white shadow-lg transition"
                title="Remove Cover Banner"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Avatar & Quick Identity Summary */}
        <div className="px-5 sm:px-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
              {/* Interactive Profile Avatar with Camera Icon */}
              <div
                onClick={() => {
                  if (displayedAvatarUrl) {
                    const idx = galleryItems.findIndex((g) => g.key === 'AVATAR');
                    openPhotoLightbox(galleryItems, idx >= 0 ? idx : 0);
                  } else {
                    avatarInputRef.current?.click();
                  }
                }}
                className="relative group w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white p-1.5 shadow-xl border border-slate-200/80 shrink-0 cursor-pointer"
                title={
                  displayedAvatarUrl
                    ? 'Click to view Profile Photo fullscreen'
                    : 'Click to upload Profile Photo (up to 5 MB)'
                }
              >
                {displayedAvatarUrl ? (
                  <>
                    <img
                      src={displayedAvatarUrl}
                      alt={activeUser.full_name || 'Profile'}
                      onError={() => setImgLoadError(true)}
                      className="w-full h-full rounded-2xl object-cover bg-slate-100 group-hover:brightness-95 transition"
                    />
                    <div className="absolute inset-1.5 rounded-2xl bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <ZoomIn className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-4xl flex items-center justify-center">
                    {(activeUser.full_name || activeUser.email || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    avatarInputRef.current?.click();
                  }}
                  disabled={updateProfileMutation.isPending}
                  className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 border-2 border-white transition transform hover:scale-105"
                  title="Upload New Profile Avatar (Up to 5 MB)"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="pt-1 sm:pb-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {activeUser.full_name || 'SmartRent User'}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                      isAdmin
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {isAdmin ? 'Landlord Admin' : 'Verified Tenant'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                      activeUser.kyc_status === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeUser.kyc_status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    KYC: {activeUser.kyc_status || 'PENDING'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    {activeUser.email}
                  </span>
                  {activeUser.phone_number && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      {activeUser.phone_number}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:pb-1">
              <button
                type="button"
                onClick={() => navigate(isAdmin ? '/admin-deck' : '/tenant')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition"
              >
                <span>Open {isAdmin ? 'Command Center' : 'Billing & Lease Desk'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 2. THE 4 EXECUTIVE TELEMETRY CARDS (ASSIGNED ROOM, BILLS, PAID, ID)   */}
          {/* ===================================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
            {/* Card 1: Assigned Room */}
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100/90 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">
                ASSIGNED ROOM
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">
                {roomDetails?.room_number
                  ? `Room ${roomDetails.room_number}`
                  : activeUser.room_number
                  ? `Room ${activeUser.room_number}`
                  : 'Unassigned'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {roomDetails
                  ? `${roomDetails.floor || 'Active Unit'} • Rs. ${Number(
                      roomDetails.base_rent || 0
                    ).toLocaleString()}/mo`
                  : 'No active unit'}
              </p>
            </div>

            {/* Card 2: Pending / Unpaid Bills */}
            <div
              onClick={() => navigate('/tenant')}
              className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                Number(activeUser.pending_bills_count || 0) > 0
                  ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300'
                  : 'bg-emerald-50/60 border-emerald-200/90 hover:border-emerald-300'
              }`}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                PENDING / UNPAID BILLS
              </span>
              <p
                className={`text-xl font-black mt-1 ${
                  Number(activeUser.pending_bills_count || 0) > 0
                    ? 'text-rose-600'
                    : 'text-emerald-700'
                }`}
              >
                Rs. {Number(activeUser.total_pending_amount || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {Number(activeUser.pending_bills_count || 0) > 0
                  ? `${activeUser.pending_bills_count} open bill(s) awaiting action`
                  : 'No pending dues'}
              </p>
            </div>

            {/* Card 3: Total Paid History */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                TOTAL PAID HISTORY
              </span>
              <p className="text-xl font-black text-slate-900 mt-1">
                Rs. {Number(activeUser.total_paid_amount || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeUser.paid_bills_count || 0} settled invoice(s)
              </p>
            </div>

            {/* Card 4: Digital Lease & ID */}
            <div
              onClick={() => navigate('/tenant')}
              className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 hover:border-indigo-200 cursor-pointer transition flex flex-col justify-between"
            >
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                DIGITAL LEASE & ID
              </span>
              <p className="text-xl font-black text-slate-900 mt-1 truncate">
                {activeUser.citizenship_number || 'No ID No.'}
              </p>
              <p
                className={`text-xs font-extrabold mt-0.5 ${
                  activeUser.has_accepted_lease ? 'text-emerald-600' : 'text-emerald-600'
                }`}
              >
                {activeUser.has_accepted_lease
                  ? `✓ Lease Signed (${activeUser.lease_accepted_at || 'Verified'})`
                  : 'Lease Pending'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK ALERT BANNER */}
      {banner.text && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-2xs ${
            banner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : banner.type === 'info'
              ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner({ type: '', text: '' })}
            className="p-1 rounded-lg hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ROOM TELEMETRY, LEGAL & EMERGENCY CONTACTS, AND PHOTO GALLERY          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Room & Sub-Meter Utility Telemetry */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Home className="w-4 h-4 text-indigo-600" /> Room & Utility Telemetry
            </h3>
            {roomDetails && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                Active Tenancy
              </span>
            )}
          </div>

          {roomDetails ? (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">
                  Move-In Date
                </span>
                <strong className="text-sm text-slate-900 mt-0.5 block">
                  {roomDetails.entry_date || activeUser.entry_date || 'Verified'}
                </strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70">
                <span className="text-amber-700 font-bold uppercase text-[10px] block">
                  Next Rent Due Date
                </span>
                <strong className="text-sm text-slate-900 mt-0.5 block">
                  {roomDetails.next_due_date || 'Upcoming'}
                </strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-indigo-600 font-bold uppercase text-[10px] block">
                  Last Sub-Meter Reading
                </span>
                <strong className="text-sm text-indigo-950 mt-0.5 block">
                  {roomDetails.current_meter_reading ?? 0} kWh units
                </strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">
                  Utility Tariff
                </span>
                <strong className="text-sm text-slate-900 mt-0.5 block">
                  Rs. {roomDetails.electricity_rate ?? 15}/u • Water Rs.{' '}
                  {roomDetails.fixed_water_bill ?? 100}
                </strong>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
              <p className="text-xs font-bold text-slate-600">
                No active room assigned to your account right now.
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition"
              >
                Browse Available Rooms <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Legal KYC & Emergency Contact Overview */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Legal Identity & Emergency Contact
            </h3>
            <button
              type="button"
              onClick={() => navigate('/tenant')}
              className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800"
            >
              Manage KYC →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">
                Legal Full Name
              </span>
              <strong className="text-sm text-slate-900 mt-0.5 block truncate">
                {activeUser.full_name_legal || activeUser.full_name || 'Not set'}
              </strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">
                Citizenship Number
              </span>
              <strong className="text-sm text-slate-900 mt-0.5 block truncate">
                {activeUser.citizenship_number || 'Not submitted'}
              </strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">
                Emergency Contact
              </span>
              <strong className="text-sm text-slate-900 mt-0.5 block truncate">
                {activeUser.emergency_contact_name || 'Not provided'}
              </strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">
                Emergency Phone
              </span>
              <strong className="text-sm text-slate-900 mt-0.5 block truncate">
                {activeUser.emergency_contact_phone || 'Not provided'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PERSONAL INFORMATION FORM & EMAIL OTP PASSWORD SECURITY                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 COLS): PERSONAL DETAILS */}
        <div className="lg:col-span-7 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Personal Information
                </h2>
                <p className="text-xs text-slate-500">
                  Update your full name and registered contact number
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-3 text-sm font-semibold rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Email (Locked)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={activeUser.email || ''}
                    className="w-full pl-10 pr-4 py-3 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full pl-10 pr-4 py-3 text-sm font-semibold rounded-xl border border-slate-200 focus:border-indigo-600 outline-none transition"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Personal Details
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN (5 COLS): PASSWORD SECURITY VIA EMAIL OTP */}
        <div className="lg:col-span-5 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Password Security
              </h2>
              <p className="text-xs text-slate-500">
                2-Step Email OTP verification for password changes
              </p>
            </div>
          </div>

          {resetStep === 1 ? (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Protected by Email Verification</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  To change your password, we send a secure 6-digit verification code to{' '}
                  <strong className="text-slate-900">{activeUser.email}</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => requestOTPMutation.mutate()}
                disabled={requestOTPMutation.isPending}
                className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                {requestOTPMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending OTP to Email...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Send Password Reset OTP
                  </>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirmPasswordChange} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                <span className="truncate pr-2">
                  OTP sent to <strong>{activeUser.email}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => requestOTPMutation.mutate()}
                  disabled={requestOTPMutation.isPending}
                  className="inline-flex items-center gap-1 font-extrabold text-emerald-700 hover:text-emerald-900 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" /> Resend
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  6-Digit OTP
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-4 py-3 text-sm font-black tracking-[0.3em] text-center rounded-xl border-2 border-indigo-200 focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-4 pr-10 py-3 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition"
                    tabIndex={-1}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-4 pr-10 py-3 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition"
                    tabIndex={-1}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetStep(1);
                    setOtpCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  className="py-3 px-4 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmOTPMutation.isPending}
                  className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-md transition"
                >
                  {confirmOTPMutation.isPending ? 'Updating...' : 'Verify OTP & Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. UPLOADED IDENTITY & PROFILE PHOTOS GALLERY + RECENT BILLS              */}
      {/* ========================================================================= */}
      <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-600" /> My Uploaded Identity & Profile Photos
            </h3>
            <p className="text-xs text-slate-500">
              Click any photo below to open it in fullscreen photo viewer mode
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Profile Avatar', url: displayedAvatarUrl, key: 'AVATAR' },
            { label: 'Cover Banner', url: displayedCoverUrl, key: 'COVER' },
            { label: 'Citizenship Front', url: citFrontUrl, key: 'CIT_FRONT' },
            { label: 'Citizenship Back', url: citBackUrl, key: 'CIT_BACK' },
          ].map((item) => {
            const gIdx = galleryItems.findIndex((g) => g.key === item.key);
            return (
              <div
                key={item.key}
                onClick={() => {
                  if (item.url) {
                    openPhotoLightbox(galleryItems, gIdx >= 0 ? gIdx : 0);
                  }
                }}
                className={`rounded-2xl border overflow-hidden bg-slate-50 flex flex-col justify-between ${
                  item.url
                    ? 'border-slate-200 cursor-pointer group hover:border-indigo-400 hover:shadow-md transition'
                    : 'border-dashed border-slate-200 opacity-75'
                }`}
              >
                <div className="h-32 w-full bg-slate-900/5 relative overflow-hidden flex items-center justify-center">
                  {item.url ? (
                    <>
                      <img
                        src={item.url}
                        alt={item.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-extrabold transition">
                        <ZoomIn className="w-4 h-4" /> View Photo
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400">Not Uploaded</span>
                  )}
                </div>
                <div className="px-3 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 truncate">
                    {item.label}
                  </span>
                  {item.url && <ZoomIn className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Invoices & Proofs Table */}
        {recentBills.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" /> Recent Billing & Payment Proofs
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Billing Cycle</th>
                    <th className="py-3 px-4">Total Payable</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Proof Photos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBills.map((b) => {
                    const mUrl = resolveMobileSafeImageUrl(b.meter_photo_url);
                    const pUrl = resolveMobileSafeImageUrl(b.payment_screenshot_url);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <p className="font-extrabold text-slate-900">{b.billing_month_label}</p>
                          <p className="text-[11px] text-slate-500">
                            Room {b.room_number} • Due: {b.due_date}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900">
                          Rs. {Number(b.total_payable).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                              b.status === 'APPROVED' || b.status === 'PAID_CASH'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'PENDING_VERIFICATION'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {b.status_display}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {mUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openPhotoLightbox([
                                    {
                                      url: mUrl,
                                      title: `Meter Photo — ${b.billing_month_label}`,
                                      subtitle: `Room ${b.room_number}`,
                                    },
                                  ])
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px]"
                              >
                                <Camera className="w-3 h-3" /> Meter
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">No Meter</span>
                            )}
                            {pUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openPhotoLightbox([
                                    {
                                      url: pUrl,
                                      title: `Payment Receipt — ${b.billing_month_label}`,
                                      subtitle: `Room ${b.room_number} • Rs. ${b.total_payable}`,
                                    },
                                  ])
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px]"
                              >
                                <CreditCard className="w-3 h-3" /> Receipt
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">No Slip</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FULLSCREEN PHOTO LIGHTBOX MODAL                                           */}
      {/* ========================================================================= */}
      {lightboxState.isOpen && lightboxState.items.length > 0 && (() => {
        const currentPhoto =
          lightboxState.items[lightboxState.currentIndex] || lightboxState.items[0];
        const totalPhotos = lightboxState.items.length;

        return (
          <div
            onClick={closePhotoLightbox}
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 text-white"
            >
              <div>
                <h3 className="text-sm sm:text-base font-extrabold">{currentPhoto.title}</h3>
                {currentPhoto.subtitle && (
                  <p className="text-xs text-slate-400">{currentPhoto.subtitle}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold">
                  {lightboxState.currentIndex + 1} / {totalPhotos}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxState((prev) => ({
                      ...prev,
                      zoom: Math.max(0.5, Number((prev.zoom - 0.25).toFixed(2))),
                    }))
                  }
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxState((prev) => ({
                      ...prev,
                      zoom: 1,
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-extrabold text-white transition"
                >
                  {Math.round(lightboxState.zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxState((prev) => ({
                      ...prev,
                      zoom: Math.min(2.5, Number((prev.zoom + 0.25).toFixed(2))),
                    }))
                  }
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadFileFromUrl(
                      currentPhoto.url,
                      `${(currentPhoto.title || 'SmartRent-Photo').replace(/\s+/g, '-')}.jpg`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  type="button"
                  onClick={closePhotoLightbox}
                  className="p-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 flex items-center justify-center overflow-hidden my-4">
              {totalPhotos > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxState((prev) => ({
                      ...prev,
                      zoom: 1,
                      currentIndex:
                        (prev.currentIndex - 1 + prev.items.length) % prev.items.length,
                    }));
                  }}
                  className="absolute left-2 sm:left-6 z-20 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <img
                src={currentPhoto.url}
                alt={currentPhoto.title}
                onClick={(e) => e.stopPropagation()}
                style={{ transform: `scale(${lightboxState.zoom})` }}
                className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-transform duration-200"
              />

              {totalPhotos > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxState((prev) => ({
                      ...prev,
                      zoom: 1,
                      currentIndex: (prev.currentIndex + 1) % prev.items.length,
                    }));
                  }}
                  className="absolute right-2 sm:right-6 z-20 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {totalPhotos > 1 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-2.5 overflow-x-auto py-2"
              >
                {lightboxState.items.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setLightboxState((prev) => ({
                        ...prev,
                        currentIndex: idx,
                        zoom: 1,
                      }))
                    }
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                      lightboxState.currentIndex === idx
                        ? 'border-indigo-400 scale-105 shadow-lg'
                        : 'border-white/20 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
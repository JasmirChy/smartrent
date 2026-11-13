import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Zap,
  Droplets,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Trash2,
  ImagePlus,
  Building,
  Sparkles,
  Moon,
  AlertTriangle,
  ArrowRight,
  Loader2,
  X,
  BellRing,
  Play,
  Pause,
  ZoomIn,
  Layers,
  Wrench,
  Lock,
  Car,
  Users,
  CreditCard,
  MessageSquare,
  Ban,
  LogOut,
  HeartHandshake,
  FileCheck2,
} from 'lucide-react';
import axiosClient, { createReservation, acceptDigitalLease } from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { formatDualDate, formatBSOnly } from '../utils/nepaliDate';

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85';

const MAX_BANNER_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const HOUSE_RULES_CATEGORIES = [
  {
    id: 1,
    title: '1. Cleanliness & Hygiene',
    subtitle: 'Sanitation standards for rooms, kitchens, drains, and shared spaces',
    icon: Sparkles,
    iconBg: 'bg-emerald-50 text-emerald-600',
    items: [
      'Keep rooms, bathrooms, and shared spaces clean.',
      'Dispose of garbage in designated dustbins.',
      'Clean kitchens and shared facilities after use.',
      'Do not throw waste, sanitary products, or food into drains or toilets.',
      'Maintain cleanliness around the building.',
    ],
  },
  {
    id: 2,
    title: '2. Property Damage & Maintenance',
    subtitle: 'Care of walls, fixtures, and reporting of maintenance issues',
    icon: Wrench,
    iconBg: 'bg-indigo-50 text-indigo-600',
    items: [
      'Take proper care of walls, doors, furniture, and fixtures.',
      'Do not modify, drill, or repaint property without permission.',
      'Report leaks, breakages, and maintenance issues immediately.',
      'Tenants are responsible for damage caused by negligence or misuse.',
      'Normal wear and tear is not chargeable.',
    ],
  },
  {
    id: 3,
    title: '3. Electricity & Water Usage',
    subtitle: 'Responsible utility consumption and sub-meter integrity',
    icon: Zap,
    iconBg: 'bg-amber-50 text-amber-600',
    items: [
      'Switch off lights and appliances when not in use.',
      'Avoid unnecessary electricity and water wastage.',
      'Use high-power appliances responsibly.',
      'Do not tamper with meters, wiring, or connections.',
      'Pay utility bills within the agreed deadline.',
    ],
  },
  {
    id: 4,
    title: '4. Noise & Peaceful Environment',
    subtitle: 'Quiet hours (10:00 PM – 6:00 AM) and neighborly conduct',
    icon: Moon,
    iconBg: 'bg-violet-50 text-violet-600',
    items: [
      'Avoid loud music, shouting, and unnecessary disturbances.',
      'Maintain quiet hours from 10:00 PM to 6:00 AM.',
      'Respect neighbors and other tenants.',
      'Fighting, threatening, or disruptive behavior is prohibited.',
    ],
  },
  {
    id: 5,
    title: '5. Security & Safety',
    subtitle: 'Access control, appliance safety, and emergency awareness',
    icon: Lock,
    iconBg: 'bg-teal-50 text-teal-600',
    items: [
      'Lock rooms and entrances when leaving.',
      'Do not share keys or access codes with unauthorized people.',
      'Inform the owner about overnight guests.',
      'Never leave cooking appliances unattended.',
      'Do not keep hazardous or illegal materials on the property.',
      'Report suspicious activities and emergencies immediately.',
    ],
  },
  {
    id: 6,
    title: '6. Parking & Common Areas',
    subtitle: 'Designated parking and unobstructed corridors & staircases',
    icon: Car,
    iconBg: 'bg-sky-50 text-sky-600',
    items: [
      'Park vehicles only in designated spaces.',
      'Keep corridors, staircases, and balconies clean.',
      'Do not block entrances or other vehicles.',
      'Do not misuse or damage shared facilities.',
      'Keep common areas accessible to everyone.',
    ],
  },
  {
    id: 7,
    title: '7. Visitors & Guests',
    subtitle: 'Guest conduct and prior notice for overnight stays',
    icon: Users,
    iconBg: 'bg-indigo-50 text-indigo-600',
    items: [
      "Tenants are responsible for their visitors' behavior.",
      'Inform the owner about overnight or extended stays.',
      'Ensure guests respect other residents and house rules.',
      'Visitors must not damage property or disturb others.',
    ],
  },
  {
    id: 8,
    title: '8. Rent & Bill Payments',
    subtitle: 'Timely monthly settlement and receipt record-keeping',
    icon: CreditCard,
    iconBg: 'bg-emerald-50 text-emerald-600',
    items: [
      'Pay monthly rent and utility bills on time.',
      'Clear outstanding payments within the agreed period.',
      'Inform the owner about possible payment delays.',
      'Keep payment receipts for future reference.',
      'Follow agreed rent and billing arrangements.',
    ],
  },
  {
    id: 9,
    title: '9. Maintenance & Communication',
    subtitle: 'Official reporting channels and inspection cooperation',
    icon: MessageSquare,
    iconBg: 'bg-blue-50 text-blue-600',
    items: [
      'Report maintenance problems and damages promptly.',
      'Obtain permission before making repairs or modifications.',
      'Cooperate with scheduled inspections after prior notice.',
      'Report complaints through the website or directly to the owner.',
      'Allow necessary access during emergencies.',
    ],
  },
  {
    id: 10,
    title: '10. Additional Restrictions',
    subtitle: 'Policies on pets, subletting, commercial use, and privacy',
    icon: Ban,
    iconBg: 'bg-rose-50 text-rose-600',
    items: [
      'Illegal activities are strictly prohibited.',
      'Pets require prior owner approval.',
      'Subletting requires written permission.',
      'Unauthorized commercial activities are not allowed.',
      "Respect everyone's privacy and personal belongings.",
    ],
  },
  {
    id: 11,
    title: '11. Damage Fines & Penalties',
    subtitle: 'Official penalty schedule and transparent fine enforcement rules',
    icon: AlertTriangle,
    iconBg: 'bg-rose-100 text-rose-600',
    isHighlightedFineCategory: true,
    items: [
      'Every fine must include a clear reason.',
      'Photographic evidence should be attached whenever possible.',
      'Tenants receive notifications for issued fines.',
      'Tenants can review and dispute fines.',
      'Repair costs must have supporting evidence.',
      'No fines for normal wear and tear.',
      'All penalties must be reasonable and follow the rental agreement and applicable law.',
    ],
  },
  {
    id: 12,
    title: '12. Moving In & Moving Out',
    subtitle: 'Registration, handover inspection, advance notice, and final settlement',
    icon: LogOut,
    iconBg: 'bg-amber-50 text-amber-600',
    items: [
      'Complete registration before occupying the room.',
      'Inspect and report existing damages during handover.',
      'Provide advance notice before vacating.',
      'Clear outstanding rent and bills before departure.',
      'Return keys and owner-provided belongings.',
      'Complete the final inspection before deposit settlement.',
    ],
  },
  {
    id: 13,
    title: '13. General Responsibilities',
    subtitle: 'Community harmony, announcements, and agreement compliance',
    icon: HeartHandshake,
    iconBg: 'bg-teal-50 text-teal-600',
    items: [
      'Respect other tenants, their privacy, and belongings.',
      'Maintain a friendly and cooperative environment.',
      'Follow owner announcements and instructions.',
      'Keep registered contact information updated.',
      'Repeated violations may result in action under the rental agreement.',
    ],
  },
];

const DAMAGE_FINE_PENALTIES = [
  { violation: 'Littering in shared areas', penalty: 'NPR 100–200' },
  { violation: 'Repeated noise disturbances', penalty: 'NPR 200–500' },
  { violation: 'Intentional water wastage', penalty: 'Actual additional cost' },
  { violation: 'Damaged furniture or fixtures', penalty: 'Repair/replacement cost' },
  { violation: 'Plumbing or electrical damage', penalty: 'Actual repair cost' },
  { violation: 'Unauthorized modifications', penalty: 'Restoration cost' },
  { violation: 'Damage caused by guests', penalty: 'Actual repair cost' },
];

const FINE_GUIDELINES_LIST = [
  'Every fine must include a clear reason.',
  'Photographic evidence should be attached whenever possible.',
  'Tenants receive notifications for issued fines.',
  'Tenants can review and dispute fines.',
  'Repair costs must have supporting evidence.',
  'No fines for normal wear and tear.',
  'All penalties must be reasonable and follow the rental agreement and applicable law.',
];

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

export default function PublicLanding() {
  const { user, isAdmin, openAuthModal, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI Filter & Slideshow States
  const [floorFilter, setFloorFilter] = useState('ALL'); // ALL | GROUND | FIRST
  const [availableOnly, setAvailableOnly] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isHoveringHero, setIsHoveringHero] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // 13-Category Accordion & Tenant Acknowledgment States
  const [openRuleIndex, setOpenRuleIndex] = useState(0);
  const [expandAllRules, setExpandAllRules] = useState(false);
  const [rulesAcceptedLocal, setRulesAcceptedLocal] = useState(() => {
    try {
      return localStorage.getItem('smartrent_rules_accepted') === 'true';
    } catch {
      return false;
    }
  });
  const [rulesAckMsg, setRulesAckMsg] = useState('');

  // Reservation Modal States
  const [reservingRoom, setReservingRoom] = useState(null);
  const [requestType, setRequestType] = useState('RESERVE');
  const [moveInDate, setMoveInDate] = useState(new Date().toISOString().split('T')[0]);
  const [occupantsCount, setOccupantsCount] = useState(1);
  const [phoneNum, setPhoneNum] = useState(user?.phone_number || '');
  const [occupation, setOccupation] = useState('');
  const [message, setMessage] = useState('');
  const [tokenAmount, setTokenAmount] = useState('500');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [citizenshipDoc, setCitizenshipDoc] = useState(null);
  const [reservationMsg, setReservationMsg] = useState({ type: '', text: '' });

  // Admin Multi-Image Hero Banner Manager States
  const [showBannerEditor, setShowBannerEditor] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('Studio B2 • Balcony Suite');
  const [bannerSubtitle, setBannerSubtitle] = useState(
    'Sub-meter #M-202 • Digital Telemetry Active'
  );
  const [bannerBadge, setBannerBadge] = useState('Physical Inspection Passed');
  const [bannerFiles, setBannerFiles] = useState([]); // Array of File objects
  const [bannerPreviews, setBannerPreviews] = useState([]); // Array of { name, url, sizeMB }
  const [bannerFeedback, setBannerFeedback] = useState({ type: '', text: '' });

  // Fetch live Landing Data
  const { data, isLoading } = useQuery({
    queryKey: ['publicLandingData'],
    queryFn: async () => {
      const res = await axiosClient.get('/rooms/landing/');
      return res.data;
    },
    refetchInterval: 4000,
  });

  const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
  const rawBanners = Array.isArray(data?.banners) ? data.banners : [];
  const notices = Array.isArray(data?.notices) ? data.notices : [];
  const stats = data?.stats || { total_rooms: 9, occupied_rooms: 0, available_rooms: 9 };

  const hasAcceptedRules = Boolean(user?.has_accepted_lease || rulesAcceptedLocal);

  // Normalize banner image URLs for both laptop and mobile
  const banners = rawBanners.map((b) => ({
    ...b,
    resolved_url:
      getSafeMediaUrl(b.image_path || b.image_url || b.image) || DEFAULT_HERO_IMAGE,
  }));

  // Keep activeSlide in bounds when banners array changes
  useEffect(() => {
    if (banners.length > 0 && activeSlide >= banners.length) {
      setActiveSlide(0);
    }
  }, [banners.length, activeSlide]);

  // Auto-advance slideshow timer (every 4.5 seconds unless paused or hovered)
  useEffect(() => {
    if (!isAutoPlaying || isHoveringHero || showLightbox || banners.length <= 1) {
      return undefined;
    }
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isAutoPlaying, isHoveringHero, showLightbox, banners.length]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      bannerPreviews.forEach((p) => {
        if (p.url && p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, [bannerPreviews]);

  // Mutation: Accept House Rules & Digital Lease Acknowledgment
  const acceptRulesMutation = useMutation({
    mutationFn: acceptDigitalLease,
    onSuccess: async (resData) => {
      try {
        localStorage.setItem('smartrent_rules_accepted', 'true');
      } catch {
        // Ignore storage errors
      }
      setRulesAcceptedLocal(true);
      setRulesAckMsg(
        resData?.message ||
          'Thank you! Your acknowledgment of the House Rules & Guidelines has been recorded.'
      );
      if (typeof refreshProfile === 'function') {
        await refreshProfile();
      }
      queryClient.invalidateQueries({ queryKey: ['tenantKYC'] });
      queryClient.invalidateQueries({ queryKey: ['tenantMeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['meProfileSettings'] });
    },
    onError: () => {
      try {
        localStorage.setItem('smartrent_rules_accepted', 'true');
      } catch {
        // Ignore storage errors
      }
      setRulesAcceptedLocal(true);
      setRulesAckMsg('House Rules & Guidelines acknowledgment saved!');
    },
  });

  const handleAcceptHouseRules = () => {
    if (user) {
      acceptRulesMutation.mutate();
    } else {
      try {
        localStorage.setItem('smartrent_rules_accepted', 'true');
      } catch {
        // Ignore storage errors
      }
      setRulesAcceptedLocal(true);
      setRulesAckMsg(
        'You have accepted the House Rules & Guidelines! Sign in anytime to link this acknowledgment to your tenant profile.'
      );
    }
  };

  // Admin Mutation: Upload Multiple Hero Images at once
  const uploadBannerMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axiosClient.post('/rooms/banners/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
      setBannerFiles([]);
      setBannerPreviews([]);
      setActiveSlide(0);
      setBannerFeedback({
        type: 'success',
        text: resData?.message || 'Hero slideshow images uploaded successfully!',
      });
    },
    onError: (err) => {
      setBannerFeedback({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to upload banner image(s). Make sure each image is under 5 MB.',
      });
    },
  });

  // Admin Mutation: Delete Hero Image
  const deleteBannerMutation = useMutation({
    mutationFn: async (bannerId) => {
      await axiosClient.delete(`/rooms/banners/${bannerId}/`);
    },
    onSuccess: () => {
      setActiveSlide((prev) => Math.max(0, prev - 1));
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
      setBannerFeedback({
        type: 'success',
        text: 'Slide removed from hero slideshow.',
      });
    },
  });

  // Reservation Submission Mutation
  const reserveMutation = useMutation({
    mutationFn: async (formData) => {
      return await createReservation(formData);
    },
    onSuccess: () => {
      setReservationMsg({
        type: 'success',
        text: 'Room reservation request submitted successfully! Landlord will review and assign.',
      });
      setTimeout(() => {
        setReservingRoom(null);
        setReservationMsg({ type: '', text: '' });
      }, 2500);
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
    },
    onError: (err) => {
      setReservationMsg({
        type: 'error',
        text:
          err.response?.data?.room?.[0] ||
          err.response?.data?.detail ||
          'Failed to submit reservation.',
      });
    },
  });

  const handleSelectMultipleBannerFiles = (e) => {
    const selectedList = Array.from(e.target.files || []);
    if (selectedList.length === 0) return;

    const validFiles = [];
    const newPreviews = [];

    for (const file of selectedList) {
      if (file.size > MAX_BANNER_SIZE_BYTES) {
        setBannerFeedback({
          type: 'error',
          text: `"${file.name}" exceeds the 5 MB limit (${(file.size / 1024 / 1024).toFixed(
            2
          )} MB).`,
        });
        continue;
      }
      validFiles.push(file);
      newPreviews.push({
        name: file.name,
        url: URL.createObjectURL(file),
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      });
    }

    if (validFiles.length > 0) {
      setBannerFiles((prev) => [...prev, ...validFiles]);
      setBannerPreviews((prev) => [...prev, ...newPreviews]);
      setBannerFeedback({
        type: 'info',
        text: `${validFiles.length} image(s) queued for slideshow upload. Click "Upload to Slideshow" below.`,
      });
    }
    e.target.value = '';
  };

  const removeQueuedBannerFile = (indexToRemove) => {
    setBannerFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setBannerPreviews((prev) => {
      const target = prev[indexToRemove];
      if (target?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const handleBannerUpload = (e) => {
    e.preventDefault();
    if (bannerFiles.length === 0) {
      setBannerFeedback({
        type: 'error',
        text: 'Please select one or more images first.',
      });
      return;
    }
    const formData = new FormData();
    formData.append('title', bannerTitle);
    formData.append('subtitle', bannerSubtitle);
    formData.append('badge_text', bannerBadge);
    formData.append('is_active', 'true');
    bannerFiles.forEach((file) => {
      formData.append('images', file);
    });
    uploadBannerMutation.mutate(formData);
  };

  const handleReservationSubmit = (e) => {
    e.preventDefault();
    if (!reservingRoom) return;

    const formData = new FormData();
    formData.append('room', reservingRoom.id);
    formData.append('request_type', requestType);
    formData.append('expected_move_in_date', moveInDate);
    formData.append('occupants_count', occupantsCount);
    formData.append('phone_number', phoneNum);
    formData.append('occupation', occupation);
    formData.append('message', message);
    formData.append('token_amount', tokenAmount || '0');
    if (paymentScreenshot) formData.append('payment_screenshot', paymentScreenshot);
    if (citizenshipDoc) formData.append('citizenship_document', citizenshipDoc);

    reserveMutation.mutate(formData);
  };

  const currentBanner = banners[activeSlide] || {
    id: null,
    title: 'Smart House Rental • Ground & 1st Floor',
    subtitle: 'Sub-metered electricity (Rs. 15/unit) & fixed water (Rs. 100/room)',
    badge_text: 'Verified Direct-Landlord Listing',
    resolved_url: DEFAULT_HERO_IMAGE,
  };

  const filterRoomList = (floorCode) => {
    return rooms.filter((r) => {
      const roomNo = String(r.room_number || '').trim().toUpperCase();
      const dbFloor = String(r.floor || '').trim().toUpperCase();

      if (floorCode === 'GROUND') {
        const isGround = dbFloor === 'GROUND' || roomNo.startsWith('A');
        if (!isGround) return false;
      } else if (floorCode === 'FIRST') {
        const isFirst =
          dbFloor === 'FIRST' || dbFloor === 'SECOND' || roomNo.startsWith('B');
        if (!isFirst) return false;
      }

      if (availableOnly && r.is_occupied) return false;
      return true;
    });
  };

  const groundRooms = filterRoomList('GROUND');
  const firstRooms = filterRoomList('FIRST');

  return (
    <div className="w-full">
      {/* Top Live Telemetry Strip */}
      <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-2 text-center">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-700">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            LIVE TELEMETRY
          </span>
          <span>
            Automated Digital Sub-Metering Active • Transparent Utility Billing (Electricity Rs.
            15/unit • Water Rs. 100/room)
          </span>
        </div>
      </div>

      {/* PUBLIC HOUSE NOTICES / ANNOUNCEMENTS BANNER */}
      {notices.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white px-4 py-3 shadow-md border-b border-indigo-700/50">
          <div className="max-w-7xl mx-auto space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-indigo-300">
              <BellRing className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              Official House Announcements
            </div>
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-white/10 p-2.5 rounded-xl backdrop-blur-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      notice.category === 'URGENT'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-indigo-500 text-white'
                    }`}
                  >
                    {notice.category_display || notice.category}
                  </span>
                  <span className="font-bold">{notice.title}:</span>
                  <span className="text-indigo-100 line-clamp-1">{notice.content}</span>
                </div>
                <span className="text-[10px] text-indigo-300 whitespace-nowrap">
                  {notice.created_at
                    ? formatDualDate(new Date(notice.created_at).toISOString().split('T')[0])
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HERO SECTION WITH MULTI-IMAGE SLIDESHOW CAROUSEL */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Headline & CTA */}
          <div className="lg:col-span-6 space-y-6 lg:pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Verified Direct-Landlord Rental Portal
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Next-Gen Living.{' '}
              <span className="text-indigo-600 block mt-1">Sub-Metered Precision.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Zero utility squabbles, transparent digital electricity and water calculation, and
              instant online/cash rent receipts. Designed for disciplined students, professionals,
              and peaceful living.
            </p>

            <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center justify-between max-w-lg">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Now Leasing — Live Room Status</p>
                  <p className="text-xs text-slate-500">
                    {stats.available_rooms} of {stats.total_rooms} Premium Rooms Vacant & Ready
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">
                GROUND & FIRST FL
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#rooms-inventory"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition"
              >
                Check Room Availability
                <ArrowRight className="w-4 h-4" />
              </a>

              {user ? (
                <button
                  onClick={() => navigate(isAdmin ? '/admin-deck' : '/tenant')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-sm font-bold shadow-sm transition"
                >
                  Open {isAdmin ? 'Admin Command Center' : 'Tenant Dashboard'}
                </button>
              ) : (
                <button
                  onClick={() => openAuthModal('LOGIN')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-sm font-bold shadow-sm transition"
                >
                  Tenant Portal Login
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/80 max-w-lg">
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900">Rs. 2,500</p>
                <p className="text-[11px] text-slate-500 font-medium">Small Rooms (A3, B4)</p>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900">Rs. 3,800</p>
                <p className="text-[11px] text-slate-500 font-medium">Standard Rooms</p>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900">Rs. 15/kWh</p>
                <p className="text-[11px] text-slate-500 font-medium">+ Rs. 100 Water/mo</p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Multi-Image Slideshow Card */}
          <div className="lg:col-span-6">
            <div
              onMouseEnter={() => setIsHoveringHero(true)}
              onMouseLeave={() => setIsHoveringHero(false)}
              className="relative rounded-3xl bg-white p-2.5 sm:p-3.5 shadow-2xl shadow-indigo-950/10 border border-slate-200/80"
            >
              {/* Main Slideshow Viewport */}
              <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-slate-900 group">
                <img
                  key={currentBanner.id || activeSlide}
                  src={currentBanner.resolved_url}
                  alt={currentBanner.title}
                  onClick={() => setShowLightbox(true)}
                  className="w-full h-full object-cover transition-all duration-700 cursor-pointer group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-slate-950/30 pointer-events-none" />

                {/* Top Left Badge + Slide Counter */}
                <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {currentBanner.badge_text || 'Verified House Inspection'}
                  </div>

                  {banners.length > 1 && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-900/75 backdrop-blur-md text-white text-[11px] font-extrabold border border-white/15">
                      {activeSlide + 1} / {banners.length}
                    </span>
                  )}
                </div>

                {/* Top Right Controls: Fullscreen Zoom, Auto-Play Toggle & Admin Manager */}
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                  {banners.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsAutoPlaying((prev) => !prev)}
                      className="p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md transition"
                      title={isAutoPlaying ? 'Pause Slideshow' : 'Play Slideshow'}
                    >
                      {isAutoPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowLightbox(true)}
                    className="p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md transition"
                    title="View Fullscreen Slideshow"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowBannerEditor(!showBannerEditor)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-lg transition"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        {showBannerEditor ? 'Close Manager' : 'Manage Slideshow'}
                      </button>
                      {currentBanner.id && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Delete this slide from the homepage slideshow?')) {
                              deleteBannerMutation.mutate(currentBanner.id);
                            }
                          }}
                          className="p-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition"
                          title="Delete Current Slide"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Left / Right Carousel Arrows */}
                {banners.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1))
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/85 hover:bg-white text-slate-900 shadow-lg transition transform hover:scale-105"
                      title="Previous Slide"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlide((prev) => (prev === banners.length - 1 ? 0 : prev + 1))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/85 hover:bg-white text-slate-900 shadow-lg transition transform hover:scale-105"
                      title="Next Slide"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Bottom Caption Card */}
                <div className="absolute bottom-3.5 inset-x-3.5 rounded-2xl bg-white/95 backdrop-blur-md p-3.5 sm:p-4 shadow-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {currentBanner.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {currentBanner.subtitle || 'Sub-metered Power & 24/7 Water Supply'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-xs sm:text-sm">
                      Rs. 2,500 – 3,800
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Thumbnail Filmstrip & Dots */}
              {banners.length > 1 && (
                <div className="pt-3 px-1 space-y-2">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {banners.map((b, idx) => (
                      <button
                        key={b.id || idx}
                        type="button"
                        onClick={() => setActiveSlide(idx)}
                        className={`relative w-16 h-11 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                          idx === activeSlide
                            ? 'border-indigo-600 ring-2 ring-indigo-600/25 scale-[1.03]'
                            : 'border-slate-200 opacity-65 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={b.resolved_url}
                          alt={b.title}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    {banners.map((b, idx) => (
                      <button
                        key={b.id || idx}
                        type="button"
                        onClick={() => setActiveSlide(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === activeSlide ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ADMIN MULTI-IMAGE SLIDESHOW MANAGER PANEL */}
              {isAdmin && showBannerEditor && (
                <div className="mt-3 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <p className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                        Admin: Multi-Image Hero Slideshow Manager ({banners.length} Active Slides)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBannerEditor(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {bannerFeedback.text && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                        bannerFeedback.type === 'error'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : bannerFeedback.type === 'info'
                          ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      <span>{bannerFeedback.text}</span>
                      <button
                        type="button"
                        onClick={() => setBannerFeedback({ type: '', text: '' })}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Existing Slides Strip with Quick Delete */}
                  {banners.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">
                        Current Published Slides (Click Trash to Remove)
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-36 overflow-y-auto pr-1">
                        {banners.map((b, idx) => (
                          <div
                            key={b.id || idx}
                            onClick={() => setActiveSlide(idx)}
                            className={`relative h-16 rounded-xl overflow-hidden border cursor-pointer group ${
                              idx === activeSlide
                                ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                                : 'border-slate-200'
                            }`}
                          >
                            <img
                              src={b.resolved_url}
                              alt={b.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-between px-2">
                              <span className="text-[10px] font-extrabold text-white">
                                #{idx + 1}
                              </span>
                              {b.id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteBannerMutation.mutate(b.id);
                                  }}
                                  className="p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                                  title="Delete Slide"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload New Single or Multiple Slides Form */}
                  <form onSubmit={handleBannerUpload} className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={bannerTitle}
                        onChange={(e) => setBannerTitle(e.target.value)}
                        placeholder="Slide Title (e.g. Studio B2 • Balcony)"
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                        required
                      />
                      <input
                        type="text"
                        value={bannerBadge}
                        onChange={(e) => setBannerBadge(e.target.value)}
                        placeholder="Top Badge Text"
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                      />
                    </div>
                    <input
                      type="text"
                      value={bannerSubtitle}
                      onChange={(e) => setBannerSubtitle(e.target.value)}
                      placeholder="Subtitle description"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                    />

                    {/* Multi-file Dropzone */}
                    <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-white cursor-pointer transition text-center">
                      <Upload className="w-5 h-5 text-indigo-600 mb-1" />
                      <span className="text-xs font-extrabold text-slate-800">
                        Select Multiple Hero Banner Images
                      </span>
                      <span className="text-[11px] text-slate-400">
                        You can select 1 or multiple photos at once (JPG, PNG, WEBP, HEIC up to 5 MB each)
                      </span>
                      <input
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.avif"
                        multiple
                        onChange={handleSelectMultipleBannerFiles}
                        className="hidden"
                      />
                    </label>

                    {/* Preview Queued Files Before Upload */}
                    {bannerPreviews.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold text-indigo-700">
                          Ready to Upload ({bannerPreviews.length} selected):
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {bannerPreviews.map((item, idx) => (
                            <div
                              key={idx}
                              className="relative h-16 rounded-xl overflow-hidden border border-indigo-200 bg-white"
                            >
                              <img
                                src={item.url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeQueuedBannerFile(idx)}
                                className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/75 text-white hover:bg-rose-600"
                                title="Remove from queue"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <span className="absolute bottom-0.5 left-1 px-1.5 py-0.2 rounded bg-black/60 text-white text-[9px] font-bold">
                                {item.sizeMB} MB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      {bannerFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setBannerFiles([]);
                            setBannerPreviews([]);
                          }}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                        >
                          Clear Queue
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={uploadBannerMutation.isPending || bannerFiles.length === 0}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-md transition"
                      >
                        {uploadBannerMutation.isPending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uploading Slides...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Upload {bannerFiles.length > 0 ? `${bannerFiles.length} Slide(s)` : 'to Slideshow'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* REAL-TIME INVENTORY: ROOMS A1-A4 & B1-B5 */}
      <section
        id="rooms-inventory"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200/70"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
              REAL-TIME INVENTORY
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Available Rooms & Studios
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Explore floor-by-floor specifications, pricing, and live occupancy statuses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              {[
                { key: 'ALL', label: `All Units (${rooms.length || 9})` },
                { key: 'GROUND', label: 'Ground Floor (A1–A4)' },
                { key: 'FIRST', label: 'First Floor (B1–B5)' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFloorFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    floorFilter === tab.key
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                availableOnly
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {availableOnly ? '✓ Showing Available Only' : 'Filter: Available Only'}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-10">
            {(floorFilter === 'ALL' || floorFilter === 'GROUND') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">Ground Floor</h3>
                    <span className="text-xs text-slate-500">4 Units • A1, A2, A3 (Small), A4</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">
                    {groundRooms.filter((r) => !r.is_occupied).length} Available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {groundRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onAction={() => {
                        if (!user) {
                          openAuthModal('SIGNUP');
                        } else {
                          setReservingRoom(room);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {(floorFilter === 'ALL' || floorFilter === 'FIRST') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">First Floor</h3>
                    <span className="text-xs text-slate-500">
                      5 Units • B1, B2, B3, B4 (Small), B5
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">
                    {firstRooms.filter((r) => !r.is_occupied).length} Available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {firstRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onAction={() => {
                        if (!user) {
                          openAuthModal('SIGNUP');
                        } else {
                          setReservingRoom(room);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* HOUSE RULES & GUIDELINES (13 ACCORDION CARDS + HIGHLIGHTED FINES CARD)    */}
      {/* ========================================================================= */}
      <section
        id="house-rules"
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-200/70 space-y-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
              COMMUNITY HARMONY & TENANT CHARTER
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              House Rules & Guidelines
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Official 13-point residential guidelines for a clean, safe, peaceful, and respectful living environment.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setExpandAllRules((prev) => !prev)}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 text-xs font-extrabold shadow-2xs transition"
          >
            {expandAllRules ? 'Collapse All 13 Categories' : 'Expand All 13 Categories'}
          </button>
        </div>

        {/* 13 ACCORDION CARDS */}
        <div className="space-y-3">
          {HOUSE_RULES_CATEGORIES.map((cat, idx) => {
            const isOpen = expandAllRules || openRuleIndex === idx;
            const IconComponent = cat.icon;

            return (
              <div
                key={cat.id}
                className={`rounded-2xl transition overflow-hidden border ${
                  cat.isHighlightedFineCategory
                    ? 'bg-rose-50/40 border-rose-200 shadow-sm'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (expandAllRules) {
                      setExpandAllRules(false);
                      setOpenRuleIndex(idx);
                    } else {
                      setOpenRuleIndex(isOpen ? -1 : idx);
                    }
                  }}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-3">
                    <div
                      className={`w-10 h-10 rounded-xl ${cat.iconBg} flex items-center justify-center shrink-0`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`text-sm sm:text-base font-extrabold ${
                            cat.isHighlightedFineCategory ? 'text-rose-900' : 'text-slate-900'
                          }`}
                        >
                          {cat.title}
                        </h3>
                        {cat.isHighlightedFineCategory && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase">
                            Penalty Schedule
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{cat.subtitle}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-indigo-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100/90 space-y-4">
                    {cat.isHighlightedFineCategory && (
                      <div className="overflow-x-auto rounded-xl border border-rose-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-rose-50 text-rose-900 font-extrabold uppercase text-[11px] border-b border-rose-200">
                            <tr>
                              <th className="py-2.5 px-4">Violation</th>
                              <th className="py-2.5 px-4">Penalty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-100">
                            {DAMAGE_FINE_PENALTIES.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-rose-50/30">
                                <td className="py-2.5 px-4 font-semibold text-slate-800">
                                  {row.violation}
                                </td>
                                <td className="py-2.5 px-4 font-extrabold text-rose-600">
                                  {row.penalty}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <ul className="space-y-2">
                      {cat.items.map((point, pIdx) => (
                        <li
                          key={pIdx}
                          className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700"
                        >
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              cat.isHighlightedFineCategory
                                ? 'text-rose-600'
                                : 'text-indigo-600'
                            }`}
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* SEPARATE HIGHLIGHTED CARD FOR DAMAGE FINES & PENALTIES */}
        <div className="rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50/60 border-2 border-rose-200 p-6 sm:p-8 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-200/70 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 block">
                  Highlighted Policy Schedule
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  Damage Fines & Penalties Schedule
                </h3>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-extrabold self-start sm:self-auto">
              Evidence-Backed Enforcement
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Violation & Penalty Table */}
            <div className="lg:col-span-7 overflow-x-auto rounded-2xl border border-rose-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-rose-600 text-white text-[11px] font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Violation</th>
                    <th className="py-3 px-4">Penalty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DAMAGE_FINE_PENALTIES.map((item, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/40 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">{item.violation}</td>
                      <td className="py-3 px-4 font-black text-rose-600">{item.penalty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fine Guidelines Box */}
            <div className="lg:col-span-5 rounded-2xl bg-white p-5 border border-rose-200/90 space-y-3 shadow-2xs">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-rose-600" /> Official Fine Guidelines
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-700">
                {FINE_GUIDELINES_LIST.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* IMPORTANT NOTICE & "I AGREE & ACCEPT" TENANT ACKNOWLEDGMENT CARD */}
        <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-extrabold uppercase tracking-wider border border-indigo-400/30">
                <FileCheck2 className="w-3.5 h-3.5" /> Important Notice
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white">
                Tenant Acknowledgment & Responsibility Charter
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                All tenants are expected to follow these guidelines to maintain a clean, safe,
                peaceful, and respectful living environment. By accepting these rules, tenants
                acknowledge their responsibilities toward the property and other residents.
              </p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center gap-3">
              {hasAcceptedRules ? (
                <div className="px-5 py-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>✓ House Rules Acknowledged & Accepted</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAcceptHouseRules}
                  disabled={acceptRulesMutation.isPending}
                  className="px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-500/25 transition inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {acceptRulesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Recording Acknowledgment...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      I Agree & Accept
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {rulesAckMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
              <span>{rulesAckMsg}</span>
              <button
                type="button"
                onClick={() => setRulesAckMsg('')}
                className="text-emerald-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* FULLSCREEN HERO SLIDESHOW LIGHTBOX MODAL */}
      {showLightbox && (
        <div
          onClick={() => setShowLightbox(false)}
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between text-white pb-3 border-b border-white/10"
          >
            <div>
              <h3 className="text-sm sm:text-base font-extrabold">{currentBanner.title}</h3>
              <p className="text-xs text-slate-400">{currentBanner.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {banners.length > 1 && (
                <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold">
                  {activeSlide + 1} / {banners.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowLightbox(false)}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            {banners.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
                }}
                className="absolute left-2 sm:left-6 z-20 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={currentBanner.resolved_url}
              alt={currentBanner.title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            />

            {banners.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlide((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-2 sm:right-6 z-20 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {banners.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-2 overflow-x-auto py-2"
            >
              {banners.map((b, idx) => (
                <button
                  key={b.id || idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  className={`w-16 h-12 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                    idx === activeSlide
                      ? 'border-indigo-400 scale-105'
                      : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={b.resolved_url} alt={b.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ROOM RESERVATION & VISIT BOOKING MODAL */}
      {reservingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Book Room {reservingRoom.room_number} (
                  {String(reservingRoom.room_number).startsWith('B')
                    ? 'First Floor'
                    : 'Ground Floor'}
                  )
                </h3>
                <p className="text-xs text-slate-500">
                  Base Rent: Rs. {Number(reservingRoom.base_rent).toLocaleString()}/month
                </p>
              </div>
              <button
                onClick={() => setReservingRoom(null)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reservationMsg.text && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-bold ${
                  reservationMsg.type === 'error'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {reservationMsg.text}
              </div>
            )}

            <form onSubmit={handleReservationSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  REQUEST TYPE
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestType('RESERVE')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                      requestType === 'RESERVE'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Instant Room Reservation
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestType('VISIT')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                      requestType === 'VISIT'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Schedule Physical Visit
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    EXPECTED MOVE-IN / VISIT DATE (AD)
                  </label>
                  <input
                    type="date"
                    required
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
                  {moveInDate && (
                    <p className="text-[11px] font-extrabold text-indigo-600 mt-1">
                      📅 BS: {formatBSOnly(moveInDate)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    TOTAL OCCUPANTS
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    required
                    value={occupantsCount}
                    onChange={(e) => setOccupantsCount(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PHONE NUMBER
                  </label>
                  <input
                    type="text"
                    required
                    value={phoneNum}
                    onChange={(e) => setPhoneNum(e.target.value)}
                    placeholder="e.g. 9848800000"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    OCCUPATION / PROFESSION
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. BCA Student / IT Intern"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {requestType === 'RESERVE' && (
                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                  <p className="text-xs font-bold text-indigo-900">Token Deposit (Optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Token Amount (NPR)
                      </label>
                      <input
                        type="number"
                        value={tokenAmount}
                        onChange={(e) => setTokenAmount(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Payment Screenshot Slip
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)}
                        className="text-[11px] text-slate-600 pt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CITIZENSHIP / ID CARD PHOTO (FOR KYC ONBOARDING)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCitizenshipDoc(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ADDITIONAL NOTES / PREFERRED VISIT TIME
                </label>
                <textarea
                  rows="2"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Any special inquiries or time preferences..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReservingRoom(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reserveMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
                >
                  {reserveMutation.isPending ? 'Submitting...' : 'Confirm Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onAction }) {
  const isSmall = room.room_type === 'SMALL';
  const occupied = room.is_occupied;
  const pendingCount = room.pending_reservations_count || 0;

  return (
    <div
      className={`rounded-2xl bg-white p-5 border transition flex flex-col justify-between ${
        occupied
          ? 'border-slate-200/70 opacity-90'
          : 'border-indigo-200/80 shadow-md shadow-indigo-950/5 hover:border-indigo-500'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <h4 className="text-base font-extrabold text-slate-900">
              Room {room.room_number}
            </h4>
            {isSmall && (
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                Small Room
              </span>
            )}
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              occupied
                ? 'bg-slate-100 text-slate-600'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {occupied ? '• Occupied' : '• Available'}
          </span>
        </div>

        <p className="text-xs text-slate-500 font-medium mb-4">
          {room.title} • {room.area_sqft} sq.ft
        </p>

        <ul className="space-y-2 mb-5">
          {(room.features || []).map((feat, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">{feat}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 text-xs text-slate-600">
            <Droplets className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Water: Rs. {Number(room.fixed_water_bill).toFixed(0)}/mo</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-slate-600">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Electricity: Rs. {Number(room.electricity_rate_per_unit).toFixed(0)}/unit</span>
          </li>
        </ul>
      </div>

      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-extrabold text-slate-900">
            Rs. {Number(room.base_rent).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">/ month base rent</p>
        </div>

        {occupied ? (
          <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold">
            Occupied
          </span>
        ) : (
          <button
            onClick={onAction}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition relative"
          >
            Reserve / Apply
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Zap,
  Droplets,
  Wrench,
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
  Calendar,
  X,
} from 'lucide-react';
import axiosClient, { createReservation } from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=85';

export default function PublicLanding() {
  const { user, isAdmin, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI Filter & Accordion States
  const [floorFilter, setFloorFilter] = useState('ALL'); // ALL | GROUND | SECOND
  const [availableOnly, setAvailableOnly] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [openRuleIndex, setOpenRuleIndex] = useState(0);

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

  // Admin Hero Banner Manager States
  const [showBannerEditor, setShowBannerEditor] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('Studio B2 • Balcony Suite');
  const [bannerSubtitle, setBannerSubtitle] = useState('Sub-meter #M-202 • Digital Telemetry Active');
  const [bannerBadge, setBannerBadge] = useState('Physical Inspection Passed');
  const [bannerFile, setBannerFile] = useState(null);

  // Fetch live Landing Data
  const { data, isLoading } = useQuery({
    queryKey: ['publicLandingData'],
    queryFn: async () => {
      const res = await axiosClient.get('/rooms/landing/');
      return res.data;
    },
  });

  // Admin Mutation: Upload New Hero Image
  const uploadBannerMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axiosClient.post('/rooms/banners/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
      setBannerFile(null);
      setShowBannerEditor(false);
    },
  });

  // Admin Mutation: Delete Hero Image
  const deleteBannerMutation = useMutation({
    mutationFn: async (bannerId) => {
      await axiosClient.delete(`/rooms/banners/${bannerId}/`);
    },
    onSuccess: () => {
      setActiveSlide(0);
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
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
        text: err.response?.data?.room?.[0] || err.response?.data?.detail || 'Failed to submit reservation.',
      });
    },
  });

  const handleBannerUpload = (e) => {
    e.preventDefault();
    if (!bannerFile) return;
    const formData = new FormData();
    formData.append('title', bannerTitle);
    formData.append('subtitle', bannerSubtitle);
    formData.append('badge_text', bannerBadge);
    formData.append('image', bannerFile);
    formData.append('is_active', true);
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

  const rooms = data?.rooms || [];
  const banners = data?.banners || [];
  const rules = data?.rules || [];
  const stats = data?.stats || { total_rooms: 9, occupied_rooms: 0, available_rooms: 9 };

  const currentBanner = banners[activeSlide] || {
    id: null,
    title: 'Smart House Rental • Ground & 2nd Floor',
    subtitle: 'Sub-metered electricity (Rs. 15/unit) & fixed water (Rs. 100/room)',
    badge_text: 'Verified Direct-Landlord Listing',
    image_url: DEFAULT_HERO_IMAGE,
  };

  const filterRoomList = (floorCode) => {
    return rooms.filter((r) => {
      if (floorCode && r.floor !== floorCode) return false;
      if (availableOnly && r.is_occupied) return false;
      return true;
    });
  };

  const groundRooms = filterRoomList('GROUND');
  const secondRooms = filterRoomList('SECOND');

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
            Automated Digital Sub-Metering Active • Transparent Utility Billing (Electricity Rs. 15/unit • Water Rs. 100/room)
          </span>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Verified Direct-Landlord Rental Portal
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Next-Gen Living.{' '}
              <span className="text-indigo-600 block mt-1">Sub-Metered Precision.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Zero utility squabbles, transparent digital electricity and water calculation, and instant online/cash rent receipts. Designed for disciplined students, professionals, and peaceful living.
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
                GROUND & 2ND FL
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

          <div className="lg:col-span-6">
            <div className="relative rounded-3xl bg-white p-2.5 sm:p-3.5 shadow-2xl shadow-indigo-950/10 border border-slate-200/80">
              <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-slate-900">
                <img
                  src={currentBanner.image_url || DEFAULT_HERO_IMAGE}
                  alt={currentBanner.title}
                  className="w-full h-full object-cover transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/20" />

                <div className="absolute top-3.5 left-3.5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {currentBanner.badge_text || 'Verified House Inspection'}
                </div>

                {isAdmin && (
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
                    <button
                      onClick={() => setShowBannerEditor(!showBannerEditor)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg transition"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      {showBannerEditor ? 'Close Editor' : 'Manage Viewer Image'}
                    </button>
                    {currentBanner.id && (
                      <button
                        onClick={() => deleteBannerMutation.mutate(currentBanner.id)}
                        className="p-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {banners.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setActiveSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1))
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white text-slate-900 shadow-md transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setActiveSlide((prev) => (prev === banners.length - 1 ? 0 : prev + 1))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white text-slate-900 shadow-md transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

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

              {banners.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-3 pb-1">
                  {banners.map((b, idx) => (
                    <button
                      key={b.id}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === activeSlide ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}

              {isAdmin && showBannerEditor && (
                <form
                  onSubmit={handleBannerUpload}
                  className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                    Admin: Upload New Homepage Viewer Image
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      placeholder="Image Title"
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                      className="text-xs text-slate-600"
                      required
                    />
                    <button
                      type="submit"
                      disabled={uploadBannerMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
                    >
                      {uploadBannerMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      Save Hero Image
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* REAL-TIME INVENTORY: ROOMS A1-A4 & B1-B5 */}
      <section id="rooms-inventory" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200/70">
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
                { key: 'ALL', label: 'All Units (9)' },
                { key: 'GROUND', label: 'Ground Floor (A1–A4)' },
                { key: 'SECOND', label: 'Second Floor (B1–B5)' },
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

            {(floorFilter === 'ALL' || floorFilter === 'SECOND') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">Second Floor</h3>
                    <span className="text-xs text-slate-500">5 Units • B1, B2, B3, B4 (Small), B5</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">
                    {secondRooms.filter((r) => !r.is_occupied).length} Available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {secondRooms.map((room) => (
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

      {/* HOUSE RULES */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-200/70">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
            COMMUNITY HARMONY
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            House Rules & Regulations
          </h2>
        </div>

        <div className="space-y-3.5">
          {rules.map((rule, idx) => {
            const isOpen = openRuleIndex === idx;
            const iconMap = {
              CLEANLINESS: <Sparkles className="w-5 h-5 text-emerald-600" />,
              DISCIPLINE: <Moon className="w-5 h-5 text-indigo-600" />,
              DAMAGE_FINE: <AlertTriangle className="w-5 h-5 text-rose-600" />,
            };
            const bgMap = {
              CLEANLINESS: 'bg-emerald-50',
              DISCIPLINE: 'bg-indigo-50',
              DAMAGE_FINE: 'bg-rose-50',
            };

            return (
              <div key={rule.id} className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
                <button
                  onClick={() => setOpenRuleIndex(isOpen ? -1 : idx)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl ${bgMap[rule.category] || 'bg-slate-100'} flex items-center justify-center shrink-0`}>
                      {iconMap[rule.category] || <ShieldCheck className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{rule.title}</h3>
                      <p className="text-xs text-slate-500">{rule.category_display}</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                    <p>{rule.description}</p>
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                      {Number(rule.fine_amount) > 0
                        ? `Violation Fine: Rs. ${Number(rule.fine_amount).toLocaleString()}`
                        : 'Fine Policy: 100% of Damaged Property Repair / Replacement Cost'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ROOM RESERVATION & VISIT BOOKING MODAL */}
      {reservingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Book Room {reservingRoom.room_number} ({reservingRoom.room_floor_display || reservingRoom.floor})
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
                    EXPECTED MOVE-IN / VISIT DATE
                  </label>
                  <input
                    type="date"
                    required
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                  />
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
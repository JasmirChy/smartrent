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
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
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

  // Admin Hero Banner Manager States
  const [showBannerEditor, setShowBannerEditor] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('Studio B2 • Balcony Suite');
  const [bannerSubtitle, setBannerSubtitle] = useState('Sub-meter #M-202 • Digital Telemetry Active');
  const [bannerBadge, setBannerBadge] = useState('Physical Inspection Passed');
  const [bannerFile, setBannerFile] = useState(null);

  // Fetch live Landing Data (auto-syncs every 5 seconds via TanStack Query)
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

      {/* HERO SECTION WITH RESPONSIVE IMAGE VIEWER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Hero Content */}
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

            {/* Live Availability Status Box */}
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

            {/* Hero CTA Buttons */}
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

            {/* Key Metrics Strip */}
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

          {/* Right Responsive Hero Image Viewer (4:5 Mobile Ratio, 16:10 Desktop Ratio) */}
          <div className="lg:col-span-6">
            <div className="relative rounded-3xl bg-white p-2.5 sm:p-3.5 shadow-2xl shadow-indigo-950/10 border border-slate-200/80">
              {/* Responsive Image Container */}
              <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-slate-900">
                <img
                  src={currentBanner.image_url || DEFAULT_HERO_IMAGE}
                  alt={currentBanner.title}
                  className="w-full h-full object-cover transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/20" />

                {/* Top Badge */}
                <div className="absolute top-3.5 left-3.5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {currentBanner.badge_text || 'Verified House Inspection'}
                </div>

                {/* Admin Manage Viewer Button */}
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
                        title="Delete current banner image"
                        className="p-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Prev / Next Controls if multiple images exist */}
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

                {/* Bottom Overlay Info Card */}
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

              {/* Slide Dots */}
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

              {/* Admin Inline Hero Image Uploader Drawer */}
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
                      placeholder="Image Title (e.g. Ground Floor A1)"
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

      {/* SMART HOUSE INFRASTRUCTURE SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200/70">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
              AUTOMATED LIVING OS
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Smart House Infrastructure
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md">
            Transparent calculation every month from your exact entry date. Pay online with screenshot proof or directly in cash to Admin.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Sub-Metered Accuracy</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Admin records your starting meter reading on move-in. Each month, enter your new reading and upload the meter photo—system computes <strong className="text-slate-800">(New − Old) × Rs. 15/unit</strong> automatically.
            </p>
            <span className="text-[11px] font-semibold text-indigo-600">
              • Photo Proof Verification Guard
            </span>
          </div>

          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Droplets className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Transparent Monthly Ledger</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Fixed <strong className="text-slate-800">Rs. 100 Water Bill</strong> per room plus your room rent (<strong className="text-slate-800">Rs. 2,500</strong> for Small rooms A3/B4 or <strong className="text-slate-800">Rs. 3,800</strong> for Standard rooms). Automated email reminders on your monthly entry anniversary.
            </p>
            <span className="text-[11px] font-semibold text-emerald-600">
              • Online Screenshot or Cash to Admin
            </span>
          </div>

          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Real-Time Chat & Support</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Built-in real-time chat with the Landlord/Admin and a dedicated Complaint Ticket system to report plumbing, electrical, or house issues immediately.
            </p>
            <span className="text-[11px] font-semibold text-amber-600">
              • Instant No-Refresh WebSockets
            </span>
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

          {/* Filter Pills */}
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
            {/* GROUND FLOOR: A1, A2, A3 (Small), A4 */}
            {(floorFilter === 'ALL' || floorFilter === 'GROUND') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Ground Floor
                    </h3>
                    <span className="text-xs text-slate-500">
                      4 Units • A1, A2, A3 (Small), A4
                    </span>
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
                      onAction={() =>
                        user ? navigate('/support') : openAuthModal('SIGNUP')
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SECOND FLOOR: B1, B2, B3, B4 (Small), B5 */}
            {(floorFilter === 'ALL' || floorFilter === 'SECOND') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Second Floor
                    </h3>
                    <span className="text-xs text-slate-500">
                      5 Units • B1, B2, B3, B4 (Small), B5
                    </span>
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
                      onAction={() =>
                        user ? navigate('/support') : openAuthModal('SIGNUP')
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* HOUSE RULES & REGULATIONS ACCORDION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-200/70">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
            COMMUNITY HARMONY
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            House Rules & Regulations
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl mx-auto">
            All tenants living in the house must strictly follow cleanliness and discipline standards. Any property damage is fined according to actual repair/replacement costs.
          </p>
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
              <div
                key={rule.id}
                className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden"
              >
                <button
                  onClick={() => setOpenRuleIndex(isOpen ? -1 : idx)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl ${
                        bgMap[rule.category] || 'bg-slate-100'
                      } flex items-center justify-center shrink-0`}
                    >
                      {iconMap[rule.category] || <ShieldCheck className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{rule.title}</h3>
                      <p className="text-xs text-slate-500">{rule.category_display}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
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
    </div>
  );
}

function RoomCard({ room, onAction }) {
  const isSmall = room.room_type === 'SMALL';
  const occupied = room.is_occupied;

  return (
    <div
      className={`rounded-2xl bg-white p-5 border transition flex flex-col justify-between ${
        occupied
          ? 'border-slate-200/70 opacity-90'
          : 'border-indigo-200/80 shadow-md shadow-indigo-950/5 hover:border-indigo-500'
      }`}
    >
      <div>
        {/* Top Row: Room Name & Occupancy Badge */}
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

        {/* Features List */}
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

      {/* Bottom Price & Action Button */}
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
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
          >
            Reserve / Apply
          </button>
        )}
      </div>
    </div>
  );
}
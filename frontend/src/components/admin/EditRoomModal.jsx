import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Save,
  Loader2,
  Home,
  Maximize2,
  Tag,
  Droplets,
  Zap,
  Banknote,
  Sparkles,
} from 'lucide-react';
import { updateRoomDetails } from '../../api/axiosClient';
import { useLanguage } from '../../context/LanguageContext';

const TITLE_PRESETS = [
  'Spacious Ground Studio',
  'Sunlit Ground Suite',
  'Compact Ground Room',
  'Corner Ground Suite',
  'Bright First-Floor Studio',
  'Balcony Corner Suite',
];

export default function EditRoomModal({ room, onClose, onSaved }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const [roomType, setRoomType] = useState('STANDARD');
  const [baseRent, setBaseRent] = useState('');
  const [waterBill, setWaterBill] = useState('');
  const [elecRate, setElecRate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!room) return;
    setTitle(room.title || '');
    setAreaSqft(room.area_sqft != null ? String(room.area_sqft) : '');
    setRoomType(room.room_type || 'STANDARD');
    setBaseRent(room.base_rent != null ? String(room.base_rent) : '');
    setWaterBill(room.fixed_water_bill != null ? String(room.fixed_water_bill) : '');
    setElecRate(
      room.electricity_rate_per_unit != null ? String(room.electricity_rate_per_unit) : ''
    );
    setErrorMsg('');
  }, [room]);

  const mutation = useMutation({
    mutationFn: (payload) => updateRoomDetails(room.id, payload),
    onSuccess: (updatedRoom) => {
      // Refresh both the Public Landing cards and all Admin dashboard room queries
      queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
      queryClient.invalidateQueries({ queryKey: ['adminRooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['roomsMatrix'] });
      if (typeof onSaved === 'function') onSaved(updatedRoom);
      onClose();
    },
    onError: (err) => {
      const data = err.response?.data;
      const firstErr =
        data?.detail ||
        data?.title?.[0] ||
        data?.area_sqft?.[0] ||
        data?.base_rent?.[0] ||
        t('Failed to update room details.', 'कोठाको विवरण अपडेट गर्न सकिएन।');
      setErrorMsg(firstErr);
    },
  });

  if (!room) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanTitle = title.trim();
    const numericArea = Number(areaSqft);
    const numericRent = Number(baseRent);
    const numericWater = Number(waterBill);
    const numericElec = Number(elecRate);

    if (!cleanTitle) {
      setErrorMsg(t('Please enter a room title/label.', 'कृपया कोठाको शीर्षक लेख्नुहोस्।'));
      return;
    }
    if (!numericArea || numericArea <= 0) {
      setErrorMsg(
        t('Area (sq.ft) must be a positive number.', 'क्षेत्रफल (वर्ग फिट) ० भन्दा बढी हुनुपर्छ।')
      );
      return;
    }

    mutation.mutate({
      title: cleanTitle,
      area_sqft: numericArea,
      room_type: roomType,
      base_rent: numericRent,
      fixed_water_bill: numericWater,
      electricity_rate_per_unit: numericElec,
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] overflow-hidden"
      >
        {/* Mobile drag handle indicator */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Sticky Modal Header */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Home className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {t('Edit Room', 'कोठा सम्पादन')} {room.room_number}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {t('Update tagline, area, and utility rates', 'शीर्षक, क्षेत्रफल र भाडा दर अपडेट गर्नुहोस्')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="edit-room-form"
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 space-y-4"
        >
          {/* Live Card Preview */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {t('Live Landing Preview', 'लाइभ प्रिभ्यू')}
              </span>
              {roomType === 'SMALL' && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                  {t('Small', 'सानो')}
                </span>
              )}
            </div>
            <p className="text-sm font-extrabold text-slate-900">
              {t('Room', 'कोठा')} {room.room_number}
            </p>
            <p className="text-xs font-medium text-slate-600">
              {title.trim() || t('Room Title', 'कोठाको शीर्षक')} •{' '}
              <span className="font-bold text-slate-800">
                {areaSqft || '0'} {t('sq.ft', 'वर्ग फिट')}
              </span>
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Room Title / Tagline */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              {t('ROOM LABEL / TAGLINE', 'कोठाको शीर्षक / विवरण')}
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('e.g. Spacious Ground Studio', 'जस्तै: Spacious Ground Studio')}
              className="w-full px-3.5 py-2.5 text-sm sm:text-xs rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
            />
            {/* Tap-friendly Quick Presets (Horizontally scrollable on mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {TITLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTitle(preset)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition shrink-0 ${
                    title === preset
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Area (sq.ft) + Room Type (2-Column Grid) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 mb-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                {t('AREA (SQ.FT)', 'क्षेत्रफल (वर्ग फिट)')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min="20"
                  max="2000"
                  step="1"
                  required
                  value={areaSqft}
                  onChange={(e) => setAreaSqft(e.target.value)}
                  placeholder="140"
                  className="w-full pl-3.5 pr-12 py-2.5 text-sm sm:text-xs font-bold rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
                  sq.ft
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                {t('SIZE BADGE', 'कोठाको आकार')}
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full px-3 py-2.5 text-sm sm:text-xs font-bold rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
              >
                <option value="STANDARD">{t('Standard', 'स्ट्यान्डर्ड')}</option>
                <option value="SMALL">{t('Small', 'सानो')}</option>
              </select>
            </div>
          </div>

          {/* Pricing & Utility Rates (Responsive 3-col on desktop, stacked cleanly on mobile) */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
              {t('Rent & Utility Rates', 'मासिक भाडा र उपयोगिता दर')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mb-1">
                  <Banknote className="w-3.5 h-3.5 text-indigo-600" />
                  {t('Base Rent (Rs.)', 'मासिक भाडा (रु.)')}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  required
                  value={baseRent}
                  onChange={(e) => setBaseRent(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm sm:text-xs font-bold rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:contents gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mb-1">
                    <Droplets className="w-3.5 h-3.5 text-emerald-600" />
                    {t('Water (Rs.)', 'पानी (रु.)')}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    required
                    value={waterBill}
                    onChange={(e) => setWaterBill(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm sm:text-xs font-bold rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mb-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    {t('Elec (Rs./u)', 'बिजुली (रु./यु)')}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    required
                    value={elecRate}
                    onChange={(e) => setElecRate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm sm:text-xs font-bold rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Sticky Modal Footer */}
        <div className="px-5 py-3.5 sm:px-6 border-t border-slate-100 bg-slate-50/90 flex items-center gap-2.5 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition"
          >
            {t('Cancel', 'रद्द गर्नुहोस्')}
          </button>
          <button
            type="submit"
            form="edit-room-form"
            disabled={mutation.isPending}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-md shadow-indigo-600/20 transition inline-flex items-center justify-center gap-1.5"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('Saving...', 'सुरक्षित हुँदै...')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('Save Changes', 'परिवर्तन सुरक्षित गर्नुहोस्')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
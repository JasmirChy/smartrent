import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Home,
  Zap,
  Droplets,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wrench,
  MessageSquare,
  Download,
  Camera,
  CreditCard,
  X,
  LogOut,
  QrCode,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import axiosClient, {
  fetchReservations,
  processReservationAction,
  fetchKYCProfile,
  updateKYCProfile,
  acceptDigitalLease,
  fetchMoveOutStatus,
  requestMoveOut,
  fetchPaymentQRConfig,
  downloadFileFromUrl,
} from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  formatDualDate,
  formatDualMonthLabel,
  formatBSOnly,
} from '../utils/nepaliDate';

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

export default function TenantDashboard() {
  const { user, refreshProfile } = useAuth();
  const { t, td } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('BILLING');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  // Sub-meter & QR Payment Form States
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [meterInput, setMeterInput] = useState('');
  const [meterPhoto, setMeterPhoto] = useState(null);
  const [meterPreview, setMeterPreview] = useState(null);
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [showQRZoomModal, setShowQRZoomModal] = useState(false);

  // Fullscreen Photo Lightbox States (For Fine Evidence, Meter & Receipt Photos)
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    items: [],
    currentIndex: 0,
    zoom: 1,
  });

  // Modals & KYC States
  const [showLeaseModal, setShowLeaseModal] = useState(false);
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [showPayBillFirstModal, setShowPayBillFirstModal] = useState(false);
  const [moveOutDate, setMoveOutDate] = useState('');
  const [moveOutReason, setMoveOutReason] = useState('');

  const [legalName, setLegalName] = useState('');
  const [citizenshipNo, setCitizenshipNo] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [citFront, setCitFront] = useState(null);
  const [citBack, setCitBack] = useState(null);

  // Queries (4-second live auto-sync)
  const { data: profileData } = useQuery({
    queryKey: ['tenantMeProfile'],
    queryFn: async () => (await axiosClient.get('/accounts/me/')).data,
    refetchInterval: 4000,
  });

  const { data: rawBills = [] } = useQuery({
    queryKey: ['tenantBills'],
    queryFn: async () => {
      const res = await axiosClient.get('/billing/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
    refetchInterval: 4000,
  });

  const { data: paymentQR } = useQuery({
    queryKey: ['paymentQRConfig'],
    queryFn: fetchPaymentQRConfig,
    refetchInterval: 4000,
  });

  const { data: rawReservations = [] } = useQuery({
    queryKey: ['tenantReservations'],
    queryFn: fetchReservations,
    refetchInterval: 4000,
  });

  const { data: kycProfile } = useQuery({
    queryKey: ['tenantKYC'],
    queryFn: fetchKYCProfile,
    refetchInterval: 4000,
  });

  const { data: moveOutStatus } = useQuery({
    queryKey: ['moveOutStatus'],
    queryFn: fetchMoveOutStatus,
    refetchInterval: 4000,
  });

  const bills = Array.isArray(rawBills) ? rawBills : [];
  const reservations = Array.isArray(rawReservations) ? rawReservations : [];

  useEffect(() => {
    if (typeof refreshProfile === 'function') {
      refreshProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (kycProfile) {
      setLegalName(kycProfile.full_name_legal || user?.full_name || '');
      setCitizenshipNo(kycProfile.citizenship_number || '');
      setEmergencyName(kycProfile.emergency_contact_name || '');
      setEmergencyPhone(kycProfile.emergency_contact_phone || '');
    }
  }, [kycProfile, user]);

  // Only treat room_details as active if it has a valid room_number
  const rawRoom =
    profileData?.room_details !== undefined
      ? profileData.room_details
      : profileData?.assigned_room || user?.assigned_room || null;
  const assignedRoom = rawRoom && rawRoom.room_number ? rawRoom : null;

  const openUnpaidBill = bills.find((b) =>
    ['UNPAID', 'PENDING_VERIFICATION', 'REJECTED'].includes(b.status)
  );

  // If tenant has vacated (!assignedRoom), only show a bill if there is an open unpaid bill
  // or if they explicitly clicked a past invoice row in the table
  const activeBill =
    bills.find((b) => String(b.id) === String(selectedBillId)) ||
    openUnpaidBill ||
    (assignedRoom ? bills[0] : null) ||
    null;

  useEffect(() => {
    if (
      activeBill &&
      activeBill.current_meter_reading !== null &&
      activeBill.current_meter_reading !== undefined &&
      !meterInput
    ) {
      setMeterInput(String(activeBill.current_meter_reading));
    }
  }, [activeBill, meterInput]);

  // True only when the selected bill is still open/unpaid (hides fine banner once paid)
  const isBillOpen = activeBill
    ? ['UNPAID', 'PENDING_VERIFICATION', 'REJECTED'].includes(activeBill.status)
    : false;

  const prevReading = Number(
    activeBill?.previous_meter_reading ?? assignedRoom?.current_meter_reading ?? 0
  );
  const baseRent = Number(
    activeBill?.base_rent ?? assignedRoom?.base_rent ?? (assignedRoom ? 3800 : 0)
  );
  const headerBaseRent = assignedRoom
    ? Number(assignedRoom.base_rent ?? 3800)
    : isBillOpen
    ? Number(activeBill?.base_rent ?? 0)
    : 0;

  const waterBill = Number(
    activeBill?.water_bill ?? assignedRoom?.fixed_water_bill ?? (assignedRoom ? 100 : 0)
  );
  const elecRate = Number(
    activeBill?.electricity_rate ?? assignedRoom?.electricity_rate_per_unit ?? 15
  );
  const fineAmount = Number(activeBill?.damage_fine_amount ?? 0);
  const fineReason = activeBill?.damage_fine_reason || '';
  const fineAppliedAt = activeBill?.fine_applied_at || null;
  const fineEvidenceUrls = Array.isArray(activeBill?.fine_evidence_urls)
    ? activeBill.fine_evidence_urls.map((u) => getSafeMediaUrl(u)).filter(Boolean)
    : [];

  const numericCurrentReading = meterInput !== '' ? Number(meterInput) : prevReading;
  const unitsConsumed = Math.max(0, numericCurrentReading - prevReading);
  const liveElectricityCost = unitsConsumed * elecRate;
  const liveGrandTotal = baseRent + waterBill + liveElectricityCost + fineAmount;

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

  // Mutations
  const submitBillMutation = useMutation({
    mutationFn: async (formData) =>
      (
        await axiosClient.post(`/billing/${activeBill.id}/submit-online/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: (data) => {
      setFeedback({
        type: 'success',
        text:
          data.message ||
          t(
            'Meter reading and payment proof submitted!',
            'मिटर रिडिङ र भुक्तानी प्रमाण सफलतापूर्वक पेश गरियो!'
          ),
      });
      queryClient.invalidateQueries({ queryKey: ['tenantBills'] });
      setMeterPhoto(null);
      setPaymentPhoto(null);
      setMeterPreview(null);
      setPaymentPreview(null);
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text:
          err.response?.data?.error ||
          t('Failed to submit proofs.', 'प्रमाण पेश गर्न सकिएन।'),
      }),
  });

  const updateKYCMutation = useMutation({
    mutationFn: updateKYCProfile,
    onSuccess: () => {
      setFeedback({
        type: 'success',
        text: t(
          'KYC documents saved successfully!',
          'केवाईसी कागजातहरू सफलतापूर्वक सुरक्षित गरियो!'
        ),
      });
      queryClient.invalidateQueries({ queryKey: ['tenantKYC'] });
      queryClient.invalidateQueries({ queryKey: ['tenantMeProfile'] });
    },
    onError: () =>
      setFeedback({
        type: 'error',
        text: t('Could not update KYC.', 'केवाईसी अपडेट गर्न सकिएन।'),
      }),
  });

  const acceptLeaseMutation = useMutation({
    mutationFn: acceptDigitalLease,
    onSuccess: (data) => {
      setFeedback({
        type: 'success',
        text:
          data.message ||
          t(
            'Digital lease agreement accepted!',
            'डिजिटल भाडा सम्झौता स्वीकार गरियो!'
          ),
      });
      queryClient.invalidateQueries({ queryKey: ['tenantKYC'] });
    },
  });

  const cancelResMutation = useMutation({
    mutationFn: (resId) => processReservationAction(resId, { action: 'CANCEL' }),
    onSuccess: () => {
      setFeedback({
        type: 'success',
        text: t('Reservation cancelled.', 'बुकिङ अनुरोध रद्द गरियो।'),
      });
      queryClient.invalidateQueries({ queryKey: ['tenantReservations'] });
    },
  });

  const moveOutMutation = useMutation({
    mutationFn: requestMoveOut,
    onSuccess: () => {
      setFeedback({
        type: 'success',
        text: t(
          'Move-out request submitted. Admin will review shortly.',
          'कोठा छोड्ने अनुरोध पेश गरियो। एडमिनले छिट्टै जाँच गर्नुहुनेछ।'
        ),
      });
      setShowMoveOutModal(false);
      queryClient.invalidateQueries({ queryKey: ['moveOutStatus'] });
      queryClient.invalidateQueries({ queryKey: ['tenantMeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['tenantBills'] });
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text:
          err.response?.data?.error ||
          t('Failed to request move out.', 'कोठा छोड्ने अनुरोध पठाउन सकिएन।'),
      }),
  });

  const handleSubmitOnlineProof = (e) => {
    e.preventDefault();
    if (!activeBill) return;
    if (Number(meterInput) < prevReading) {
      setFeedback({
        type: 'error',
        text: t(
          `Reading cannot be less than ${prevReading}.`,
          `नयाँ मिटर रिडिङ ${prevReading} भन्दा कम हुन सक्दैन।`
        ),
      });
      return;
    }
    if (!meterPhoto || !paymentPhoto) {
      setFeedback({
        type: 'error',
        text: t(
          'Upload both Zone 1 and Zone 2 photos.',
          'कृपया क्षेत्र १ (मिटर फोटो) र क्षेत्र २ (भुक्तानी भौचर) दुवै अपलोड गर्नुहोस्।'
        ),
      });
      return;
    }
    const formData = new FormData();
    formData.append('current_meter_reading', meterInput);
    formData.append('meter_photo_proof', meterPhoto);
    formData.append('payment_screenshot_proof', paymentPhoto);
    formData.append('transaction_reference', transactionRef);
    submitBillMutation.mutate(formData);
  };

  const handleKYCSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('full_name_legal', legalName);
    formData.append('citizenship_number', citizenshipNo);
    formData.append('emergency_contact_name', emergencyName);
    formData.append('emergency_contact_phone', emergencyPhone);
    if (citFront) formData.append('citizenship_front', citFront);
    if (citBack) formData.append('citizenship_back', citBack);
    updateKYCMutation.mutate(formData);
  };

  const handleRequestMoveOutClick = () => {
    if (openUnpaidBill) {
      setShowPayBillFirstModal(true);
      return;
    }
    setShowMoveOutModal(true);
  };

  const handlePrintReceipt = (bill) => {
    const win = window.open('', '_blank', 'width=700,height=700');
    if (!win) return;
    const dualCycle = formatDualMonthLabel(bill.billing_month_label);
    const dualDueDate = formatDualDate(bill.due_date, 'N/A');
    const dualPaidAt = bill.paid_at
      ? formatDualDate(bill.paid_at)
      : t('Verified by Admin', 'एडमिनद्वारा प्रमाणित');

    win.document.write(`
      <html>
        <head>
          <title>${t('SmartRent Receipt - Room', 'स्मार्टरेन्ट रसिद - कोठा')} ${bill.room_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            .box { border: 2px solid #4f46e5; border-radius: 12px; padding: 24px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .total { font-size: 20px; font-weight: bold; color: #4f46e5; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>${t('SmartRent Official Payment Receipt', 'स्मार्टरेन्ट आधिकारिक भुक्तानी रसिद')}</h2>
            <p><strong>${t('Tenant:', 'भाडावाल:')}</strong> ${bill.tenant_name} | <strong>${t('Room:', 'कोठा:')}</strong> ${bill.room_number}</p>
            <p><strong>${t('Billing Cycle:', 'बिलिङ चक्र:')}</strong> ${dualCycle} | <strong>${t('Due Date:', 'तिर्नुपर्ने मिति:')}</strong> ${dualDueDate}</p>
            <p><strong>${t('Status:', 'अवस्था:')}</strong> ${td(bill.status_display)}</p>
            <hr/>
            <div class="row"><span>${t('Base Room Rent', 'कोठाको आधारभूत भाडा')}</span><span>${t('Rs.', 'रु.')} ${bill.base_rent}</span></div>
            <div class="row"><span>${t('Fixed Water Supply', 'निश्चित पानी महसुल')}</span><span>${t('Rs.', 'रु.')} ${bill.water_bill}</span></div>
            <div class="row"><span>${t('Electricity', 'बिजुली महसुल')} (${bill.previous_meter_reading} → ${bill.current_meter_reading} = ${bill.units_consumed} ${t('units', 'युनिट')} × ${t('Rs.', 'रु.')} 15)</span><span>${t('Rs.', 'रु.')} ${bill.electricity_amount}</span></div>
            <div class="row"><span>${t('Property Damage / Rule Fine', 'क्षति / नियम उल्लंघन जरिवाना')} ${bill.damage_fine_reason ? `(${bill.damage_fine_reason})` : ''}</span><span>${t('Rs.', 'रु.')} ${bill.damage_fine_amount}</span></div>
            <div class="row total"><span>${t('Total Paid', 'कुल भुक्तानी रकम')}</span><span>${t('Rs.', 'रु.')} ${bill.total_payable}</span></div>
            <p style="margin-top:20px;font-size:12px;color:#64748b;">Ref: ${bill.transaction_reference || t('Verified', 'प्रमाणित')} • ${t('Paid At:', 'भुक्तानी मिति:')} ${dualPaidAt}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const rawAvatarUrl = getSafeMediaUrl(
    profileData?.profile_picture_path ||
      profileData?.profile_picture_url ||
      user?.profile_picture_url
  );
  const userAvatarUrl = !avatarLoadError ? rawAvatarUrl : null;
  const qrSafeUrl = getSafeMediaUrl(paymentQR?.qr_image_url);

  const rawDueDate = activeBill?.due_date || assignedRoom?.next_due_date || null;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. TOP TENANT PROFILE & BILLING CYCLE BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 rounded-3xl bg-white p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt={user?.full_name || 'Tenant'}
                onError={() => setAvatarLoadError(true)}
                onClick={() =>
                  openPhotoLightbox([
                    {
                      url: userAvatarUrl,
                      title: `${user?.full_name || t('Tenant', 'भाडावाल')} — ${t(
                        'Profile Photo',
                        'प्रोफाइल फोटो'
                      )}`,
                      subtitle: user?.email,
                    },
                  ])
                }
                className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-100 shadow-sm cursor-pointer hover:scale-105 transition shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md shrink-0">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'T'}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-extrabold text-slate-900">{user?.full_name}</h1>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                  {t('Verified Tenant', 'प्रमाणित भाडावाल')}
                </span>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                <Home className="w-4 h-4 text-indigo-600" />
                {assignedRoom
                  ? `${t('Room', 'कोठा')} ${assignedRoom.room_number} • ${td(
                      assignedRoom.floor || 'Active Unit'
                    )}`
                  : t('No Room Assigned Yet', 'अहिले कुनै कोठा तोकिएको छैन')}
              </p>
            </div>
          </div>
          <div className="sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
              {t('BASE AGREEMENT', 'आधारभूत भाडा सम्झौता')}
            </p>
            <p className="text-2xl font-extrabold text-indigo-600">
              {t('Rs.', 'रु.')} {Number(headerBaseRent).toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-500">
                {t('/month', '/महिना')}
              </span>
            </p>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-3xl bg-amber-50 border border-amber-200 p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-900 uppercase tracking-wide">
              <Clock className="w-4 h-4 text-amber-600" />{' '}
              {t('Billing Cycle', 'बिलिङ चक्र')}
            </span>
            <span className="px-3 py-1 rounded-full bg-white text-amber-800 text-[11px] font-bold border border-amber-200">
              {assignedRoom || isBillOpen
                ? formatDualMonthLabel(activeBill?.billing_month_label || 'Active Cycle')
                : t('No Active Cycle', 'कुनै सक्रिय चक्र छैन')}
            </span>
          </div>
          <div className="mt-4">
            {assignedRoom || isBillOpen ? (
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {t('Due:', 'तिर्नुपर्ने मिति:')}{' '}
                  {rawDueDate || t('Pending', 'प्रतीक्षामा')}
                </p>
                {rawDueDate && formatBSOnly(rawDueDate) && (
                  <p className="text-xs font-bold text-amber-800 mt-0.5">
                    {t('Nepali Date:', 'नेपाली मिति:')} {formatBSOnly(rawDueDate)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-2xl font-extrabold text-slate-900">
                {t('No Pending Dues', 'कुनै बक्यौता बाँकी छैन')}
              </p>
            )}
          </div>
        </div>
      </div>

      {feedback.text && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback({ type: '', text: '' })}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 2. NAVIGATION TABS */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-4">
        {[
          {
            key: 'BILLING',
            label: t('1. Monthly Billing & Receipts', '१. मासिक बिल र रसिदहरू'),
          },
          {
            key: 'KYC_LEASE',
            label: t(
              '2. KYC Verification & Digital Lease',
              '२. केवाईसी प्रमाणीकरण र डिजिटल सम्झौता'
            ),
          },
          {
            key: 'RESERVATIONS',
            label: t(
              `3. Room Bookings (${reservations.length})`,
              `३. कोठा बुकिङ (${reservations.length})`
            ),
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-5 py-3 rounded-2xl text-sm font-extrabold transition ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: BILLING */}
      {activeTab === 'BILLING' &&
        (!assignedRoom && !activeBill ? (
          <div className="rounded-3xl bg-white p-8 sm:p-12 border border-slate-200 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Home className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {t(
                'No Active Room or Pending Monthly Bill',
                'कुनै सक्रिय कोठा वा बाँकी मासिक बिल छैन'
              )}
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              {t(
                'You do not currently have an active room assigned or any open unpaid bills. You can view and print your past official payment receipts in the table below, or browse available units to book a room.',
                'तपाईंको खातामा हाल कुनै सक्रिय कोठा वा तिर्न बाँकी बिल छैन। तपाईंले तलको तालिकाबाट आफ्ना पुराना आधिकारिक रसिदहरू हेर्न र प्रिन्ट गर्न सक्नुहुन्छ, वा नयाँ कोठा बुक गर्न सक्नुहुन्छ।'
              )}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition"
              >
                {t('Browse Available Rooms', 'उपलब्ध कोठाहरू हेर्नुहोस्')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {t('Monthly Bill Telemetry', 'मासिक बिल विवरण')}
                  </h2>
                  {!assignedRoom && selectedBillId && (
                    <button
                      type="button"
                      onClick={() => setSelectedBillId(null)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-600"
                    >
                      {t('Close Past Invoice View', 'पुरानो बिल दृश्य बन्द गर्नुहोस्')}
                    </button>
                  )}
                </div>
                {bills.length > 1 && (
                  <select
                    value={activeBill?.id || ''}
                    onChange={(e) => {
                      setSelectedBillId(Number(e.target.value));
                      setMeterInput('');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-extrabold text-slate-800 outline-none focus:border-indigo-600"
                  >
                    {bills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {formatDualMonthLabel(b.billing_month_label)} — {t('Rs.', 'रु.')}{' '}
                        {Number(b.total_payable).toLocaleString()} ({td(b.status_display)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <div className="flex items-center gap-3">
                    <Home className="w-5 h-5 text-indigo-600" />
                    <p className="text-sm font-bold text-slate-900">
                      {t('Base Room Rent', 'कोठाको आधारभूत भाडा')}
                    </p>
                  </div>
                  <span className="text-base font-extrabold text-slate-900">
                    {t('Rs.', 'रु.')} {baseRent.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <div className="flex items-center gap-3">
                    <Droplets className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm font-bold text-slate-900">
                      {t('Fixed Water Supply', 'निश्चित पानी महसुल')}
                    </p>
                  </div>
                  <span className="text-base font-extrabold text-slate-900">
                    {t('Rs.', 'रु.')} {waterBill.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* PROPERTY DAMAGE / VIOLATION FINE ALERT CARD (AUTO-HIDES WHEN PAID OR UNDONE) */}
              {fineAmount > 0 && isBillOpen && (
                <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-950">
                          {t(
                            'Property Damage / Rule Violation Fine',
                            'सम्पत्ति क्षति / नियम उल्लंघन जरिवाना'
                          )}
                        </h3>
                        {fineAppliedAt && (
                          <p className="text-[11px] text-rose-600 font-semibold">
                            {t('Issued on', 'जारी मिति:')} {formatDualDate(fineAppliedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-lg font-black text-rose-600">
                      + {t('Rs.', 'रु.')} {fineAmount.toLocaleString()}
                    </span>
                  </div>

                  {fineReason && (
                    <div className="p-3 rounded-xl bg-white/90 border border-rose-200/80 text-xs text-rose-950">
                      <span className="font-extrabold uppercase text-[10px] text-rose-500 block mb-0.5">
                        {t(
                          'Official Admin Reason / Remarks:',
                          'आधिकारिक एडमिन कारण / कैफियत:'
                        )}
                      </span>
                      <p className="font-semibold leading-relaxed">{fineReason}</p>
                    </div>
                  )}

                  {fineEvidenceUrls.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-rose-800 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-rose-600" />{' '}
                        {t(
                          `Attached Inspection Evidence (${fineEvidenceUrls.length} Photo${
                            fineEvidenceUrls.length > 1 ? 's' : ''
                          } — Tap to Zoom)`,
                          `संलग्न निरीक्षण प्रमाण (${fineEvidenceUrls.length} फोटो — ठूलो पार्न थिच्नुहोस्)`
                        )}
                      </p>
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                        {fineEvidenceUrls.map((evUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() =>
                              openPhotoLightbox(
                                fineEvidenceUrls.map((u, i) => ({
                                  url: u,
                                  title: `${t('Fine Evidence Photo', 'जरिवाना प्रमाण फोटो')} #${
                                    i + 1
                                  }`,
                                  subtitle: `${t('Fine: Rs.', 'जरिवाना: रु.')} ${fineAmount} • ${t(
                                    'Reason:',
                                    'कारण:'
                                  )} ${fineReason}`,
                                })),
                                idx
                              )
                            }
                            className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-rose-300 bg-white shrink-0 cursor-pointer group"
                          >
                            <img
                              src={evUrl}
                              alt={`Fine Evidence ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-indigo-950 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-600" />{' '}
                    {t('Sub-Meter Telemetry', 'सब-मिटर विवरण')}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white text-xs font-extrabold text-indigo-700 border border-indigo-200">
                    {t('Rs.', 'रु.')} {elecRate} {t('/ unit', '/ युनिट')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase">
                      {t('PREV READING', 'अघिल्लो रिडिङ')}
                    </p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{prevReading}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border-2 border-indigo-500">
                    <p className="text-[10px] font-extrabold text-indigo-600 uppercase">
                      {t('NEW READING', 'नयाँ रिडिङ')}
                    </p>
                    <input
                      type="number"
                      step="0.01"
                      min={prevReading}
                      disabled={!isBillOpen}
                      value={meterInput}
                      onChange={(e) => setMeterInput(e.target.value)}
                      className="w-full text-2xl font-black outline-none mt-1 text-slate-900 disabled:bg-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3.5 border border-indigo-100 text-sm flex justify-between items-center">
                  <span className="font-medium text-slate-600">
                    {t('Consumed:', 'खपत:')}{' '}
                    <strong className="text-slate-900">
                      {unitsConsumed.toFixed(2)} {t('units', 'युनिट')}
                    </strong>
                  </span>
                  <strong className="text-indigo-700">
                    {t('Rs.', 'रु.')} {liveElectricityCost.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                    {t('GRAND TOTAL PAYABLE', 'कुल तिर्नुपर्ने रकम')}
                  </p>
                  <p className="text-4xl font-black mt-2 text-white">
                    {t('Rs.', 'रु.')} {liveGrandTotal.toLocaleString()}
                  </p>
                  {fineAmount > 0 && isBillOpen && (
                    <p className="text-xs font-bold text-rose-400 mt-1">
                      {t(
                        `Includes Rs. ${fineAmount.toLocaleString()} violation/damage fine`,
                        `रु. ${fineAmount.toLocaleString()} जरिवाना समावेश छ`
                      )}
                    </p>
                  )}
                </div>
                <span className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white/20 text-white">
                  {td(
                    activeBill?.status_display ||
                      t('Awaiting Submission', 'प्रमाण पेश गर्न बाँकी')
                  )}
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <h2 className="text-lg font-extrabold text-slate-900">
                {t(
                  'Verification & QR Payment Desk',
                  'प्रमाणीकरण र क्यूआर (QR) भुक्तानी कक्ष'
                )}
              </h2>

              {/* SCAN & DOWNLOAD OFFICIAL PAYMENT QR BOX */}
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/70 to-indigo-50/50 border border-emerald-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                        {paymentQR?.merchant_name ||
                          t(
                            'SmartRent Official Payment QR',
                            'स्मार्टरेन्ट आधिकारिक भुक्तानी QR'
                          )}
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        {t('Scan to pay Rs.', 'स्क्यान गरी तिर्नुहोस्: रु.')}{' '}
                        {liveGrandTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {qrSafeUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadFileFromUrl(
                          qrSafeUrl,
                          `SmartRent-Payment-QR-${activeBill?.room_number || 'Official'}.png`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />{' '}
                      {t('Download QR', 'QR डाउनलोड')}
                    </button>
                  )}
                </div>

                {qrSafeUrl ? (
                  <div className="flex flex-col items-center bg-white rounded-2xl p-3.5 border border-emerald-200/80 shadow-2xs">
                    <div className="relative group">
                      <img
                        src={qrSafeUrl}
                        alt="Official Payment QR Code"
                        onClick={() => setShowQRZoomModal(true)}
                        className="w-44 h-44 object-contain rounded-xl cursor-pointer transition-transform group-hover:scale-[1.02]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowQRZoomModal(true)}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800"
                      >
                        <Maximize2 className="w-3 h-3" />{' '}
                        {t('Tap to View Fullscreen', 'पूरा स्क्रिनमा हेर्न थिच्नुहोस्')}
                      </button>
                    </div>
                    {paymentQR?.payment_note && (
                      <p className="text-[11px] text-slate-500 text-center mt-2 leading-relaxed">
                        {paymentQR.payment_note}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white/80 border border-dashed border-emerald-300 text-center text-xs text-slate-500">
                    {t(
                      'Official payment QR code has not been uploaded by Admin yet. Please ask Admin or pay via cash/eSewa.',
                      'एडमिनद्वारा आधिकारिक भुक्तानी QR अपलोड गरिएको छैन। कृपया एडमिनसँग सम्पर्क गर्नुहोस् वा नगद/ई-सेवा मार्फत तिर्नुहोस्।'
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmitOnlineProof} className="space-y-5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2 uppercase">
                    {t('METER PHOTO (ZONE 1)', 'मिटरको फोटो (क्षेत्र १)')}
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 cursor-pointer overflow-hidden">
                    {meterPreview || activeBill?.meter_photo_url ? (
                      <img
                        src={meterPreview || getSafeMediaUrl(activeBill.meter_photo_url)}
                        alt="Meter"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Camera className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-600">
                          {t(
                            'Upload Meter Reading',
                            'मिटर रिडिङको फोटो अपलोड गर्नुहोस्'
                          )}
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      required
                      disabled={!isBillOpen}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setMeterPhoto(f);
                          setMeterPreview(URL.createObjectURL(f));
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2 uppercase">
                    {t(
                      'PAYMENT SCREENSHOT (ZONE 2)',
                      'भुक्तानी भौचर स्क्रीनशट (क्षेत्र २)'
                    )}
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 cursor-pointer overflow-hidden">
                    {paymentPreview || activeBill?.payment_screenshot_url ? (
                      <img
                        src={paymentPreview || getSafeMediaUrl(activeBill.payment_screenshot_url)}
                        alt="Payment"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <CreditCard className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-600">
                          {t(
                            'Upload eSewa/Bank Receipt',
                            'ई-सेवा वा बैंक भौचर अपलोड गर्नुहोस्'
                          )}
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      required
                      disabled={!isBillOpen}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setPaymentPhoto(f);
                          setPaymentPreview(URL.createObjectURL(f));
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 mb-2 uppercase">
                    {t('TRANSACTION REF ID', 'कारोबार रेफरेन्स आईडी (Ref ID)')}
                  </label>
                  <input
                    type="text"
                    disabled={!isBillOpen}
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder={t('e.g. ESEWA-12345', 'जस्तै: ESEWA-12345')}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 outline-none focus:border-indigo-600 disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!activeBill || !isBillOpen || submitBillMutation.isPending}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg disabled:opacity-50"
                >
                  {submitBillMutation.isPending
                    ? t('Submitting...', 'पेश हुँदैछ...')
                    : isBillOpen
                    ? t(
                        'Submit Proofs for Approval',
                        'स्वीकृतिका लागि प्रमाण पेश गर्नुहोस्'
                      )
                    : t('Bill Already Settled ✓', 'बिल भुक्तानी भइसकेको छ ✓')}
                </button>
              </form>
            </div>
          </div>
        ))}

      {/* TAB 2: KYC & LEASE & MOVE OUT */}
      {activeTab === 'KYC_LEASE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-slate-900">
                {t('Identity Verification (KYC)', 'पहिचान प्रमाणीकरण (KYC)')}
              </h2>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                  kycProfile?.status === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {td(kycProfile?.status_display || 'Pending')}
              </span>
            </div>
            <form onSubmit={handleKYCSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-extrabold mb-1.5 text-slate-600 uppercase">
                    {t('LEGAL NAME', 'पूरा कानुनी नाम')}
                  </label>
                  <input
                    type="text"
                    required
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold mb-1.5 text-slate-600 uppercase">
                    {t('CITIZENSHIP NO', 'नागरिकता नम्बर')}
                  </label>
                  <input
                    type="text"
                    required
                    value={citizenshipNo}
                    onChange={(e) => setCitizenshipNo(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold mb-1.5 text-slate-600 uppercase">
                    {t(
                      'EMERGENCY CONTACT NAME',
                      'आपतकालीन सम्पर्क व्यक्तिको नाम'
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold mb-1.5 text-slate-600 uppercase">
                    {t(
                      'EMERGENCY CONTACT PHONE',
                      'आपतकालीन सम्पर्क फोन नम्बर'
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold mb-2 text-slate-600 uppercase">
                    {t('CITIZENSHIP FRONT', 'नागरिकताको अगाडिको फोटो')}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCitFront(e.target.files?.[0])}
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold mb-2 text-slate-600 uppercase">
                    {t('CITIZENSHIP BACK', 'नागरिकताको पछाडिको फोटो')}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCitBack(e.target.files?.[0])}
                    className="w-full text-xs"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={updateKYCMutation.isPending}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm rounded-2xl"
              >
                {updateKYCMutation.isPending
                  ? t('Saving...', 'सुरक्षित हुँदैछ...')
                  : t('Update KYC Documents', 'केवाईसी कागजात अपडेट गर्नुहोस्')}
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <h3 className="text-lg font-extrabold text-slate-900">
                {t('Digital Lease Agreement', 'डिजिटल भाडा सम्झौता')}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(
                  'All tenants must abide by sub-meter utility terms (Rs. 15/unit), quiet hours, and 100% replacement fine policy for property damage.',
                  'सबै भाडावालहरूले सब-मिटर बिजुली नियम (रु. १५/युनिट), शान्त समय, र सम्पत्ति क्षतिमा लागू हुने जरिवाना नियमहरू पूर्ण रूपमा पालना गर्नुपर्नेछ।'
                )}
              </p>
              {!kycProfile?.has_accepted_lease ? (
                <button
                  onClick={() => acceptLeaseMutation.mutate()}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl"
                >
                  {t(
                    '✓ I Accept the Digital Lease',
                    '✓ म डिजिटल भाडा सम्झौता स्वीकार गर्दछु'
                  )}
                </button>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />{' '}
                  {t('Signed on', 'हस्ताक्षर मिति:')}{' '}
                  {kycProfile.lease_accepted_at
                    ? formatDualDate(kycProfile.lease_accepted_at)
                    : t('Verified', 'प्रमाणित')}
                </div>
              )}
              <button
                onClick={() => setShowLeaseModal(true)}
                className="w-full py-3 border-2 border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-extrabold"
              >
                {t('View Printable Lease', 'प्रिन्ट गर्न मिल्ने सम्झौता हेर्नुहोस्')}
              </button>
            </div>

            {assignedRoom && (
              <div className="rounded-3xl bg-rose-50 border border-rose-100 p-6 sm:p-8 shadow-sm">
                <h3 className="text-base font-extrabold text-rose-900 flex items-center gap-2 mb-2">
                  <LogOut className="w-5 h-5 text-rose-600" />{' '}
                  {t('End Tenancy / Move Out', 'कोठा छोड्ने / बसाइँ सर्ने')}
                </h3>
                <p className="text-xs text-rose-700 mb-5 leading-relaxed">
                  {t(
                    'Initiate a room vacate request. Admin will conduct a final meter reading and settle your security deposit.',
                    'कोठा छोड्न पूर्व अनुरोध पठाउनुहोस्। एडमिनले अन्तिम सब-मिटर रिडिङ जाँच गरी हिसाब फरफारक गर्नुहुनेछ।'
                  )}
                </p>

                {moveOutStatus?.has_active_request ? (
                  <div className="p-4 bg-white rounded-xl border border-rose-100 text-sm font-bold text-slate-800">
                    {t('Status:', 'अवस्था:')}{' '}
                    <span className="text-amber-600 uppercase">
                      {td(moveOutStatus.request?.status_display || 'Pending')}
                    </span>
                    <p className="text-xs text-slate-500 mt-1 font-normal">
                      {t('Requested for:', 'छोड्ने मिति:')}{' '}
                      {formatDualDate(moveOutStatus.request?.requested_date)}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestMoveOutClick}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl"
                  >
                    {t(
                      'Request Move-Out Settlement',
                      'कोठा छोड्ने र हिसाब फरफारक अनुरोध'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RESERVATIONS */}
      {activeTab === 'RESERVATIONS' && (
        <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h2 className="text-lg font-extrabold text-slate-900">
              {t('My Room Reservation Requests', 'मेरा कोठा बुकिङ अनुरोधहरू')}
            </h2>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold rounded-xl"
            >
              {t('Browse Rooms', 'कोठाहरू हेर्नुहोस्')}
            </button>
          </div>
          {reservations.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <p className="text-sm font-bold text-slate-400">
                {t(
                  'No reservations submitted yet.',
                  'अहिलेसम्म कुनै बुकिङ अनुरोध पेश गरिएको छैन।'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reservations.map((r) => (
                <div
                  key={r.id}
                  className="p-5 border border-slate-200 rounded-2xl bg-white flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-lg font-black text-slate-900">
                        {t('Room', 'कोठा')} {r.room_number}
                      </span>
                      <span className="px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg bg-amber-100 text-amber-800">
                        {td(r.status_display)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1">
                      {t('Move-In:', 'सर्ने मिति:')}{' '}
                      {formatDualDate(r.expected_move_in_date)}
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      {td(r.request_type_display)}
                    </p>
                  </div>
                  {r.status === 'PENDING' && (
                    <button
                      onClick={() => cancelResMutation.mutate(r.id)}
                      className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold rounded-xl"
                    >
                      {t('Cancel Request', 'अनुरोध रद्द गर्नुहोस्')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QUICK ACTIONS & HISTORY TABLE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <button
          onClick={() => (activeBill || bills[0]) && handlePrintReceipt(activeBill || bills[0])}
          className="p-5 bg-white border border-slate-200 hover:border-emerald-500 text-left rounded-3xl shadow-sm"
        >
          <Download className="w-6 h-6 text-emerald-500 mb-3" />
          <p className="text-sm font-extrabold text-slate-900">
            {t('Get Receipt', 'रसिद प्राप्त गर्नुहोस्')}
          </p>
        </button>
        <button
          onClick={() => navigate('/support')}
          className="p-5 bg-white border border-slate-200 hover:border-rose-500 text-left rounded-3xl shadow-sm"
        >
          <Wrench className="w-6 h-6 text-rose-500 mb-3" />
          <p className="text-sm font-extrabold text-slate-900">
            {t('Report Issue', 'समस्या टिपाउनुहोस्')}
          </p>
        </button>
        <button
          onClick={() => navigate('/support')}
          className="p-5 bg-white border border-slate-200 hover:border-indigo-500 text-left rounded-3xl shadow-sm"
        >
          <MessageSquare className="w-6 h-6 text-indigo-500 mb-3" />
          <p className="text-sm font-extrabold text-slate-900">
            {t('Chat Admin', 'एडमिनसँग च्याट')}
          </p>
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="p-5 bg-white border border-slate-200 hover:border-amber-500 text-left rounded-3xl shadow-sm"
        >
          <ShieldCheck className="w-6 h-6 text-amber-500 mb-3" />
          <p className="text-sm font-extrabold text-slate-900">
            {t('Security', 'सुरक्षा सेटिङ')}
          </p>
        </button>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-extrabold text-slate-900">
            {t('Payment History & Past Invoices', 'भुक्तानी इतिहास र पुराना बिलहरू')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-white text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="py-4 px-6">
                  {t('Billing Cycle (AD / BS)', 'बिलिङ चक्र (AD / BS)')}
                </th>
                <th className="py-4 px-6">{t('Rent + Water', 'भाडा + पानी')}</th>
                <th className="py-4 px-6">
                  {t('Telemetry & Fines', 'युनिट र जरिवाना')}
                </th>
                <th className="py-4 px-6">
                  {t('Total Payable', 'कुल तिर्नुपर्ने')}
                </th>
                <th className="py-4 px-6">{t('Status', 'अवस्था')}</th>
                <th className="py-4 px-6 text-right">{t('Actions', 'कार्य')}</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-bold">
                    {t(
                      'No billing history or past invoices found.',
                      'कुनै बिलिङ इतिहास वा पुराना बिलहरू फेला परेनन्।'
                    )}
                  </td>
                </tr>
              ) : (
                bills.map((b) => {
                  const rowFineEv = Array.isArray(b.fine_evidence_urls)
                    ? b.fine_evidence_urls.map((u) => getSafeMediaUrl(u)).filter(Boolean)
                    : [];
                  const isRowPaid = ['APPROVED', 'PAID_CASH'].includes(b.status);

                  return (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBillId(b.id)}
                      className={`cursor-pointer transition ${
                        activeBill?.id === b.id ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {formatDualMonthLabel(b.billing_month_label)}
                        <span className="block text-[11px] font-normal text-slate-500">
                          {t('Room', 'कोठा')} {b.room_number} • {t('Due:', 'तिर्नुपर्ने:')}{' '}
                          {formatDualDate(b.due_date)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {t('Rs.', 'रु.')} {b.base_rent} + {b.water_bill}
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        <strong className="text-indigo-600">
                          {b.units_consumed} {t('units', 'युनिट')}
                        </strong>
                        {Number(b.damage_fine_amount || 0) > 0 && !isRowPaid && (
                          <div className="mt-1">
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[11px] font-extrabold">
                              {t('Fine: Rs.', 'जरिवाना: रु.')}{' '}
                              {Number(b.damage_fine_amount).toLocaleString()}
                            </span>
                            {b.damage_fine_reason && (
                              <span className="block text-[11px] text-rose-600 truncate max-w-[200px]">
                                {b.damage_fine_reason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 font-black text-slate-900">
                        {t('Rs.', 'रु.')} {Number(b.total_payable).toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 text-xs rounded-lg font-bold ${
                            isRowPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'PENDING_VERIFICATION'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {td(b.status_display)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5"
                        >
                          {rowFineEv.length > 0 && !isRowPaid && (
                            <button
                              type="button"
                              onClick={() =>
                                openPhotoLightbox(
                                  rowFineEv.map((u, i) => ({
                                    url: u,
                                    title: `${t('Fine Evidence', 'जरिवाना प्रमाण')} #${
                                      i + 1
                                    } — ${formatDualMonthLabel(b.billing_month_label)}`,
                                    subtitle: b.damage_fine_reason,
                                  }))
                                )
                              }
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"
                              title={t(
                                'View Fine Evidence Photos',
                                'जरिवाना प्रमाण फोटो हेर्नुहोस्'
                              )}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(b)}
                            className="p-2 hover:bg-slate-200 rounded-lg"
                            title={t(
                              'Print Official Receipt',
                              'आधिकारिक रसिद प्रिन्ट गर्नुहोस्'
                            )}
                          >
                            <FileText className="w-5 h-5 text-slate-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FULLSCREEN PHOTO LIGHTBOX MODAL                                  */}
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
                  <Download className="w-3.5 h-3.5" />{' '}
                  {t('Download', 'डाउनलोड')}
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

      {/* ========================================================================= */}
      {/* MODAL 2: FULLSCREEN QR ZOOM & DOWNLOAD MODAL                              */}
      {/* ========================================================================= */}
      {showQRZoomModal && qrSafeUrl && (
        <div
          onClick={() => setShowQRZoomModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-center space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="text-left">
                <h3 className="text-sm font-black text-slate-900">
                  {paymentQR?.merchant_name ||
                    t('Official Payment QR', 'आधिकारिक भुक्तानी QR')}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t('Total Payable: Rs.', 'कुल तिर्नुपर्ने: रु.')}{' '}
                  {liveGrandTotal.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQRZoomModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
              <img
                src={qrSafeUrl}
                alt="Payment QR Fullscreen"
                className="w-64 h-64 object-contain rounded-xl"
              />
            </div>

            {paymentQR?.payment_note && (
              <p className="text-xs text-slate-600 leading-relaxed">{paymentQR.payment_note}</p>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowQRZoomModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700"
              >
                {t('Close', 'बन्द गर्नुहोस्')}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFileFromUrl(
                    qrSafeUrl,
                    `SmartRent-Payment-QR-${activeBill?.room_number || 'Official'}.png`
                  )
                }
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md"
              >
                <Download className="w-4 h-4" />{' '}
                {t('Download QR', 'QR डाउनलोड गर्नुहोस्')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: LEASE MODAL                                                      */}
      {/* ========================================================================= */}
      {showLeaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">
                {t('Digital Lease Summary', 'डिजिटल भाडा सम्झौता सारांश')}
              </h3>
              <button
                onClick={() => setShowLeaseModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-700 leading-relaxed mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <p>
                <strong className="text-slate-900">
                  {t('Tenant:', 'भाडावाल:')}
                </strong>{' '}
                {kycProfile?.full_name_legal || user?.full_name}
              </p>
              <p>
                <strong className="text-slate-900">
                  {t('Assigned Unit:', 'तोकिएको कोठा:')}
                </strong>{' '}
                {assignedRoom?.room_number
                  ? `${t('Room', 'कोठा')} ${assignedRoom.room_number}`
                  : t('No Active Room', 'कुनै सक्रिय कोठा छैन')}
              </p>
              {assignedRoom?.entry_date && (
                <p>
                  <strong className="text-slate-900">
                    {t('Move-In Date (AD / BS):', 'कोठामा सरेको मिति (AD / BS):')}
                  </strong>{' '}
                  {formatDualDate(assignedRoom.entry_date)}
                </p>
              )}
              <p>
                <strong className="text-slate-900">
                  {t('Financials:', 'आर्थिक विवरण:')}
                </strong>{' '}
                {t(
                  `Base Rent Rs. ${assignedRoom?.base_rent || '2,500 / 3,800'} + Fixed Water Rs. 100/mo + Sub-metered Electricity @ Rs. 15/unit.`,
                  `आधारभूत भाडा रु. ${assignedRoom?.base_rent || '२,५०० / ३,८००'} + निश्चित पानी रु. १००/महिना + सब-मिटर बिजुली रु. १५/युनिट।`
                )}
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl"
            >
              {t('Print PDF Copy', 'पीडीएफ (PDF) प्रतिलिपि प्रिन्ट गर्नुहोस्')}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: MOVE-OUT MODAL                                                   */}
      {/* ========================================================================= */}
      {showMoveOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-2">
              {t('Request Move-Out', 'कोठा छोड्ने अनुरोध')}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {t(
                'Select your planned departure date. Admin will verify final utility bills and process your deposit refund.',
                'आफ्नो कोठा छोड्ने मिति छान्नुहोस्। एडमिनले अन्तिम सब-मिटर जाँच गरी हिसाब फरफारक गर्नुहुनेछ।'
              )}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                moveOutMutation.mutate({ requested_date: moveOutDate, reason: moveOutReason });
              }}
              className="space-y-5"
            >
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2 uppercase">
                  {t('Expected Move-Out Date (AD)', 'कोठा छोड्ने संभावित मिति (AD)')}
                </label>
                <input
                  type="date"
                  required
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
                {moveOutDate && (
                  <p className="text-xs font-extrabold text-indigo-600 mt-1.5">
                    📅 {t('Nepali Date (BS):', 'नेपाली मिति (बि.सं.):')}{' '}
                    {formatBSOnly(moveOutDate)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2 uppercase">
                  {t('Reason (Optional)', 'कारण (ऐच्छिक)')}
                </label>
                <input
                  type="text"
                  value={moveOutReason}
                  onChange={(e) => setMoveOutReason(e.target.value)}
                  placeholder={t(
                    'e.g. Graduation, Relocation',
                    'जस्तै: पढाइ सकिएको, स्थानान्तरण'
                  )}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoveOutModal(false)}
                  className="flex-1 py-3.5 border-2 border-slate-200 rounded-xl font-extrabold text-sm text-slate-700"
                >
                  {t('Cancel', 'रद्द गर्नुहोस्')}
                </button>
                <button
                  type="submit"
                  disabled={moveOutMutation.isPending}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-sm"
                >
                  {moveOutMutation.isPending
                    ? t('Submitting...', 'पठाउँदै...')
                    : t('Submit Request', 'अनुरोध पेश गर्नुहोस्')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PAY BILL FIRST WARNING MODAL                                     */}
      {/* ========================================================================= */}
      {showPayBillFirstModal && (
        <div
          onClick={() => setShowPayBillFirstModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-8 shadow-2xl border-2 border-rose-100 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 block">
                    {t('Action Required', 'आवश्यक कारबाही')}
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    {t(
                      'Please Pay Your Bill First',
                      'कृपया पहिले आफ्नो बाँकी बिल तिर्नुहोस्'
                    )}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayBillFirstModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t(
                'You have an unsettled monthly bill on your account. Please pay and clear your pending bill before submitting a move-out settlement request.',
                'तपाईंको खातामा मासिक बिल भुक्तानी गर्न बाँकी छ। कोठा छोड्ने अनुरोध पठाउनुअघि कृपया आफ्नो बाँकी बिल चुक्ता गर्नुहोस्।'
              )}
            </p>

            {openUnpaidBill && (
              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">
                    {t('Billing Cycle:', 'बिलिङ चक्र:')}
                  </span>
                  <strong className="text-slate-900">
                    {formatDualMonthLabel(openUnpaidBill.billing_month_label)}
                  </strong>
                </div>
                {openUnpaidBill.due_date && (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">
                      {t('Due Date:', 'तिर्नुपर्ने मिति:')}
                    </span>
                    <strong className="text-slate-800">
                      {formatDualDate(openUnpaidBill.due_date)}
                    </strong>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">
                    {t('Current Status:', 'हालको अवस्था:')}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white text-rose-700 font-extrabold text-[11px] border border-rose-200">
                    {td(openUnpaidBill.status_display)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-rose-200/70">
                  <span className="font-extrabold text-slate-800">
                    {t('Total Payable:', 'कुल तिर्नुपर्ने रकम:')}
                  </span>
                  <strong className="text-base font-black text-rose-600">
                    {t('Rs.', 'रु.')}{' '}
                    {Number(openUnpaidBill.total_payable).toLocaleString()}
                  </strong>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowPayBillFirstModal(false)}
                className="flex-1 py-3.5 border-2 border-slate-200 rounded-xl font-extrabold text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                {t('Close', 'बन्द गर्नुहोस्')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (openUnpaidBill) {
                    setSelectedBillId(openUnpaidBill.id);
                  }
                  setShowPayBillFirstModal(false);
                  setActiveTab('BILLING');
                }}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs sm:text-sm shadow-lg shadow-indigo-600/20 transition inline-flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-4 h-4" />{' '}
                {t('Pay Bill First', 'पहिले बिल तिर्नुहोस्')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
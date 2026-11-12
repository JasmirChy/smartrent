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

export default function TenantDashboard() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('BILLING');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Sub-meter & QR Payment Form States
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [meterInput, setMeterInput] = useState('');
  const [meterPhoto, setMeterPhoto] = useState(null);
  const [meterPreview, setMeterPreview] = useState(null);
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [showQRZoomModal, setShowQRZoomModal] = useState(false);

  // Modals & KYC States
  const [showLeaseModal, setShowLeaseModal] = useState(false);
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
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

  const assignedRoom = profileData?.assigned_room || user?.assigned_room || null;
  const activeBill =
    bills.find((b) => b.id === selectedBillId) ||
    bills.find((b) => ['UNPAID', 'PENDING_VERIFICATION', 'REJECTED'].includes(b.status)) ||
    bills[0] ||
    null;

  useEffect(() => {
    if (activeBill && activeBill.current_meter_reading && !meterInput) {
      setMeterInput(String(activeBill.current_meter_reading));
    }
  }, [activeBill, meterInput]);

  const prevReading = Number(
    activeBill?.previous_meter_reading ?? assignedRoom?.current_meter_reading ?? 0
  );
  const baseRent = Number(activeBill?.base_rent ?? assignedRoom?.base_rent ?? 3800);
  const waterBill = Number(activeBill?.water_bill ?? assignedRoom?.fixed_water_bill ?? 100);
  const elecRate = Number(
    activeBill?.electricity_rate ?? assignedRoom?.electricity_rate_per_unit ?? 15
  );
  const fineAmount = Number(activeBill?.damage_fine_amount ?? 0);

  const numericCurrentReading = meterInput !== '' ? Number(meterInput) : prevReading;
  const unitsConsumed = Math.max(0, numericCurrentReading - prevReading);
  const liveElectricityCost = unitsConsumed * elecRate;
  const liveGrandTotal = baseRent + waterBill + liveElectricityCost + fineAmount;

  // Mutations
  const submitBillMutation = useMutation({
    mutationFn: async (formData) =>
      (
        await axiosClient.post(`/billing/${activeBill.id}/submit-online/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: (data) => {
      setFeedback({ type: 'success', text: data.message });
      queryClient.invalidateQueries({ queryKey: ['tenantBills'] });
      setMeterPhoto(null);
      setPaymentPhoto(null);
      setMeterPreview(null);
      setPaymentPreview(null);
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit proofs.',
      }),
  });

  const updateKYCMutation = useMutation({
    mutationFn: updateKYCProfile,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'KYC documents saved successfully!' });
      queryClient.invalidateQueries({ queryKey: ['tenantKYC'] });
      queryClient.invalidateQueries({ queryKey: ['tenantMeProfile'] });
    },
    onError: () => setFeedback({ type: 'error', text: 'Could not update KYC.' }),
  });

  const acceptLeaseMutation = useMutation({
    mutationFn: acceptDigitalLease,
    onSuccess: (data) => {
      setFeedback({ type: 'success', text: data.message });
      queryClient.invalidateQueries({ queryKey: ['tenantKYC'] });
    },
  });

  const cancelResMutation = useMutation({
    mutationFn: (resId) => processReservationAction(resId, { action: 'CANCEL' }),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Reservation cancelled.' });
      queryClient.invalidateQueries({ queryKey: ['tenantReservations'] });
    },
  });

  const moveOutMutation = useMutation({
    mutationFn: requestMoveOut,
    onSuccess: () => {
      setFeedback({
        type: 'success',
        text: 'Move-out request submitted. Admin will review shortly.',
      });
      setShowMoveOutModal(false);
      queryClient.invalidateQueries({ queryKey: ['moveOutStatus'] });
    },
    onError: (err) =>
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to request move out.',
      }),
  });

  const handleSubmitOnlineProof = (e) => {
    e.preventDefault();
    if (!activeBill) return;
    if (Number(meterInput) < prevReading) {
      setFeedback({ type: 'error', text: `Reading cannot be less than ${prevReading}.` });
      return;
    }
    if (!meterPhoto || !paymentPhoto) {
      setFeedback({ type: 'error', text: 'Upload both Zone 1 and Zone 2 photos.' });
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

  const handlePrintReceipt = (bill) => {
    const win = window.open('', '_blank', 'width=700,height=700');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>SmartRent Receipt - Room ${bill.room_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            .box { border: 2px solid #4f46e5; border-radius: 12px; padding: 24px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .total { font-size: 20px; font-weight: bold; color: #4f46e5; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>SmartRent Official Payment Receipt</h2>
            <p><strong>Tenant:</strong> ${bill.tenant_name} | <strong>Room:</strong> ${bill.room_number}</p>
            <p><strong>Billing Cycle:</strong> ${bill.billing_month_label} | <strong>Status:</strong> ${bill.status_display}</p>
            <hr/>
            <div class="row"><span>Base Room Rent</span><span>Rs. ${bill.base_rent}</span></div>
            <div class="row"><span>Fixed Water Supply</span><span>Rs. ${bill.water_bill}</span></div>
            <div class="row"><span>Electricity (${bill.previous_meter_reading} → ${bill.current_meter_reading} = ${bill.units_consumed} units × Rs. 15)</span><span>Rs. ${bill.electricity_amount}</span></div>
            <div class="row"><span>Property Damage / Rule Fine</span><span>Rs. ${bill.damage_fine_amount}</span></div>
            <div class="row total"><span>Total Paid</span><span>Rs. ${bill.total_payable}</span></div>
            <p style="margin-top:20px;font-size:12px;color:#64748b;">Ref: ${bill.transaction_reference || 'Verified'} • Paid At: ${bill.paid_at || 'Verified by Admin'}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. TOP TENANT PROFILE & BILLING CYCLE BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 rounded-3xl bg-white p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {user?.profile_picture_url ? (
              <img
                src={user.profile_picture_url}
                alt={user.full_name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-100 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'T'}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-extrabold text-slate-900">{user?.full_name}</h1>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                  Verified Tenant
                </span>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                <Home className="w-4 h-4 text-indigo-600" />
                {assignedRoom
                  ? `Room ${assignedRoom.room_number} • ${assignedRoom.floor}`
                  : 'No Room Assigned Yet'}
              </p>
            </div>
          </div>
          <div className="sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
              BASE AGREEMENT
            </p>
            <p className="text-2xl font-extrabold text-indigo-600">
              Rs. {Number(baseRent).toLocaleString()}{' '}
              <span className="text-sm font-medium text-slate-500">/month</span>
            </p>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-3xl bg-amber-50 border border-amber-200 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-900 uppercase tracking-wide">
              <Clock className="w-4 h-4 text-amber-600" /> Billing Cycle
            </span>
            <span className="px-3 py-1 rounded-full bg-white text-amber-800 text-[11px] font-bold border border-amber-200">
              {activeBill?.billing_month_label || 'Active Cycle'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-extrabold text-slate-900">
              Due: {activeBill?.due_date || assignedRoom?.next_due_date || 'Pending'}
            </p>
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
          { key: 'BILLING', label: '1. Monthly Billing & Receipts' },
          { key: 'KYC_LEASE', label: '2. KYC Verification & Digital Lease' },
          { key: 'RESERVATIONS', label: `3. Room Bookings (${reservations.length})` },
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
      {activeTab === 'BILLING' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-extrabold text-slate-900">Monthly Bill Telemetry</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <Home className="w-5 h-5 text-indigo-600" />
                  <p className="text-sm font-bold text-slate-900">Base Room Rent</p>
                </div>
                <span className="text-base font-extrabold text-slate-900">
                  Rs. {baseRent.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-3">
                  <Droplets className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm font-bold text-slate-900">Fixed Water Supply</p>
                </div>
                <span className="text-base font-extrabold text-slate-900">
                  Rs. {waterBill.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-indigo-950 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" /> Sub-Meter Telemetry
                </span>
                <span className="px-3 py-1 rounded-lg bg-white text-xs font-extrabold text-indigo-700 border border-indigo-200">
                  Rs. {elecRate} / unit
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">
                    PREV READING
                  </p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{prevReading}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border-2 border-indigo-500">
                  <p className="text-[10px] font-extrabold text-indigo-600 uppercase">
                    NEW READING
                  </p>
                  <input
                    type="number"
                    step="0.01"
                    min={prevReading}
                    value={meterInput}
                    onChange={(e) => setMeterInput(e.target.value)}
                    className="w-full text-2xl font-black outline-none mt-1 text-slate-900"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="bg-white rounded-xl p-3.5 border border-indigo-100 text-sm flex justify-between items-center">
                <span className="font-medium text-slate-600">
                  Consumed: <strong className="text-slate-900">{unitsConsumed.toFixed(2)} units</strong>
                </span>
                <strong className="text-indigo-700">
                  Rs. {liveElectricityCost.toLocaleString()}
                </strong>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                  GRAND TOTAL PAYABLE
                </p>
                <p className="text-4xl font-black mt-2 text-white">
                  Rs. {liveGrandTotal.toLocaleString()}
                </p>
              </div>
              <span className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white/20 text-white">
                {activeBill?.status_display || 'Awaiting Submission'}
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-extrabold text-slate-900">Verification & QR Payment Desk</h2>

            {/* SCAN & DOWNLOAD OFFICIAL PAYMENT QR BOX */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/70 to-indigo-50/50 border border-emerald-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                      {paymentQR?.merchant_name || 'SmartRent Official Payment QR'}
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Scan to pay Rs. {liveGrandTotal.toLocaleString()}
                    </p>
                  </div>
                </div>
                {paymentQR?.qr_image_url && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadFileFromUrl(
                        paymentQR.qr_image_url,
                        `SmartRent-Payment-QR-${activeBill?.room_number || 'Official'}.png`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" /> Download QR
                  </button>
                )}
              </div>

              {paymentQR?.qr_image_url ? (
                <div className="flex flex-col items-center bg-white rounded-2xl p-3.5 border border-emerald-200/80 shadow-2xs">
                  <div className="relative group">
                    <img
                      src={paymentQR.qr_image_url}
                      alt="Official Payment QR Code"
                      onClick={() => setShowQRZoomModal(true)}
                      className="w-44 h-44 object-contain rounded-xl cursor-pointer transition-transform group-hover:scale-[1.02]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowQRZoomModal(true)}
                      className="mt-2 w-full inline-flex items-center justify-center gap-1 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800"
                    >
                      <Maximize2 className="w-3 h-3" /> Tap to View Fullscreen
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
                  Official payment QR code has not been uploaded by Admin yet. Please ask Admin or pay via cash/eSewa.
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitOnlineProof} className="space-y-5">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2 uppercase">
                  METER PHOTO (ZONE 1)
                </label>
                <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 cursor-pointer overflow-hidden">
                  {meterPreview || activeBill?.meter_photo_url ? (
                    <img
                      src={meterPreview || activeBill.meter_photo_url}
                      alt="Meter"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Camera className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-600">Upload Meter Reading</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    required
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
                  PAYMENT SCREENSHOT (ZONE 2)
                </label>
                <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 cursor-pointer overflow-hidden">
                  {paymentPreview || activeBill?.payment_screenshot_url ? (
                    <img
                      src={paymentPreview || activeBill.payment_screenshot_url}
                      alt="Payment"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <CreditCard className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-600">Upload eSewa/Bank Receipt</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    required
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
                  TRANSACTION REF ID
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. ESEWA-12345"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <button
                type="submit"
                disabled={!activeBill || submitBillMutation.isPending}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg disabled:opacity-50"
              >
                {submitBillMutation.isPending ? 'Submitting...' : 'Submit Proofs for Approval'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: KYC & LEASE & MOVE OUT */}
      {activeTab === 'KYC_LEASE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-slate-900">Identity Verification (KYC)</h2>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                  kycProfile?.status === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {kycProfile?.status_display || 'Pending'}
              </span>
            </div>
            <form onSubmit={handleKYCSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-extrabold mb-1.5 text-slate-600 uppercase">
                    LEGAL NAME
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
                    CITIZENSHIP NO
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
                    EMERGENCY CONTACT NAME
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
                    EMERGENCY CONTACT PHONE
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
                    CITIZENSHIP FRONT
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
                    CITIZENSHIP BACK
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
                Update KYC Documents
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <h3 className="text-lg font-extrabold text-slate-900">Digital Lease Agreement</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                All tenants must abide by sub-meter utility terms (Rs. 15/unit), quiet hours, and
                100% replacement fine policy for property damage.
              </p>
              {!kycProfile?.has_accepted_lease ? (
                <button
                  onClick={() => acceptLeaseMutation.mutate()}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl"
                >
                  ✓ I Accept the Digital Lease
                </button>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Signed on{' '}
                  {kycProfile.lease_accepted_at
                    ? new Date(kycProfile.lease_accepted_at).toLocaleDateString()
                    : 'Verified'}
                </div>
              )}
              <button
                onClick={() => setShowLeaseModal(true)}
                className="w-full py-3 border-2 border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-extrabold"
              >
                View Printable Lease
              </button>
            </div>

            {assignedRoom && (
              <div className="rounded-3xl bg-rose-50 border border-rose-100 p-6 sm:p-8 shadow-sm">
                <h3 className="text-base font-extrabold text-rose-900 flex items-center gap-2 mb-2">
                  <LogOut className="w-5 h-5 text-rose-600" /> End Tenancy / Move Out
                </h3>
                <p className="text-xs text-rose-700 mb-5 leading-relaxed">
                  Initiate a room vacate request. Admin will conduct a final meter reading and
                  settle your security deposit.
                </p>

                {moveOutStatus?.has_active_request ? (
                  <div className="p-4 bg-white rounded-xl border border-rose-100 text-sm font-bold text-slate-800">
                    Status:{' '}
                    <span className="text-amber-600 uppercase">
                      {moveOutStatus.request?.status_display || 'Pending'}
                    </span>
                    <p className="text-xs text-slate-500 mt-1 font-normal">
                      Requested for: {moveOutStatus.request?.requested_date}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowMoveOutModal(true)}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl"
                  >
                    Request Move-Out Settlement
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
            <h2 className="text-lg font-extrabold text-slate-900">My Room Reservation Requests</h2>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold rounded-xl"
            >
              Browse Rooms
            </button>
          </div>
          {reservations.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <p className="text-sm font-bold text-slate-400">No reservations submitted yet.</p>
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
                        Room {r.room_number}
                      </span>
                      <span className="px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg bg-amber-100 text-amber-800">
                        {r.status_display}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1">
                      Move-In: {r.expected_move_in_date}
                    </p>
                    <p className="text-xs text-slate-500 mb-4">{r.request_type_display}</p>
                  </div>
                  {r.status === 'PENDING' && (
                    <button
                      onClick={() => cancelResMutation.mutate(r.id)}
                      className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold rounded-xl"
                    >
                      Cancel Request
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
          onClick={() => activeBill && handlePrintReceipt(activeBill)}
          className="p-5 bg-white border border-slate-200 hover:border-emerald-500 text-left rounded-3xl shadow-sm"
        >
          <Download className="w-6 h-6 text-emerald-500 mb-3" />
          <p className="text-sm font-extrabold text-slate-900">Get Receipt</p>
        </button>
        <button
          onClick={() => navigate('/support')}
          className="p-5 bg-white border border-slate-200 hover:border-rose-500 text-left rounded-3xl shadow-sm"
        >
          <Wrench className="w-6 h-6 text-rose-500 mb-3" />
          <p className="text-sm font-extrabold text-slate-900">Report Issue</p>
        </button>
        <button
          onClick={() => navigate('/support')}
          className="p-5 bg-white border border-slate-200 hover:border-indigo-500 text-left rounded-3xl shadow-sm"
        >
          <MessageSquare className="w-6 h-6 text-indigo-500 mb-3" />
          <p className="text-sm font-extrabold text-slate-900">Chat Admin</p>
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="p-5 bg-white border border-slate-200 hover:border-amber-500 text-left rounded-3xl shadow-sm"
        >
          <ShieldCheck className="w-6 h-6 text-amber-500 mb-3" />
          <p className="text-sm font-extrabold text-slate-900">Security</p>
        </button>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-extrabold text-slate-900">
            Payment History & Past Invoices
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-white text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="py-4 px-6">Billing Cycle</th>
                <th className="py-4 px-6">Rent + Water</th>
                <th className="py-4 px-6">Telemetry</th>
                <th className="py-4 px-6">Total Payable</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {bills.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="py-4 px-6 font-bold text-slate-900">{b.billing_month_label}</td>
                  <td className="py-4 px-6 text-slate-600">
                    Rs. {b.base_rent} + {b.water_bill}
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    <strong className="text-indigo-600">{b.units_consumed} units</strong>
                  </td>
                  <td className="py-4 px-6 font-black text-slate-900">
                    Rs. {Number(b.total_payable).toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg font-bold">
                      {b.status_display}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handlePrintReceipt(b)}
                      className="p-2 hover:bg-slate-200 rounded-lg"
                    >
                      <FileText className="w-5 h-5 text-slate-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULLSCREEN QR ZOOM & DOWNLOAD MODAL */}
      {showQRZoomModal && paymentQR?.qr_image_url && (
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
                  {paymentQR.merchant_name || 'Official Payment QR'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Total Payable: Rs. {liveGrandTotal.toLocaleString()}
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
                src={paymentQR.qr_image_url}
                alt="Payment QR Fullscreen"
                className="w-64 h-64 object-contain rounded-xl"
              />
            </div>

            {paymentQR.payment_note && (
              <p className="text-xs text-slate-600 leading-relaxed">{paymentQR.payment_note}</p>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowQRZoomModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFileFromUrl(
                    paymentQR.qr_image_url,
                    `SmartRent-Payment-QR-${activeBill?.room_number || 'Official'}.png`
                  )
                }
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md"
              >
                <Download className="w-4 h-4" /> Download QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEASE MODAL */}
      {showLeaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">Digital Lease Summary</h3>
              <button
                onClick={() => setShowLeaseModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-700 leading-relaxed mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <p>
                <strong className="text-slate-900">Tenant:</strong>{' '}
                {kycProfile?.full_name_legal || user?.full_name}
              </p>
              <p>
                <strong className="text-slate-900">Assigned Unit:</strong> Room{' '}
                {assignedRoom?.room_number || 'Pending'}
              </p>
              <p>
                <strong className="text-slate-900">Financials:</strong> Base Rent Rs.{' '}
                {assignedRoom?.base_rent || '2,500 / 3,800'} + Fixed Water Rs. 100/mo +
                Sub-metered Electricity @ Rs. 15/unit.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl"
            >
              Print PDF Copy
            </button>
          </div>
        </div>
      )}

      {/* MOVE-OUT MODAL */}
      {showMoveOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-2">Request Move-Out</h3>
            <p className="text-sm text-slate-500 mb-6">
              Select your planned departure date. Admin will verify final utility bills and process
              your deposit refund.
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
                  Expected Move-Out Date
                </label>
                <input
                  type="date"
                  required
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2 uppercase">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={moveOutReason}
                  onChange={(e) => setMoveOutReason(e.target.value)}
                  placeholder="e.g. Graduation, Relocation"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoveOutModal(false)}
                  className="flex-1 py-3.5 border-2 border-slate-200 rounded-xl font-extrabold text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moveOutMutation.isPending}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-sm"
                >
                  {moveOutMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
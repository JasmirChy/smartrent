import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Home,
  Zap,
  Droplets,
  ShieldCheck,
  Clock,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wrench,
  MessageSquare,
  Download,
  Camera,
  CreditCard,
  Loader2,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

export default function TenantDashboard() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [meterInput, setMeterInput] = useState('');
  const [meterPhoto, setMeterPhoto] = useState(null);
  const [meterPreview, setMeterPreview] = useState(null);
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Fetch logged-in user's bills (auto-refreshes every 5s)
  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['tenantBills'],
    queryFn: async () => {
      const res = await axiosClient.get('/billing/');
      return res.data;
    },
  });

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Active unpaid/pending/rejected bill is the latest one
  const activeBill =
    bills.find((b) => ['UNPAID', 'PENDING_VERIFICATION', 'REJECTED'].includes(b.status)) ||
    bills[0] ||
    null;

  useEffect(() => {
    if (activeBill && activeBill.current_meter_reading && !meterInput) {
      setMeterInput(String(activeBill.current_meter_reading));
    }
  }, [activeBill]);

  // Live Interactive Math Calculation (Base Rent + Rs. 100 Water + (New - Old) * 15 + Fine)
  const prevReading = Number(
    activeBill?.previous_meter_reading ?? user?.assigned_room?.current_meter_reading ?? 0
  );
  const baseRent = Number(activeBill?.base_rent ?? user?.assigned_room?.base_rent ?? 3800);
  const waterBill = Number(activeBill?.water_bill ?? user?.assigned_room?.fixed_water_bill ?? 100);
  const elecRate = Number(
    activeBill?.electricity_rate ?? user?.assigned_room?.electricity_rate_per_unit ?? 15
  );
  const fineAmount = Number(activeBill?.damage_fine_amount ?? 0);

  const numericCurrentReading = meterInput !== '' ? Number(meterInput) : prevReading;
  const unitsConsumed = Math.max(0, numericCurrentReading - prevReading);
  const liveElectricityCost = unitsConsumed * elecRate;
  const liveGrandTotal = baseRent + waterBill + liveElectricityCost + fineAmount;

  const submitBillMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axiosClient.post(
        `/billing/${activeBill.id}/submit-online/`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return res.data;
    },
    onSuccess: (data) => {
      setFeedback({ type: 'success', text: data.message });
      queryClient.invalidateQueries({ queryKey: ['tenantBills'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit bill proofs. Check your inputs.',
      });
    },
  });

  const handleSubmitOnlineProof = (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });

    if (!activeBill) return;
    if (Number(meterInput) < prevReading) {
      setFeedback({
        type: 'error',
        text: `New meter reading (${meterInput}) cannot be less than previous reading (${prevReading}).`,
      });
      return;
    }
    if (!meterPhoto || !paymentPhoto) {
      setFeedback({
        type: 'error',
        text: 'Please upload both Zone 1 (Meter Photo Proof) and Zone 2 (Payment Screenshot).',
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

  const handlePrintReceipt = (bill) => {
    const win = window.open('', '_blank', 'width=700,height=700');
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

  const roomInfo = user?.assigned_room;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* TOP TENANT PROFILE & BILLING CYCLE BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user?.profile_picture_url ? (
              <img
                src={user.profile_picture_url}
                alt={user.full_name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-extrabold text-xl flex items-center justify-center">
                {user?.full_name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold text-slate-900">{user?.full_name}</h1>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                  Verified Tenant
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-indigo-600" />
                {roomInfo
                  ? `Room ${roomInfo.room_number} (${
                      roomInfo.room_type === 'SMALL' ? 'Small Studio' : 'Standard Room'
                    }) • ${roomInfo.floor}`
                  : 'No Room Assigned Yet — Contact Admin'}
              </p>
            </div>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              BASE AGREEMENT
            </p>
            <p className="text-xl font-extrabold text-indigo-600">
              Rs. {Number(baseRent).toLocaleString()}{' '}
              <span className="text-xs font-medium text-slate-500">/month</span>
            </p>
            {roomInfo?.entry_date && (
              <p className="text-[11px] text-slate-500">
                Entry Anniversary: <strong>{roomInfo.entry_date}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Right Billing Cycle Due Box */}
        <div className="lg:col-span-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase">
              <Clock className="w-4 h-4 text-amber-600" />
              Billing Cycle
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white text-amber-800 text-[11px] font-bold border border-amber-200">
              {activeBill?.billing_month_label || 'Active Cycle'}
            </span>
          </div>
          <div className="my-2">
            <p className="text-xl font-extrabold text-slate-900">
              Due: {activeBill?.due_date || roomInfo?.next_due_date || 'Pending Assignment'}
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Monthly cycle calculated from your exact move-in date • Email alerts active
            </p>
          </div>
        </div>
      </div>

      {feedback.text && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* MAIN GRID: LEFT LIVE BILL TELEMETRY CALCULATOR | RIGHT PROOF UPLOAD DESK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Monthly Bill Telemetry */}
        <div className="lg:col-span-7 rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Monthly Bill Telemetry</h2>
              <p className="text-xs text-slate-500">
                Real-time dynamic breakdown with Rs. 15/unit sub-meter rate
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sub-meter Live
            </span>
          </div>

          {/* Base Rent & Fixed Water Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <div className="flex items-center gap-3">
                <Home className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Base Room Rent</p>
                  <p className="text-[11px] text-slate-500">
                    Fixed monthly room rate ({roomInfo?.room_number || 'Assigned Room'})
                  </p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-slate-900">
                Rs. {baseRent.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <div className="flex items-center gap-3">
                <Droplets className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Fixed Water Supply</p>
                  <p className="text-[11px] text-slate-500">Standard water charge per room</p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-slate-900">
                Rs. {waterBill.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Sub-Meter Telemetry Interactive Box */}
          <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-indigo-600" />
                Sub-Meter Electricity Telemetry
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-white text-slate-700 text-[11px] font-bold border border-slate-200">
                Rate: Rs. {elecRate} / unit
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  PREVIOUS METER READING
                </p>
                <p className="text-lg font-extrabold text-slate-800 mt-1">
                  {prevReading} <span className="text-xs font-normal text-slate-500">units</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Locked by Admin</p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border-2 border-indigo-500">
                <label className="block text-[10px] font-bold uppercase text-indigo-600">
                  ENTER CURRENT METER READING
                </label>
                <div className="flex items-baseline gap-2 mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min={prevReading}
                    value={meterInput}
                    onChange={(e) => setMeterInput(e.target.value)}
                    placeholder={String(prevReading)}
                    className="w-full text-lg font-extrabold text-slate-900 outline-none bg-transparent"
                  />
                  <span className="text-xs text-slate-400">units</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Type new reading to calculate</p>
              </div>
            </div>

            <div className="bg-white/90 rounded-xl p-3 border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Consumption Formula:</span>
                <strong className="text-slate-900">
                  ({numericCurrentReading} − {prevReading}) × Rs. {elecRate} = Rs.{' '}
                  {liveElectricityCost.toLocaleString()}
                </strong>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-bold">
                Total Used: {unitsConsumed.toFixed(1)} units
              </span>
            </div>
          </div>

          {/* Property Damage / Fine Row */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Outstanding / Property Damage Fines
              </p>
              <p className="text-[11px] text-slate-500">
                {activeBill?.damage_fine_reason || 'Clean record • No rule violation surcharges'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {fineAmount === 0 && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  Clean Record
                </span>
              )}
              <span
                className={`text-sm font-extrabold ${
                  fineAmount > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                Rs. {fineAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Grand Total Payable Banner */}
          <div className="rounded-2xl bg-indigo-600 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-indigo-600/20">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                GRAND TOTAL PAYABLE (RENT + WATER + ELECTRICITY + FINES)
              </p>
              <p className="text-3xl font-extrabold mt-1">
                Rs. {liveGrandTotal.toLocaleString()}
              </p>
              <p className="text-xs text-indigo-100 mt-1">
                Cycle: {activeBill?.cycle_start_date || 'Current'} →{' '}
                {activeBill?.cycle_end_date || 'Monthly'}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-xs text-xs font-bold">
                Status: {activeBill?.status_display || 'Awaiting Submission'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Verification Desk (Zone 1 Meter Photo + Zone 2 Payment Screenshot) */}
        <div className="lg:col-span-5 rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <form onSubmit={handleSubmitOnlineProof} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Verification Desk</h2>
                <p className="text-xs text-slate-500">
                  Upload meter reading photo & online payment proof
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                {activeBill?.status === 'APPROVED' || activeBill?.status === 'PAID_CASH'
                  ? '✓ Verified'
                  : 'Proof Required'}
              </span>
            </div>

            {/* Zone 1: Meter Dial Photo Proof */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>Zone 1: Meter Dial Photo Proof</span>
                <span className="text-[11px] text-indigo-600">Required</span>
              </div>
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-600 bg-slate-50/70 cursor-pointer overflow-hidden transition">
                {meterPreview || activeBill?.meter_photo_url ? (
                  <img
                    src={meterPreview || activeBill.meter_photo_url}
                    alt="Meter Proof"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="w-6 h-6 text-indigo-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-700">
                      Tap to upload photo of New Meter Reading
                    </p>
                    <p className="text-[11px] text-slate-400">Clear dial showing current units</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
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

            {/* Zone 2: Online Payment Screenshot Proof */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>Zone 2: Payment Receipt Screenshot</span>
                <span className="text-[11px] text-slate-500">eSewa / Khalti / Mobile Banking</span>
              </div>
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-600 bg-slate-50/70 cursor-pointer overflow-hidden transition">
                {paymentPreview || activeBill?.payment_screenshot_url ? (
                  <img
                    src={paymentPreview || activeBill.payment_screenshot_url}
                    alt="Payment Screenshot"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4">
                    <CreditCard className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-700">
                      Drag & Drop or tap to upload payment screenshot
                    </p>
                    <p className="text-[11px] text-slate-400">JPG or PNG up to 5MB</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
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

            {/* Optional Transaction Reference */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                TRANSACTION REFERENCE ID (OPTIONAL)
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g., ESEWA-9841-884210"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!activeBill || submitBillMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
            >
              {submitBillMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Submit Meter Reading & Payment Proof
            </button>
          </form>

          {/* Info Note for Cash Payers */}
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-600">
            <strong className="text-slate-900 block mb-0.5">Paying by Cash?</strong>
            If you pay cash directly to the Admin, the Admin will enter your new meter reading and mark your bill as <strong>Paid via Cash</strong> from the Admin Command Center.
          </div>
        </div>
      </div>

      {/* QUICK ACTION SHORTCUT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => activeBill && handlePrintReceipt(activeBill)}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-500 text-left transition shadow-2xs"
        >
          <Download className="w-5 h-5 text-emerald-600 mb-2" />
          <p className="text-xs font-bold text-slate-900">Download Receipt</p>
          <p className="text-[11px] text-slate-500">Official rent & utility slip</p>
        </button>

        <button
          onClick={() => navigate('/support')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-500 text-left transition shadow-2xs"
        >
          <Wrench className="w-5 h-5 text-rose-600 mb-2" />
          <p className="text-xs font-bold text-slate-900">Report Complaint</p>
          <p className="text-[11px] text-slate-500">Plumbing, wiring or issue</p>
        </button>

        <button
          onClick={() => navigate('/support')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-500 text-left transition shadow-2xs"
        >
          <MessageSquare className="w-5 h-5 text-indigo-600 mb-2" />
          <p className="text-xs font-bold text-slate-900">Chat with Admin</p>
          <p className="text-[11px] text-slate-500">Direct real-time message</p>
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-500 text-left transition shadow-2xs"
        >
          <ShieldCheck className="w-5 h-5 text-amber-600 mb-2" />
          <p className="text-xs font-bold text-slate-900">Profile & Password</p>
          <p className="text-[11px] text-slate-500">Photo & Email OTP security</p>
        </button>
      </div>

      {/* PAYMENT HISTORY & PAST INVOICES TABLE */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Payment History & Past Invoices
            </h3>
            <p className="text-xs text-slate-500">
              Complete monthly ledger with meter readings and verification statuses
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                <th className="py-3 px-4">Billing Cycle</th>
                <th className="py-3 px-4">Rent + Water</th>
                <th className="py-3 px-4">Electricity Telemetry</th>
                <th className="py-3 px-4">Total Payable</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No billing history yet. Once Admin assigns your room, your monthly bills appear here.
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{b.billing_month_label}</p>
                      <p className="text-[11px] text-slate-500">Due: {b.due_date}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      Rent: Rs. {b.base_rent} <br />
                      Water: Rs. {b.water_bill}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <strong>{b.units_consumed} units</strong> (Rs. {b.electricity_amount})
                      <br />
                      <span className="text-[11px] text-slate-400">
                        Meter: {b.previous_meter_reading} → {b.current_meter_reading || '...'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      Rs. {Number(b.total_payable).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          b.status === 'APPROVED' || b.status === 'PAID_CASH'
                            ? 'bg-emerald-100 text-emerald-700'
                            : b.status === 'PENDING_VERIFICATION'
                            ? 'bg-amber-100 text-amber-800'
                            : b.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {b.status_display}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handlePrintReceipt(b)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                        title="Print / Download Receipt"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
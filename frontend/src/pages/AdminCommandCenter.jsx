import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  DollarSign,
  Users,
  Building,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Zap,
  Loader2,
  UserPlus,
  BellRing,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import axiosClient from '../api/axiosClient';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AdminCommandCenter() {
  const queryClient = useQueryClient();

  // Feedback Toast State
  const [bannerMsg, setBannerMsg] = useState({ type: '', text: '' });

  // Active tab for Audit Queue
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');

  // Cash Override Modal States
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashBillId, setCashBillId] = useState('');
  const [cashMeterReading, setCashMeterReading] = useState('');
  const [cashFine, setCashFine] = useState('0');
  const [cashReason, setCashReason] = useState('');

  // Assign Tenant to Room Modal States
  const [assignModalRoom, setAssignModalRoom] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [startingMeter, setStartingMeter] = useState('0');

  // Apply Fine Modal States
  const [showFineModal, setShowFineModal] = useState(false);
  const [fineBillId, setFineBillId] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');

  // Expense Logger Form States
  const [expenseCategory, setExpenseCategory] = useState('ELECTRICITY_MAIN');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseReceipt, setExpenseReceipt] = useState(null);

  // 1. Fetch Analytics & KPI data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: async () => {
      const res = await axiosClient.get('/billing/analytics/');
      return res.data;
    },
  });

  // 2. Fetch all bills
  const { data: bills = [], isLoading: billsLoading } = useQuery({
    queryKey: ['allBills'],
    queryFn: async () => {
      const res = await axiosClient.get('/billing/');
      return res.data;
    },
  });

  // 3. Fetch rooms matrix (A1-A4, B1-B5)
  const { data: roomsData } = useQuery({
    queryKey: ['roomsMatrix'],
    queryFn: async () => {
      const res = await axiosClient.get('/rooms/');
      return res.data;
    },
  });

  // 4. Fetch all registered users (so Admin can assign a tenant to a room)
  const { data: allUsers = [] } = useQuery({
    queryKey: ['adminUsersList'],
    queryFn: async () => {
      const res = await axiosClient.get('/accounts/users/');
      return res.data;
    },
  });

  const pendingQueue = bills.filter((b) => b.status === 'PENDING_VERIFICATION');
  const unpaidOrPendingBills = bills.filter(
    (b) => b.status !== 'APPROVED' && b.status !== 'PAID_CASH'
  );
  const roomsList = Array.isArray(roomsData) ? roomsData : roomsData?.rooms || [];

  const refreshAllAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ['allBills'] });
    queryClient.invalidateQueries({ queryKey: ['adminAnalytics'] });
    queryClient.invalidateQueries({ queryKey: ['roomsMatrix'] });
    queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
    queryClient.invalidateQueries({ queryKey: ['adminUsersList'] });
  };

  // Audit Mutation (Approve / Reject)
  const auditMutation = useMutation({
    mutationFn: async ({ billId, action, remarks }) => {
      const res = await axiosClient.post(`/billing/${billId}/audit/`, {
        action,
        admin_remarks: remarks,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setSelectedBillForAudit(null);
      setAdminRemarks('');
    },
  });

  // Cash Override Mutation
  const cashOverrideMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await axiosClient.post('/billing/cash-override/', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setShowCashModal(false);
      setCashBillId('');
      setCashMeterReading('');
      setCashFine('0');
      setCashReason('');
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to record cash payment.',
      });
    },
  });

  // Assign Tenant to Room Mutation
  const assignTenantMutation = useMutation({
    mutationFn: async ({ roomId, payload }) => {
      const res = await axiosClient.post(`/rooms/${roomId}/assign-tenant/`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setAssignModalRoom(null);
      setSelectedTenantId('');
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.error || 'Could not assign tenant to room.',
      });
    },
  });

  // Apply Property Damage Fine Mutation
  const applyFineMutation = useMutation({
    mutationFn: async ({ billId, payload }) => {
      const res = await axiosClient.post(`/billing/${billId}/apply-fine/`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setShowFineModal(false);
      setFineBillId('');
      setFineAmount('');
      setFineReason('');
    },
  });

  // Expense Logger Mutation
  const expenseMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await axiosClient.post('/billing/expenses/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      setBannerMsg({ type: 'success', text: 'House expense recorded in ledger!' });
      refreshAllAdminData();
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseNotes('');
      setExpenseReceipt(null);
    },
  });

  // Trigger Due Email Reminders Mutation
  const reminderMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post('/billing/send-due-reminders/');
      return res.data;
    },
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
    },
  });

  const handleLogExpense = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('category', expenseCategory);
    formData.append('title', expenseTitle);
    formData.append('amount', expenseAmount);
    formData.append('expense_date', expenseDate);
    formData.append('notes', expenseNotes);
    if (expenseReceipt) {
      formData.append('receipt_image', expenseReceipt);
    }
    expenseMutation.mutate(formData);
  };

  const kpis = analytics?.kpis || {
    total_revenue: 0,
    total_expenses: 0,
    net_profit: 0,
    pending_verifications_count: 0,
    total_rooms: 9,
    occupied_rooms: 0,
    vacant_rooms: 9,
  };

  const activeAuditBill =
    selectedBillForAudit || pendingQueue[0] || bills.find((b) => b.status === 'UNPAID') || null;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* HEADER BANNER */}
      <div className="rounded-3xl bg-indigo-600 text-white p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" /> LANDLORD COMMAND DECK
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Executive Command Center
          </h1>
          <p className="text-xs sm:text-sm text-indigo-100 mt-1">
            Real-time telemetric utility audit, tenant remittance clearing & financial ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => reminderMutation.mutate()}
            disabled={reminderMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold border border-indigo-400 transition"
          >
            <BellRing className="w-3.5 h-3.5" />
            {reminderMutation.isPending ? 'Sending...' : 'Send Due Email Alerts'}
          </button>

          <button
            onClick={() => setShowFineModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            + Apply Damage Fine
          </button>

          <button
            onClick={() => setShowCashModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 text-xs font-bold shadow-md transition"
          >
            + Manual Cash Override
          </button>
        </div>
      </div>

      {bannerMsg.text && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            bannerMsg.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button onClick={() => setBannerMsg({ type: '', text: '' })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL COLLECTED REVENUE
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            Rs. {Number(kpis.total_revenue).toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Rent + Water + Electricity + Fines
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              VERIFICATION QUEUE
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {pendingQueue.length} Submissions
          </p>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">
            {pendingQueue.length > 0 ? 'Awaiting Photo Inspection' : 'All Submissions Cleared'}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ROOM OCCUPANCY
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {kpis.occupied_rooms} / {kpis.total_rooms} Rooms
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {kpis.vacant_rooms} Available • Ground (A1–A4) & 2nd (B1–B5)
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              NET OPERATING PROFIT
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-indigo-600">
            Rs. {Number(kpis.net_profit).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Gross Revenue minus House Expenses</p>
        </div>
      </div>

      {/* UNIT TELEMETRY & OCCUPANCY MATRIX (ROOMS A1-A4 & B1-B5) */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Unit Telemetry & Occupancy Matrix (Rooms A1–A4 & B1–B5)
            </h3>
            <p className="text-xs text-slate-500">
              Click "Assign Tenant" on any vacant room to set the tenant's entry date, initial sub-meter reading, and generate their monthly bill.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roomsList.map((room) => {
            const occupied = room.is_occupied;
            const tenant = room.active_tenancy;
            const isSmall = room.room_type === 'SMALL';

            return (
              <div
                key={room.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                  occupied
                    ? 'border-indigo-200 bg-white shadow-xs'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Room {room.room_number}
                      </h4>
                      {isSmall && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Small (Rs. 2,500)
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        occupied
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {occupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-800 mb-2">
                    {occupied && tenant ? tenant.full_name : 'Available for Lease'}
                  </p>

                  <div className="space-y-1 text-[11px] text-slate-500 mb-4">
                    <p>
                      Current Sub-Meter: <strong>{room.current_meter_reading} units</strong>
                    </p>
                    <p>
                      Rent: Rs. {Number(room.base_rent).toLocaleString()} + Rs. 100 Water
                    </p>
                    {occupied && tenant && (
                      <>
                        <p>Entry Date: <strong>{tenant.entry_date}</strong></p>
                        <p>Next Due: <strong>{tenant.next_due_date}</strong></p>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {room.floor_display}
                  </span>
                  {occupied ? (
                    <button
                      onClick={() => {
                        if (window.confirm(`Mark Room ${room.room_number} as vacant?`)) {
                          axiosClient.post(`/rooms/${room.id}/vacate/`).then(() => {
                            refreshAllAdminData();
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition"
                    >
                      Vacate Room
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setAssignModalRoom(room);
                        setStartingMeter(String(room.current_meter_reading || 0));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold shadow-xs transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Assign Tenant
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REMITTANCE & METER AUDIT CLEARING QUEUE */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              Remittance & Meter Audit Clearing
              {pendingQueue.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  {pendingQueue.length} Pending
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Review unit telemetry, side-by-side meter dial captures, and digital payment slips
            </p>
          </div>
        </div>

        {billsLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : bills.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No bills generated yet. Assign a tenant to any room above to generate their first monthly bill!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Queue List */}
            <div className="lg:col-span-5 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                SELECT BILL FOR INSPECTION
              </p>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {bills.map((b) => {
                  const isSelected = activeAuditBill?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBillForAudit(b)}
                      className={`p-4 rounded-2xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-xs">
                          Room {b.room_number} • {b.tenant_name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            b.status === 'PENDING_VERIFICATION'
                              ? 'bg-amber-100 text-amber-800'
                              : b.status === 'APPROVED' || b.status === 'PAID_CASH'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.status_display}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          Meter: {b.previous_meter_reading} → {b.current_meter_reading ?? '...'} (
                          {b.units_consumed} units)
                        </span>
                        <span className="font-extrabold text-slate-900">
                          Rs. {Number(b.total_payable).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Side-by-Side Inspection Target */}
            {activeAuditBill && (
              <div className="lg:col-span-7 rounded-2xl bg-slate-50 border border-slate-200/80 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Room {activeAuditBill.room_number} — {activeAuditBill.tenant_name}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Cycle: {activeAuditBill.billing_month_label} • Due: {activeAuditBill.due_date}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-indigo-600">
                    Total: Rs. {Number(activeAuditBill.total_payable).toLocaleString()}
                  </span>
                </div>

                {/* Side-by-Side Images: Zone 1 Meter Photo & Zone 2 Payment Receipt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Zone 1: Sub-Meter Snapshot
                    </p>
                    <div className="w-full h-44 rounded-xl bg-slate-900 overflow-hidden border border-slate-300">
                      {activeAuditBill.meter_photo_url ? (
                        <a
                          href={activeAuditBill.meter_photo_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={activeAuditBill.meter_photo_url}
                            alt="Meter Snapshot"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          No meter photo uploaded yet
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Reading: <strong>{activeAuditBill.current_meter_reading ?? 'Pending'} units</strong>{' '}
                      (Prev: {activeAuditBill.previous_meter_reading})
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Zone 2: Payment Receipt Slip
                    </p>
                    <div className="w-full h-44 rounded-xl bg-slate-900 overflow-hidden border border-slate-300">
                      {activeAuditBill.payment_screenshot_url ? (
                        <a
                          href={activeAuditBill.payment_screenshot_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={activeAuditBill.payment_screenshot_url}
                            alt="Payment Slip"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          No payment screenshot uploaded yet
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Ref: <strong>{activeAuditBill.transaction_reference || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    ADMIN AUDIT REMARKS / REJECTION REASON
                  </label>
                  <input
                    type="text"
                    value={adminRemarks}
                    onChange={(e) => setAdminRemarks(e.target.value)}
                    placeholder="e.g., Verified successfully or Please upload clearer meter photo"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() =>
                      auditMutation.mutate({
                        billId: activeAuditBill.id,
                        action: 'REJECT',
                        remarks: adminRemarks || 'Please re-upload clearer meter photo or receipt.',
                      })
                    }
                    disabled={auditMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject / Request Re-upload
                  </button>

                  <button
                    onClick={() =>
                      auditMutation.mutate({
                        billId: activeAuditBill.id,
                        action: 'APPROVE',
                        remarks: adminRemarks || 'Verified and approved by Landlord.',
                      })
                    }
                    disabled={auditMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition"
                  >
                    {auditMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve & Issue Receipt
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FINANCIAL VELOCITY & UTILITY CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
          <h3 className="text-base font-extrabold text-slate-900 mb-1">
            Financial Velocity & Operational Net (Bar Chart)
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Monthly comparison of rental & utility income vs. whole-house expenses
          </p>

          <div className="w-full h-72">
            {analyticsLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.monthly_trend_chart || []}>
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="income"
                    name="Rental Income (Rs.)"
                    fill="#4F46E5"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="House Expenses (Rs.)"
                    fill="#EF4444"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Utility Outflow (Pie Chart)
            </h3>
            <p className="text-xs text-slate-500">Breakdown of whole-house operational expenses</p>
          </div>

          <div className="w-full h-56 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.expense_pie_chart || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {(analytics?.expense_pie_chart || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {(analytics?.expense_pie_chart || []).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-bold text-slate-900">Rs. {item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECORD BUILDING OUTFLOW (EXPENSE LOGGER) */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
        <h3 className="text-base font-extrabold text-slate-900 mb-1">
          Record Whole-House Expense (Electricity, Water Supply, Maintenance)
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Log main NEA electricity grid bills, water tanker bills, and building repair expenses to update the Pie and Bar charts automatically.
        </p>

        <form onSubmit={handleLogExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
              CATEGORY
            </label>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
            >
              <option value="ELECTRICITY_MAIN">Main Electricity (NEA)</option>
              <option value="WATER_SUPPLY">Water Supply / Tanker</option>
              <option value="MAINTENANCE">Plumbing & Repairs</option>
              <option value="CLEANING_SANITATION">Cleaning & Waste</option>
              <option value="INTERNET_OTHER">Internet / Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
              TITLE / VENDOR
            </label>
            <input
              type="text"
              required
              value={expenseTitle}
              onChange={(e) => setExpenseTitle(e.target.value)}
              placeholder="e.g. NEA Main Meter Bill"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
              AMOUNT (NPR)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              placeholder="e.g. 4200"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
              EXPENSE DATE
            </label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
            />
          </div>

          <button
            type="submit"
            disabled={expenseMutation.isPending}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition"
          >
            {expenseMutation.isPending ? 'Saving...' : 'Commit Expense'}
          </button>
        </form>
      </div>

      {/* MODAL 1: ASSIGN TENANT TO ROOM & SET INITIAL METER READING */}
      {assignModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-900 mb-1">
              Assign Tenant to Room {assignModalRoom.room_number}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Base Rent: Rs. {Number(assignModalRoom.base_rent).toLocaleString()}/mo • Water: Rs. 100/mo • Electricity: Rs. 15/unit
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                assignTenantMutation.mutate({
                  roomId: assignModalRoom.id,
                  payload: {
                    tenant_id: Number(selectedTenantId),
                    entry_date: entryDate,
                    starting_meter_reading: startingMeter,
                  },
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  SELECT REGISTERED TENANT
                </label>
                <select
                  required
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                >
                  <option value="">-- Choose User --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email} • {u.phone_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  MOVE-IN / ENTRY DATE (Determines Monthly Billing Date)
                </label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  INITIAL ELECTRICITY SUB-METER READING (Units)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={startingMeter}
                  onChange={(e) => setStartingMeter(e.target.value)}
                  placeholder="e.g. 1200"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalRoom(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignTenantMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
                >
                  {assignTenantMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL CASH PAYMENT OVERRIDE */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-900 mb-1">
              Record Manual Cash Payment
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter the tenant's new meter reading to auto-calculate (New − Old) × Rs. 15 and mark the bill as Paid via Cash.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                cashOverrideMutation.mutate({
                  bill_id: Number(cashBillId),
                  current_meter_reading: cashMeterReading,
                  damage_fine_amount: cashFine || '0',
                  damage_fine_reason: cashReason,
                  admin_remarks: 'Paid via Cash directly to Landlord Admin',
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  SELECT ACTIVE BILL
                </label>
                <select
                  required
                  value={cashBillId}
                  onChange={(e) => setCashBillId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                >
                  <option value="">-- Choose Tenant Bill --</option>
                  {unpaidOrPendingBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      Room {b.room_number} — {b.tenant_name} (Prev Meter: {b.previous_meter_reading})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NEW METER READING (Units)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cashMeterReading}
                  onChange={(e) => setCashMeterReading(e.target.value)}
                  placeholder="e.g. 1245"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DAMAGE FINE AMOUNT (OPTIONAL)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cashFine}
                  onChange={(e) => setCashFine(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  FINE REASON (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={cashReason}
                  onChange={(e) => setCashReason(e.target.value)}
                  placeholder="e.g. Broken switch replacement"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cashOverrideMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
                >
                  {cashOverrideMutation.isPending ? 'Processing...' : 'Confirm Cash Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: APPLY PROPERTY DAMAGE / RULE VIOLATION FINE */}
      {showFineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-900 mb-1">
              Apply Property Damage / Rule Violation Fine
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Adds a surcharge directly to the tenant's active monthly bill.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyFineMutation.mutate({
                  billId: Number(fineBillId),
                  payload: {
                    damage_fine_amount: fineAmount,
                    damage_fine_reason: fineReason,
                  },
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  SELECT TENANT BILL
                </label>
                <select
                  required
                  value={fineBillId}
                  onChange={(e) => setFineBillId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                >
                  <option value="">-- Choose Active Bill --</option>
                  {unpaidOrPendingBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      Room {b.room_number} — {b.tenant_name} ({b.billing_month_label})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  FINE AMOUNT (NPR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DAMAGE / VIOLATION REASON
                </label>
                <input
                  type="text"
                  required
                  value={fineReason}
                  onChange={(e) => setFineReason(e.target.value)}
                  placeholder="e.g. Corridor cleanliness violation / Broken window latch"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFineModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyFineMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md"
                >
                  {applyFineMutation.isPending ? 'Applying...' : 'Apply Fine to Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  DollarSign,
  Building,
  Zap,
  UserPlus,
  BellRing,
  AlertTriangle,
  X,
  CalendarCheck,
  Megaphone,
  Trash2,
  LogOut,
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
import axiosClient, {
  fetchReservations,
  processReservationAction,
  triggerBulkGenerateBills,
  fetchNotices,
  createNotice,
  deleteNotice,
  fetchPendingMoveOuts,
  processMoveOutRequest,
} from '../api/axiosClient';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AdminCommandCenter() {
  const queryClient = useQueryClient();

  const [bannerMsg, setBannerMsg] = useState({ type: '', text: '' });
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [startingMeterOverride, setStartingMeterOverride] = useState('');

  // Overrides & Modals
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashBillId, setCashBillId] = useState('');
  const [cashMeterReading, setCashMeterReading] = useState('');
  const [cashFine, setCashFine] = useState('0');
  const [cashReason, setCashReason] = useState('');

  const [assignModalRoom, setAssignModalRoom] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [startingMeter, setStartingMeter] = useState('0');

  const [showFineModal, setShowFineModal] = useState(false);
  const [fineBillId, setFineBillId] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');

  // Notice Board Form States (ITEM A)
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeCategory, setNoticeCategory] = useState('GENERAL');

  // Expense Form
  const [expenseCategory, setExpenseCategory] = useState('ELECTRICITY_MAIN');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseReceipt, setExpenseReceipt] = useState(null);

  // Move Out Review State
  const [selectedMoveOut, setSelectedMoveOut] = useState(null);
  const [finalMeterReading, setFinalMeterReading] = useState('');

  // Queries
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: async () => (await axiosClient.get('/billing/analytics/')).data,
  });

  const { data: rawBills = [] } = useQuery({
    queryKey: ['allBills'],
    queryFn: async () => {
      const res = await axiosClient.get('/billing/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const { data: roomsData } = useQuery({
    queryKey: ['roomsMatrix'],
    queryFn: async () => (await axiosClient.get('/rooms/')).data,
  });

  const { data: rawUsers = [] } = useQuery({
    queryKey: ['adminUsersList'],
    queryFn: async () => {
      const res = await axiosClient.get('/accounts/users/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
  });

  const { data: rawReservations = [] } = useQuery({
    queryKey: ['adminReservations'],
    queryFn: fetchReservations,
  });

  const { data: rawNotices = [] } = useQuery({
    queryKey: ['adminNotices'],
    queryFn: fetchNotices,
  });

  const { data: rawPendingMoveOuts = [] } = useQuery({
    queryKey: ['pendingMoveOuts'],
    queryFn: fetchPendingMoveOuts,
  });

  const bills = Array.isArray(rawBills) ? rawBills : [];
  const allUsers = Array.isArray(rawUsers) ? rawUsers : [];
  const reservations = Array.isArray(rawReservations) ? rawReservations : [];
  const notices = Array.isArray(rawNotices) ? rawNotices : [];
  const pendingMoveOuts = Array.isArray(rawPendingMoveOuts) ? rawPendingMoveOuts : [];

  const pendingQueue = bills.filter((b) => b.status === 'PENDING_VERIFICATION');
  const pendingReservations = reservations.filter((r) => r.status === 'PENDING');
  const unpaidOrPendingBills = bills.filter(
    (b) => b.status !== 'APPROVED' && b.status !== 'PAID_CASH'
  );
  const roomsList = Array.isArray(roomsData)
    ? roomsData
    : Array.isArray(roomsData?.rooms)
    ? roomsData.rooms
    : Array.isArray(roomsData?.results)
    ? roomsData.results
    : [];

  const refreshAllAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ['allBills'] });
    queryClient.invalidateQueries({ queryKey: ['adminAnalytics'] });
    queryClient.invalidateQueries({ queryKey: ['roomsMatrix'] });
    queryClient.invalidateQueries({ queryKey: ['adminUsersList'] });
    queryClient.invalidateQueries({ queryKey: ['adminReservations'] });
    queryClient.invalidateQueries({ queryKey: ['adminNotices'] });
    queryClient.invalidateQueries({ queryKey: ['pendingMoveOuts'] });
  };

  // Mutations
  const reservationActionMutation = useMutation({
    mutationFn: async ({ id, payload }) => processReservationAction(id, payload),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setSelectedReservation(null);
      setStartingMeterOverride('');
    },
  });

  const auditMutation = useMutation({
    mutationFn: async ({ billId, action, remarks }) =>
      (await axiosClient.post(`/billing/${billId}/audit/`, { action, admin_remarks: remarks })).data,
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setSelectedBillForAudit(null);
      setAdminRemarks('');
    },
  });

  const cashOverrideMutation = useMutation({
    mutationFn: async (payload) => (await axiosClient.post('/billing/cash-override/', payload)).data,
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setShowCashModal(false);
    },
  });

  const assignTenantMutation = useMutation({
    mutationFn: async ({ roomId, payload }) =>
      (await axiosClient.post(`/rooms/${roomId}/assign-tenant/`, payload)).data,
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setAssignModalRoom(null);
    },
  });

  const applyFineMutation = useMutation({
    mutationFn: async ({ billId, payload }) =>
      (await axiosClient.post(`/billing/${billId}/apply-fine/`, payload)).data,
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setShowFineModal(false);
    },
  });

  const expenseMutation = useMutation({
    mutationFn: async (formData) =>
      (
        await axiosClient.post('/billing/expenses/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: () => {
      setBannerMsg({ type: 'success', text: 'Expense recorded!' });
      refreshAllAdminData();
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async () => (await axiosClient.post('/billing/send-due-reminders/')).data,
    onSuccess: (data) => setBannerMsg({ type: 'success', text: data.message }),
  });

  const createNoticeMutation = useMutation({
    mutationFn: createNotice,
    onSuccess: () => {
      setBannerMsg({ type: 'success', text: 'Notice published to all tenants!' });
      refreshAllAdminData();
      setNoticeTitle('');
      setNoticeContent('');
    },
  });

  const deleteNoticeMutation = useMutation({
    mutationFn: deleteNotice,
    onSuccess: () => {
      setBannerMsg({ type: 'success', text: 'Notice deleted.' });
      refreshAllAdminData();
    },
  });

  const processMoveOutMutation = useMutation({
    mutationFn: async ({ id, payload }) => processMoveOutRequest(id, payload),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setSelectedMoveOut(null);
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to process move-out.',
      });
    },
  });

  const handlePostNotice = (e) => {
    e.preventDefault();
    createNoticeMutation.mutate({
      title: noticeTitle,
      content: noticeContent,
      category: noticeCategory,
      is_active: true,
    });
  };

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
    occupied_rooms: 0,
    total_rooms: 9,
    vacant_rooms: 9,
  };

  const activeAuditBill =
    selectedBillForAudit || pendingQueue[0] || bills.find((b) => b.status === 'UNPAID') || null;
  const activeReviewReservation =
    selectedReservation || pendingReservations[0] || reservations[0] || null;
  const activeMoveOut = selectedMoveOut || pendingMoveOuts[0] || null;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* HEADER BANNER */}
      <div className="rounded-3xl bg-indigo-600 text-white p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" /> LANDLORD COMMAND DECK
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Executive Command Center
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              triggerBulkGenerateBills()
                .then((res) => {
                  setBannerMsg({ type: 'success', text: res.message });
                  refreshAllAdminData();
                })
                .catch(() => {
                  setBannerMsg({ type: 'error', text: 'Bulk generate endpoint not wired yet.' });
                });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition"
          >
            <Zap className="w-3.5 h-3.5" /> Auto-Generate Bills
          </button>
          <button
            onClick={() => reminderMutation.mutate()}
            disabled={reminderMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold border border-indigo-400 transition"
          >
            <BellRing className="w-3.5 h-3.5" /> Send Alerts
          </button>
          <button
            onClick={() => setShowFineModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> + Apply Fine
          </button>
          <button
            onClick={() => setShowCashModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 text-xs font-bold shadow-md transition"
          >
            + Cash Override
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
              TOTAL REVENUE
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            Rs. {Number(kpis.total_revenue).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              BOOKING QUEUE
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {pendingReservations.length} Requests
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              OCCUPANCY
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {kpis.occupied_rooms} / {kpis.total_rooms} Rooms
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              NET PROFIT
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-indigo-600">
            Rs. {Number(kpis.net_profit).toLocaleString()}
          </p>
        </div>
      </div>

      {/* NOTICE BOARD PUBLISHER (ITEM A) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-1">
            <Megaphone className="w-5 h-5 text-indigo-600" /> Broadcast House Notice
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            Publish announcements, maintenance schedules, or urgent alerts directly to all tenants'
            dashboards.
          </p>
          <form onSubmit={handlePostNotice} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  NOTICE TITLE
                </label>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="e.g., Water Tank Cleaning This Sunday"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  CATEGORY
                </label>
                <select
                  value={noticeCategory}
                  onChange={(e) => setNoticeCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                >
                  <option value="GENERAL">General Notice</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="URGENT">Urgent Alert</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                NOTICE CONTENT
              </label>
              <textarea
                required
                rows="3"
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                placeholder="Details of the announcement..."
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={createNoticeMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition"
            >
              {createNoticeMutation.isPending ? 'Publishing...' : 'Publish Notice to Tenants'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-4 rounded-2xl bg-slate-50 border border-slate-200/80 p-5 overflow-y-auto max-h-[350px]">
          <h3 className="text-sm font-extrabold text-slate-900 mb-4">Active Broadcasts</h3>
          {notices.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No active notices.</p>
          ) : (
            <div className="space-y-3">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-bold ${
                        n.category === 'URGENT' ? 'text-rose-600' : 'text-indigo-600'
                      }`}
                    >
                      {n.category_display || n.category}
                    </span>
                    <button
                      onClick={() => deleteNoticeMutation.mutate(n.id)}
                      className="text-slate-400 hover:text-rose-600 transition"
                      title="Delete Notice"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-bold text-slate-900">{n.title}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROOM RESERVATION & VISIT BOOKING QUEUE */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-6">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          Room Reservations & Visit Requests
          {pendingReservations.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
              {pendingReservations.length} Pending
            </span>
          )}
        </h3>
        {reservations.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No room reservations submitted yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {reservations.map((res) => (
                <div
                  key={res.id}
                  onClick={() => {
                    setSelectedReservation(res);
                    setStartingMeterOverride(String(res.current_meter_reading || 0));
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer ${
                    activeReviewReservation?.id === res.id
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      Room {res.room_number} • {res.user_full_name || res.user_email}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                      {res.status_display}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Move-in: {res.expected_move_in_date}
                  </p>
                </div>
              ))}
            </div>

            {activeReviewReservation && (
              <div className="lg:col-span-7 rounded-2xl bg-slate-50 border border-slate-200/80 p-5 space-y-4">
                <h4 className="text-sm font-extrabold text-slate-900">
                  Room {activeReviewReservation.room_number} —{' '}
                  {activeReviewReservation.user_full_name}
                </h4>
                {activeReviewReservation.status === 'PENDING' && (
                  <div className="space-y-3">
                    <input
                      type="number"
                      step="0.01"
                      value={startingMeterOverride}
                      onChange={(e) => setStartingMeterOverride(e.target.value)}
                      placeholder="Initial Sub-Meter Reading"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          reservationActionMutation.mutate({
                            id: activeReviewReservation.id,
                            payload: { action: 'REJECT', admin_remarks: 'Rejected by Landlord' },
                          })
                        }
                        className="flex-1 py-2.5 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() =>
                          reservationActionMutation.mutate({
                            id: activeReviewReservation.id,
                            payload: {
                              action: 'APPROVE',
                              starting_meter_reading:
                                startingMeterOverride ||
                                activeReviewReservation.current_meter_reading,
                              entry_date: activeReviewReservation.expected_move_in_date,
                            },
                          })
                        }
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                      >
                        Approve & Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* UNIT TELEMETRY MATRIX */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-5">
        <h3 className="text-base font-extrabold text-slate-900">
          Unit Telemetry & Occupancy Matrix
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roomsList.map((room) => {
            const occupied = room.is_occupied;
            const tenant = room.active_tenancy;
            return (
              <div
                key={room.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  occupied ? 'border-indigo-200 bg-white' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Room {room.room_number}
                    </h4>
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
                    {occupied && tenant ? tenant.full_name : 'Available'}
                  </p>
                  <div className="space-y-1 text-[11px] text-slate-500 mb-4">
                    <p>
                      Meter: <strong>{room.current_meter_reading} units</strong>
                    </p>
                    {occupied && tenant && (
                      <p>
                        Next Due: <strong>{tenant.next_due_date}</strong>
                      </p>
                    )}
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  {occupied ? (
                    <button
                      onClick={() => {
                        if (window.confirm(`Mark Room ${room.room_number} as vacant?`)) {
                          axiosClient.post(`/rooms/${room.id}/vacate/`).then(() => {
                            refreshAllAdminData();
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold"
                    >
                      Vacate Room
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setAssignModalRoom(room);
                        setStartingMeter(String(room.current_meter_reading || 0));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
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
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          Remittance & Meter Audit Clearing
          {pendingQueue.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
              {pendingQueue.length} Pending
            </span>
          )}
        </h3>

        {bills.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">No bills generated yet.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {bills.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBillForAudit(b)}
                  className={`p-4 rounded-2xl border cursor-pointer ${
                    activeAuditBill?.id === b.id
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      Room {b.room_number} • {b.tenant_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                      {b.status_display}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Rs. {Number(b.total_payable).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {activeAuditBill && (
              <div className="lg:col-span-7 rounded-2xl bg-slate-50 border border-slate-200/80 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Room {activeAuditBill.room_number} — {activeAuditBill.tenant_name}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Cycle: {activeAuditBill.billing_month_label}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-indigo-600">
                    Total: Rs. {Number(activeAuditBill.total_payable).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Zone 1: Sub-Meter
                    </p>
                    <div className="w-full h-44 rounded-xl bg-slate-900 overflow-hidden border">
                      {activeAuditBill.meter_photo_url && (
                        <a
                          href={activeAuditBill.meter_photo_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={activeAuditBill.meter_photo_url}
                            alt="Meter"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Zone 2: Payment Receipt
                    </p>
                    <div className="w-full h-44 rounded-xl bg-slate-900 overflow-hidden border">
                      {activeAuditBill.payment_screenshot_url && (
                        <a
                          href={activeAuditBill.payment_screenshot_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={activeAuditBill.payment_screenshot_url}
                            alt="Payment"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder="Remarks..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border outline-none"
                />
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() =>
                      auditMutation.mutate({
                        billId: activeAuditBill.id,
                        action: 'REJECT',
                        remarks: adminRemarks || 'Please re-upload.',
                      })
                    }
                    className="flex-1 py-3 bg-rose-50 text-rose-700 font-bold text-xs rounded-xl border"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      auditMutation.mutate({
                        billId: activeAuditBill.id,
                        action: 'APPROVE',
                        remarks: adminRemarks || 'Verified.',
                      })
                    }
                    className="flex-1 py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl"
                  >
                    Approve
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
          <h3 className="text-base font-extrabold text-slate-900 mb-1">
            Financial Velocity (Bar Chart)
          </h3>
          <div className="w-full h-72 mt-4">
            {!analyticsLoading && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.monthly_trend_chart || []}>
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="income"
                    name="Income (Rs.)"
                    fill="#4F46E5"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses (Rs.)"
                    fill="#EF4444"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="lg:col-span-4 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <h3 className="text-base font-extrabold text-slate-900 mb-1">
            Utility Outflow (Pie Chart)
          </h3>
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
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RECORD BUILDING OUTFLOW */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
        <h3 className="text-base font-extrabold text-slate-900 mb-1">
          Record Whole-House Expense
        </h3>
        <form
          onSubmit={handleLogExpense}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end mt-4"
        >
          <div>
            <label className="block text-[11px] font-bold mb-1">CATEGORY</label>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border outline-none"
            >
              <option value="ELECTRICITY_MAIN">Main Electricity (NEA)</option>
              <option value="WATER_SUPPLY">Water Supply / Tanker</option>
              <option value="MAINTENANCE">Plumbing & Repairs</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">TITLE</label>
            <input
              type="text"
              required
              value={expenseTitle}
              onChange={(e) => setExpenseTitle(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">AMOUNT</label>
            <input
              type="number"
              step="0.01"
              required
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">DATE</label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={expenseMutation.isPending}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-bold text-xs"
          >
            Commit Expense
          </button>
        </form>
      </div>

      {/* MODALS */}
      {assignModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Assign Room {assignModalRoom.room_number}</h3>
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
              <select
                required
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                <option value="">Choose User</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
              <input
                type="number"
                required
                value={startingMeter}
                onChange={(e) => setStartingMeter(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalRoom(null)}
                  className="flex-1 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl">
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Record Cash Payment</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                cashOverrideMutation.mutate({
                  bill_id: Number(cashBillId),
                  current_meter_reading: cashMeterReading,
                  damage_fine_amount: cashFine || '0',
                  damage_fine_reason: cashReason,
                  admin_remarks: 'Paid via Cash',
                });
              }}
              className="space-y-4"
            >
              <select
                required
                value={cashBillId}
                onChange={(e) => setCashBillId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                <option value="">Choose Bill</option>
                {unpaidOrPendingBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    Room {b.room_number} — {b.tenant_name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                required
                value={cashMeterReading}
                onChange={(e) => setCashMeterReading(e.target.value)}
                placeholder="New Meter Reading"
                className="w-full px-3 py-2 border rounded-xl"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="flex-1 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl">
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Apply Fine</h3>
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
              <select
                required
                value={fineBillId}
                onChange={(e) => setFineBillId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                <option value="">Choose Bill</option>
                {unpaidOrPendingBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    Room {b.room_number}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                required
                value={fineAmount}
                onChange={(e) => setFineAmount(e.target.value)}
                placeholder="Fine Amount"
                className="w-full px-3 py-2 border rounded-xl"
              />
              <input
                type="text"
                required
                value={fineReason}
                onChange={(e) => setFineReason(e.target.value)}
                placeholder="Reason"
                className="w-full px-3 py-2 border rounded-xl"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowFineModal(false)}
                  className="flex-1 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-rose-600 text-white rounded-xl">
                  Apply Fine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
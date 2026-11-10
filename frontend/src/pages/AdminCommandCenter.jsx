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
  Users,
  ShieldCheck,
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
  fetchAdminUsersManagement,
  adminEvictOrManageUser,
  manageAdminRole,
} from '../api/axiosClient';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AdminCommandCenter() {
  const queryClient = useQueryClient();

  const [activeAdminTab, setActiveAdminTab] = useState('OVERVIEW'); // OVERVIEW | USERS | ADMINS
  const [selectedUserModal, setSelectedUserModal] = useState(null);

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

  // Add Admin Modal States
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Notice Board Form States
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

  const { data: adminUsers = [] } = useQuery({
    queryKey: ['adminUsersManagement'],
    queryFn: fetchAdminUsersManagement,
  });

  const { data: rawReservations = [] } = useQuery({
    queryKey: ['adminReservations'],
    queryFn: fetchReservations,
  });

  const { data: rawNotices = [] } = useQuery({
    queryKey: ['adminNotices'],
    queryFn: fetchNotices,
  });

  const bills = Array.isArray(rawBills) ? rawBills : [];
  const reservations = Array.isArray(rawReservations) ? rawReservations : [];
  const notices = Array.isArray(rawNotices) ? rawNotices : [];

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
    queryClient.invalidateQueries({ queryKey: ['adminUsersManagement'] });
    queryClient.invalidateQueries({ queryKey: ['adminReservations'] });
    queryClient.invalidateQueries({ queryKey: ['adminNotices'] });
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

  const evictMutation = useMutation({
    mutationFn: ({ userId, actionType }) =>
      adminEvictOrManageUser(userId, { action_type: actionType }),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setSelectedUserModal(null);
    },
  });

  const manageAdminMutation = useMutation({
    mutationFn: (payload) => manageAdminRole(payload),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      setShowAddAdminModal(false);
      setNewAdminEmail('');
      setNewAdminName('');
      setNewAdminPhone('');
      setNewAdminPassword('');
      refreshAllAdminData();
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to update admin permissions.',
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

      {/* ADMIN TAB SWITCHER */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        {[
          { key: 'OVERVIEW', label: '📊 Executive Command Overview' },
          { key: 'USERS', label: `👥 Tenants Directory (${adminUsers.length})` },
          { key: 'ADMINS', label: `🛡️ Admin Team Management` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveAdminTab(t.key)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-2xl text-xs font-extrabold transition ${
              activeAdminTab === t.key
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeAdminTab === 'USERS' && (
        <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Registered Users & Tenants Directory
              </h3>
              <p className="text-xs text-slate-500">
                Manage all registered accounts, inspect KYC citizenship documents, and process room terminations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {adminUsers.map((u) => (
              <div
                key={u.id}
                className="p-5 rounded-3xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-center gap-4">
                  {u.profile_picture_url ? (
                    <img
                      src={u.profile_picture_url}
                      alt={u.full_name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-extrabold text-lg flex items-center justify-center">
                      {u.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 truncate">
                      {u.full_name}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {u.role}
                      </span>
                      {u.room_number && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Room {u.room_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserModal(u)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    View Profile & KYC
                  </button>
                  {u.room_number && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to ask ${u.full_name} to leave / vacate Room ${u.room_number}?`
                          )
                        ) {
                          evictMutation.mutate({ userId: u.id, actionType: 'VACATE' });
                        }
                      }}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition"
                      title="Ask to Leave / Vacate Room"
                    >
                      Ask to Leave
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeAdminTab === 'ADMINS' && (
        <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Landlord & Administrator Team
              </h3>
              <p className="text-xs text-slate-500">
                Manage who has executive command access to the SmartRent property portal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddAdminModal(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition"
            >
              + Add New Administrator
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {adminUsers
              .filter((u) => u.role === 'ADMIN')
              .map((adm) => (
                <div
                  key={adm.id}
                  className="p-5 rounded-3xl border border-indigo-100 bg-indigo-50/30 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {adm.profile_picture_url ? (
                      <img
                        src={adm.profile_picture_url}
                        alt={adm.full_name}
                        className="w-12 h-12 rounded-2xl object-cover border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold text-base flex items-center justify-center shrink-0">
                        {adm.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">
                        {adm.full_name}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">{adm.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-extrabold uppercase">
                        Landlord Admin
                      </span>
                    </div>
                  </div>

                  {adminUsers.filter((u) => u.role === 'ADMIN').length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to revoke admin privileges from ${adm.full_name}?`
                          )
                        ) {
                          manageAdminMutation.mutate({ action: 'REMOVE', user_id: adm.id });
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition shrink-0"
                      title="Remove Admin Access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {activeAdminTab === 'OVERVIEW' && (
        <>
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
        </>
      )}

      {/* USER PROFILE & KYC INSPECTION MODAL */}
      {selectedUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold text-xl flex items-center justify-center">
                  {selectedUserModal.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{selectedUserModal.full_name}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedUserModal.email} • {selectedUserModal.phone_number || 'No Phone'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserModal(null)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-400 block">Role</span>
                <strong>{selectedUserModal.role}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Assigned Room</span>
                <strong>
                  {selectedUserModal.room_number ? `Room ${selectedUserModal.room_number}` : 'None'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">KYC Status</span>
                <strong className="text-emerald-600">{selectedUserModal.kyc_status}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Citizenship No.</span>
                <strong>{selectedUserModal.citizenship_number || 'Not provided'}</strong>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
                Citizenship ID Documents (KYC)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500">Front Side</span>
                  {selectedUserModal.citizenship_front_url ? (
                    <a
                      href={selectedUserModal.citizenship_front_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl overflow-hidden border border-slate-200"
                    >
                      <img
                        src={selectedUserModal.citizenship_front_url}
                        alt="Citizenship Front"
                        className="w-full h-40 object-cover hover:scale-105 transition-transform"
                      />
                    </a>
                  ) : (
                    <div className="h-40 rounded-2xl bg-slate-100 flex items-center justify-center text-xs text-slate-400 border border-slate-200">
                      Not Uploaded
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500">Back Side</span>
                  {selectedUserModal.citizenship_back_url ? (
                    <a
                      href={selectedUserModal.citizenship_back_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl overflow-hidden border border-slate-200"
                    >
                      <img
                        src={selectedUserModal.citizenship_back_url}
                        alt="Citizenship Back"
                        className="w-full h-40 object-cover hover:scale-105 transition-transform"
                      />
                    </a>
                  ) : (
                    <div className="h-40 rounded-2xl bg-slate-100 flex items-center justify-center text-xs text-slate-400 border border-slate-200">
                      Not Uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              {selectedUserModal.room_number && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Are you sure you want to ask ${selectedUserModal.full_name} to leave Room ${selectedUserModal.room_number}?`
                      )
                    ) {
                      evictMutation.mutate({
                        userId: selectedUserModal.id,
                        actionType: 'VACATE',
                      });
                    }
                  }}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition"
                >
                  Ask Tenant to Leave / Vacate Room
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedUserModal(null)}
                className="py-3 px-5 border rounded-xl text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ADMIN MODAL */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Create New Administrator</h3>
              <button
                type="button"
                onClick={() => setShowAddAdminModal(false)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                manageAdminMutation.mutate({
                  action: 'CREATE',
                  email: newAdminEmail,
                  full_name: newAdminName,
                  phone_number: newAdminPhone,
                  password: newAdminPassword,
                });
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. Subash Chaudhary"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@smartrent.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={newAdminPhone}
                  onChange={(e) => setNewAdminPhone(e.target.value)}
                  placeholder="9848800000"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  Secure Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manageAdminMutation.isPending}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md"
                >
                  {manageAdminMutation.isPending ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
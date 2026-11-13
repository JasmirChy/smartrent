import React, { useState, useEffect } from 'react';
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
  Radio,
  RotateCcw,
  ShieldCheck,
  QrCode,
  Download,
  Upload,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Home,
  FileText,
  CheckCircle2,
  Clock,
  CreditCard,
  Camera,
  Loader2,
  ImagePlus,
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
  fetchPendingMoveOuts,
  processMoveOutRequest,
  triggerBulkGenerateBills,
  fetchNotices,
  createNotice,
  deleteNotice,
  fetchAdminUsersManagement,
  adminEvictOrManageUser,
  manageAdminRole,
  resetSmartRentDatabase,
  fetchPaymentQRConfig,
  updatePaymentQRConfig,
  deletePaymentQRConfig,
  downloadFileFromUrl,
  auditKYC,
} from '../api/axiosClient';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const FINE_REASON_PRESETS = [
  'Unclean surroundings / corridor dirt violation',
  'Broken room fixture / property damage',
  'Late night noise / discipline rule violation',
  'Improper waste disposal / sanitation fine',
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

export default function AdminCommandCenter() {
  const queryClient = useQueryClient();

  const [activeAdminTab, setActiveAdminTab] = useState('OVERVIEW'); // OVERVIEW | USERS | ADMINS
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Fullscreen Photo Lightbox States
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    items: [], // [{ url, title, subtitle }]
    currentIndex: 0,
    zoom: 1,
  });

  const [bannerMsg, setBannerMsg] = useState({ type: '', text: '' });
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [startingMeterOverride, setStartingMeterOverride] = useState('');

  // Move-Out & Final Settlement States
  const [selectedMoveOut, setSelectedMoveOut] = useState(null);
  const [finalMeterOverride, setFinalMeterOverride] = useState('');
  const [moveOutRemarks, setMoveOutRemarks] = useState('');

  // Overrides & Modals
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashTenantId, setCashTenantId] = useState('');
  const [cashBillId, setCashBillId] = useState('');
  const [cashMeterReading, setCashMeterReading] = useState('');
  const [cashFine, setCashFine] = useState('0');
  const [cashReason, setCashReason] = useState('');

  const [assignModalRoom, setAssignModalRoom] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [startingMeter, setStartingMeter] = useState('0');

  // Upgraded Fine Management & Evidence Upload States
  const [showFineModal, setShowFineModal] = useState(false);
  const [fineTenantId, setFineTenantId] = useState('');
  const [fineBillId, setFineBillId] = useState('');
  const [fineMode, setFineMode] = useState('SET'); // SET replaces fine so 600 stays 600; ADD adds to existing
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');
  const [fineEvidenceFiles, setFineEvidenceFiles] = useState([]);
  const [fineEvidencePreviews, setFineEvidencePreviews] = useState([]);
  const [fineModalError, setFineModalError] = useState('');

  // Payment QR Setup Modal States
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrMerchantName, setQrMerchantName] = useState('');
  const [qrPaymentNote, setQrPaymentNote] = useState('');
  const [qrImageFile, setQrImageFile] = useState(null);
  const [qrImagePreview, setQrImagePreview] = useState(null);

  // Add Admin Modal States
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);

  // 2-Step Database Factory Reset Modal States
  const [resetStep, setResetStep] = useState(0);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetModalError, setResetModalError] = useState('');

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

  // 4-Second Live Auto-Sync Queries
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: async () => (await axiosClient.get('/billing/analytics/')).data,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const { data: rawBills = [] } = useQuery({
    queryKey: ['allBills'],
    queryFn: async () => {
      const res = await axiosClient.get('/billing/');
      return Array.isArray(res.data) ? res.data : res.data?.results || [];
    },
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const { data: paymentQR } = useQuery({
    queryKey: ['paymentQRConfig'],
    queryFn: fetchPaymentQRConfig,
    refetchInterval: 4000,
  });

  const { data: roomsData } = useQuery({
    queryKey: ['roomsMatrix'],
    queryFn: async () => (await axiosClient.get('/rooms/')).data,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const { data: adminUsers = [] } = useQuery({
    queryKey: ['adminUsersManagement'],
    queryFn: fetchAdminUsersManagement,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const { data: rawReservations = [] } = useQuery({
    queryKey: ['adminReservations'],
    queryFn: fetchReservations,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const { data: rawMoveOuts = [] } = useQuery({
    queryKey: ['adminPendingMoveOuts'],
    queryFn: fetchPendingMoveOuts,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const { data: rawNotices = [] } = useQuery({
    queryKey: ['adminNotices'],
    queryFn: fetchNotices,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (paymentQR) {
      setQrMerchantName(paymentQR.merchant_name || 'SmartRent Official eSewa / Fonepay');
      setQrPaymentNote(
        paymentQR.payment_note ||
          'Scan this QR with eSewa, Khalti, or Mobile Banking and upload screenshot.'
      );
    }
  }, [paymentQR]);

  useEffect(() => {
    return () => {
      fineEvidencePreviews.forEach((p) => {
        if (p.url?.startsWith('blob:')) URL.revokeObjectURL(p.url);
      });
    };
  }, [fineEvidencePreviews]);

  const bills = Array.isArray(rawBills) ? rawBills : [];
  const reservations = Array.isArray(rawReservations) ? rawReservations : [];
  const pendingMoveOuts = Array.isArray(rawMoveOuts) ? rawMoveOuts : [];
  const notices = Array.isArray(rawNotices) ? rawNotices : [];

  const tenantUsers = adminUsers.filter((u) => u.role !== 'ADMIN');
  const adminTeamUsers = adminUsers.filter((u) => u.role === 'ADMIN');

  // Keep selected user live-synced with latest query data
  const selectedUserModal = selectedUserId
    ? adminUsers.find((u) => u.id === selectedUserId) || null
    : null;

  const pendingQueue = bills.filter((b) => b.status === 'PENDING_VERIFICATION');
  const pendingReservations = reservations.filter((r) => r.status === 'PENDING');
  const unpaidOrPendingBills = bills.filter(
    (b) => b.status !== 'APPROVED' && b.status !== 'PAID_CASH'
  );
  const selectableBillsForDropdown =
    unpaidOrPendingBills.length > 0 ? unpaidOrPendingBills : bills;

  const filteredBillsForFine = fineTenantId
    ? bills.filter(
        (b) =>
          String(b.tenant) === String(fineTenantId) ||
          String(b.tenant_id) === String(fineTenantId)
      )
    : selectableBillsForDropdown;

  const selectedFineTenantObj = fineTenantId
    ? adminUsers.find((u) => String(u.id) === String(fineTenantId))
    : null;

  const selectedFineBillObj = fineBillId
    ? bills.find((b) => String(b.id) === String(fineBillId))
    : null;

  const roomsList = Array.isArray(roomsData)
    ? roomsData
    : Array.isArray(roomsData?.rooms)
    ? roomsData.rooms
    : Array.isArray(roomsData?.results)
    ? roomsData.results
    : [];

  const openFineModalForUser = (userObj = null, billObj = null) => {
    setFineModalError('');
    setFineAmount('');
    setFineReason('');
    setFineMode('SET');
    setFineEvidenceFiles([]);
    setFineEvidencePreviews([]);

    if (billObj) {
      setFineBillId(String(billObj.id));
      setFineTenantId(String(billObj.tenant || billObj.tenant_id || ''));
    } else if (userObj) {
      setFineTenantId(String(userObj.id));
      const userOpenBill = bills.find(
        (b) =>
          (String(b.tenant) === String(userObj.id) ||
            String(b.tenant_id) === String(userObj.id)) &&
          b.status !== 'APPROVED' &&
          b.status !== 'PAID_CASH'
      );
      const userAnyBill = bills.find(
        (b) =>
          String(b.tenant) === String(userObj.id) ||
          String(b.tenant_id) === String(userObj.id)
      );
      setFineBillId(
        userOpenBill ? String(userOpenBill.id) : userAnyBill ? String(userAnyBill.id) : ''
      );
    } else {
      setFineTenantId('');
      setFineBillId('');
    }
    setShowFineModal(true);
  };

  const handleSelectFineTenant = (tenantIdVal) => {
    setFineTenantId(tenantIdVal);
    setFineModalError('');
    if (!tenantIdVal) {
      setFineBillId('');
      return;
    }
    const matchingOpenBill = bills.find(
      (b) =>
        (String(b.tenant) === String(tenantIdVal) ||
          String(b.tenant_id) === String(tenantIdVal)) &&
        b.status !== 'APPROVED' &&
        b.status !== 'PAID_CASH'
    );
    const matchingAnyBill = bills.find(
      (b) =>
        String(b.tenant) === String(tenantIdVal) ||
        String(b.tenant_id) === String(tenantIdVal)
    );
    if (matchingOpenBill) {
      setFineBillId(String(matchingOpenBill.id));
    } else if (matchingAnyBill) {
      setFineBillId(String(matchingAnyBill.id));
    } else {
      setFineBillId('');
    }
  };

  const handleSelectFineBill = (billIdVal) => {
    setFineBillId(billIdVal);
    setFineModalError('');
    if (billIdVal) {
      const foundBill = bills.find((b) => String(b.id) === String(billIdVal));
      if (foundBill && (foundBill.tenant || foundBill.tenant_id)) {
        setFineTenantId(String(foundBill.tenant || foundBill.tenant_id));
      }
    }
  };

  const handleFineEvidenceSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setFineModalError('');

    const validFiles = [];
    const previews = [];

    for (const file of files) {
      if (file.size > MAX_EVIDENCE_FILE_SIZE) {
        setFineModalError(
          `"${file.name}" exceeds the 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`
        );
        continue;
      }
      validFiles.push(file);
      previews.push({
        name: file.name,
        url: URL.createObjectURL(file),
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      });
    }

    if (validFiles.length > 0) {
      setFineEvidenceFiles((prev) => [...prev, ...validFiles]);
      setFineEvidencePreviews((prev) => [...prev, ...previews]);
    }
    e.target.value = '';
  };

  const removeFineEvidenceFile = (idxToRemove) => {
    setFineEvidenceFiles((prev) => prev.filter((_, idx) => idx !== idxToRemove));
    setFineEvidencePreviews((prev) => {
      const target = prev[idxToRemove];
      if (target?.url?.startsWith('blob:')) URL.revokeObjectURL(target.url);
      return prev.filter((_, idx) => idx !== idxToRemove);
    });
  };

  const openPhotoLightbox = (itemsList, startIndex = 0) => {
    const validItems = itemsList.filter((item) => Boolean(item?.url));
    if (validItems.length === 0) return;
    setLightboxState({
      isOpen: true,
      items: validItems,
      currentIndex: Math.min(startIndex, validItems.length - 1),
      zoom: 1,
    });
  };

  const closePhotoLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false, zoom: 1 }));
  };

  const buildUserGalleryItems = (u) => {
    if (!u) return [];
    const items = [];
    const avatarUrl = getSafeMediaUrl(u.profile_picture_path || u.profile_picture_url);
    const coverUrl = getSafeMediaUrl(u.cover_picture_path || u.cover_picture_url);
    const citFrontUrl = getSafeMediaUrl(u.citizenship_front_url);
    const citBackUrl = getSafeMediaUrl(u.citizenship_back_url);

    if (avatarUrl) {
      items.push({
        key: 'AVATAR',
        url: avatarUrl,
        title: `${u.full_name} — Profile Avatar`,
        subtitle: u.email,
      });
    }
    if (coverUrl) {
      items.push({
        key: 'COVER',
        url: coverUrl,
        title: `${u.full_name} — Cover Banner`,
        subtitle: u.email,
      });
    }
    if (citFrontUrl) {
      items.push({
        key: 'CIT_FRONT',
        url: citFrontUrl,
        title: `${u.full_name} — Citizenship ID (Front Side)`,
        subtitle: `Citizenship No: ${u.citizenship_number || 'N/A'}`,
      });
    }
    if (citBackUrl) {
      items.push({
        key: 'CIT_BACK',
        url: citBackUrl,
        title: `${u.full_name} — Citizenship ID (Back Side)`,
        subtitle: `Citizenship No: ${u.citizenship_number || 'N/A'}`,
      });
    }
    if (Array.isArray(u.recent_bills)) {
      u.recent_bills.forEach((b) => {
        const mUrl = getSafeMediaUrl(b.meter_photo_url);
        const pUrl = getSafeMediaUrl(b.payment_screenshot_url);
        if (mUrl) {
          items.push({
            key: `BILL_METER_${b.id}`,
            url: mUrl,
            title: `Meter Photo Proof — ${b.billing_month_label}`,
            subtitle: `Room ${b.room_number} • ${b.units_consumed} units • Rs. ${b.total_payable}`,
          });
        }
        if (pUrl) {
          items.push({
            key: `BILL_PAY_${b.id}`,
            url: pUrl,
            title: `Payment Receipt — ${b.billing_month_label}`,
            subtitle: `Room ${b.room_number} • Ref: ${b.transaction_reference || 'N/A'} • Rs. ${b.total_payable}`,
          });
        }
      });
    }
    const userFullBills = bills.filter(
      (b) => String(b.tenant) === String(u.id) || String(b.tenant_id) === String(u.id)
    );
    userFullBills.forEach((b) => {
      if (Array.isArray(b.fine_evidence_urls)) {
        b.fine_evidence_urls.forEach((evUrl, evIdx) => {
          const safeEv = getSafeMediaUrl(evUrl);
          if (safeEv) {
            items.push({
              key: `BILL_FINE_${b.id}_${evIdx}`,
              url: safeEv,
              title: `Fine Evidence Photo #${evIdx + 1} — ${b.billing_month_label}`,
              subtitle: `Fine: Rs. ${b.damage_fine_amount} • Reason: ${b.damage_fine_reason || 'Violation'}`,
            });
          }
        });
      }
    });
    return items;
  };

  const refreshAllAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ['allBills'] });
    queryClient.invalidateQueries({ queryKey: ['adminAnalytics'] });
    queryClient.invalidateQueries({ queryKey: ['roomsMatrix'] });
    queryClient.invalidateQueries({ queryKey: ['adminUsersManagement'] });
    queryClient.invalidateQueries({ queryKey: ['adminReservations'] });
    queryClient.invalidateQueries({ queryKey: ['adminPendingMoveOuts'] });
    queryClient.invalidateQueries({ queryKey: ['adminNotices'] });
    queryClient.invalidateQueries({ queryKey: ['paymentQRConfig'] });
    queryClient.invalidateQueries({ queryKey: ['chatContacts'] });
    queryClient.invalidateQueries({ queryKey: ['complaintTickets'] });
  };

  // Mutations
  const kycAuditMutation = useMutation({
    mutationFn: ({ kycId, action, notes }) => auditKYC(kycId, action, notes),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message || 'KYC status updated!' });
      refreshAllAdminData();
    },
    onError: () => {
      setBannerMsg({ type: 'error', text: 'Could not update KYC verification status.' });
    },
  });

  const updateQRMutation = useMutation({
    mutationFn: (formData) => updatePaymentQRConfig(formData),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      setQrImageFile(null);
      setQrImagePreview(null);
      setShowQRModal(false);
      queryClient.invalidateQueries({ queryKey: ['paymentQRConfig'] });
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to upload Payment QR Code.',
      });
    },
  });

  const deleteQRMutation = useMutation({
    mutationFn: deletePaymentQRConfig,
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      setQrImageFile(null);
      setQrImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['paymentQRConfig'] });
    },
  });

  const reservationActionMutation = useMutation({
    mutationFn: async ({ id, payload }) => processReservationAction(id, payload),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setSelectedReservation(null);
      setStartingMeterOverride('');
    },
  });

  const moveOutActionMutation = useMutation({
    mutationFn: async ({ id, payload }) => processMoveOutRequest(id, payload),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setSelectedMoveOut(null);
      setFinalMeterOverride('');
      setMoveOutRemarks('');
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Could not process move-out request.',
      });
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
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to record cash payment.',
      });
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
    mutationFn: async ({ billId, formData }) => {
      const endpoint =
        billId && Number(billId) > 0
          ? `/billing/${billId}/apply-fine/`
          : '/billing/apply-fine/';
      const res = await axiosClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      refreshAllAdminData();
      setShowFineModal(false);
      setFineTenantId('');
      setFineBillId('');
      setFineAmount('');
      setFineReason('');
      setFineEvidenceFiles([]);
      setFineEvidencePreviews([]);
      setFineModalError('');
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Could not apply fine. Please make sure backend views.py and urls.py are updated.';
      setFineModalError(msg);
      setBannerMsg({ type: 'error', text: msg });
    },
  });

  const handleApplyFineSubmit = (e) => {
    e.preventDefault();
    setFineModalError('');

    if (!fineTenantId && !fineBillId) {
      setFineModalError('Please select a Tenant (or a specific Bill) to apply the fine.');
      return;
    }
    if (!fineAmount || Number(fineAmount) <= 0) {
      setFineModalError('Please enter a valid fine amount greater than Rs. 0.');
      return;
    }
    if (!fineReason.trim()) {
      setFineModalError('Please enter the violation or damage reason.');
      return;
    }

    const fd = new FormData();
    if (fineBillId) fd.append('bill_id', fineBillId);
    if (fineTenantId) fd.append('tenant_id', fineTenantId);
    fd.append('fine_mode', fineMode);
    fd.append('damage_fine_amount', fineAmount);
    fd.append('damage_fine_reason', fineReason.trim());

    fineEvidenceFiles.forEach((file) => {
      fd.append('evidence_images', file);
    });

    applyFineMutation.mutate({
      billId: fineBillId ? Number(fineBillId) : 0,
      formData: fd,
    });
  };

  const handleUndoFine = (billId) => {
    if (!billId) return;
    if (window.confirm('Are you sure you want to undo and remove this fine from the tenant?')) {
      const fd = new FormData();
      fd.append('bill_id', String(billId));
      fd.append('fine_mode', 'UNDO');
      applyFineMutation.mutate({
        billId: Number(billId),
        formData: fd,
      });
    }
  };

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
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseNotes('');
      setExpenseReceipt(null);
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
      setSelectedUserId(null);
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
      setShowNewAdminPassword(false);
      refreshAllAdminData();
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to update admin permissions.',
      });
    },
  });

  const resetDatabaseMutation = useMutation({
    mutationFn: (phrase) => resetSmartRentDatabase(phrase),
    onSuccess: (data) => {
      setBannerMsg({ type: 'success', text: data.message });
      setResetStep(0);
      setResetConfirmText('');
      setResetModalError('');
      refreshAllAdminData();
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Backend reset endpoint failed. Please check that Django server reloaded.';
      setResetModalError(msg);
      setBannerMsg({ type: 'error', text: msg });
    },
  });

  const handleSaveQRConfig = (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('merchant_name', qrMerchantName);
    fd.append('payment_note', qrPaymentNote);
    if (qrImageFile) {
      fd.append('qr_image', qrImageFile);
    }
    updateQRMutation.mutate(fd);
  };

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
  const activeReviewMoveOut =
    selectedMoveOut || pendingMoveOuts[0] || null;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* HEADER BANNER */}
      <div className="rounded-3xl bg-indigo-600 text-white p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> LANDLORD COMMAND DECK
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-extrabold border border-emerald-400/30">
              <Radio className="w-3 h-3 text-emerald-300 animate-pulse" /> LIVE 4S AUTO-SYNC
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Executive Command Center
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowQRModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-extrabold shadow-sm transition"
          >
            <QrCode className="w-3.5 h-3.5" /> Payment QR Setup
          </button>
          <button
            type="button"
            onClick={() => {
              triggerBulkGenerateBills()
                .then((res) => {
                  setBannerMsg({ type: 'success', text: res.message });
                  refreshAllAdminData();
                })
                .catch(() => {
                  setBannerMsg({ type: 'error', text: 'Bulk generate endpoint error.' });
                });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition"
          >
            <Zap className="w-3.5 h-3.5" /> Auto-Generate Bills
          </button>
          <button
            type="button"
            onClick={() => reminderMutation.mutate()}
            disabled={reminderMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold border border-indigo-400 transition"
          >
            <BellRing className="w-3.5 h-3.5" /> Send Alerts
          </button>
          <button
            type="button"
            onClick={() => openFineModalForUser(null, null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> + Apply Fine
          </button>
          <button
            type="button"
            onClick={() => setShowCashModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 text-xs font-bold shadow-md transition"
          >
            + Cash Override
          </button>
          <button
            type="button"
            onClick={() => {
              setResetConfirmText('');
              setResetModalError('');
              setResetStep(1);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-950/90 hover:bg-rose-900 text-rose-100 border border-rose-400/40 text-xs font-extrabold shadow-sm transition"
            title="Factory Reset Database (Keeps Admin)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Database
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
          { key: 'USERS', label: `👥 Tenants Directory (${tenantUsers.length})` },
          { key: 'ADMINS', label: `🛡️ Admin Team Management (${adminTeamUsers.length})` },
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

      {/* TAB 2: TENANTS DIRECTORY WITH RICH PREVIEW CARDS */}
      {activeAdminTab === 'USERS' && (
        <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Registered Users & Tenants Directory
              </h3>
              <p className="text-xs text-slate-500">
                Inspect full tenant profiles, fullscreen photos, KYC citizenship IDs, assigned rooms, and pending bills.
              </p>
            </div>
            {tenantUsers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setResetConfirmText('');
                  setResetModalError('');
                  setResetStep(1);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Wipe All Tenants & Reset DB
              </button>
            )}
          </div>

          {tenantUsers.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-sm font-extrabold text-slate-700">
                No tenants registered in the database
              </p>
              <p className="text-xs text-slate-400">
                The database is clean and ready for new tenant signups.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenantUsers.map((u) => {
                const avatarUrl = getSafeMediaUrl(u.profile_picture_path || u.profile_picture_url);
                const coverUrl = getSafeMediaUrl(u.cover_picture_path || u.cover_picture_url);
                const galleryItems = buildUserGalleryItems(u);

                return (
                  <div
                    key={u.id}
                    className="rounded-3xl border border-slate-200/90 bg-white hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Mini Cover Banner on Card */}
                      <div
                        onClick={() => setSelectedUserId(u.id)}
                        className="h-24 bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-500 relative cursor-pointer overflow-hidden"
                      >
                        {coverUrl && (
                          <img
                            src={coverUrl}
                            alt="Cover"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent" />

                        {/* Top Right Room / Status Pill */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          {u.room_number ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold shadow-sm">
                              Room {u.room_number}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-900/60 backdrop-blur-xs text-white text-[10px] font-bold">
                              No Room
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Avatar + Identity */}
                      <div className="px-5 pb-4">
                        <div className="flex items-end justify-between -mt-9 mb-3 relative z-10">
                          <div
                            onClick={() => {
                              if (avatarUrl) {
                                openPhotoLightbox(galleryItems, 0);
                              } else {
                                setSelectedUserId(u.id);
                              }
                            }}
                            className="w-16 h-16 rounded-2xl bg-white p-1 shadow-md border border-slate-200 cursor-pointer relative group/avatar"
                            title={avatarUrl ? 'Click to view photo fullscreen' : 'View Profile'}
                          >
                            {avatarUrl ? (
                              <>
                                <img
                                  src={avatarUrl}
                                  alt={u.full_name}
                                  className="w-full h-full rounded-xl object-cover"
                                />
                                <div className="absolute inset-0 rounded-xl bg-black/35 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition">
                                  <ZoomIn className="w-4 h-4 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full rounded-xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center">
                                {u.full_name?.charAt(0)?.toUpperCase() || 'T'}
                              </div>
                            )}
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                              u.kyc_status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.kyc_status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            KYC: {u.kyc_status}
                          </span>
                        </div>

                        <h4 className="text-base font-extrabold text-slate-900 truncate">
                          {u.full_name}
                        </h4>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        {u.phone_number && (
                          <p className="text-xs text-slate-500 font-semibold mt-0.5">
                            📞 {u.phone_number}
                          </p>
                        )}

                        {/* Quick Financial & Room Summary Strip */}
                        <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                              Pending Dues
                            </span>
                            {u.pending_bills_count > 0 ? (
                              <span className="font-black text-rose-600">
                                Rs. {Number(u.total_pending_amount || 0).toLocaleString()} (
                                {u.pending_bills_count})
                              </span>
                            ) : (
                              <span className="font-extrabold text-emerald-600">All Clear ✓</span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                              Uploaded Photos
                            </span>
                            <span className="font-extrabold text-indigo-600">
                              {galleryItems.length} Photo(s)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(u.id)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> Dossier
                      </button>
                      <button
                        type="button"
                        onClick={() => openFineModalForUser(u, null)}
                        className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition inline-flex items-center gap-1"
                        title="Apply Fine to Tenant"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Fine
                      </button>
                      {galleryItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openPhotoLightbox(galleryItems, 0)}
                          className="py-2.5 px-3 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-extrabold transition inline-flex items-center gap-1"
                          title="Open Photo Viewer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                          className="py-2.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold transition"
                          title="Vacate Room"
                        >
                          Vacate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ADMIN TEAM */}
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
              onClick={() => {
                setShowNewAdminPassword(false);
                setShowAddAdminModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition"
            >
              + Add New Administrator
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {adminTeamUsers.map((adm) => {
              const admAvatar = getSafeMediaUrl(
                adm.profile_picture_path || adm.profile_picture_url
              );
              const admGallery = buildUserGalleryItems(adm);
              return (
                <div
                  key={adm.id}
                  className="p-5 rounded-3xl border border-indigo-100 bg-indigo-50/30 flex items-center justify-between gap-4"
                >
                  <div
                    onClick={() => setSelectedUserId(adm.id)}
                    className="flex items-center gap-3.5 min-w-0 cursor-pointer"
                  >
                    {admAvatar ? (
                      <img
                        src={admAvatar}
                        alt={adm.full_name}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPhotoLightbox(admGallery, 0);
                        }}
                        className="w-12 h-12 rounded-2xl object-cover border border-indigo-200"
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

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(adm.id)}
                      className="p-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 transition"
                      title="View Admin Profile"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {adminTeamUsers.length > 1 && (
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
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                        title="Remove Admin Access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
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
                  BOOKINGS & MOVE-OUTS
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl font-extrabold text-slate-900">
                  {pendingReservations.length} Bookings
                </p>
                {pendingMoveOuts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-extrabold">
                    {pendingMoveOuts.length} Move-Out
                  </span>
                )}
              </div>
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

          {/* NOTICE BOARD PUBLISHER */}
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
                          type="button"
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
                            type="button"
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
                            type="button"
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

          {/* TENANT MOVE-OUT & FINAL SETTLEMENT QUEUE */}
          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-rose-600" />
                Tenant Move-Out & Final Settlement Queue
                {pendingMoveOuts.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-extrabold">
                    {pendingMoveOuts.length} Pending
                  </span>
                )}
              </h3>
              <span className="text-xs text-slate-500">
                Verify final sub-meter reading to generate settlement bill & vacate room
              </span>
            </div>

            {pendingMoveOuts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No pending move-out requests from tenants right now.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {pendingMoveOuts.map((mo) => (
                    <div
                      key={mo.id}
                      onClick={() => {
                        setSelectedMoveOut(mo);
                        setFinalMeterOverride(
                          String(mo.current_meter_reading ?? '')
                        );
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition ${
                        activeReviewMoveOut?.id === mo.id
                          ? 'border-rose-600 bg-rose-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-xs">
                          Room {mo.room_number} • {mo.tenant_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800">
                          {mo.status_display || 'Pending Move-Out'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-semibold">
                        Planned Departure: {mo.requested_date}
                      </p>
                      {mo.reason && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          Reason: {mo.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {activeReviewMoveOut && (
                  <div className="lg:col-span-7 rounded-2xl bg-rose-50/40 border border-rose-200/80 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/60 pb-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Room {activeReviewMoveOut.room_number} — {activeReviewMoveOut.tenant_name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Email: {activeReviewMoveOut.tenant_email}
                          {activeReviewMoveOut.tenant_phone
                            ? ` • 📞 ${activeReviewMoveOut.tenant_phone}`
                            : ''}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-white text-rose-700 font-extrabold text-xs border border-rose-200">
                        Departure: {activeReviewMoveOut.requested_date}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Previous Sub-Meter Reading
                        </span>
                        <strong className="text-sm text-indigo-600">
                          {activeReviewMoveOut.current_meter_reading ?? 0} units
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Tenant Reason
                        </span>
                        <strong className="text-slate-800">
                          {activeReviewMoveOut.reason || 'Not specified'}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-extrabold uppercase text-slate-700 mb-1">
                          Final Sub-Meter Reading (Units) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min={activeReviewMoveOut.current_meter_reading || 0}
                          value={
                            finalMeterOverride !== ''
                              ? finalMeterOverride
                              : String(activeReviewMoveOut.current_meter_reading ?? 0)
                          }
                          onChange={(e) => setFinalMeterOverride(e.target.value)}
                          placeholder="Enter final sub-meter reading"
                          className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-white border border-slate-200 outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold uppercase text-slate-700 mb-1">
                          Admin Settlement Remarks (Optional)
                        </label>
                        <input
                          type="text"
                          value={moveOutRemarks}
                          onChange={(e) => setMoveOutRemarks(e.target.value)}
                          placeholder="e.g. Keys returned & deposit settled"
                          className="w-full px-3 py-2.5 text-xs rounded-xl bg-white border border-slate-200 outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        disabled={moveOutActionMutation.isPending}
                        onClick={() =>
                          moveOutActionMutation.mutate({
                            id: activeReviewMoveOut.id,
                            payload: {
                              action: 'REJECT',
                              admin_remarks:
                                moveOutRemarks || 'Please clear pending dues before move-out.',
                            },
                          })
                        }
                        className="flex-1 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200 transition"
                      >
                        Reject Request
                      </button>
                      <button
                        type="button"
                        disabled={moveOutActionMutation.isPending}
                        onClick={() =>
                          moveOutActionMutation.mutate({
                            id: activeReviewMoveOut.id,
                            payload: {
                              action: 'APPROVE',
                              final_meter_reading:
                                finalMeterOverride !== ''
                                  ? finalMeterOverride
                                  : activeReviewMoveOut.current_meter_reading,
                              admin_remarks:
                                moveOutRemarks || 'Final move-out settlement invoice.',
                            },
                          })
                        }
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-sm transition"
                      >
                        {moveOutActionMutation.isPending
                          ? 'Processing...'
                          : 'Approve, Generate Final Bill & Vacate'}
                      </button>
                    </div>
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
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
                      {occupied && tenant?.tenant_id && (
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(tenant.tenant_id)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                        >
                          Inspect Tenant
                        </button>
                      )}
                      {occupied ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Mark Room ${room.room_number} as vacant?`)) {
                              axiosClient.post(`/rooms/${room.id}/vacate/`).then(() => {
                                refreshAllAdminData();
                              });
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold ml-auto"
                        >
                          Vacate Room
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignModalRoom(room);
                            setStartingMeter(String(room.current_meter_reading || 0));
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold ml-auto"
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
              <div className="py-12 text-center text-slate-400 text-xs">
                No bills generated yet.
              </div>
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
                        {Number(b.damage_fine_amount || 0) > 0 && (
                          <span className="text-rose-600 font-bold">
                            Fine: Rs. {Number(b.damage_fine_amount).toLocaleString()}
                          </span>
                        )}
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
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-indigo-600 block">
                          Total: Rs. {Number(activeAuditBill.total_payable).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => openFineModalForUser(null, activeAuditBill)}
                          className="text-[11px] font-extrabold text-rose-600 hover:underline"
                        >
                          + Add / Edit Fine
                        </button>
                      </div>
                    </div>

                    {Number(activeAuditBill.damage_fine_amount || 0) > 0 && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-extrabold text-rose-800 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            Applied Fine: Rs.{' '}
                            {Number(activeAuditBill.damage_fine_amount).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-2">
                            {activeAuditBill.fine_applied_at && (
                              <span className="text-[10px] text-rose-600 font-semibold">
                                {activeAuditBill.fine_applied_at}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleUndoFine(activeAuditBill.id)}
                              disabled={applyFineMutation.isPending}
                              className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition text-[10px] font-extrabold shadow-xs"
                            >
                              Undo Fine
                            </button>
                          </div>
                        </div>
                        <p className="text-rose-700 font-medium">
                          Reason: {activeAuditBill.damage_fine_reason || 'Rule / damage violation'}
                        </p>
                        {Array.isArray(activeAuditBill.fine_evidence_urls) &&
                          activeAuditBill.fine_evidence_urls.length > 0 && (
                            <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                              {activeAuditBill.fine_evidence_urls.map((evUrl, idx) => {
                                const safeEv = getSafeMediaUrl(evUrl);
                                return (
                                  <img
                                    key={idx}
                                    src={safeEv}
                                    alt="Fine Evidence"
                                    onClick={() =>
                                      openPhotoLightbox(
                                        activeAuditBill.fine_evidence_urls.map((u, i) => ({
                                          url: getSafeMediaUrl(u),
                                          title: `Fine Evidence #${i + 1} — Room ${activeAuditBill.room_number}`,
                                          subtitle: activeAuditBill.damage_fine_reason,
                                        })),
                                        idx
                                      )
                                    }
                                    className="w-14 h-14 rounded-xl object-cover border border-rose-300 cursor-pointer hover:scale-105 transition"
                                  />
                                );
                              })}
                            </div>
                          )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Zone 1: Sub-Meter
                        </p>
                        <div className="w-full h-44 rounded-xl bg-slate-900 overflow-hidden border relative group">
                          {activeAuditBill.meter_photo_url ? (
                            <img
                              src={getSafeMediaUrl(activeAuditBill.meter_photo_url)}
                              alt="Meter"
                              onClick={() =>
                                openPhotoLightbox([
                                  {
                                    url: getSafeMediaUrl(activeAuditBill.meter_photo_url),
                                    title: `Room ${activeAuditBill.room_number} — Meter Photo`,
                                    subtitle: activeAuditBill.billing_month_label,
                                  },
                                ])
                              }
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                              No Meter Photo
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Zone 2: Payment Receipt
                        </p>
                        <div className="w-full h-44 rounded-xl bg-slate-900 overflow-hidden border relative group">
                          {activeAuditBill.payment_screenshot_url ? (
                            <img
                              src={getSafeMediaUrl(activeAuditBill.payment_screenshot_url)}
                              alt="Payment"
                              onClick={() =>
                                openPhotoLightbox([
                                  {
                                    url: getSafeMediaUrl(activeAuditBill.payment_screenshot_url),
                                    title: `Room ${activeAuditBill.room_number} — Payment Screenshot`,
                                    subtitle: activeAuditBill.billing_month_label,
                                  },
                                ])
                              }
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                              No Payment Slip
                            </div>
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
                        type="button"
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
                        type="button"
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
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EXECUTIVE USER DOSSIER & PHOTO INSPECTION MODAL                  */}
      {/* ========================================================================= */}
      {selectedUserModal && (() => {
        const u = selectedUserModal;
        const avatarUrl = getSafeMediaUrl(u.profile_picture_path || u.profile_picture_url);
        const coverUrl = getSafeMediaUrl(u.cover_picture_path || u.cover_picture_url);
        const citFrontUrl = getSafeMediaUrl(u.citizenship_front_url);
        const citBackUrl = getSafeMediaUrl(u.citizenship_back_url);
        const galleryItems = buildUserGalleryItems(u);
        const userBills = Array.isArray(u.recent_bills) ? u.recent_bills : [];

        return (
          <div
            onClick={() => setSelectedUserId(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
            >
              {/* Scrollable Modal Body */}
              <div className="overflow-y-auto flex-1">
                {/* 1. Hero Cover Banner */}
                <div className="h-36 sm:h-48 bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-500 relative overflow-hidden group">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Cover Banner"
                      onClick={() => {
                        const idx = galleryItems.findIndex((item) => item.key === 'COVER');
                        openPhotoLightbox(galleryItems, idx >= 0 ? idx : 0);
                      }}
                      className="w-full h-full object-cover cursor-pointer group-hover:scale-[1.02] transition duration-500"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                        backgroundSize: '18px 18px',
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-900/20 to-transparent pointer-events-none" />

                  {/* Top Action Bar on Cover */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-slate-900/60 backdrop-blur-md text-white text-[11px] font-extrabold border border-white/20">
                      Tenant Inspection Dossier #{u.id}
                    </span>
                    <div className="flex items-center gap-2">
                      {galleryItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openPhotoLightbox(galleryItems, 0)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-900 text-xs font-extrabold shadow-md transition"
                        >
                          <ZoomIn className="w-3.5 h-3.5 text-indigo-600" />
                          Photo Mode ({galleryItems.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(null)}
                        className="p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Profile Avatar & Identity Strip */}
                <div className="px-6 sm:px-8 pb-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 relative z-10 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                      <div
                        onClick={() => {
                          if (avatarUrl) {
                            const idx = galleryItems.findIndex((item) => item.key === 'AVATAR');
                            openPhotoLightbox(galleryItems, idx >= 0 ? idx : 0);
                          }
                        }}
                        className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white p-1.5 shadow-xl border border-slate-200 shrink-0 relative group/av ${
                          avatarUrl ? 'cursor-pointer' : ''
                        }`}
                      >
                        {avatarUrl ? (
                          <>
                            <img
                              src={avatarUrl}
                              alt={u.full_name}
                              className="w-full h-full rounded-2xl object-cover"
                            />
                            <div className="absolute inset-1.5 rounded-2xl bg-black/40 opacity-0 group-hover/av:opacity-100 flex items-center justify-center transition">
                              <ZoomIn className="w-6 h-6 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-3xl flex items-center justify-center">
                            {u.full_name?.charAt(0)?.toUpperCase() || 'T'}
                          </div>
                        )}
                      </div>

                      <div className="pt-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                            {u.full_name}
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase">
                            {u.role}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                              u.kyc_status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.kyc_status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            KYC: {u.kyc_status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-indigo-600" /> {u.email}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />{' '}
                            {u.phone_number || 'No Phone'}
                          </span>
                          {u.joined_at && <span>Joined: {u.joined_at}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Quick KYC Verify / Reject + Fine Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openFineModalForUser(u, null)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> + Apply Fine
                      </button>
                      {u.kyc_id && u.kyc_status !== 'VERIFIED' && (
                        <button
                          type="button"
                          onClick={() =>
                            kycAuditMutation.mutate({
                              kycId: u.kyc_id,
                              action: 'VERIFY',
                              notes: 'Verified by Admin',
                            })
                          }
                          disabled={kycAuditMutation.isPending}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition"
                        >
                          ✓ Verify KYC
                        </button>
                      )}
                      {u.kyc_id && u.kyc_status !== 'REJECTED' && (
                        <button
                          type="button"
                          onClick={() =>
                            kycAuditMutation.mutate({
                              kycId: u.kyc_id,
                              action: 'REJECT',
                              notes: 'Please re-upload clearer citizenship photos.',
                            })
                          }
                          disabled={kycAuditMutation.isPending}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition"
                        >
                          Reject KYC
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. 4-Card Telemetry Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 block">
                        Assigned Room
                      </span>
                      <p className="text-base font-black text-slate-900 mt-1">
                        {u.room_details
                          ? `Room ${u.room_details.room_number}`
                          : u.room_number
                          ? `Room ${u.room_number}`
                          : 'Unassigned'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {u.room_details
                          ? `${u.room_details.floor} • Rs. ${u.room_details.base_rent}/mo`
                          : 'No active unit'}
                      </p>
                    </div>

                    <div
                      className={`p-4 rounded-2xl border ${
                        u.pending_bills_count > 0
                          ? 'bg-rose-50/80 border-rose-200'
                          : 'bg-emerald-50/70 border-emerald-200'
                      }`}
                    >
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                        Pending / Unpaid Bills
                      </span>
                      <p
                        className={`text-base font-black mt-1 ${
                          u.pending_bills_count > 0 ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        Rs. {Number(u.total_pending_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {u.pending_bills_count > 0
                          ? `${u.pending_bills_count} open bill(s)`
                          : 'No pending dues'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Total Paid History
                      </span>
                      <p className="text-base font-black text-slate-900 mt-1">
                        Rs. {Number(u.total_paid_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {u.paid_bills_count || 0} settled invoice(s)
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Digital Lease & ID
                      </span>
                      <p className="text-base font-black text-slate-900 mt-1 truncate">
                        {u.citizenship_number || 'No ID No.'}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                        {u.has_accepted_lease ? '✓ Lease Signed' : 'Lease Pending'}
                      </p>
                    </div>
                  </div>

                  {/* 4. Assigned Room Telemetry + Emergency & Legal Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                      <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Home className="w-4 h-4 text-indigo-600" /> Room & Utility Telemetry
                      </h4>
                      {u.room_details ? (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <span className="text-slate-400 block">Move-In Date</span>
                            <strong>{u.room_details.entry_date || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Next Due Date</span>
                            <strong className="text-amber-700">
                              {u.room_details.next_due_date || 'N/A'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Sub-Meter Reading</span>
                            <strong className="text-indigo-600">
                              {u.room_details.current_meter_reading} units
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Utility Rates</span>
                            <strong>
                              Water Rs. {u.room_details.fixed_water_bill} • Elec Rs.{' '}
                              {u.room_details.electricity_rate}/u
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 py-2">
                          This user is not currently assigned to an active room.
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                      <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Legal & Emergency
                        Contact
                      </h4>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-slate-400 block">Legal Full Name</span>
                          <strong>{u.full_name_legal || u.full_name}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Citizenship No.</span>
                          <strong>{u.citizenship_number || 'Not submitted'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Emergency Contact</span>
                          <strong>{u.emergency_contact_name || 'Not provided'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Emergency Phone</span>
                          <strong>{u.emergency_contact_phone || 'Not provided'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Interactive Photo Gallery (Profile, Cover, KYC Front & Back) */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-indigo-600" /> Uploaded Identity & Profile
                        Photos (Click Any Photo for Fullscreen View)
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      {[
                        {
                          label: 'Profile Avatar',
                          url: avatarUrl,
                          key: 'AVATAR',
                        },
                        {
                          label: 'Cover Banner',
                          url: coverUrl,
                          key: 'COVER',
                        },
                        {
                          label: 'Citizenship Front',
                          url: citFrontUrl,
                          key: 'CIT_FRONT',
                        },
                        {
                          label: 'Citizenship Back',
                          url: citBackUrl,
                          key: 'CIT_BACK',
                        },
                      ].map((photoItem) => {
                        const galleryIdx = galleryItems.findIndex(
                          (g) => g.key === photoItem.key
                        );
                        return (
                          <div
                            key={photoItem.key}
                            onClick={() => {
                              if (photoItem.url) {
                                openPhotoLightbox(
                                  galleryItems,
                                  galleryIdx >= 0 ? galleryIdx : 0
                                );
                              }
                            }}
                            className={`rounded-2xl border overflow-hidden bg-slate-50 flex flex-col justify-between ${
                              photoItem.url
                                ? 'border-slate-200 cursor-pointer group hover:border-indigo-400 hover:shadow-md transition'
                                : 'border-dashed border-slate-200 opacity-75'
                            }`}
                          >
                            <div className="h-32 w-full bg-slate-900/5 relative overflow-hidden flex items-center justify-center">
                              {photoItem.url ? (
                                <>
                                  <img
                                    src={photoItem.url}
                                    alt={photoItem.label}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-extrabold transition">
                                    <ZoomIn className="w-4 h-4" /> View Photo
                                  </div>
                                </>
                              ) : (
                                <span className="text-[11px] font-bold text-slate-400">
                                  Not Uploaded
                                </span>
                              )}
                            </div>
                            <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-slate-700 truncate">
                                {photoItem.label}
                              </span>
                              {photoItem.url && (
                                <ZoomIn className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 6. Tenant Billing & Proof History Table */}
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" /> Billing & Payment Proof
                      History ({userBills.length})
                    </h4>
                    {userBills.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-400">
                        No bills recorded for this user yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-4">Cycle / Room</th>
                              <th className="py-3 px-4">Total Payable</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4">Proof Photos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {userBills.map((b) => {
                              const mUrl = getSafeMediaUrl(b.meter_photo_url);
                              const pUrl = getSafeMediaUrl(b.payment_screenshot_url);
                              const fullBillObj = bills.find((item) => item.id === b.id);
                              const fineEvUrls = Array.isArray(fullBillObj?.fine_evidence_urls)
                                ? fullBillObj.fine_evidence_urls
                                : [];

                              return (
                                <tr key={b.id} className="hover:bg-slate-50/80">
                                  <td className="py-3 px-4">
                                    <p className="font-extrabold text-slate-900">
                                      {b.billing_month_label}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      Room {b.room_number} • Due: {b.due_date}
                                    </p>
                                  </td>
                                  <td className="py-3 px-4">
                                    <p className="font-black text-slate-900">
                                      Rs. {Number(b.total_payable).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      {b.units_consumed} units elec
                                      {Number(b.damage_fine_amount || 0) > 0 && (
                                        <span className="text-rose-600 font-bold ml-1">
                                          • Fine: Rs. {b.damage_fine_amount}
                                        </span>
                                      )}
                                    </p>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                                        b.status === 'APPROVED' || b.status === 'PAID_CASH'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : b.status === 'PENDING_VERIFICATION'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-700'
                                      }`}
                                    >
                                      {b.status_display}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      {mUrl ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openPhotoLightbox([
                                              {
                                                url: mUrl,
                                                title: `Meter Photo — ${b.billing_month_label}`,
                                                subtitle: `Room ${b.room_number} • ${u.full_name}`,
                                              },
                                            ])
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px]"
                                        >
                                          <Camera className="w-3 h-3" /> Meter
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-slate-400">No Meter</span>
                                      )}
                                      {pUrl ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openPhotoLightbox([
                                              {
                                                url: pUrl,
                                                title: `Payment Slip — ${b.billing_month_label}`,
                                                subtitle: `Room ${b.room_number} • Rs. ${b.total_payable}`,
                                              },
                                            ])
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px]"
                                        >
                                          <CreditCard className="w-3 h-3" /> Receipt
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-slate-400">No Slip</span>
                                      )}
                                      {fineEvUrls.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openPhotoLightbox(
                                              fineEvUrls.map((ev, i) => ({
                                                url: getSafeMediaUrl(ev),
                                                title: `Fine Evidence #${i + 1} — ${b.billing_month_label}`,
                                                subtitle: fullBillObj?.damage_fine_reason,
                                              }))
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px]"
                                        >
                                          <AlertTriangle className="w-3 h-3" /> Fine Proof (
                                          {fineEvUrls.length})
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sticky Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {u.room_number && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to ask ${u.full_name} to leave Room ${u.room_number}?`
                          )
                        ) {
                          evictMutation.mutate({
                            userId: u.id,
                            actionType: 'VACATE',
                          });
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-sm transition"
                    >
                      Ask Tenant to Leave / Vacate Room {u.room_number}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition ml-auto"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 2: FULLSCREEN PHOTO LIGHTBOX MODAL (ZOOM, NEXT/PREV, DOWNLOAD)      */}
      {/* ========================================================================= */}
      {lightboxState.isOpen && lightboxState.items.length > 0 && (() => {
        const currentPhoto =
          lightboxState.items[lightboxState.currentIndex] || lightboxState.items[0];
        const totalPhotos = lightboxState.items.length;

        return (
          <div
            onClick={closePhotoLightbox}
            className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none"
          >
            {/* Top Toolbar */}
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
                  title="Zoom Out"
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
                  title="Reset Zoom"
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
                  title="Zoom In"
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
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  type="button"
                  onClick={closePhotoLightbox}
                  className="p-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white transition"
                  title="Close Photo Viewer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Center Image Canvas */}
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
                  title="Previous Photo"
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
                  title="Next Photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Bottom Thumbnail Strip */}
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
      {/* MODAL 3: ADMIN PAYMENT QR CODE UPLOAD & MANAGEMENT MODAL                  */}
      {/* ========================================================================= */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Official Payment QR Setup
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Upload or update the QR code shown to all tenants
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowQRModal(false);
                  setQrImageFile(null);
                  setQrImagePreview(null);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQRConfig} className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center space-y-3">
                {qrImagePreview || paymentQR?.qr_image_url ? (
                  <>
                    <img
                      src={qrImagePreview || getSafeMediaUrl(paymentQR.qr_image_url)}
                      alt="Payment QR Preview"
                      className="w-48 h-48 object-contain rounded-xl bg-white p-2 border border-slate-200 shadow-xs"
                    />
                    <div className="flex items-center gap-2">
                      {paymentQR?.qr_image_url && !qrImagePreview && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              downloadFileFromUrl(
                                getSafeMediaUrl(paymentQR.qr_image_url),
                                'SmartRent-Official-Payment-QR.png'
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold transition"
                          >
                            <Download className="w-3.5 h-3.5" /> Download Current QR
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Remove current Payment QR code?')) {
                                deleteQRMutation.mutate();
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-extrabold transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No QR code image uploaded yet. Select an image below.
                  </div>
                )}

                <label className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-extrabold cursor-pointer transition border border-indigo-200">
                  <Upload className="w-4 h-4" />
                  <span>
                    {paymentQR?.qr_image_url || qrImagePreview
                      ? 'Choose New QR Image to Replace'
                      : 'Upload QR Code Image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setQrImageFile(f);
                        setQrImagePreview(URL.createObjectURL(f));
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                  Merchant / Account Title
                </label>
                <input
                  type="text"
                  required
                  value={qrMerchantName}
                  onChange={(e) => setQrMerchantName(e.target.value)}
                  placeholder="e.g. SmartRent Official eSewa / Fonepay"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                  Payment Instructions for Tenants
                </label>
                <textarea
                  rows={2}
                  value={qrPaymentNote}
                  onChange={(e) => setQrPaymentNote(e.target.value)}
                  placeholder="e.g. Scan with eSewa, Khalti, or Mobile Banking and upload screenshot."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQRModal(false);
                    setQrImageFile(null);
                    setQrImagePreview(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateQRMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-md transition"
                >
                  {updateQRMutation.isPending ? 'Saving QR...' : 'Save & Publish QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: 2-STEP DANGER CONFIRMATION MODAL FOR DATABASE FACTORY RESET      */}
      {/* ========================================================================= */}
      {resetStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border-2 border-rose-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 block">
                    {resetStep === 1 ? 'Danger Confirmation (1 of 2)' : 'Final Irreversible Warning (2 of 2)'}
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    Factory Reset SmartRent Database
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetStep(0);
                  setResetConfirmText('');
                  setResetModalError('');
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {resetModalError}
              </div>
            )}

            {resetStep === 1 ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
                  <p className="font-extrabold text-rose-700">
                    Are you sure you want to reset the entire system to brand new?
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-800">
                    <li>Deletes all <strong>Tenant accounts</strong> and their KYC documents.</li>
                    <li>Deletes all <strong>Monthly Bills, Expenses, Reservations, and Tenancies</strong>.</li>
                    <li>Deletes all <strong>Chat Messages, Maintenance Tickets, and Notices</strong>.</li>
                    <li>Resets all <strong>Rooms to Vacant</strong> with <strong>0.00 meter reading</strong>.</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Safe Protected:</strong> Your logged-in Landlord Admin account and room structure will NOT be deleted.
                  </span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep(0)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep(2)}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md transition"
                  >
                    Yes, Proceed to Final Step →
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (resetConfirmText.trim().toUpperCase() !== 'RESET') return;
                  resetDatabaseMutation.mutate('RESET');
                }}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-rose-600 text-white text-xs space-y-1.5 shadow-inner">
                  <p className="font-black uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> SECOND & FINAL CONFIRMATION
                  </p>
                  <p className="text-[11px] text-rose-100 leading-relaxed">
                    This action cannot be undone. Every tenant, bill, and chat will be permanently erased, leaving only your Admin account and fresh vacant rooms.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1.5">
                    Type <span className="text-rose-600 font-black">RESET</span> below to unlock final wipe:
                  </label>
                  <input
                    type="text"
                    required
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="Type RESET in capital letters"
                    className="w-full px-3.5 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-xl border-2 border-rose-300 focus:border-rose-600 outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep(0);
                      setResetConfirmText('');
                      setResetModalError('');
                    }}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel & Keep Data
                  </button>
                  <button
                    type="submit"
                    disabled={
                      resetConfirmText.trim().toUpperCase() !== 'RESET' ||
                      resetDatabaseMutation.isPending
                    }
                    className="flex-1 py-3 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-40 text-white text-xs font-extrabold shadow-lg transition"
                  >
                    {resetDatabaseMutation.isPending
                      ? 'Wiping Database...'
                      : '🔥 Wipe & Reset Database Now'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADD ADMIN MODAL                                                  */}
      {/* ========================================================================= */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Create New Administrator</h3>
              <button
                type="button"
                onClick={() => {
                  setShowNewAdminPassword(false);
                  setShowAddAdminModal(false);
                }}
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
                <div className="relative">
                  <input
                    type={showNewAdminPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewAdminPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition"
                    tabIndex={-1}
                    title={showNewAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewAdminPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewAdminPassword(false);
                    setShowAddAdminModal(false);
                  }}
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

      {/* ========================================================================= */}
      {/* MODAL 6: ASSIGN TENANT MODAL                                              */}
      {/* ========================================================================= */}
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
                {tenantUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
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
                step="0.01"
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

      {/* ========================================================================= */}
      {/* MODAL 7: CASH OVERRIDE MODAL                                              */}
      {/* ========================================================================= */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Record Cash Payment</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                cashOverrideMutation.mutate({
                  bill_id: cashBillId ? Number(cashBillId) : undefined,
                  tenant_id: cashTenantId ? Number(cashTenantId) : undefined,
                  current_meter_reading: cashMeterReading,
                  damage_fine_amount: cashFine || '0',
                  damage_fine_reason: cashReason,
                  admin_remarks: 'Paid via Cash',
                });
              }}
              className="space-y-4"
            >
              <select
                required={!cashTenantId}
                value={cashBillId}
                onChange={(e) => setCashBillId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                <option value="">Choose Bill</option>
                {selectableBillsForDropdown.map((b) => (
                  <option key={b.id} value={b.id}>
                    Room {b.room_number} — {b.tenant_name} ({b.billing_month_label}) • Rs.{' '}
                    {b.total_payable}
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

      {/* ========================================================================= */}
      {/* MODAL 8: UPGRADED APPLY FINE MODAL (TENANT + BILL + EVIDENCE + UNDO)      */}
      {/* ========================================================================= */}
      {showFineModal && (
        <div
          onClick={() => setShowFineModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 my-auto max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Apply Property Damage / Rule Violation Fine
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Select a tenant or bill, attach evidence photos, and send an automated email notice
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFineModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {fineModalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{fineModalError}</span>
              </div>
            )}

            <form onSubmit={handleApplyFineSubmit} className="space-y-4">
              {/* Step 1: Select Tenant / User */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  1. Select Tenant / Registered User *
                </label>
                <select
                  value={fineTenantId}
                  onChange={(e) => handleSelectFineTenant(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition"
                >
                  <option value="">-- Choose Tenant / User ({tenantUsers.length} Registered) --</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email}){' '}
                      {u.room_number ? `• Room ${u.room_number}` : '• No Room Assigned'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Target Bill (Auto-populated or auto-created) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                    2. Choose Bill
                  </label>
                  {fineTenantId && filteredBillsForFine.length === 0 && (
                    <span className="text-[10px] font-extrabold text-emerald-600">
                      ✨ New invoice will be auto-created for this tenant
                    </span>
                  )}
                </div>
                <select
                  value={fineBillId}
                  onChange={(e) => handleSelectFineBill(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition"
                >
                  <option value="">
                    {fineTenantId && filteredBillsForFine.length === 0
                      ? 'Auto-Create Fresh Invoice for Selected Tenant'
                      : '-- Choose Existing Bill (or leave blank to auto-select) --'}
                  </option>
                  {filteredBillsForFine.map((b) => (
                    <option key={b.id} value={b.id}>
                      Room {b.room_number} — {b.tenant_name || 'Tenant'} ({b.billing_month_label}) •
                      Total: Rs. {Number(b.total_payable || 0).toLocaleString()} [{b.status_display}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Tenant / Bill Live Preview Banner + Quick Undo Fine if already fined */}
              {(selectedFineTenantObj || selectedFineBillObj) && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-extrabold text-slate-900">
                      {selectedFineTenantObj?.full_name || selectedFineBillObj?.tenant_name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Email: {selectedFineTenantObj?.email || 'Will notify registered email'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedFineBillObj && Number(selectedFineBillObj.damage_fine_amount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => handleUndoFine(selectedFineBillObj.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] shadow-xs transition"
                      >
                        Undo Current Fine (Rs. {selectedFineBillObj.damage_fine_amount})
                      </button>
                    )}
                    <span className="px-2.5 py-1 rounded-lg bg-white text-indigo-700 font-extrabold text-[11px] border border-indigo-200">
                      {selectedFineBillObj
                        ? `Room ${selectedFineBillObj.room_number} • Rs. ${Number(
                            selectedFineBillObj.total_payable
                          ).toLocaleString()}`
                        : selectedFineTenantObj?.room_number
                        ? `Room ${selectedFineTenantObj.room_number}`
                        : 'Direct Fine Invoice'}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Fine Mode & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                    3. Fine Amount (NPR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    placeholder="e.g. 600"
                    className="w-full px-3.5 py-2.5 text-sm font-black text-rose-600 rounded-xl border border-slate-200 outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                    Calculation Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFineMode('SET')}
                      className={`py-2 rounded-lg text-[11px] font-extrabold transition ${
                        fineMode === 'SET'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Set Exact Fine
                    </button>
                    <button
                      type="button"
                      onClick={() => setFineMode('ADD')}
                      className={`py-2 rounded-lg text-[11px] font-extrabold transition ${
                        fineMode === 'ADD'
                          ? 'bg-white text-rose-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      + Add to Fine
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 4: Violation / Damage Reason + Quick Presets */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  4. Violation / Damage Reason (Included in Email) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={fineReason}
                  onChange={(e) => setFineReason(e.target.value)}
                  placeholder="Describe the damage, dirt, broken item, or rule violation..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-rose-500 resize-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {FINE_REASON_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFineReason(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[10px] font-bold transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 5: Evidence Photo Upload (Dirt, Broken Items, Violation Proof) */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  5. Attach Evidence Photos (Optional • Up to 5 MB each)
                </label>
                <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-rose-200 hover:border-rose-500 bg-rose-50/30 cursor-pointer transition text-center">
                  <ImagePlus className="w-6 h-6 text-rose-500 mb-1" />
                  <span className="text-xs font-extrabold text-slate-800">
                    Upload Photos of Damage, Dirt, or Broken Items
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    Supports JPG, PNG, WEBP, HEIC • Stored with bill & sent in tenant email
                  </span>
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.avif"
                    multiple
                    onChange={handleFineEvidenceSelect}
                    className="hidden"
                  />
                </label>

                {fineEvidencePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2.5 mt-3">
                    {fineEvidencePreviews.map((item, idx) => (
                      <div
                        key={idx}
                        className="relative h-16 rounded-xl overflow-hidden border border-rose-200 bg-slate-100"
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFineEvidenceFile(idx)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-0.5 left-1 px-1 rounded bg-black/60 text-white text-[9px] font-bold">
                          {item.sizeMB}M
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFineModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyFineMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-rose-600/20 transition inline-flex items-center justify-center gap-1.5"
                >
                  {applyFineMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying & Emailing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      Apply Fine & Notify Tenant
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
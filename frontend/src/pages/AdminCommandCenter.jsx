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
  CreditCard,
  Camera,
  Loader2,
  ImagePlus,
  LogOut,
  Search,
  Edit3,
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
import { useLanguage } from '../context/LanguageContext';
import {
  formatDualDate,
  formatDualMonthLabel,
  formatBSOnly,
} from '../utils/nepaliDate';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const FINE_REASON_PRESETS = [
  {
    en: 'Unclean surroundings / corridor dirt violation',
    ne: 'वरिपरि वा प्यासेजमा फोहोर गरेको जरिवाना',
  },
  {
    en: 'Broken room fixture / property damage',
    ne: 'कोठाको सामान टुटफुट वा क्षति पुर्याएको',
  },
  {
    en: 'Late night noise / discipline rule violation',
    ne: 'राति होहल्ला वा अनुशासन नियम उल्लंघन',
  },
  {
    en: 'Improper waste disposal / sanitation fine',
    ne: 'जथाभावी फोहोर फालेको / सरसफाइ नियम उल्लंघन',
  },
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

  const mediaIndex = finalUrl.indexOf('/media/');
  if (mediaIndex !== -1) {
    finalUrl = `${backendOrigin}${finalUrl.substring(mediaIndex)}`;
  } else if (finalUrl.startsWith('/')) {
    finalUrl = `${backendOrigin}${finalUrl}`;
  }

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
  const { isNepali, t, td } = useLanguage();

  const [activeAdminTab, setActiveAdminTab] = useState('OVERVIEW'); // OVERVIEW | USERS | ADMINS
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  // Edit Room Sub-Meter Modal States
  const [editMeterRoom, setEditMeterRoom] = useState(null);
  const [editMeterValue, setEditMeterValue] = useState('');

  // Managed List Filter & Search States
  const [reservationFilter, setReservationFilter] = useState('PENDING'); // PENDING | APPROVED | ALL
  const [billQueueFilter, setBillQueueFilter] = useState('OPEN'); // OPEN | APPROVED | ALL
  const [roomMatrixFilter, setRoomMatrixFilter] = useState('ALL'); // ALL | OCCUPIED | VACANT
  const [tenantListFilter, setTenantListFilter] = useState('ALL'); // ALL | ASSIGNED | UNASSIGNED | KYC_VERIFIED
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');

  // Fullscreen Photo Lightbox States
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    items: [],
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
  const [fineMode, setFineMode] = useState('SET');
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

  const selectedUserModal = selectedUserId
    ? adminUsers.find((u) => u.id === selectedUserId) || null
    : null;

  const pendingQueue = bills.filter((b) => b.status === 'PENDING_VERIFICATION');
  const pendingReservations = reservations.filter((r) => r.status === 'PENDING');
  const approvedReservations = reservations.filter((r) => r.status === 'APPROVED');

  const unpaidOrPendingBills = bills.filter(
    (b) => b.status !== 'APPROVED' && b.status !== 'PAID_CASH'
  );
  const approvedOrPaidBills = bills.filter(
    (b) => b.status === 'APPROVED' || b.status === 'PAID_CASH'
  );
  const selectableBillsForDropdown =
    unpaidOrPendingBills.length > 0 ? unpaidOrPendingBills : bills;

  const displayedReservations =
    reservationFilter === 'PENDING'
      ? pendingReservations
      : reservationFilter === 'APPROVED'
      ? approvedReservations
      : reservations;

  const displayedBillsQueue =
    billQueueFilter === 'OPEN'
      ? unpaidOrPendingBills
      : billQueueFilter === 'APPROVED'
      ? approvedOrPaidBills
      : bills;

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

  const occupiedRoomsCount = roomsList.filter((r) => r.is_occupied).length;
  const vacantRoomsCount = roomsList.length - occupiedRoomsCount;

  const displayedRoomsList = roomsList.filter((r) => {
    if (roomMatrixFilter === 'OCCUPIED') return r.is_occupied;
    if (roomMatrixFilter === 'VACANT') return !r.is_occupied;
    return true;
  });

  const assignedTenantsCount = tenantUsers.filter((u) => Boolean(u.room_number)).length;
  const unassignedTenantsCount = tenantUsers.length - assignedTenantsCount;

  const filteredTenantUsers = tenantUsers.filter((u) => {
    if (tenantListFilter === 'ASSIGNED' && !u.room_number) return false;
    if (tenantListFilter === 'UNASSIGNED' && u.room_number) return false;
    if (tenantListFilter === 'KYC_VERIFIED' && u.kyc_status !== 'VERIFIED') return false;

    if (tenantSearchQuery.trim()) {
      const q = tenantSearchQuery.toLowerCase().trim();
      const matchName = (u.full_name || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchPhone = (u.phone_number || '').toLowerCase().includes(q);
      const matchRoom = (u.room_number || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchRoom;
    }
    return true;
  });

  const monthlyTrendChartData = (analytics?.monthly_trend_chart || []).map((item) => ({
    ...item,
    month: formatDualMonthLabel(item.month),
  }));

  const openEditMeterModal = (roomObj) => {
    if (!roomObj) return;
    setEditMeterRoom(roomObj);
    setEditMeterValue(String(roomObj.current_meter_reading ?? 0));
  };

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
          t(
            `"${file.name}" exceeds the 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
            `"${file.name}" ५ MB सीमाभन्दा ठूलो छ।`
          )
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
        title: `${u.full_name} — ${t('Profile Avatar', 'प्रोफाइल फोटो')}`,
        subtitle: u.email,
      });
    }
    if (coverUrl) {
      items.push({
        key: 'COVER',
        url: coverUrl,
        title: `${u.full_name} — ${t('Cover Banner', 'कभर ब्यानर')}`,
        subtitle: u.email,
      });
    }
    if (citFrontUrl) {
      items.push({
        key: 'CIT_FRONT',
        url: citFrontUrl,
        title: `${u.full_name} — ${t('Citizenship ID (Front)', 'नागरिकता (अगाडि)')}`,
        subtitle: `${t('Citizenship No:', 'नागरिकता नं:')} ${u.citizenship_number || 'N/A'}`,
      });
    }
    if (citBackUrl) {
      items.push({
        key: 'CIT_BACK',
        url: citBackUrl,
        title: `${u.full_name} — ${t('Citizenship ID (Back)', 'नागरिकता (पछाडि)')}`,
        subtitle: `${t('Citizenship No:', 'नागरिकता नं:')} ${u.citizenship_number || 'N/A'}`,
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
            title: `${t('Meter Photo Proof', 'मिटर फोटो प्रमाण')} — ${formatDualMonthLabel(
              b.billing_month_label
            )}`,
            subtitle: `${t('Room', 'कोठा')} ${b.room_number} • ${b.units_consumed} ${t(
              'units',
              'युनिट'
            )} • ${t('Rs.', 'रु.')} ${b.total_payable}`,
          });
        }
        if (pUrl) {
          items.push({
            key: `BILL_PAY_${b.id}`,
            url: pUrl,
            title: `${t('Payment Receipt', 'भुक्तानी भौचर')} — ${formatDualMonthLabel(
              b.billing_month_label
            )}`,
            subtitle: `${t('Room', 'कोठा')} ${b.room_number} • Ref: ${
              b.transaction_reference || 'N/A'
            } • ${t('Rs.', 'रु.')} ${b.total_payable}`,
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
              title: `${t('Fine Evidence Photo', 'जरिवाना प्रमाण फोटो')} #${
                evIdx + 1
              } — ${formatDualMonthLabel(b.billing_month_label)}`,
              subtitle: `${t('Fine: Rs.', 'जरिवाना: रु.')} ${b.damage_fine_amount} • ${t(
                'Reason:',
                'कारण:'
              )} ${b.damage_fine_reason || 'Violation'}`,
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
    queryClient.invalidateQueries({ queryKey: ['publicLandingData'] });
  };

  const updateRoomMeterMutation = useMutation({
    mutationFn: async ({ roomId, newMeter }) =>
      (
        await axiosClient.patch(`/rooms/${roomId}/`, {
          current_meter_reading: newMeter,
        })
      ).data,
    onSuccess: (data) => {
      setBannerMsg({
        type: 'success',
        text:
          data.message ||
          t(
            'Sub-meter reading updated successfully!',
            'सब-मिटर रिडिङ सफलतापूर्वक अपडेट गरियो!'
          ),
      });
      setEditMeterRoom(null);
      setEditMeterValue('');
      refreshAllAdminData();
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          t(
            'Could not update sub-meter reading.',
            'सब-मिटर रिडिङ अपडेट गर्न सकिएन।'
          ),
      });
    },
  });

  const kycAuditMutation = useMutation({
    mutationFn: ({ kycId, action, notes }) => auditKYC(kycId, action, notes),
    onSuccess: (data) => {
      setBannerMsg({
        type: 'success',
        text: data.message || t('KYC status updated!', 'केवाईसी अवस्था अपडेट गरियो!'),
      });
      refreshAllAdminData();
    },
    onError: () => {
      setBannerMsg({
        type: 'error',
        text: t(
          'Could not update KYC verification status.',
          'केवाईसी अवस्था अपडेट गर्न सकिएन।'
        ),
      });
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
        text:
          err.response?.data?.error ||
          t(
            'Failed to upload Payment QR Code.',
            'भुक्तानी QR कोड अपलोड गर्न सकिएन।'
          ),
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
          t(
            'Could not process move-out request.',
            'कोठा छोड्ने अनुरोध प्रक्रिया गर्न सकिएन।'
          ),
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
        text:
          err.response?.data?.error ||
          t('Failed to record cash payment.', 'नगद भुक्तानी रेकर्ड गर्न सकिएन।'),
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
        t('Could not apply fine.', 'जरिवाना लागू गर्न सकिएन।');
      setFineModalError(msg);
      setBannerMsg({ type: 'error', text: msg });
    },
  });

  const handleApplyFineSubmit = (e) => {
    e.preventDefault();
    setFineModalError('');

    if (!fineTenantId && !fineBillId) {
      setFineModalError(
        t(
          'Please select a Tenant (or a specific Bill) to apply the fine.',
          'कृपया जरिवाना लागू गर्न भाडावाल वा बिल छान्नुहोस्।'
        )
      );
      return;
    }
    if (!fineAmount || Number(fineAmount) <= 0) {
      setFineModalError(
        t(
          'Please enter a valid fine amount greater than Rs. 0.',
          'कृपया रु. ० भन्दा बढी जरिवाना रकम लेख्नुहोस्।'
        )
      );
      return;
    }
    if (!fineReason.trim()) {
      setFineModalError(
        t(
          'Please enter the violation or damage reason.',
          'कृपया जरिवानाको कारण उल्लेख गर्नुहोस्।'
        )
      );
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
    if (
      window.confirm(
        t(
          'Are you sure you want to undo and remove this fine from the tenant?',
          'के तपाईं यो जरिवाना हटाउन चाहनुहुन्छ?'
        )
      )
    ) {
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
      setBannerMsg({
        type: 'success',
        text: t('Expense recorded!', 'घर खर्च सफलतापूर्वक रेकर्ड गरियो!'),
      });
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
      setBannerMsg({
        type: 'success',
        text: t(
          'Notice published to all tenants!',
          'सबै भाडावालहरूका लागि सूचना प्रकाशित गरियो!'
        ),
      });
      refreshAllAdminData();
      setNoticeTitle('');
      setNoticeContent('');
    },
  });

  const deleteNoticeMutation = useMutation({
    mutationFn: deleteNotice,
    onSuccess: () => {
      setBannerMsg({
        type: 'success',
        text: t('Notice deleted.', 'सूचना हटाइयो।'),
      });
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
      setUserToDelete(null);
    },
    onError: (err) => {
      setBannerMsg({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          t(
            'Could not complete tenant action.',
            'भाडावाल सम्बन्धी कार्य पूरा गर्न सकिएन।'
          ),
      });
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
        text:
          err.response?.data?.error ||
          t('Failed to update admin permissions.', 'एडमिन अनुमति अपडेट गर्न सकिएन।'),
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
        t(
          'Backend reset endpoint failed.',
          'डाटाबेस रिसेट गर्न सकिएन।'
        );
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
    (selectedBillForAudit &&
      displayedBillsQueue.find((b) => b.id === selectedBillForAudit.id)) ||
    displayedBillsQueue[0] ||
    null;

  const activeReviewReservation =
    (selectedReservation &&
      displayedReservations.find((r) => r.id === selectedReservation.id)) ||
    displayedReservations[0] ||
    null;

  const activeReviewMoveOut = selectedMoveOut || pendingMoveOuts[0] || null;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* HEADER BANNER */}
      <div className="rounded-3xl bg-indigo-600 text-white p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />{' '}
              {t('LANDLORD COMMAND DECK', 'घरधनी कमाण्ड सेन्टर')}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-extrabold border border-emerald-400/30">
              <Radio className="w-3 h-3 text-emerald-300 animate-pulse" />{' '}
              {t('LIVE 4S AUTO-SYNC', 'लाइभ ४-सेकेन्ड अटो-सिंक')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t('Executive Command Center', 'प्रमुख व्यवस्थापन तथा नियन्त्रण कक्ष')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowQRModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-extrabold shadow-sm transition"
          >
            <QrCode className="w-3.5 h-3.5" />{' '}
            {t('Payment QR Setup', 'भुक्तानी QR सेटअप')}
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
                  setBannerMsg({
                    type: 'error',
                    text: t('Bulk generate endpoint error.', 'बिल तयार गर्न समस्या भयो।'),
                  });
                });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition"
          >
            <Zap className="w-3.5 h-3.5" />{' '}
            {t('Auto-Generate Bills', 'स्वचालित बिल तयार')}
          </button>
          <button
            type="button"
            onClick={() => reminderMutation.mutate()}
            disabled={reminderMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold border border-indigo-400 transition"
          >
            <BellRing className="w-3.5 h-3.5" />{' '}
            {t('Send Alerts', 'स्मरण इमेल पठाउनुहोस्')}
          </button>
          <button
            type="button"
            onClick={() => openFineModalForUser(null, null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" />{' '}
            {t('+ Apply Fine', '+ जरिवाना लगाउनुहोस्')}
          </button>
          <button
            type="button"
            onClick={() => setShowCashModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 text-xs font-bold shadow-md transition"
          >
            {t('+ Cash Override', '+ नगद भुक्तानी')}
          </button>
          <button
            type="button"
            onClick={() => {
              setResetConfirmText('');
              setResetModalError('');
              setResetStep(1);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-950/90 hover:bg-rose-900 text-rose-100 border border-rose-400/40 text-xs font-extrabold shadow-sm transition"
            title={t(
              'Factory Reset Database (Keeps Admin)',
              'डाटाबेस रिसेट गर्नुहोस् (एडमिन सुरक्षित रहनेछ)'
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />{' '}
            {t('Reset Database', 'डाटाबेस रिसेट')}
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
          {
            key: 'OVERVIEW',
            label: t('📊 Executive Command Overview', '📊 प्रमुख सिंहावलोकन तथा नियन्त्रण'),
          },
          {
            key: 'USERS',
            label: t(
              `👥 Tenants Directory (${tenantUsers.length})`,
              `👥 भाडावाल निर्देशिका (${tenantUsers.length})`
            ),
          },
          {
            key: 'ADMINS',
            label: t(
              `🛡️ Admin Team Management (${adminTeamUsers.length})`,
              `🛡️ एडमिन टोली व्यवस्थापन (${adminTeamUsers.length})`
            ),
          },
        ].map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setActiveAdminTab(tabItem.key)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-2xl text-xs font-extrabold transition ${
              activeAdminTab === tabItem.key
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* TAB 2: TENANTS DIRECTORY WITH SEARCH, FILTER & SCROLLABLE MANAGED CONTAINER */}
      {activeAdminTab === 'USERS' && (
        <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                {t(
                  'Registered Users & Tenants Directory',
                  'दर्ता गरिएका प्रयोगकर्ता र भाडावाल निर्देशिका'
                )}
              </h3>
              <p className="text-xs text-slate-500">
                {t(
                  'Inspect full tenant profiles, fullscreen photos, KYC citizenship IDs, assigned rooms, or permanently delete departed tenants.',
                  'भाडावालको पूरा विवरण, फोटो, नागरिकता (KYC), तोकिएको कोठा हेर्नुहोस् वा कोठा छोडिसकेका भाडावालको डाटा हटाउनुहोस्।'
                )}
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition self-start lg:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />{' '}
                {t('Wipe All Tenants & Reset DB', 'सबै भाडावाल हटाई डाटाबेस रिसेट गर्नुहोस्')}
              </button>
            )}
          </div>

          {/* Search & Managed Filter Bar */}
          {tenantUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[
                  {
                    key: 'ALL',
                    label: t(`All (${tenantUsers.length})`, `सबै (${tenantUsers.length})`),
                  },
                  {
                    key: 'ASSIGNED',
                    label: t(
                      `Assigned Room (${assignedTenantsCount})`,
                      `कोठा तोकिएको (${assignedTenantsCount})`
                    ),
                  },
                  {
                    key: 'UNASSIGNED',
                    label: t(
                      `Unassigned (${unassignedTenantsCount})`,
                      `कोठा नतोकिएको (${unassignedTenantsCount})`
                    ),
                  },
                  {
                    key: 'KYC_VERIFIED',
                    label: t(
                      `KYC Verified (${
                        tenantUsers.filter((u) => u.kyc_status === 'VERIFIED').length
                      })`,
                      `केवाईसी प्रमाणित (${
                        tenantUsers.filter((u) => u.kyc_status === 'VERIFIED').length
                      })`
                    ),
                  },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setTenantListFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                      tenantListFilter === f.key
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tenantSearchQuery}
                  onChange={(e) => setTenantSearchQuery(e.target.value)}
                  placeholder={t(
                    'Search name, room, phone...',
                    'नाम, कोठा वा फोन खोज्नुहोस्...'
                  )}
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none"
                />
                {tenantSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTenantSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredTenantUsers.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-sm font-extrabold text-slate-700">
                {t('No tenants match the current filter', 'कुनै भाडावाल फेला परेन')}
              </p>
              <p className="text-xs text-slate-400">
                {t(
                  'Try switching the filter tab or clearing your search query.',
                  'कृपया अर्को फिल्टर छान्नुहोस् वा खोज शब्द हटाउनुहोस्।'
                )}
              </p>
            </div>
          ) : (
            <div className="max-h-[680px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTenantUsers.map((u) => {
                  const avatarUrl = getSafeMediaUrl(u.profile_picture_path || u.profile_picture_url);
                  const coverUrl = getSafeMediaUrl(u.cover_picture_path || u.cover_picture_url);
                  const galleryItems = buildUserGalleryItems(u);

                  return (
                    <div
                      key={u.id}
                      className="rounded-3xl border border-slate-200/90 bg-white hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                    >
                      <div>
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

                          <div className="absolute top-3 right-3 flex items-center gap-1.5">
                            {u.room_number ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold shadow-sm">
                                {t('Room', 'कोठा')} {u.room_number}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-slate-900/60 backdrop-blur-xs text-white text-[10px] font-bold">
                                {t('No Room', 'कोठा छैन')}
                              </span>
                            )}
                          </div>
                        </div>

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
                              KYC: {td(u.kyc_status)}
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

                          <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                {t('Pending Dues', 'तिर्न बाँकी')}
                              </span>
                              {u.pending_bills_count > 0 ? (
                                <span className="font-black text-rose-600">
                                  {t('Rs.', 'रु.')}{' '}
                                  {Number(u.total_pending_amount || 0).toLocaleString()} (
                                  {u.pending_bills_count})
                                </span>
                              ) : (
                                <span className="font-extrabold text-emerald-600">
                                  {t('All Clear ✓', 'चुक्ता छ ✓')}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                                {t('Uploaded Photos', 'अपलोड फोटो')}
                              </span>
                              <span className="font-extrabold text-indigo-600">
                                {galleryItems.length} {t('Photo(s)', 'फोटो')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />{' '}
                          {t('Dossier', 'पूर्ण विवरण')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openFineModalForUser(u, null)}
                          className="py-2.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition inline-flex items-center gap-1"
                          title={t('Apply Fine to Tenant', 'जरिवाना लगाउनुहोस्')}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />{' '}
                          {t('Fine', 'जरिवाना')}
                        </button>
                        {galleryItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openPhotoLightbox(galleryItems, 0)}
                            className="py-2.5 px-2.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-extrabold transition inline-flex items-center gap-1"
                            title={t('Open Photo Viewer', 'फोटो हेर्नुहोस्')}
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
                                  t(
                                    `Are you sure you want to ask ${u.full_name} to leave / vacate Room ${u.room_number}?`,
                                    `के तपाईं ${u.full_name} को कोठा ${u.room_number} खाली गराउन चाहनुहुन्छ?`
                                  )
                                )
                              ) {
                                evictMutation.mutate({ userId: u.id, actionType: 'VACATE' });
                              }
                            }}
                            className="py-2.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-extrabold transition"
                            title={t('Vacate Room', 'कोठा खाली गराउनुहोस्')}
                          >
                            {t('Vacate', 'खाली')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setUserToDelete(u)}
                          className="py-2.5 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1"
                          title={t(
                            'Permanently Delete Tenant & All Data',
                            'भाडावाल र सम्पूर्ण डाटा स्थायी रूपमा मेटाउनुहोस्'
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                {t(
                  'Landlord & Administrator Team',
                  'घरधनी र प्रशासक (Admin) टोली'
                )}
              </h3>
              <p className="text-xs text-slate-500">
                {t(
                  'Manage who has executive command access to the SmartRent property portal.',
                  'स्मार्टरेन्ट पोर्टलमा कसलाई प्रमुख एडमिन अधिकार दिने भनी व्यवस्थापन गर्नुहोस्।'
                )}
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
              {t('+ Add New Administrator', '+ नयाँ एडमिन थप्नुहोस्')}
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
                        {t('Landlord Admin', 'घरधनी एडमिन')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(adm.id)}
                      className="p-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 transition"
                      title={t('View Admin Profile', 'एडमिन प्रोफाइल हेर्नुहोस्')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {adminTeamUsers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              t(
                                `Are you sure you want to revoke admin privileges from ${adm.full_name}?`,
                                `के तपाईं ${adm.full_name} को एडमिन अधिकार हटाउन चाहनुहुन्छ?`
                              )
                            )
                          ) {
                            manageAdminMutation.mutate({ action: 'REMOVE', user_id: adm.id });
                          }
                        }}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                        title={t('Remove Admin Access', 'एडमिन अधिकार हटाउनुहोस्')}
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
                  {t('TOTAL REVENUE', 'कुल आम्दानी')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {t('Rs.', 'रु.')} {Number(kpis.total_revenue).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {t('BOOKINGS & MOVE-OUTS', 'बुकिङ र कोठा छोड्ने')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl font-extrabold text-slate-900">
                  {pendingReservations.length} {t('Bookings', 'बुकिङ')}
                </p>
                {pendingMoveOuts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-extrabold">
                    {pendingMoveOuts.length} {t('Move-Out', 'छोड्ने')}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {t('OCCUPANCY', 'कोठा बसोबास')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Building className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {kpis.occupied_rooms} / {kpis.total_rooms} {t('Rooms', 'कोठाहरू')}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {t('NET PROFIT', 'खुद नाफा')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-indigo-600">
                {t('Rs.', 'रु.')} {Number(kpis.net_profit).toLocaleString()}
              </p>
            </div>
          </div>

          {/* NOTICE BOARD PUBLISHER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-1">
                <Megaphone className="w-5 h-5 text-indigo-600" />{' '}
                {t('Broadcast House Notice', 'घरको आधिकारिक सूचना प्रकाशन गर्नुहोस्')}
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                {t(
                  "Publish announcements, maintenance schedules, or urgent alerts directly to all tenants' dashboards and emails.",
                  'सबै भाडावालहरूको ड्यासबोर्ड र इमेलमा सिधै सूचना, मर्मत तालिका वा जरुरी जानकारी पठाउनुहोस्।'
                )}
              </p>
              <form onSubmit={handlePostNotice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      {t('NOTICE TITLE', 'सूचनाको शीर्षक')}
                    </label>
                    <input
                      type="text"
                      required
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      placeholder={t(
                        'e.g., Water Tank Cleaning This Sunday',
                        'जस्तै: यो आइतबार पानी ट्यांकी सफा गरिने'
                      )}
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      {t('CATEGORY', 'प्रकार')}
                    </label>
                    <select
                      value={noticeCategory}
                      onChange={(e) => setNoticeCategory(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    >
                      <option value="GENERAL">{t('General Notice', 'सामान्य सूचना')}</option>
                      <option value="MAINTENANCE">{t('Maintenance', 'मर्मत सम्भार')}</option>
                      <option value="URGENT">{t('Urgent Alert', 'जरुरी सूचना')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    {t('NOTICE CONTENT', 'सूचनाको विस्तृत विवरण')}
                  </label>
                  <textarea
                    required
                    rows="3"
                    value={noticeContent}
                    onChange={(e) => setNoticeContent(e.target.value)}
                    placeholder={t(
                      'Details of the announcement...',
                      'सूचनाको पूरा विवरण लेख्नुहोस्...'
                    )}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createNoticeMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition"
                >
                  {createNoticeMutation.isPending
                    ? t('Publishing...', 'प्रकाशन हुँदैछ...')
                    : t('Publish Notice to Tenants', 'भाडावालहरूलाई सूचना पठाउनुहोस्')}
                </button>
              </form>
            </div>

            <div className="lg:col-span-4 rounded-2xl bg-slate-50 border border-slate-200/80 p-5 overflow-y-auto max-h-[350px]">
              <h3 className="text-sm font-extrabold text-slate-900 mb-4">
                {t('Active Broadcasts', 'प्रकाशित सक्रिय सूचनाहरू')}
              </h3>
              {notices.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  {t('No active notices.', 'कुनै सक्रिय सूचना छैन।')}
                </p>
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
                          {td(n.category_display || n.category)}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteNoticeMutation.mutate(n.id)}
                          className="text-slate-400 hover:text-rose-600 transition"
                          title={t('Delete Notice', 'सूचना हटाउनुहोस्')}
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
          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                {t('Room Reservations & Visit Requests', 'कोठा बुकिङ र अवलोकन अनुरोधहरू')}
                {pendingReservations.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                    {pendingReservations.length} {t('Pending', 'बाँकी')}
                  </span>
                )}
              </h3>

              <div className="inline-flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                {[
                  {
                    key: 'PENDING',
                    label: t(
                      `Pending (${pendingReservations.length})`,
                      `प्रतीक्षामा (${pendingReservations.length})`
                    ),
                  },
                  {
                    key: 'APPROVED',
                    label: t(
                      `Approved & Assigned (${approvedReservations.length})`,
                      `स्वीकृत र तोकिएको (${approvedReservations.length})`
                    ),
                  },
                  {
                    key: 'ALL',
                    label: t(`All (${reservations.length})`, `सबै (${reservations.length})`),
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setReservationFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition ${
                      reservationFilter === tab.key
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {displayedReservations.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                {t(
                  'No room reservations to display in this tab.',
                  'यस ट्याबमा कुनै कोठा बुकिङ अनुरोध छैन।'
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {displayedReservations.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedReservation(res);
                        setStartingMeterOverride(String(res.current_meter_reading || 0));
                      }}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                        activeReviewReservation?.id === res.id
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-xs truncate pr-2">
                          {t('Room', 'कोठा')} {res.room_number} •{' '}
                          {res.user_full_name || res.user_email}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                            res.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : res.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {td(res.status_display)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t('Move-in:', 'सर्ने मिति:')}{' '}
                        {formatDualDate(res.expected_move_in_date)}
                      </p>
                    </div>
                  ))}
                </div>

                {activeReviewReservation && (
                  <div className="lg:col-span-7 rounded-2xl bg-slate-50 border border-slate-200/80 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          {t('Room', 'कोठा')} {activeReviewReservation.room_number} —{' '}
                          {activeReviewReservation.user_full_name ||
                            activeReviewReservation.user_email}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {t('Expected Move-In:', 'सर्ने मिति:')}{' '}
                          {formatDualDate(activeReviewReservation.expected_move_in_date)}
                          {activeReviewReservation.phone_number
                            ? ` • 📞 ${activeReviewReservation.phone_number}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${
                          activeReviewReservation.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : activeReviewReservation.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {td(activeReviewReservation.status_display)}
                      </span>
                    </div>

                    {activeReviewReservation.status === 'PENDING' ? (
                      <div className="space-y-3">
                        <input
                          type="number"
                          step="0.01"
                          value={startingMeterOverride}
                          onChange={(e) => setStartingMeterOverride(e.target.value)}
                          placeholder={t(
                            'Initial Sub-Meter Reading',
                            'सुरुवाती सब-मिटर रिडिङ'
                          )}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200"
                        />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              reservationActionMutation.mutate({
                                id: activeReviewReservation.id,
                                payload: {
                                  action: 'REJECT',
                                  admin_remarks: 'Rejected by Landlord',
                                },
                              })
                            }
                            className="flex-1 py-2.5 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200"
                          >
                            {t('Reject', 'अस्वीकार गर्नुहोस्')}
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
                            {t('Approve & Assign', 'स्वीकृत गरी कोठा तोक्नुहोस्')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2
                            className={`w-5 h-5 shrink-0 ${
                              activeReviewReservation.status === 'APPROVED'
                                ? 'text-emerald-600'
                                : 'text-slate-400'
                            }`}
                          />
                          <div>
                            <p className="font-extrabold text-slate-900">
                              {activeReviewReservation.status === 'APPROVED'
                                ? t(
                                    `Approved & Assigned to Room ${activeReviewReservation.room_number}`,
                                    `स्वीकृत भई कोठा ${activeReviewReservation.room_number} मा तोकिएको छ`
                                  )
                                : `${t('Request', 'अनुरोध')} ${td(
                                    activeReviewReservation.status_display
                                  )}`}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {activeReviewReservation.admin_remarks ||
                                t('Processed by Landlord Admin', 'घरधनी एडमिनद्वारा सम्पन्न')}
                            </p>
                          </div>
                        </div>
                        {activeReviewReservation.user && (
                          <button
                            type="button"
                            onClick={() => setSelectedUserId(activeReviewReservation.user)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] shrink-0"
                          >
                            {t('Inspect Tenant', 'भाडावाल हेर्नुहोस्')}
                          </button>
                        )}
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
                {t(
                  'Tenant Move-Out & Final Settlement Queue',
                  'कोठा छोड्ने र अन्तिम हिसाब फरफारक सूची'
                )}
                {pendingMoveOuts.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-extrabold">
                    {pendingMoveOuts.length} {t('Pending', 'बाँकी')}
                  </span>
                )}
              </h3>
              <span className="text-xs text-slate-500">
                {t(
                  'Verify final sub-meter reading to generate settlement bill & vacate room',
                  'अन्तिम सब-मिटर रिडिङ जाँच गरी हिसाब फरफारक र कोठा खाली गर्नुहोस्'
                )}
              </span>
            </div>

            {pendingMoveOuts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {t(
                  'No pending move-out requests from tenants right now.',
                  'अहिले कोठा छोड्ने कुनै अनुरोध बाँकी छैन।'
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {pendingMoveOuts.map((mo) => (
                    <div
                      key={mo.id}
                      onClick={() => {
                        setSelectedMoveOut(mo);
                        setFinalMeterOverride(String(mo.current_meter_reading ?? ''));
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition ${
                        activeReviewMoveOut?.id === mo.id
                          ? 'border-rose-600 bg-rose-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-xs">
                          {t('Room', 'कोठा')} {mo.room_number} • {mo.tenant_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800">
                          {td(mo.status_display || 'Pending')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-semibold">
                        {t('Planned Departure:', 'छोड्ने मिति:')}{' '}
                        {formatDualDate(mo.requested_date)}
                      </p>
                      {mo.reason && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {t('Reason:', 'कारण:')} {mo.reason}
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
                          {t('Room', 'कोठा')} {activeReviewMoveOut.room_number} —{' '}
                          {activeReviewMoveOut.tenant_name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {activeReviewMoveOut.tenant_email}
                          {activeReviewMoveOut.tenant_phone
                            ? ` • 📞 ${activeReviewMoveOut.tenant_phone}`
                            : ''}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-white text-rose-700 font-extrabold text-xs border border-rose-200">
                        {t('Departure:', 'छोड्ने मिति:')}{' '}
                        {formatDualDate(activeReviewMoveOut.requested_date)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {t('Previous Sub-Meter Reading', 'अघिल्लो सब-मिटर रिडिङ')}
                        </span>
                        <strong className="text-sm text-indigo-600">
                          {activeReviewMoveOut.current_meter_reading ?? 0}{' '}
                          {t('units', 'युनिट')}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {t('Tenant Reason', 'भाडावालको कारण')}
                        </span>
                        <strong className="text-slate-800">
                          {activeReviewMoveOut.reason || t('Not specified', 'उल्लेख छैन')}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-extrabold uppercase text-slate-700 mb-1">
                          {t('Final Sub-Meter Reading (Units) *', 'अन्तिम सब-मिटर रिडिङ (युनिट) *')}
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
                          className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-white border border-slate-200 outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold uppercase text-slate-700 mb-1">
                          {t('Admin Settlement Remarks', 'फरफारक कैफियत (ऐच्छिक)')}
                        </label>
                        <input
                          type="text"
                          value={moveOutRemarks}
                          onChange={(e) => setMoveOutRemarks(e.target.value)}
                          placeholder={t(
                            'e.g. Keys returned & deposit settled',
                            'जस्तै: साँचो बुझियो र हिसाब फरफारक भयो'
                          )}
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
                        {t('Reject Request', 'अस्वीकार गर्नुहोस्')}
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
                          ? t('Processing...', 'प्रक्रियामा...')
                          : t(
                              'Approve, Settle & Vacate',
                              'स्वीकृत गरी हिसाब मिलान र कोठा खाली गर्नुहोस्'
                            )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* UNIT TELEMETRY MATRIX */}
          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t(
                    'Unit Telemetry & Occupancy Matrix',
                    'कोठा सब-मिटर र बसोबास विवरण'
                  )}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    'Click "Edit Meter" on any room card to set or adjust its initial/current sub-meter reading',
                    'कुनै पनि कोठाको सुरुवाती वा हालको सब-मिटर रिडिङ सच्याउन "मिटर सच्याउनुहोस्" मा थिच्नुहोस्'
                  )}
                </p>
              </div>

              <div className="inline-flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                {[
                  {
                    key: 'ALL',
                    label: t(`All Units (${roomsList.length})`, `सबै कोठा (${roomsList.length})`),
                  },
                  {
                    key: 'OCCUPIED',
                    label: t(
                      `Assigned / Occupied (${occupiedRoomsCount})`,
                      `बसोबास भएको (${occupiedRoomsCount})`
                    ),
                  },
                  {
                    key: 'VACANT',
                    label: t(`Vacant (${vacantRoomsCount})`, `खाली कोठा (${vacantRoomsCount})`),
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setRoomMatrixFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition ${
                      roomMatrixFilter === tab.key
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[480px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedRoomsList.map((room) => {
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
                            {t('Room', 'कोठा')} {room.room_number}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              occupied
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {occupied
                              ? t('Occupied', 'बसोबास छ')
                              : t('Vacant', 'खाली छ')}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 mb-2">
                          {occupied && tenant
                            ? tenant.full_name
                            : t('Available', 'उपलब्ध')}
                        </p>
                        <div className="space-y-1.5 text-[11px] text-slate-500 mb-4">
                          <div className="flex items-center justify-between bg-slate-100/80 px-2.5 py-1.5 rounded-xl border border-slate-200/70">
                            <span>
                              {t('Sub-Meter:', 'सब-मिटर:')}{' '}
                              <strong className="text-slate-900">
                                {room.current_meter_reading} {t('units', 'युनिट')}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditMeterModal(room)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 font-extrabold text-[10px] shadow-2xs transition"
                            >
                              <Edit3 className="w-3 h-3" />{' '}
                              {t('Edit Meter', 'मिटर सच्याउनुहोस्')}
                            </button>
                          </div>
                          {occupied && tenant && (
                            <p className="pt-0.5">
                              {t('Next Due:', 'अर्को मिति:')}{' '}
                              <strong>{formatDualDate(tenant.next_due_date)}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                        {occupied && tenant?.tenant_id && (
                          <button
                            type="button"
                            onClick={() => setSelectedUserId(tenant.tenant_id)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                          >
                            {t('Inspect Tenant', 'भाडावाल हेर्नुहोस्')}
                          </button>
                        )}
                        {occupied ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  t(
                                    `Mark Room ${room.room_number} as vacant?`,
                                    `कोठा ${room.room_number} लाई खाली चिन्ह लगाउने हो?`
                                  )
                                )
                              ) {
                                axiosClient.post(`/rooms/${room.id}/vacate/`).then(() => {
                                  refreshAllAdminData();
                                });
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold ml-auto"
                          >
                            {t('Vacate Room', 'कोठा खाली गर्नुहोस्')}
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
                            <UserPlus className="w-3.5 h-3.5" />{' '}
                            {t('Assign Tenant', 'भाडावाल तोक्नुहोस्')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* REMITTANCE & METER AUDIT CLEARING QUEUE */}
          <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                {t('Remittance & Meter Audit Clearing', 'भुक्तानी र सब-मिटर प्रमाणीकरण कक्ष')}
                {pendingQueue.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    {pendingQueue.length} {t('Pending Audit', 'प्रमाणीकरण बाँकी')}
                  </span>
                )}
              </h3>

              <div className="inline-flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                {[
                  {
                    key: 'OPEN',
                    label: t(
                      `Open / Pending (${unpaidOrPendingBills.length})`,
                      `बाँकी / प्रतीक्षामा (${unpaidOrPendingBills.length})`
                    ),
                  },
                  {
                    key: 'APPROVED',
                    label: t(
                      `Approved & Paid (${approvedOrPaidBills.length})`,
                      `स्वीकृत र चुक्ता (${approvedOrPaidBills.length})`
                    ),
                  },
                  {
                    key: 'ALL',
                    label: t(`All (${bills.length})`, `सबै (${bills.length})`),
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setBillQueueFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition ${
                      billQueueFilter === tab.key
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {displayedBillsQueue.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                {t('No bills in this view.', 'यस दृश्यमा कुनै बिल छैन।')}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {displayedBillsQueue.map((b) => {
                    const isSettled = b.status === 'APPROVED' || b.status === 'PAID_CASH';
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBillForAudit(b)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                          activeAuditBill?.id === b.id
                            ? 'border-indigo-600 bg-indigo-50/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900 text-xs truncate pr-2">
                            {t('Room', 'कोठा')} {b.room_number} • {b.tenant_name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                              isSettled
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'PENDING_VERIFICATION'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {td(b.status_display)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {formatDualMonthLabel(b.billing_month_label)} •{' '}
                            {t('Rs.', 'रु.')} {Number(b.total_payable).toLocaleString()}
                          </span>
                          {Number(b.damage_fine_amount || 0) > 0 && !isSettled && (
                            <span className="text-rose-600 font-bold">
                              {t('Fine: Rs.', 'जरिवाना: रु.')}{' '}
                              {Number(b.damage_fine_amount).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeAuditBill && (
                  <div className="lg:col-span-7 rounded-2xl bg-slate-50 border border-slate-200/80 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          {t('Room', 'कोठा')} {activeAuditBill.room_number} —{' '}
                          {activeAuditBill.tenant_name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {t('Cycle:', 'बिलिङ चक्र:')}{' '}
                          {formatDualMonthLabel(activeAuditBill.billing_month_label)}
                          {activeAuditBill.due_date
                            ? ` • ${t('Due:', 'तिर्नुपर्ने:')} ${formatDualDate(
                                activeAuditBill.due_date
                              )}`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-indigo-600 block">
                          {t('Total: Rs.', 'जम्मा: रु.')}{' '}
                          {Number(activeAuditBill.total_payable).toLocaleString()}
                        </span>
                        {!['APPROVED', 'PAID_CASH'].includes(activeAuditBill.status) && (
                          <button
                            type="button"
                            onClick={() => openFineModalForUser(null, activeAuditBill)}
                            className="text-[11px] font-extrabold text-rose-600 hover:underline"
                          >
                            {t('+ Add / Edit Fine', '+ जरिवाना थप्नुहोस् / सच्याउनुहोस्')}
                          </button>
                        )}
                      </div>
                    </div>

                    {Number(activeAuditBill.damage_fine_amount || 0) > 0 && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-extrabold text-rose-800 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            {t('Applied Fine: Rs.', 'लगाइएको जरिवाना: रु.')}{' '}
                            {Number(activeAuditBill.damage_fine_amount).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-2">
                            {activeAuditBill.fine_applied_at && (
                              <span className="text-[10px] text-rose-600 font-semibold">
                                {formatDualDate(activeAuditBill.fine_applied_at)}
                              </span>
                            )}
                            {!['APPROVED', 'PAID_CASH'].includes(activeAuditBill.status) && (
                              <button
                                type="button"
                                onClick={() => handleUndoFine(activeAuditBill.id)}
                                disabled={applyFineMutation.isPending}
                                className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition text-[10px] font-extrabold shadow-xs"
                              >
                                {t('Undo Fine', 'जरिवाना हटाउनुहोस्')}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-rose-700 font-medium">
                          {t('Reason:', 'कारण:')}{' '}
                          {activeAuditBill.damage_fine_reason || 'Rule / damage violation'}
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
                                          title: `${t('Fine Evidence', 'जरिवाना प्रमाण')} #${
                                            i + 1
                                          } — ${t('Room', 'कोठा')} ${activeAuditBill.room_number}`,
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
                          {t('Zone 1: Sub-Meter', 'क्षेत्र १: सब-मिटर फोटो')}
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
                                    title: `${t('Room', 'कोठा')} ${
                                      activeAuditBill.room_number
                                    } — ${t('Meter Photo', 'मिटर फोटो')}`,
                                    subtitle: formatDualMonthLabel(
                                      activeAuditBill.billing_month_label
                                    ),
                                  },
                                ])
                              }
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                              {t('No Meter Photo', 'मिटर फोटो छैन')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                          {t('Zone 2: Payment Receipt', 'क्षेत्र २: भुक्तानी भौचर')}
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
                                    title: `${t('Room', 'कोठा')} ${
                                      activeAuditBill.room_number
                                    } — ${t('Payment Screenshot', 'भुक्तानी भौचर')}`,
                                    subtitle: formatDualMonthLabel(
                                      activeAuditBill.billing_month_label
                                    ),
                                  },
                                ])
                              }
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                              {t('No Payment Slip', 'भुक्तानी भौचर छैन')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {['APPROVED', 'PAID_CASH'].includes(activeAuditBill.status) ? (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {t('Payment Verified & Settled', 'भुक्तानी प्रमाणित र चुक्ता भयो')} (
                          {td(activeAuditBill.status_display)})
                        </span>
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          Ref: {activeAuditBill.transaction_reference || t('Verified', 'प्रमाणित')}
                        </span>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={adminRemarks}
                          onChange={(e) => setAdminRemarks(e.target.value)}
                          placeholder={t('Remarks...', 'कैफियत लेख्नुहोस्...')}
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
                            {t('Reject', 'अस्वीकार गर्नुहोस्')}
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
                            {t('Approve', 'स्वीकृत गर्नुहोस्')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                {t(
                  'Financial Velocity (Bar Chart • AD / BS)',
                  'मासिक आम्दानी र खर्च (बार चार्ट • AD / BS)'
                )}
              </h3>
              <div className="w-full h-72 mt-4">
                {!analyticsLoading && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrendChartData}>
                      <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} />
                      <YAxis stroke="#94A3B8" fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="income"
                        name={t('Income (Rs.)', 'आम्दानी (रु.)')}
                        fill="#4F46E5"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="expenses"
                        name={t('Expenses (Rs.)', 'खर्च (रु.)')}
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
                {t('Utility Outflow (Pie Chart)', 'खर्च विवरण (पाई चार्ट)')}
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
              {t('Record Whole-House Expense', 'घरको कुल खर्च टिपोट गर्नुहोस्')}
            </h3>
            <form
              onSubmit={handleLogExpense}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start mt-4"
            >
              <div>
                <label className="block text-[11px] font-bold mb-1">
                  {t('CATEGORY', 'विधा')}
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border outline-none"
                >
                  <option value="ELECTRICITY_MAIN">
                    {t('Main Electricity (NEA)', 'मुख्य बिजुली बिल (NEA)')}
                  </option>
                  <option value="WATER_SUPPLY">
                    {t('Water Supply / Tanker', 'पानी आपूर्ति / ट्यांकर')}
                  </option>
                  <option value="MAINTENANCE">
                    {t('Plumbing & Repairs', 'मर्मत सम्भार')}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">
                  {t('TITLE', 'खर्च शीर्षक')}
                </label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">
                  {t('AMOUNT', 'रकम (रु.)')}
                </label>
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
                <label className="block text-[11px] font-bold mb-1">
                  {t('DATE (AD / BS)', 'मिति (AD / BS)')}
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border outline-none"
                />
                {expenseDate && (
                  <p className="text-[10px] font-extrabold text-indigo-600 mt-1">
                    📅 {t('BS:', 'बि.सं.:')} {formatBSOnly(expenseDate)}
                  </p>
                )}
              </div>
              <div className="pt-5">
                <button
                  type="submit"
                  disabled={expenseMutation.isPending}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-bold text-xs"
                >
                  {t('Commit Expense', 'खर्च सुरक्षित गर्नुहोस्')}
                </button>
              </div>
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
              <div className="overflow-y-auto flex-1">
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

                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-slate-900/60 backdrop-blur-md text-white text-[11px] font-extrabold border border-white/20">
                      {t('Tenant Inspection Dossier', 'भाडावाल निरीक्षण विवरण')} #{u.id}
                    </span>
                    <div className="flex items-center gap-2">
                      {galleryItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openPhotoLightbox(galleryItems, 0)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-900 text-xs font-extrabold shadow-md transition"
                        >
                          <ZoomIn className="w-3.5 h-3.5 text-indigo-600" />
                          {t('Photo Mode', 'फोटो मोड')} ({galleryItems.length})
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
                            KYC: {td(u.kyc_status)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-indigo-600" /> {u.email}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />{' '}
                            {u.phone_number || t('No Phone', 'फोन छैन')}
                          </span>
                          {u.joined_at && (
                            <span>
                              {t('Joined:', 'आबद्ध मिति:')} {formatDualDate(u.joined_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openFineModalForUser(u, null)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />{' '}
                        {t('+ Apply Fine', '+ जरिवाना लगाउनुहोस्')}
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
                          {t('✓ Verify KYC', '✓ केवाईसी प्रमाणित गर्नुहोस्')}
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
                          {t('Reject KYC', 'केवाईसी अस्वीकार')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. 4-Card Telemetry Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 block">
                        {t('Assigned Room', 'तोकिएको कोठा')}
                      </span>
                      <p className="text-base font-black text-slate-900 mt-1">
                        {u.room_details
                          ? `${t('Room', 'कोठा')} ${u.room_details.room_number}`
                          : u.room_number
                          ? `${t('Room', 'कोठा')} ${u.room_number}`
                          : t('Unassigned', 'तोकिएको छैन')}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {u.room_details
                          ? `${td(u.room_details.floor)} • ${t('Rs.', 'रु.')} ${
                              u.room_details.base_rent
                            }${t('/mo', '/महिना')}`
                          : t('No active unit', 'कुनै सक्रिय कोठा छैन')}
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
                        {t('Pending / Unpaid Bills', 'तिर्न बाँकी बिलहरू')}
                      </span>
                      <p
                        className={`text-base font-black mt-1 ${
                          u.pending_bills_count > 0 ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {t('Rs.', 'रु.')} {Number(u.total_pending_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {u.pending_bills_count > 0
                          ? `${u.pending_bills_count} ${t('open bill(s)', 'बाँकी बिल')}`
                          : t('No pending dues', 'बक्यौता छैन')}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        {t('Total Paid History', 'कुल भुक्तानी इतिहास')}
                      </span>
                      <p className="text-base font-black text-slate-900 mt-1">
                        {t('Rs.', 'रु.')} {Number(u.total_paid_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {u.paid_bills_count || 0} {t('settled invoice(s)', 'चुक्ता बिल')}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        {t('Digital Lease & ID', 'सम्झौता र परिचयपत्र')}
                      </span>
                      <p className="text-base font-black text-slate-900 mt-1 truncate">
                        {u.citizenship_number || t('No ID No.', 'परिचयपत्र नं. छैन')}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                        {u.has_accepted_lease
                          ? `${t('✓ Lease Signed', '✓ हस्ताक्षरित')} (${formatDualDate(
                              u.lease_accepted_at || 'Verified'
                            )})`
                          : t('Lease Pending', 'सम्झौता बाँकी')}
                      </p>
                    </div>
                  </div>

                  {/* 4. Assigned Room Telemetry + Emergency & Legal Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Home className="w-4 h-4 text-indigo-600" />{' '}
                          {t('Room & Utility Telemetry', 'कोठा र सब-मिटर विवरण')}
                        </h4>
                        {u.room_details && (
                          <button
                            type="button"
                            onClick={() => openEditMeterModal(u.room_details)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] shadow-xs transition"
                          >
                            <Edit3 className="w-3 h-3" />{' '}
                            {t('Edit Meter', 'मिटर सच्याउनुहोस्')}
                          </button>
                        )}
                      </div>
                      {u.room_details ? (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <span className="text-slate-400 block">
                              {t('Move-In Date (AD / BS)', 'सरेको मिति (AD / BS)')}
                            </span>
                            <strong>{formatDualDate(u.room_details.entry_date)}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">
                              {t('Next Due Date (AD / BS)', 'अर्को मिति (AD / BS)')}
                            </span>
                            <strong className="text-amber-700">
                              {formatDualDate(u.room_details.next_due_date)}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">
                              {t('Sub-Meter Reading', 'सब-मिटर रिडिङ')}
                            </span>
                            <strong className="text-indigo-600">
                              {u.room_details.current_meter_reading} {t('units', 'युनिट')}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">
                              {t('Utility Rates', 'बिजुली र पानी दर')}
                            </span>
                            <strong>
                              {t('Water Rs.', 'पानी रु.')} {u.room_details.fixed_water_bill} •{' '}
                              {t('Elec Rs.', 'बिजुली रु.')} {u.room_details.electricity_rate}/u
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 py-2">
                          {t(
                            'This user is not currently assigned to an active room.',
                            'यस प्रयोगकर्तालाई हाल कुनै कोठा तोकिएको छैन।'
                          )}
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                      <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />{' '}
                        {t('Legal & Emergency Contact', 'कानुनी र आपतकालीन सम्पर्क')}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-slate-400 block">
                            {t('Legal Full Name', 'पूरा कानुनी नाम')}
                          </span>
                          <strong>{u.full_name_legal || u.full_name}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">
                            {t('Citizenship No.', 'नागरिकता नं.')}
                          </span>
                          <strong>
                            {u.citizenship_number || t('Not submitted', 'पेश छैन')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">
                            {t('Emergency Contact', 'आपतकालीन व्यक्ति')}
                          </span>
                          <strong>
                            {u.emergency_contact_name || t('Not provided', 'उपलब्ध छैन')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">
                            {t('Emergency Phone', 'आपतकालीन फोन')}
                          </span>
                          <strong>
                            {u.emergency_contact_phone || t('Not provided', 'उपलब्ध छैन')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Interactive Photo Gallery */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-indigo-600" />{' '}
                        {t(
                          'Uploaded Identity & Profile Photos (Click Any Photo for Fullscreen View)',
                          'अपलोड गरिएका परिचयपत्र र प्रोफाइल फोटोहरू (पूरा स्क्रिनमा हेर्न थिच्नुहोस्)'
                        )}
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      {[
                        {
                          label: t('Profile Avatar', 'प्रोफाइल फोटो'),
                          url: avatarUrl,
                          key: 'AVATAR',
                        },
                        {
                          label: t('Cover Banner', 'कभर ब्यानर'),
                          url: coverUrl,
                          key: 'COVER',
                        },
                        {
                          label: t('Citizenship Front', 'नागरिकता (अगाडि)'),
                          url: citFrontUrl,
                          key: 'CIT_FRONT',
                        },
                        {
                          label: t('Citizenship Back', 'नागरिकता (पछाडि)'),
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
                                    <ZoomIn className="w-4 h-4" />{' '}
                                    {t('View Photo', 'हेर्नुहोस्')}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[11px] font-bold text-slate-400">
                                  {t('Not Uploaded', 'अपलोड छैन')}
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
                      <FileText className="w-4 h-4 text-indigo-600" />{' '}
                      {t('Billing & Payment Proof History', 'बिल र भुक्तानी प्रमाण इतिहास')} (
                      {userBills.length})
                    </h4>
                    {userBills.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-400">
                        {t('No bills recorded for this user yet.', 'कुनै बिल रेकर्ड छैन।')}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-4">
                                {t('Cycle / Room (AD / BS)', 'चक्र / कोठा (AD / BS)')}
                              </th>
                              <th className="py-3 px-4">
                                {t('Total Payable', 'कुल तिर्नुपर्ने')}
                              </th>
                              <th className="py-3 px-4">{t('Status', 'अवस्था')}</th>
                              <th className="py-3 px-4">
                                {t('Proof Photos', 'प्रमाण फोटोहरू')}
                              </th>
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
                                      {formatDualMonthLabel(b.billing_month_label)}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {t('Room', 'कोठा')} {b.room_number} •{' '}
                                      {t('Due:', 'तिर्नुपर्ने:')} {formatDualDate(b.due_date)}
                                    </p>
                                  </td>
                                  <td className="py-3 px-4">
                                    <p className="font-black text-slate-900">
                                      {t('Rs.', 'रु.')}{' '}
                                      {Number(b.total_payable).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      {b.units_consumed} {t('units elec', 'युनिट बिजुली')}
                                      {Number(b.damage_fine_amount || 0) > 0 && (
                                        <span className="text-rose-600 font-bold ml-1">
                                          • {t('Fine: Rs.', 'जरिवाना: रु.')}{' '}
                                          {b.damage_fine_amount}
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
                                      {td(b.status_display)}
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
                                                title: `${t('Meter Photo', 'मिटर फोटो')} — ${formatDualMonthLabel(
                                                  b.billing_month_label
                                                )}`,
                                                subtitle: `${t('Room', 'कोठा')} ${b.room_number} • ${u.full_name}`,
                                              },
                                            ])
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px]"
                                        >
                                          <Camera className="w-3 h-3" /> {t('Meter', 'मिटर')}
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-slate-400">
                                          {t('No Meter', 'मिटर छैन')}
                                        </span>
                                      )}
                                      {pUrl ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openPhotoLightbox([
                                              {
                                                url: pUrl,
                                                title: `${t('Payment Slip', 'भुक्तानी भौचर')} — ${formatDualMonthLabel(
                                                  b.billing_month_label
                                                )}`,
                                                subtitle: `${t('Room', 'कोठा')} ${b.room_number} • ${t(
                                                  'Rs.',
                                                  'रु.'
                                                )} ${b.total_payable}`,
                                              },
                                            ])
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px]"
                                        >
                                          <CreditCard className="w-3 h-3" />{' '}
                                          {t('Receipt', 'भौचर')}
                                        </button>
                                      ) : (
                                        <span className="text-[11px] text-slate-400">
                                          {t('No Slip', 'भौचर छैन')}
                                        </span>
                                      )}
                                      {fineEvUrls.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openPhotoLightbox(
                                              fineEvUrls.map((ev, i) => ({
                                                url: getSafeMediaUrl(ev),
                                                title: `${t('Fine Evidence', 'जरिवाना प्रमाण')} #${
                                                  i + 1
                                                } — ${formatDualMonthLabel(
                                                  b.billing_month_label
                                                )}`,
                                                subtitle: fullBillObj?.damage_fine_reason,
                                              }))
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px]"
                                        >
                                          <AlertTriangle className="w-3 h-3" />{' '}
                                          {t('Fine Proof', 'जरिवाना फोटो')} ({fineEvUrls.length})
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
                <div className="flex flex-wrap items-center gap-2">
                  {u.room_number && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            t(
                              `Are you sure you want to ask ${u.full_name} to leave Room ${u.room_number}?`,
                              `के तपाईं ${u.full_name} को कोठा ${u.room_number} खाली गराउन चाहनुहुन्छ?`
                            )
                          )
                        ) {
                          evictMutation.mutate({
                            userId: u.id,
                            actionType: 'VACATE',
                          });
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-sm transition"
                    >
                      {t(`Vacate Room ${u.room_number}`, `कोठा ${u.room_number} खाली गराउनुहोस्`)}
                    </button>
                  )}
                  {u.role !== 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => setUserToDelete(u)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-sm transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />{' '}
                      {t('Delete Tenant & All Data', 'भाडावाल र सम्पूर्ण डाटा मेटाउनुहोस्')}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition ml-auto"
                >
                  {t('Close Dossier', 'विवरण बन्द गर्नुहोस्')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 2: FULLSCREEN PHOTO LIGHTBOX MODAL                                  */}
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
                  <Download className="w-3.5 h-3.5" /> {t('Download', 'डाउनलोड')}
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
                    {t('Official Payment QR Setup', 'आधिकारिक भुक्तानी QR सेटअप')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t(
                      'Upload or update the QR code shown to all tenants',
                      'सबै भाडावाललाई देखाइने QR कोड अपलोड वा अपडेट गर्नुहोस्'
                    )}
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
                            <Download className="w-3.5 h-3.5" />{' '}
                            {t('Download Current QR', 'हालको QR डाउनलोड')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  t(
                                    'Remove current Payment QR code?',
                                    'हालको भुक्तानी QR हटाउने हो?'
                                  )
                                )
                              ) {
                                deleteQRMutation.mutate();
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-extrabold transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> {t('Remove', 'हटाउनुहोस्')}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {t(
                      'No QR code image uploaded yet. Select an image below.',
                      'अहिलेसम्म कुनै QR फोटो अपलोड गरिएको छैन।'
                    )}
                  </div>
                )}

                <label className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-extrabold cursor-pointer transition border border-indigo-200">
                  <Upload className="w-4 h-4" />
                  <span>
                    {paymentQR?.qr_image_url || qrImagePreview
                      ? t('Choose New QR Image to Replace', 'नयाँ QR फोटो छान्नुहोस्')
                      : t('Upload QR Code Image', 'QR कोड फोटो अपलोड गर्नुहोस्')}
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
                  {t('Merchant / Account Title', 'खाता / मर्चेन्टको नाम')}
                </label>
                <input
                  type="text"
                  required
                  value={qrMerchantName}
                  onChange={(e) => setQrMerchantName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                  {t('Payment Instructions for Tenants', 'भाडावालका लागि भुक्तानी निर्देशन')}
                </label>
                <textarea
                  rows={2}
                  value={qrPaymentNote}
                  onChange={(e) => setQrPaymentNote(e.target.value)}
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
                  {t('Cancel', 'रद्द गर्नुहोस्')}
                </button>
                <button
                  type="submit"
                  disabled={updateQRMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-md transition"
                >
                  {updateQRMutation.isPending
                    ? t('Saving QR...', 'सुरक्षित हुँदैछ...')
                    : t('Save & Publish QR', 'QR सुरक्षित र प्रकाशन गर्नुहोस्')}
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
                    {resetStep === 1
                      ? t('Danger Confirmation (1 of 2)', 'पहिलो चेतावनी (१/२)')
                      : t('Final Irreversible Warning (2 of 2)', 'अन्तिम चेतावनी (२/२)')}
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    {t('Factory Reset SmartRent Database', 'स्मार्टरेन्ट डाटाबेस रिसेट')}
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
                    {t(
                      'Are you sure you want to reset the entire system to brand new?',
                      'के तपाईं सम्पूर्ण प्रणालीलाई नयाँ अवस्थामा रिसेट गर्न चाहनुहुन्छ?'
                    )}
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-800">
                    <li>
                      {t(
                        'Deletes all Tenant accounts and their KYC documents.',
                        'सबै भाडावाल खाता र केवाईसी कागजात मेटिनेछन्।'
                      )}
                    </li>
                    <li>
                      {t(
                        'Deletes all Monthly Bills, Expenses, Reservations, and Tenancies.',
                        'सबै बिल, खर्च, बुकिङ र बसाइँ विवरण मेटिनेछन्।'
                      )}
                    </li>
                    <li>
                      {t(
                        'Deletes all Chat Messages, Maintenance Tickets, and Notices.',
                        'सबै च्याट सन्देश, मर्मत टिकट र सूचना मेटिनेछन्।'
                      )}
                    </li>
                    <li>
                      {t(
                        'Resets all Rooms to Vacant with 0.00 meter reading.',
                        'सबै कोठा खाली र ०.०० मिटर रिडिङमा रिसेट हुनेछन्।'
                      )}
                    </li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    <strong>{t('Safe Protected:', 'सुरक्षित:')}</strong>{' '}
                    {t(
                      'Your logged-in Landlord Admin account and room structure will NOT be deleted.',
                      'तपाईंको एडमिन खाता र कोठाहरूको संरचना मेटिने छैन।'
                    )}
                  </span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep(0)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    {t('Cancel', 'रद्द गर्नुहोस्')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep(2)}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md transition"
                  >
                    {t('Yes, Proceed to Final Step →', 'अन्तिम चरणमा जानुहोस् →')}
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
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}
                    {t('SECOND & FINAL CONFIRMATION', 'दोस्रो तथा अन्तिम पुष्टि')}
                  </p>
                  <p className="text-[11px] text-rose-100 leading-relaxed">
                    {t(
                      'This action cannot be undone. Every tenant, bill, and chat will be permanently erased.',
                      'यो कार्य फिर्ता गर्न सकिँदैन। सबै भाडावाल, बिल र च्याट स्थायी रूपमा मेटिनेछन्।'
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1.5">
                    {t('Type ', 'तल ')}{' '}
                    <span className="text-rose-600 font-black">RESET</span>{' '}
                    {t('below to unlock final wipe:', 'लेखेर पुष्टि गर्नुहोस्:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
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
                    {t('Cancel & Keep Data', 'रद्द गर्नुहोस्')}
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
                      ? t('Wiping Database...', 'रिसेट हुँदैछ...')
                      : t('🔥 Wipe & Reset Database Now', '🔥 डाटाबेस रिसेट गर्नुहोस्')}
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
              <h3 className="text-base font-extrabold text-slate-900">
                {t('Create New Administrator', 'नयाँ एडमिन खाता बनाउनुहोस्')}
              </h3>
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
                  {t('Full Name', 'पूरा नाम')}
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
                  {t('Email Address', 'इमेल ठेगाना')}
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
                  {t('Phone Number', 'मोबाइल नम्बर')}
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
                  {t('Secure Password', 'सुरक्षित पासवर्ड')}
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
                  {t('Cancel', 'रद्द गर्नुहोस्')}
                </button>
                <button
                  type="submit"
                  disabled={manageAdminMutation.isPending}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md"
                >
                  {manageAdminMutation.isPending
                    ? t('Creating...', 'बनाउँदै...')
                    : t('Create Admin', 'एडमिन बनाउनुहोस्')}
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
            <h3 className="text-lg font-bold mb-4">
              {t('Assign Room', 'कोठा तोक्नुहोस्')} {assignModalRoom.room_number}
            </h3>
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
                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
              >
                <option value="">{t('Choose User', 'भाडावाल छान्नुहोस्')}</option>
                {tenantUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  {t('Move-In Date (AD)', 'सरेको मिति (AD)')}
                </label>
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs"
                />
                {entryDate && (
                  <p className="text-[11px] font-extrabold text-indigo-600 mt-1">
                    📅 {t('Nepali Date (BS):', 'नेपाली मिति (बि.सं.):')}{' '}
                    {formatBSOnly(entryDate)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  {t('Starting Sub-Meter Reading', 'सुरुवाती सब-मिटर रिडिङ')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={startingMeter}
                  onChange={(e) => setStartingMeter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalRoom(null)}
                  className="flex-1 py-2 border rounded-xl text-xs font-bold"
                >
                  {t('Cancel', 'रद्द गर्नुहोस्')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  {t('Confirm', 'पक्का गर्नुहोस्')}
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
            <h3 className="text-lg font-bold mb-4">
              {t('Record Cash Payment', 'नगद भुक्तानी रेकर्ड गर्नुहोस्')}
            </h3>
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
                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
              >
                <option value="">{t('Choose Bill', 'बिल छान्नुहोस्')}</option>
                {selectableBillsForDropdown.map((b) => (
                  <option key={b.id} value={b.id}>
                    {t('Room', 'कोठा')} {b.room_number} — {b.tenant_name} (
                    {formatDualMonthLabel(b.billing_month_label)}) • {t('Rs.', 'रु.')}{' '}
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
                placeholder={t('New Meter Reading', 'नयाँ मिटर रिडिङ')}
                className="w-full px-3 py-2 border rounded-xl text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="flex-1 py-2 border rounded-xl text-xs font-bold"
                >
                  {t('Cancel', 'रद्द गर्नुहोस्')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  {t('Confirm', 'पक्का गर्नुहोस्')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: UPGRADED APPLY FINE MODAL                                        */}
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
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {t(
                      'Apply Property Damage / Rule Violation Fine',
                      'सम्पत्ति क्षति / नियम उल्लंघन जरिवाना लगाउनुहोस्'
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t(
                      'Select a tenant or bill, attach evidence photos, and send an automated email notice',
                      'भाडावाल वा बिल छान्नुहोस्, प्रमाण फोटो राख्नुहोस् र इमेल सूचना पठाउनुहोस्'
                    )}
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
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  {t('1. Select Tenant / Registered User *', '१. भाडावाल छान्नुहोस् *')}
                </label>
                <select
                  value={fineTenantId}
                  onChange={(e) => handleSelectFineTenant(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none transition"
                >
                  <option value="">
                    {t(
                      `-- Choose Tenant / User (${tenantUsers.length} Registered) --`,
                      `-- भाडावाल छान्नुहोस् (${tenantUsers.length} दर्ता) --`
                    )}
                  </option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email}){' '}
                      {u.room_number
                        ? `• ${t('Room', 'कोठा')} ${u.room_number}`
                        : `• ${t('No Room Assigned', 'कोठा तोकिएको छैन')}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                    {t('2. Choose Bill (AD / BS)', '२. बिल छान्नुहोस् (AD / BS)')}
                  </label>
                  {fineTenantId && filteredBillsForFine.length === 0 && (
                    <span className="text-[10px] font-extrabold text-emerald-600">
                      {t(
                        '✨ New invoice will be auto-created',
                        '✨ नयाँ बिल स्वतः तयार हुनेछ'
                      )}
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
                      ? t(
                          'Auto-Create Fresh Invoice for Selected Tenant',
                          'छानिएको भाडावालका लागि नयाँ बिल स्वतः बनाउनुहोस्'
                        )
                      : t(
                          '-- Choose Existing Bill (or leave blank to auto-select) --',
                          '-- भइरहेको बिल छान्नुहोस् (वा स्वतः छान्न खाली छोड्नुहोस्) --'
                        )}
                  </option>
                  {filteredBillsForFine.map((b) => (
                    <option key={b.id} value={b.id}>
                      {t('Room', 'कोठा')} {b.room_number} — {b.tenant_name || 'Tenant'} (
                      {formatDualMonthLabel(b.billing_month_label)}) • {t('Rs.', 'रु.')}{' '}
                      {Number(b.total_payable || 0).toLocaleString()} [{td(b.status_display)}]
                    </option>
                  ))}
                </select>
              </div>

              {(selectedFineTenantObj || selectedFineBillObj) && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-extrabold text-slate-900">
                      {selectedFineTenantObj?.full_name || selectedFineBillObj?.tenant_name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedFineTenantObj?.email || ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedFineBillObj && Number(selectedFineBillObj.damage_fine_amount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => handleUndoFine(selectedFineBillObj.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] shadow-xs transition"
                      >
                        {t('Undo Current Fine', 'हालको जरिवाना हटाउनुहोस्')} ({t('Rs.', 'रु.')}{' '}
                        {selectedFineBillObj.damage_fine_amount})
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                    {t('3. Fine Amount (NPR) *', '३. जरिवाना रकम (रु.) *')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-3.5 py-2.5 text-sm font-black text-rose-600 rounded-xl border border-slate-200 outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                    {t('Calculation Mode', 'गणना मोड')}
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
                      {t('Set Exact Fine', 'निश्चित रकम राख्ने')}
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
                      {t('+ Add to Fine', '+ पुरानोमा थप्ने')}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  {t(
                    '4. Violation / Damage Reason (Included in Email) *',
                    '४. जरिवानाको कारण (इमेलमा पठाइनेछ) *'
                  )}
                </label>
                <textarea
                  rows={2}
                  required
                  value={fineReason}
                  onChange={(e) => setFineReason(e.target.value)}
                  placeholder={t(
                    'Describe the damage, dirt, broken item, or rule violation...',
                    'क्षति, फोहोर वा नियम उल्लंघनको कारण लेख्नुहोस्...'
                  )}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-rose-500 resize-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {FINE_REASON_PRESETS.map((preset, idx) => {
                    const label = isNepali ? preset.ne : preset.en;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFineReason(label)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[10px] font-bold transition"
                      >
                        + {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  {t(
                    '5. Attach Evidence Photos (Optional • Up to 5 MB each)',
                    '५. प्रमाण फोटोहरू जोड्नुहोस् (ऐच्छिक • ५ MB सम्म)'
                  )}
                </label>
                <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-rose-200 hover:border-rose-500 bg-rose-50/30 cursor-pointer transition text-center">
                  <ImagePlus className="w-6 h-6 text-rose-500 mb-1" />
                  <span className="text-xs font-extrabold text-slate-800">
                    {t(
                      'Upload Photos of Damage, Dirt, or Broken Items',
                      'क्षति, फोहोर वा फुटेका सामानको फोटो अपलोड गर्नुहोस्'
                    )}
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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFineModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  {t('Cancel', 'रद्द गर्नुहोस्')}
                </button>
                <button
                  type="submit"
                  disabled={applyFineMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-rose-600/20 transition inline-flex items-center justify-center gap-1.5"
                >
                  {applyFineMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Applying & Emailing...', 'लागू हुँदैछ...')}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      {t('Apply Fine & Notify Tenant', 'जरिवाना लगाई जानकारी पठाउनुहोस्')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: PERMANENT TENANT & DATA DELETION CONFIRMATION MODAL              */}
      {/* ========================================================================= */}
      {userToDelete && (
        <div
          onClick={() => setUserToDelete(null)}
          className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border-2 border-rose-200 space-y-5"
          >
            <div className="flex items-start justify-between gap-3 border-b border-rose-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 block">
                    {t('Permanent Removal', 'स्थायी रूपमा हटाउने')}
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    {t('Delete Tenant & All Data?', 'भाडावाल र सम्पूर्ण डाटा मेटाउने हो?')}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="font-extrabold text-slate-900 text-sm">{userToDelete.full_name}</p>
              <p className="text-slate-500">{userToDelete.email}</p>
              {userToDelete.phone_number && (
                <p className="text-slate-500">📞 {userToDelete.phone_number}</p>
              )}
              <p className="pt-1 font-bold text-indigo-600">
                {userToDelete.room_number
                  ? t(
                      `Currently Assigned: Room ${userToDelete.room_number} (Will be marked Vacant)`,
                      `हाल तोकिएको: कोठा ${userToDelete.room_number} (स्वतः खाली हुनेछ)`
                    )
                  : t('No Active Room Assigned', 'कुनै सक्रिय कोठा तोकिएको छैन')}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1">
              <p className="font-extrabold text-rose-700">
                {t(
                  'This will permanently erase from the database:',
                  'यसले डाटाबेसबाट स्थायी रूपमा मेटाउनेछ:'
                )}
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                <li>
                  {t(
                    'Tenant login account, profile avatar & cover banner',
                    'भाडावालको लगइन खाता र प्रोफाइल/कभर फोटो'
                  )}
                </li>
                <li>
                  {t(
                    'KYC citizenship photos & digital lease records',
                    'केवाईसी नागरिकता फोटो र भाडा सम्झौता'
                  )}
                </li>
                <li>
                  {t(
                    'All monthly bills, receipts, reservations & move-out requests',
                    'सबै मासिक बिल, रसिद, बुकिङ र कोठा छोड्ने अनुरोध'
                  )}
                </li>
                <li>
                  {t(
                    'All chat messages & maintenance tickets',
                    'सबै च्याट सन्देश र मर्मत टिकटहरू'
                  )}
                </li>
              </ul>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition"
              >
                {t('Cancel', 'रद्द गर्नुहोस्')}
              </button>
              <button
                type="button"
                disabled={evictMutation.isPending}
                onClick={() =>
                  evictMutation.mutate({
                    userId: userToDelete.id,
                    actionType: 'DELETE',
                  })
                }
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-rose-600/20 transition inline-flex items-center justify-center gap-1.5"
              >
                {evictMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('Deleting...', 'मेटिँदैछ...')}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t('Yes, Delete Tenant', 'हो, भाडावाल मेटाउनुहोस्')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 10: EDIT ROOM INITIAL / CURRENT SUB-METER READING MODAL             */}
      {/* ========================================================================= */}
      {editMeterRoom && (
        <div
          onClick={() => setEditMeterRoom(null)}
          className="fixed inset-0 z-[58] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">
                    {t('Sub-Meter Calibration', 'सब-मिटर रिडिङ समायोजन')}
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    {t(
                      `Edit Room ${editMeterRoom.room_number} Sub-Meter`,
                      `कोठा ${editMeterRoom.room_number} को सब-मिटर सच्याउनुहोस्`
                    )}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditMeterRoom(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">
                  {t('Room Status:', 'कोठाको अवस्था:')}
                </span>
                <span className="font-extrabold text-slate-900">
                  {editMeterRoom.is_occupied
                    ? `${t('Occupied', 'बसोबास छ')} (${
                        editMeterRoom.active_tenancy?.full_name || t('Active Tenant', 'सक्रिय भाडावाल')
                      })`
                    : t('Vacant / Available', 'खाली / उपलब्ध')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">
                  {t('Previous Saved Reading:', 'अघिल्लो सुरक्षित रिडिङ:')}
                </span>
                <strong className="text-indigo-600">
                  {editMeterRoom.current_meter_reading ?? 0} {t('units', 'युनिट')}
                </strong>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRoomMeterMutation.mutate({
                  roomId: editMeterRoom.id,
                  newMeter: editMeterValue,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  {t(
                    'New Initial / Current Sub-Meter Reading (kWh Units) *',
                    'नयाँ सुरुवाती / हालको सब-मिटर रिडिङ (युनिट) *'
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editMeterValue}
                  onChange={(e) => setEditMeterValue(e.target.value)}
                  placeholder="e.g. 1250.00"
                  className="w-full px-4 py-3 text-lg font-black text-slate-900 rounded-xl border-2 border-indigo-200 focus:border-indigo-600 outline-none transition"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  {t(
                    `Saving this updates Room ${editMeterRoom.room_number}'s sub-meter baseline and automatically syncs any open/unpaid bill's previous reading on the tenant dashboard.`,
                    `यो सुरक्षित गर्दा कोठा ${editMeterRoom.room_number} को सब-मिटर रिडिङ अपडेट हुन्छ र भाडावालको खुला बिलमा अघिल्लो रिडिङ स्वतः सिंक हुन्छ।`
                  )}
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditMeterRoom(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition"
                >
                  {t('Cancel', 'रद्द गर्नुहोस्')}
                </button>
                <button
                  type="submit"
                  disabled={updateRoomMeterMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/20 transition inline-flex items-center justify-center gap-1.5"
                >
                  {updateRoomMeterMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Saving...', 'सुरक्षित हुँदैछ...')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {t('Save Meter Reading', 'मिटर रिडिङ सुरक्षित गर्नुहोस्')}
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
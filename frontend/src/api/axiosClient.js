import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
});

const asArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartrent_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('smartrent_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/accounts/token/refresh/`, {
            refresh: refreshToken,
          });
          const newAccess = res.data.access;
          localStorage.setItem('smartrent_access_token', newAccess);
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return axiosClient(originalRequest);
        } catch (refreshErr) {
          localStorage.removeItem('smartrent_access_token');
          localStorage.removeItem('smartrent_refresh_token');
          localStorage.removeItem('smartrent_user');
        }
      }
    }
    return Promise.reject(error);
  }
);

// --- PAYMENT QR CODE HELPERS ---
export const fetchPaymentQRConfig = async () => {
  try {
    const res = await axiosClient.get('/billing/payment-qr/');
    return res.data;
  } catch {
    return {
      qr_image_url: null,
      merchant_name: 'SmartRent Official QR',
      payment_note: '',
    };
  }
};

export const updatePaymentQRConfig = async (formData) => {
  const res = await axiosClient.post('/billing/payment-qr/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deletePaymentQRConfig = async () => {
  const res = await axiosClient.delete('/billing/payment-qr/');
  return res.data;
};

export const downloadFileFromUrl = async (fileUrl, defaultFileName = 'SmartRent-Payment-QR.png') => {
  if (!fileUrl) return;
  try {
    const response = await fetch(fileUrl, { mode: 'cors' });
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = defaultFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback if CORS blocks blob fetch
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  }
};

// --- ROOM RESERVATION API HELPERS ---
export const fetchReservations = async () => {
  try {
    const res = await axiosClient.get('/rooms/reservations/');
    return asArray(res.data);
  } catch {
    return [];
  }
};

export const createReservation = async (formData) => {
  const res = await axiosClient.post('/rooms/reservations/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const processReservationAction = async (reservationId, actionPayload) => {
  const res = await axiosClient.post(`/rooms/reservations/${reservationId}/action/`, actionPayload);
  return res.data;
};

// --- TENANT KYC & DIGITAL LEASE API HELPERS ---
export const fetchKYCProfile = async () => {
  try {
    const res = await axiosClient.get('/accounts/kyc/');
    return res.data;
  } catch {
    return null;
  }
};

export const updateKYCProfile = async (formData) => {
  const res = await axiosClient.put('/accounts/kyc/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const acceptDigitalLease = async () => {
  const res = await axiosClient.post('/accounts/kyc/accept-lease/');
  return res.data;
};

export const fetchAdminKYCList = async () => {
  try {
    const res = await axiosClient.get('/accounts/kyc/admin-list/');
    return asArray(res.data);
  } catch {
    return [];
  }
};

export const auditKYC = async (id, action, notes) => {
  const res = await axiosClient.post(`/accounts/kyc/${id}/audit/`, {
    action,
    admin_notes: notes,
  });
  return res.data;
};

// --- ADMIN USER, ADMIN TEAM & SYSTEM RESET HELPERS ---
export const fetchAdminUsersManagement = async () => {
  try {
    const res = await axiosClient.get('/accounts/admin/users-management/');
    return asArray(res.data);
  } catch {
    return [];
  }
};

export const adminEvictOrManageUser = async (userId, payload) => {
  const res = await axiosClient.post(`/accounts/admin/users/${userId}/manage/`, payload);
  return res.data;
};

export const manageAdminRole = async (payload) => {
  const res = await axiosClient.post('/accounts/admin/manage-admins/', payload);
  return res.data;
};

export const resetSmartRentDatabase = async (confirmPhrase) => {
  const res = await axiosClient.post('/accounts/admin/reset-database/', {
    confirm_phrase: confirmPhrase,
  });
  return res.data;
};

// --- CHAT CONVERSATION DELETE HELPER ---
export const deleteEntireChat = async (otherUserId) => {
  const res = await axiosClient.delete(`/communication/messages/${otherUserId}/delete/`);
  return res.data;
};

// --- BILLING & SUB-METER HELPERS ---
export const triggerBulkGenerateBills = async () => {
  const res = await axiosClient.post('/billing/bulk-generate/');
  return res.data;
};

// --- ITEM A: NOTICE BOARD HELPERS ---
export const fetchNotices = async () => {
  try {
    const res = await axiosClient.get('/communication/notices/');
    return asArray(res.data);
  } catch {
    return [];
  }
};

export const createNotice = async (payload) => {
  const res = await axiosClient.post('/communication/notices/', payload);
  return res.data;
};

export const deleteNotice = async (id) => {
  const res = await axiosClient.delete(`/communication/notices/${id}/`);
  return res.data;
};

// --- ITEM B: MOVE-OUT & SETTLEMENT HELPERS ---
export const fetchMoveOutStatus = async () => {
  try {
    const res = await axiosClient.get('/rooms/move-out/status/');
    return res.data;
  } catch {
    return { has_active_request: false, request: null };
  }
};

export const requestMoveOut = async (payload) => {
  const res = await axiosClient.post('/rooms/move-out/request/', payload);
  return res.data;
};

export const fetchPendingMoveOuts = async () => {
  try {
    const res = await axiosClient.get('/rooms/move-out/pending/');
    return asArray(res.data);
  } catch {
    return [];
  }
};

export const processMoveOutRequest = async (id, payload) => {
  const res = await axiosClient.post(`/rooms/move-out/${id}/process/`, payload);
  return res.data;
};

export default axiosClient;
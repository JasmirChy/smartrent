import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
});

// Helper to always extract an array safely even if DRF pagination is enabled
const asArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

// Automatically attach JWT Access Token to every request
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

// Automatically refresh token if 401 Unauthorized occurs
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
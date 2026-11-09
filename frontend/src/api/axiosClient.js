import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
});

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
  const res = await axiosClient.get('/rooms/reservations/');
  return res.data;
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

export default axiosClient;
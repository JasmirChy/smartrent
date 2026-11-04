import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('smartrent_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('LOGIN'); // LOGIN | SIGNUP | OTP | RESET_PASSWORD

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('smartrent_access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await axiosClient.get('/accounts/me/');
      setUser(res.data);
      localStorage.setItem('smartrent_user', JSON.stringify(res.data));
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const saveSession = (tokens, userData) => {
    localStorage.setItem('smartrent_access_token', tokens.access);
    localStorage.setItem('smartrent_refresh_token', tokens.refresh);
    localStorage.setItem('smartrent_user', JSON.stringify(userData));
    setUser(userData);
    setAuthModalOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('smartrent_access_token');
    localStorage.removeItem('smartrent_refresh_token');
    localStorage.removeItem('smartrent_user');
    setUser(null);
  };

  const openAuthModal = (mode = 'LOGIN') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin: user?.role === 'ADMIN',
        loading,
        saveSession,
        refreshProfile,
        logout,
        authModalOpen,
        setAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        openAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
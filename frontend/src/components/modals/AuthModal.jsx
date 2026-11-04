import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Phone, Camera, KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    saveSession,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: Request OTP, 2: Enter OTP & New Password

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setError('');
    setSuccessMsg('');
  }, [authModalMode, authModalOpen]);

  if (!authModalOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePic(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await axiosClient.post('/accounts/login/', { email, password });
      saveSession(res.data.tokens, res.data.user);
    } catch (err) {
      if (err.response?.data?.requires_otp) {
        setSuccessMsg(err.response.data.error);
        setAuthModalMode('OTP');
      } else {
        setError(
          err.response?.data?.non_field_errors?.[0] ||
            err.response?.data?.error ||
            'Invalid email or password.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('full_name', fullName);
      formData.append('phone_number', phoneNumber);
      formData.append('password', password);
      if (profilePic) {
        formData.append('profile_picture', profilePic);
      }

      const res = await axiosClient.post('/accounts/signup/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg(res.data.message);
      setAuthModalMode('OTP');
    } catch (err) {
      const data = err.response?.data;
      const firstErr =
        data?.email?.[0] ||
        data?.phone_number?.[0] ||
        data?.password?.[0] ||
        data?.error ||
        'Signup failed. Please check your details.';
      setError(firstErr);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await axiosClient.post('/accounts/verify-otp/', {
        email,
        otp_code: otpCode,
        purpose: 'SIGNUP',
      });
      saveSession(res.data.tokens, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestResetOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await axiosClient.post('/accounts/password/request-otp/', { email });
      setSuccessMsg(res.data.message);
      setResetStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send OTP to this email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmResetOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await axiosClient.post('/accounts/password/confirm-otp/', {
        email,
        otp_code: otpCode,
        new_password: newPassword,
      });
      setSuccessMsg(res.data.message);
      setResetStep(1);
      setTimeout(() => setAuthModalMode('LOGIN'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    try {
      const res = await axiosClient.post('/accounts/resend-otp/', {
        email,
        purpose: authModalMode === 'RESET_PASSWORD' ? 'PASSWORD_RESET' : 'SIGNUP',
      });
      setSuccessMsg(res.data.message);
    } catch (err) {
      setError('Failed to resend OTP.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold mb-2">
            SmartRent Portal
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {authModalMode === 'LOGIN' && 'Welcome Back'}
            {authModalMode === 'SIGNUP' && 'Create Tenant Account'}
            {authModalMode === 'OTP' && 'Verify Email OTP'}
            {authModalMode === 'RESET_PASSWORD' && 'Change Password via OTP'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {authModalMode === 'LOGIN' && 'Sign in to view your room telemetry, bills, and chat.'}
            {authModalMode === 'SIGNUP' && 'Register with your email, phone number & profile photo.'}
            {authModalMode === 'OTP' && `Enter the 6-digit verification code sent to ${email}`}
            {authModalMode === 'RESET_PASSWORD' && 'Secure email OTP validation to update your password.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-medium text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {authModalMode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">EMAIL ADDRESS</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">PASSWORD</label>
                <button
                  type="button"
                  onClick={() => {
                    setResetStep(1);
                    setAuthModalMode('RESET_PASSWORD');
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Forgot / Change Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In to SmartRent
            </button>

            <p className="text-center text-xs text-slate-500 pt-2">
              New tenant at the house?{' '}
              <button
                type="button"
                onClick={() => setAuthModalMode('SIGNUP')}
                className="font-semibold text-indigo-600 hover:underline"
              >
                Create an account
              </button>
            </p>
          </form>
        )}

        {/* SIGNUP FORM */}
        {authModalMode === 'SIGNUP' && (
          <form onSubmit={handleSignup} className="space-y-3.5">
            {/* Profile Image Upload */}
            <div className="flex items-center gap-4 pb-1">
              <label className="relative cursor-pointer group">
                <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden group-hover:border-indigo-600 transition">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              <div>
                <p className="text-xs font-semibold text-slate-800">Profile Picture</p>
                <p className="text-[11px] text-slate-500">Tap circle to upload your photo (JPG/PNG)</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">FULL NAME</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">EMAIL ADDRESS (For OTP)</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aarav@example.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">MOBILE NUMBER</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="98XXXXXXXX"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PASSWORD</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign Up & Send Email OTP
            </button>

            <p className="text-center text-xs text-slate-500 pt-1">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthModalMode('LOGIN')}
                className="font-semibold text-indigo-600 hover:underline"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {/* EMAIL OTP VERIFICATION FORM */}
        {authModalMode === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">6-DIGIT EMAIL OTP</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-2.5 text-center tracking-[0.4em] font-bold text-lg rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || otpCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-lg shadow-emerald-600/25 transition disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify OTP & Continue
            </button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={handleResendOtp}
                className="font-semibold text-indigo-600 hover:underline"
              >
                Resend OTP to Email
              </button>
              <button
                type="button"
                onClick={() => setAuthModalMode('LOGIN')}
                className="text-slate-500 hover:text-slate-700"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

        {/* PASSWORD RESET / CHANGE WITH EMAIL OTP */}
        {authModalMode === 'RESET_PASSWORD' && (
          <div>
            {resetStep === 1 ? (
              <form onSubmit={handleRequestResetOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">YOUR REGISTERED EMAIL</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send 6-Digit OTP to Email
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmResetOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">6-DIGIT EMAIL OTP</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-4 py-2.5 text-center tracking-[0.3em] font-bold rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NEW PASSWORD</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-600 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verify OTP & Update Password
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => setAuthModalMode('LOGIN')}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-700 mt-4"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
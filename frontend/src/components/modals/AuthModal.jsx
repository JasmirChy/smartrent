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

  // Password Reset / Change OTP States
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

  // Direct Login (No OTP)
  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await axiosClient.post('/accounts/login/', { email, password });
      saveSession(res.data.tokens, res.data.user);
    } catch (err) {
      setError(
        err.response?.data?.non_field_errors?.[0] ||
          err.response?.data?.error ||
          'Invalid email or password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Direct Signup (No OTP - logs user in immediately)
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
      saveSession(res.data.tokens, res.data.user);
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

  // Step 1 of Password Change/Reset: Request Email OTP
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

  // Step 2 of Password Change/Reset: Verify OTP & Save New Password
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
      setOtpCode('');
      setNewPassword('');
      setTimeout(() => setAuthModalMode('LOGIN'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-4 py-2.5 text-sm rounded-xl !bg-white !text-slate-900 placeholder:text-slate-400 border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none shadow-2xs transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 text-slate-900">
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
          <h2 className="text-2xl font-extrabold text-slate-900">
            {authModalMode === 'LOGIN' && 'Welcome Back'}
            {authModalMode === 'SIGNUP' && 'Create Tenant Account'}
            {authModalMode === 'RESET_PASSWORD' && 'Reset / Change Password'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {authModalMode === 'LOGIN' && 'Sign in directly with your email and password.'}
            {authModalMode === 'SIGNUP' && 'Register with your email, phone number & profile photo.'}
            {authModalMode === 'RESET_PASSWORD' && 'We will send a 6-digit OTP to your email to change your password.'}
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

        {/* LOGIN FORM (NO OTP) */}
        {authModalMode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Password
                </label>
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
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In to SmartRent
            </button>

            <p className="text-center text-xs text-slate-500 pt-2">
              New tenant at the house?{' '}
              <button
                type="button"
                onClick={() => setAuthModalMode('SIGNUP')}
                className="font-bold text-indigo-600 hover:underline"
              >
                Create an account
              </button>
            </p>
          </form>
        )}

        {/* SIGNUP FORM (NO OTP) */}
        {authModalMode === 'SIGNUP' && (
          <form onSubmit={handleSignup} className="space-y-3.5">
            <div className="flex items-center gap-4 pb-1">
              <label className="relative cursor-pointer group">
                <div className="w-16 h-16 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden group-hover:border-indigo-600 transition">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              <div>
                <p className="text-xs font-bold text-slate-800">Profile Picture</p>
                <p className="text-[11px] text-slate-500">Tap circle to upload your photo (JPG/PNG)</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="98XXXXXXXX"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account & Sign In
            </button>

            <p className="text-center text-xs text-slate-500 pt-1">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthModalMode('LOGIN')}
                className="font-bold text-indigo-600 hover:underline"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {/* PASSWORD RESET / CHANGE WITH EMAIL OTP (ONLY PLACE WITH OTP) */}
        {authModalMode === 'RESET_PASSWORD' && (
          <div>
            {resetStep === 1 ? (
              <form onSubmit={handleRequestResetOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Your Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send 6-Digit OTP to Email
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmResetOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    6-Digit Email OTP
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full pl-10 pr-4 py-2.5 text-center tracking-[0.35em] font-extrabold text-base rounded-xl !bg-white !text-slate-900 border border-slate-300 focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className={inputClass}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verify OTP & Update Password
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => setAuthModalMode('LOGIN')}
              className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 mt-4"
            >
              ← Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
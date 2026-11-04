import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Phone, Mail, Camera, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function ProfileSettings() {
  const { user, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [profilePic, setProfilePic] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.profile_picture_url || null);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Password Change via Email OTP States
  const [resetStep, setResetStep] = useState(1); // 1: Request OTP, 2: Confirm OTP & New Password
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('full_name', fullName);
      formData.append('phone_number', phoneNumber);
      if (profilePic) {
        formData.append('profile_picture', profilePic);
      }

      await axiosClient.patch('/accounts/me/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshProfile();
      setSuccessMsg('Profile updated successfully!');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPasswordOtp = async () => {
    setPwdMsg('');
    try {
      await axiosClient.post('/accounts/password/request-otp/', { email: user.email });
      setPwdMsg('6-digit password verification OTP sent to your email.');
      setResetStep(2);
    } catch (err) {
      setPwdMsg('Failed to send OTP.');
    }
  };

  const handleConfirmPasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    try {
      const res = await axiosClient.post('/accounts/password/confirm-otp/', {
        email: user.email,
        otp_code: otpCode,
        new_password: newPassword,
      });
      setPwdMsg(res.data.message);
      setResetStep(1);
      setOtpCode('');
      setNewPassword('');
    } catch (err) {
      setPwdMsg(err.response?.data?.error || 'Invalid OTP code.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
        <h1 className="text-xl font-extrabold text-slate-900 mb-1">Profile & Security Settings</h1>
        <p className="text-xs text-slate-500">
          Update your personal details, profile picture, and secure your account with email OTP verification.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Edit Profile Form */}
        <form onSubmit={handleUpdateProfile} className="md:col-span-7 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3">
            Personal Information
          </h2>

          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setProfilePic(f);
                    setPreviewUrl(URL.createObjectURL(f));
                  }
                }}
                className="hidden"
              />
            </label>
            <div>
              <p className="text-xs font-bold text-slate-800">Change Avatar</p>
              <p className="text-[11px] text-slate-500">Tap circle to upload a new profile photo</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">FULL NAME</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">EMAIL (LOCKED)</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">MOBILE NUMBER</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </form>

        {/* Right: Password Change via Email OTP */}
        <div className="md:col-span-5 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600" /> Password Security
          </h2>

          {pwdMsg && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 font-medium">
              {pwdMsg}
            </div>
          )}

          {resetStep === 1 ? (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-slate-600">
                To change your password, we send a secure 6-digit verification code to your registered email address.
              </p>
              <button
                onClick={handleRequestPasswordOtp}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition"
              >
                Send Password Reset OTP
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirmPasswordChange} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">6-DIGIT OTP</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 text-center tracking-[0.3em] font-bold text-sm rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">NEW PASSWORD</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
              >
                Verify OTP & Update Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
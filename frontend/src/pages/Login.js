import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowRight } from 'lucide-react';
import axios from 'axios';

const getPasswordChecks = (password = '') => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  let label = 'Weak';
  let meterClass = 'bg-red-500';

  if (score >= 5) {
    label = 'Strong';
    meterClass = 'bg-green-600';
  } else if (score >= 3) {
    label = 'Medium';
    meterClass = 'bg-amber-500';
  }

  return { checks, score, label, meterClass };
};

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (!resendCooldown) return undefined;
    const timer = setTimeout(() => setResendCooldown((prev) => Math.max(prev - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const passwordMeta = getPasswordChecks(newPassword);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await login(formData.email, formData.password);
      toast.success(response?.is_new_user ? 'Welcome to LAST GEAR.' : 'Welcome back to LAST GEAR.');
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      const response = await loginWithGoogle(credentialResponse.credential);
      toast.success(response?.is_new_user ? 'Welcome to LAST GEAR.' : 'Welcome back to LAST GEAR.');
      navigate('/');
    } catch (error) {
      console.error('Google login failed:', error);
      toast.error(error.response?.data?.detail || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForgotPasswordState = () => {
    setShowForgotPassword(false);
    setResetOtp(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmResetPassword('');
    setResendCooldown(0);
  };

  const handleOpenForgotPassword = () => {
    setResetEmail(formData.email || '');
    setResetOtp(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmResetPassword('');
    setResendCooldown(0);
    setShowForgotPassword(true);
  };

  const handleSendResetOtp = async () => {
    if (!resetEmail) {
      toast.error('Enter your email first');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${BACKEND_URL}/api/auth/forgot-password/send-otp`, { email: resetEmail });
      setResetOtp(['', '', '', '', '', '']);
      setResendCooldown(30);
      toast.success('Password reset code sent to your email');
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (error) {
      console.error('Forgot password OTP failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to send password reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resendCooldown > 0) return;
    await handleSendResetOtp();
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;

    const nextOtp = [...resetOtp];
    nextOtp[index] = value.slice(-1);
    setResetOtp(nextOtp);

    if (value && index < 5 && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !resetOtp[index] && index > 0 && otpRefs.current[index - 1]) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const otpString = resetOtp.join('');

    if (otpString.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }

    if (newPassword !== confirmResetPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordMeta.score < 5) {
      toast.error('Password should contain uppercase, lowercase, numbers, and special characters');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${BACKEND_URL}/api/auth/forgot-password/reset`, {
        email: resetEmail,
        otp: otpString,
        new_password: newPassword,
      });
      toast.success('Password reset successful. You can log in now.');
      setFormData((prev) => ({ ...prev, email: resetEmail, password: '' }));
      resetForgotPasswordState();
    } catch (error) {
      console.error('Password reset failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5efe6] px-4 py-10 md:px-6 md:py-16" data-testid="login-page">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_26%),radial-gradient(circle_at_left,rgba(217,145,70,0.12),transparent_18%),linear-gradient(160deg,#f7f1e8_0%,#f1ebe2_54%,#ece4d8_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] lastgear-grid" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-40 w-40 -translate-x-1/2 rounded-full bg-[#d99146]/10 blur-3xl login-float-slow" />

      <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-md rounded-[32px] border border-black/8 bg-white/70 p-[1px] shadow-[0_24px_80px_rgba(18,14,11,0.12)] backdrop-blur-xl login-fade-up">
          <div className="rounded-[31px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,251,245,0.96)_0%,rgba(248,241,233,0.94)_100%)] px-6 py-8 text-[#120e0b] md:px-8 md:py-10">
            <div className="flex flex-col items-center text-center">
              <img src="/logo-black.png" alt="LAST GEAR Logo" className="h-14 w-auto object-contain login-fade-up" />
              <h1 className="mt-5 font-nav text-4xl text-[#120e0b] login-fade-up md:text-5xl" style={{ animationDelay: '0.06s' }}>Login</h1>
              <p className="mt-4 max-w-xs text-sm leading-6 text-black/55 login-fade-up" style={{ animationDelay: '0.12s' }}>
                Welcome back to LAST GEAR.
              </p>
            </div>

            <div className="mt-6 rounded-[20px] border border-[#d99146]/16 bg-[#fff8ef] px-4 py-3 text-sm leading-6 text-[#6b4c2d] login-fade-up" style={{ animationDelay: '0.18s' }}>
              New here? Create an account and get <span className="font-semibold text-[#ffd19d]">5% off</span> your first purchase.
            </div>

            <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4 login-fade-up" style={{ animationDelay: '0.24s' }} data-testid="login-form">
              <div>
                <label htmlFor="email" className="mb-2 block font-nav text-[11px] text-black/45">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  placeholder="you@lastgear.com"
                  className="w-full rounded-[18px] border border-black/10 bg-white/80 px-4 py-3.5 text-[15px] text-[#120e0b] outline-none transition duration-300 placeholder:text-black/28 focus:border-[#d99146]/55 focus:bg-white focus:shadow-[0_0_0_4px_rgba(217,145,70,0.08)]"
                  data-testid="email-input"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block font-nav text-[11px] text-black/45">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-[18px] border border-black/10 bg-white/80 px-4 py-3.5 text-[15px] text-[#120e0b] outline-none transition duration-300 placeholder:text-black/28 focus:border-[#d99146]/55 focus:bg-white focus:shadow-[0_0_0_4px_rgba(217,145,70,0.08)]"
                  data-testid="password-input"
                />
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={handleOpenForgotPassword}
                    className="text-sm font-medium text-[#6b4c2d] transition hover:text-[#d99146]"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-3 rounded-[18px] bg-[#d99146] px-6 py-4 font-nav text-sm text-[#130d08] transition duration-300 hover:bg-[#e59d51] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70"
                data-testid="login-button"
              >
                <span>{loading ? 'Logging In...' : 'Enter Gear'}</span>
                {!loading && <ArrowRight className="h-4 w-4" strokeWidth={2.2} />}
              </button>
            </form>

            <div className="mt-6 login-fade-up" style={{ animationDelay: '0.3s' }}>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-black/8" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#f8f1e9] px-3 font-nav text-[10px] text-black/34">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-[18px] border border-black/8 bg-white/60 p-3">
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => {
                      toast.error('Google Sign In was unsuccessful. Try again.');
                    }}
                    useOneTap={false}
                    theme="filled_black"
                    size="large"
                    shape="pill"
                    text="signin_with"
                    width="280"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-black/55 login-fade-up" style={{ animationDelay: '0.36s' }}>
              <p>
                Don&apos;t have an account?{' '}
                <Link to="/register" className="font-semibold text-[#120e0b] transition hover:text-[#d99146]" data-testid="register-link">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-black/10 bg-[#fffaf4] p-6 shadow-[0_24px_80px_rgba(18,14,11,0.18)]">
            <div className="mb-5">
              <h2 className="font-nav text-3xl text-[#120e0b]">Reset password</h2>
              <p className="mt-2 text-sm leading-6 text-black/55">
                Enter your email, verify the OTP, and set a new password.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="mb-2 block font-nav text-[11px] text-black/45">
                  Email
                </label>
                <div className="flex gap-2">
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="min-w-0 flex-1 rounded-[16px] border border-black/10 bg-white px-4 py-3 text-[15px] text-[#120e0b] outline-none transition duration-300 focus:border-[#d99146]/55 focus:shadow-[0_0_0_4px_rgba(217,145,70,0.08)]"
                  />
                  <button
                    type="button"
                    onClick={handleSendResetOtp}
                    disabled={loading}
                    className="rounded-[16px] bg-[#d99146] px-4 py-3 font-nav text-sm text-[#130d08] transition hover:bg-[#e59d51] disabled:opacity-70"
                  >
                    Send code
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 block font-nav text-[11px] text-black/45">OTP</p>
                <div className="flex justify-center gap-2">
                  {resetOtp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="h-12 w-11 rounded-[14px] border border-black/10 bg-white text-center text-lg font-semibold text-[#120e0b] outline-none transition duration-300 focus:border-[#d99146]/55 focus:shadow-[0_0_0_4px_rgba(217,145,70,0.08)]"
                    />
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={handleResendResetOtp}
                    disabled={loading || resendCooldown > 0}
                    className="text-sm font-medium text-[#6b4c2d] transition hover:text-[#d99146] disabled:cursor-not-allowed disabled:text-black/30"
                  >
                    {resendCooldown > 0 ? `Didn’t receive code? Resend in ${resendCooldown}s` : 'Didn’t receive code? Resend'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="new-password" className="mb-2 block font-nav text-[11px] text-black/45">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-[15px] text-[#120e0b] outline-none transition duration-300 focus:border-[#d99146]/55 focus:shadow-[0_0_0_4px_rgba(217,145,70,0.08)]"
                />
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-gray-600">Password strength</span>
                    <span
                      className={`font-semibold ${
                        passwordMeta.label === 'Strong'
                          ? 'text-green-700'
                          : passwordMeta.label === 'Medium'
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }`}
                    >
                      {passwordMeta.label}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full transition-all duration-300 ${passwordMeta.meterClass}`}
                      style={{ width: `${(passwordMeta.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-reset-password" className="mb-2 block font-nav text-[11px] text-black/45">
                  Confirm new password
                </label>
                <input
                  id="confirm-reset-password"
                  type="password"
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  required
                  className="w-full rounded-[16px] border border-black/10 bg-white px-4 py-3 text-[15px] text-[#120e0b] outline-none transition duration-300 focus:border-[#d99146]/55 focus:shadow-[0_0_0_4px_rgba(217,145,70,0.08)]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForgotPasswordState}
                  className="flex-1 rounded-[16px] border border-black/10 px-4 py-3 text-sm font-medium text-[#120e0b] transition hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-[16px] bg-[#d99146] px-4 py-3 font-nav text-sm text-[#130d08] transition hover:bg-[#e59d51] disabled:opacity-70"
                >
                  {loading ? 'Please wait...' : 'Reset password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

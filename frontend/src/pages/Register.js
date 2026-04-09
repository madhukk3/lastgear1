import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const Register = () => {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const handleSendOtp = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${BACKEND_URL}/api/auth/send-email-otp`, { email: formData.email });
      toast.success('OTP sent to your email!');
      setShowOtp(true);
    } catch (error) {
      console.error('Failed to send OTP:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to send OTP';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    // Take the last character typed to override the box
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5 && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Auto focus previous input on backspace if current is empty
    if (e.key === 'Backspace' && !otp[index] && index > 0 && otpRefs.current[index - 1]) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');

    if (otpString.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      // 1. Verify OTP
      await axios.post(`${BACKEND_URL}/api/auth/verify-email-otp`, {
        email: formData.email,
        otp: otpString
      });

      // 2. Complete Registration
      const response = await register(formData.email, formData.password, formData.name, formData.phone);

      toast.success(response?.is_new_user ? 'Welcome to LAST GEAR.' : 'Welcome back to LAST GEAR.');
      navigate('/');
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error(error.response?.data?.detail || 'Registration failed');
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" data-testid="register-page">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo-black.png" alt="LAST GEAR Logo" className="h-20 w-auto object-contain mb-6" />
          <h1 className="text-4xl font-bold mb-2">REGISTER</h1>
          <p className="text-gray-600 mb-6">Create your LAST GEAR account</p>
          <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-md text-sm w-full max-w-sm shadow-sm flex items-center justify-center gap-2">
            <span>✨</span>
            <span>Sign up today and automatically get <strong>5% OFF</strong> your first purchase!</span>
          </div>
        </div>

        <form onSubmit={handleSendOtp} className="space-y-6" data-testid="register-form">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              FULL NAME
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
              data-testid="name-input"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              EMAIL
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
              data-testid="email-input"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2">
              PHONE (OPTIONAL)
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
              data-testid="phone-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              PASSWORD
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
              data-testid="password-input"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
              data-testid="confirm-password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-400"
            data-testid="register-button"
          >
            {loading ? 'PLEASE WAIT...' : 'SIGN UP'}
          </button>
        </form>

        {showOtp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white p-8 rounded-lg max-w-sm w-full shadow-2xl">
              <h2 className="text-2xl font-bold mb-4 text-center">Verify Email</h2>
              <p className="text-sm text-gray-600 mb-6 text-center">
                We sent a 6-digit code to <strong>{formData.email}</strong>
              </p>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-center gap-2 sm:gap-4 mb-8 mt-4">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      type="text"
                      className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold border-2 border-gray-300 rounded focus:border-black focus:outline-none focus:ring-1 focus:ring-black bg-white transition-colors"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white py-3 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors rounded disabled:bg-gray-400"
                >
                  {loading ? 'VERIFYING...' : 'VERIFY & REGISTER'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowOtp(false)}
                  disabled={loading}
                  className="w-full text-sm font-medium text-gray-500 hover:text-black mt-2"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR CONTINUE WITH</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                toast.error('Google Sign In was unsuccessful. Try again.');
              }}
              useOneTap
              theme="outline"
              size="large"
              shape="rectangular"
              text="signup_with"
            />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-black hover:underline" data-testid="login-link">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

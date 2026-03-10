import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  // Email Login
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await login(formData.email, formData.password);
      toast.success('Login successful!');
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect);
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
      await loginWithGoogle(credentialResponse.credential);
      toast.success('Google Login successful!');
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-12" data-testid="login-page">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo-black.png" alt="LAST GEAR Logo" className="h-20 w-auto object-contain mb-6" />
          <h1 className="text-4xl font-bold mb-2">LOGIN</h1>
          <p className="text-gray-600 mb-6">Welcome back to LAST GEAR</p>
          <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-md text-sm w-full max-w-sm shadow-sm flex items-center justify-center gap-2">
            <span>✨</span>
            <span><span className="font-bold">New here?</span> Create an account and get <strong>5% OFF</strong> your first purchase!</span>
          </div>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-6" data-testid="login-form">
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
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
              data-testid="password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-400"
            data-testid="login-button"
          >
            {loading ? 'LOGGING IN...' : 'LOGIN'}
          </button>
        </form>

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
              text="signin_with"
            />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-black hover:underline" data-testid="register-link">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
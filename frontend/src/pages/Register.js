import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await register(formData.email, formData.password, formData.name, formData.phone);
      toast.success('Registration successful!');
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
      await loginWithGoogle(credentialResponse.credential);
      toast.success('Google Login successful!');
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

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="register-form">
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
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
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
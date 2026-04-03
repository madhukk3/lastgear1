import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await login(formData.email, formData.password);

      if (response.user?.is_admin) {
        toast.success('Admin login successful!');
        navigate('/admin/dashboard');
      } else {
        logout();
        toast.error('Access denied. Admin credentials required.');
      }
    } catch (error) {
      console.error('Login failed:', error);
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f131d] px-4 py-10" data-testid="admin-login-page">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,145,70,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_24%),linear-gradient(135deg,#0f131d_0%,#141b26_48%,#0d1018_100%)]" />
      <div className="lastgear-grid absolute inset-0 opacity-10" />

      <div className="relative w-full max-w-md">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.06] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="rounded-[28px] border border-white/10 bg-[#f5f0e8] p-8 sm:p-10">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-white shadow-[0_10px_30px_rgba(18,14,11,0.08)]">
                <img src="/logo-black.png" alt="LAST GEAR Logo" className="h-10 w-auto object-contain" />
              </div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-black/60">
                <ShieldCheck size={12} />
                <span>Secure Admin Access</span>
              </div>
              <h1 className="text-5xl font-display leading-none text-[#120e0b]">LAST GEAR</h1>
              <p className="mt-2 text-sm uppercase tracking-[0.28em] text-black/45">Admin Panel Login</p>
              <p className="mt-4 max-w-xs text-sm leading-6 text-black/55">
                Simple access for orders, inventory, campaigns, and store control.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" data-testid="admin-login-form">
              <div>
                <label htmlFor="email" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-black/55">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[#120e0b] outline-none transition focus:border-[#120e0b] focus:ring-2 focus:ring-[#120e0b]/10"
                  data-testid="admin-email-input"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-black/55">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[#120e0b] outline-none transition focus:border-[#120e0b] focus:ring-2 focus:ring-[#120e0b]/10"
                  data-testid="admin-password-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#120e0b] px-6 py-4 text-sm font-bold uppercase tracking-[0.28em] text-[#f1e6d8] transition hover:bg-[#2a2119] disabled:cursor-not-allowed disabled:bg-black/35"
                data-testid="admin-login-button"
              >
                <span>{loading ? 'Logging In...' : 'Login As Admin'}</span>
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

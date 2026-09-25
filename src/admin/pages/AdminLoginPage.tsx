import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AdminAuthLayout, adminAuthInputClass, adminAuthButtonClass } from '../components/AdminAuthLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminApiError } from '../api';

export const AdminLoginPage: React.FC = () => {
  const { login } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminAuthLayout
      eyebrow="Sign In"
      title="Welcome back, Administrator"
      subtitle="Sign in to access the CocoSense admin console."
      error={error}
      footer={
        <>
          Not an administrator?{' '}
          <span className="text-[#22C55E]">Farm owners can sign in at /owner instead.</span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              autoComplete="username"
              placeholder="admin@cocosense.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={adminAuthInputClass}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${adminAuthInputClass} pr-10`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className={adminAuthButtonClass}>
          {loading ? 'Signing In…' : 'Sign In'} <ArrowRight className="w-4 h-4" />
        </button>

        <div className="pt-1 text-center text-[11px] text-[#606060] font-mono">
          Demo &mdash; email <b className="text-[#A0A0A0]">admin@cocosense.ph</b>, password{' '}
          <b className="text-[#A0A0A0]">admin123</b>
        </div>
      </form>
    </AdminAuthLayout>
  );
};

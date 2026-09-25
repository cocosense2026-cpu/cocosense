import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import {
  SuperAdminAuthLayout,
  superAdminAuthInputClass,
  superAdminAuthButtonClass,
} from '../components/SuperAdminAuthLayout';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';
import { SuperAdminApiError } from '../api';

export const SuperAdminLoginPage: React.FC = () => {
  const { login } = useSuperAdminAuth();

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
      setError(err instanceof SuperAdminApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SuperAdminAuthLayout
      eyebrow="Sign In"
      title="Welcome back, Super Admin"
      subtitle="Sign in to provision and manage administrator accounts."
      error={error}
      footer={
        <>
          Not a super admin?{' '}
          <span className="text-[#22C55E]">Administrators sign in at /login instead.</span>
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
              placeholder="superadmin@cocosense.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={superAdminAuthInputClass}
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
              className={`${superAdminAuthInputClass} pr-10`}
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

        <button type="submit" disabled={loading} className={superAdminAuthButtonClass}>
          {loading ? 'Signing In…' : 'Sign In'} <ArrowRight className="w-4 h-4" />
        </button>

        <div className="pt-1 text-center text-[11px] text-[#606060] font-mono">
          Demo &mdash; email <b className="text-[#A0A0A0]">superadmin@cocosense.ph</b>, password{' '}
          <b className="text-[#A0A0A0]">super123</b>
        </div>
      </form>
    </SuperAdminAuthLayout>
  );
};

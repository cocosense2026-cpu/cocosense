import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { OwnerAuthLayout, ownerAuthInputClass, ownerAuthButtonClass } from '../components/OwnerAuthLayout';
import { useOwnerAuth } from '../context/OwnerAuthContext';
import { OwnerApiError } from '../api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useOwnerAuth();

  const locationState = location.state as { notice?: string; email?: string } | null;

  const [email, setEmail] = useState(locationState?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notice = locationState?.notice ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { mustChangePassword } = await login(email, password);
      navigate(mustChangePassword ? '/owner/change-password' : '/owner', { replace: true });
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OwnerAuthLayout
      eyebrow="Sign In"
      title="Welcome back, Farm Owner"
      subtitle="Access your coconut plantation health metrics."
      error={error}
      notice={notice}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <span className="text-[#D4AF37]">Contact your CocoSense plantation administrator.</span>
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
              placeholder="owner@plantation.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ownerAuthInputClass}
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-[#A0A0A0]">Password</label>
            <Link to="/owner/forgot-password" className="text-[11px] text-[#D4AF37] hover:text-[#E5C158]">
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${ownerAuthInputClass} pr-10`}
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

        <button type="submit" disabled={loading} className={ownerAuthButtonClass}>
          {loading ? 'Signing In…' : 'Sign In'} <ArrowRight className="w-4 h-4" />
        </button>

        <div className="pt-1 text-center text-[11px] text-[#606060] font-mono">
          Demo &mdash; email <b className="text-[#A0A0A0]">demo@example.com</b>, password{' '}
          <b className="text-[#A0A0A0]">user123</b>
        </div>
      </form>
    </OwnerAuthLayout>
  );
};

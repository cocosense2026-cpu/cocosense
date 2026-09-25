import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowRight, ChevronLeft } from 'lucide-react';
import { OwnerAuthLayout, ownerAuthInputClass, ownerAuthButtonClass } from '../components/OwnerAuthLayout';
import { ownerApi, OwnerApiError } from '../api';
import { setResetFlow } from '../resetFlow';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await ownerApi.forgotPassword(email);
      setResetFlow({ email, verified: false, requestedAt: Date.now() });
      navigate('/owner/verify-code', { state: { devCode: res.devCode } });
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OwnerAuthLayout
      eyebrow="Forgot Password"
      title="Let's get you back in."
      subtitle="Enter the email on your account and we'll send a 6-digit code you can use to reset your password."
      error={error}
      footer={
        <>
          Remember your password?{' '}
          <Link to="/owner/login" className="text-[#D4AF37] hover:text-[#E5C158]">
            Sign In
          </Link>
        </>
      }
    >
      <Link
        to="/owner/login"
        className="inline-flex items-center gap-1 text-[11px] text-[#808080] hover:text-white mb-5"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back to Sign In
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="owner@plantation.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ownerAuthInputClass}
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className={ownerAuthButtonClass}>
          {loading ? 'Sending…' : 'Send Reset Code'} <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </OwnerAuthLayout>
  );
};

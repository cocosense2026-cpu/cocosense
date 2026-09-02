import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { OwnerAuthLayout, ownerAuthInputClass, ownerAuthButtonClass } from '../components/OwnerAuthLayout';
import { ownerApi, OwnerApiError } from '../api';
import { getResetFlow, clearResetFlow, ResetFlowState } from '../resetFlow';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [flow, setFlow] = useState<ResetFlowState | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = getResetFlow();
    if (!existing || !existing.verified || !existing.code) {
      navigate('/owner/forgot-password', { replace: true });
      return;
    }
    setFlow(existing);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flow || !flow.code) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ownerApi.resetPassword(flow.email, flow.code, password);
      clearResetFlow();
      navigate('/owner/login', {
        replace: true,
        state: { notice: 'Your password has been reset. Please sign in with your new password.' },
      });
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!flow) return null;

  return (
    <OwnerAuthLayout
      eyebrow="Reset Password"
      title="One last step."
      subtitle="Your identity is verified — choose a new password to finish resetting your account."
      error={error}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${ownerAuthInputClass} pr-10`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-white"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Confirm New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={ownerAuthInputClass}
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className={ownerAuthButtonClass}>
          {loading ? 'Resetting…' : 'Reset Password'} <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </OwnerAuthLayout>
  );
};

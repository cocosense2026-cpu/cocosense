import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { OwnerAuthLayout, ownerAuthInputClass, ownerAuthButtonClass } from '../components/OwnerAuthLayout';
import { ownerApi, OwnerApiError } from '../api';
import { useOwnerAuth } from '../context/OwnerAuthContext';

function strength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['Enter a password', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#404040', '#F44336', '#E9A23B', '#E9A23B', '#4CAF50'];
  const idx = password.length === 0 ? 0 : Math.min(score, 4);
  return { score, label: labels[idx], color: colors[idx] };
}

export const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { completeForcedPasswordChange, logout } = useOwnerAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const meter = useMemo(() => strength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ownerApi.changePassword(currentPassword, password);
      completeForcedPasswordChange();
      navigate('/owner', { replace: true });
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OwnerAuthLayout
      eyebrow="Set New Password"
      title="Secure your account."
      subtitle="You signed in with a temporary password. Choose your own strong password to continue to your dashboard."
      error={error}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Temporary Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="The password from your welcome email"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={ownerAuthInputClass}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="8+ chars, mixed case, number, symbol"
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
          <div className="mt-2">
            <div className="h-1 rounded-full bg-[#262626] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${password.length === 0 ? 0 : Math.max(20, (meter.score / 5) * 100)}%`, background: meter.color }}
              />
            </div>
            <span className="text-[11px] text-[#808080] mt-1 inline-block">{meter.label}</span>
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
          {loading ? 'Saving…' : 'Set Password & Continue'} <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <button
        type="button"
        onClick={() => logout()}
        className="w-full text-center text-[11px] text-[#606060] hover:text-white mt-4"
      >
        Wrong account? Sign out
      </button>
    </OwnerAuthLayout>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ShieldCheck } from 'lucide-react';
import { OwnerAuthLayout, ownerAuthButtonClass } from '../components/OwnerAuthLayout';
import { ownerApi, OwnerApiError } from '../api';
import { getResetFlow, setResetFlow, ResetFlowState } from '../resetFlow';

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

export const VerifyCodePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [flow, setFlow] = useState<ResetFlowState | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>(
    (location.state as { devCode?: string } | null)?.devCode
  );
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const existing = getResetFlow();
    if (!existing) {
      navigate('/owner/forgot-password', { replace: true });
      return;
    }
    setFlow(existing);
  }, [navigate]);

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '').slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && inputRefs.current[index + 1]) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    text.slice(0, 6).split('').forEach((ch, idx) => (next[idx] = ch));
    setDigits(next);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flow) return;
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter the 6-digit code we sent you.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ownerApi.verifyResetCode(flow.email, code);
      setResetFlow({ ...flow, verified: true, code });
      navigate('/owner/reset-password');
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : 'That code is incorrect or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!flow) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await ownerApi.forgotPassword(flow.email);
      setResetFlow({ ...flow, requestedAt: Date.now() });
      setDevCode(res.devCode);
      setNotice(`A new code has been sent to ${maskEmail(flow.email)}.`);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : 'Could not resend the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!flow) return null;

  return (
    <OwnerAuthLayout
      eyebrow="Verify Code"
      title="Almost there."
      subtitle="Enter the 6-digit verification code to confirm it's really you before setting a new password."
      error={error}
      notice={notice}
    >
      <Link
        to="/owner/forgot-password"
        className="inline-flex items-center gap-1 text-[11px] text-[#808080] hover:text-white mb-5"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </Link>

      <h1 className="sr-only">Enter Verification Code</h1>
      <p className="text-xs text-[#808080] mb-4">
        We sent a 6-digit code to <b className="text-white">{maskEmail(flow.email)}</b>. It expires 10 minutes
        after each send.
      </p>

      {devCode && (
        <div className="mb-4 flex items-start gap-2 px-3.5 py-3 rounded bg-[#1A1608] border border-[#D4AF37]/30 text-[#D4AF37] text-xs">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <b>Demo Mode</b> &mdash; no SMTP is configured, so here's the code we would have emailed:
            <div className="mt-1.5 text-xl font-mono font-bold tracking-[0.2em]">{devCode}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoFocus={i === 0}
              autoComplete="one-time-code"
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className="w-11 h-13 sm:w-12 sm:h-14 text-center text-lg font-mono font-bold rounded bg-[#0E0E0E] border border-[#262626] text-white focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30"
            />
          ))}
        </div>

        <button type="submit" disabled={loading} className={ownerAuthButtonClass}>
          {loading ? 'Verifying…' : 'Verify Code'} <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="text-center mt-4">
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className="text-[12px] text-[#D4AF37] hover:text-[#E5C158] disabled:opacity-50"
        >
          Didn&apos;t get the code? Resend Code
        </button>
      </div>
    </OwnerAuthLayout>
  );
};

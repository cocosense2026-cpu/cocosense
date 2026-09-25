import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, LogIn } from 'lucide-react';
import { OwnerAuthLayout, ownerAuthButtonClass } from '../components/OwnerAuthLayout';
import { ownerApi, OwnerApiError, setOwnerToken } from '../api';

type ConfirmState = 'checking' | 'ok' | 'invalid' | 'expired' | 'error';

// Seconds the "You're all set" screen stays up before auto-continuing
// to the login page -- long enough to read, short enough that clicking
// the emailed link basically just takes you to Sign In.
const AUTO_REDIRECT_SECONDS = 3;

export const ConfirmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [state, setState] = useState<ConfirmState>('checking');
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(AUTO_REDIRECT_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Confirmation tokens are single-use: the server nulls the token out
  // as soon as it's redeemed. Effects can fire twice for the same token
  // (React 18 StrictMode double-invoke in dev, or any other re-render
  // before the request settles), and a second call would hit an
  // already-consumed token and report a false "invalid" error even
  // though the first call succeeded. Guard with a ref keyed on the
  // token so the network request itself only ever goes out once per
  // token, no matter how many times the effect runs.
  const firedForToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    if (firedForToken.current === token) return;
    firedForToken.current = token;

    // The owner session token is stored under one fixed localStorage
    // key shared by every owner on this browser. Anyone landing on a
    // confirmation link isn't signed in as themselves yet -- if a
    // *different* owner's session token is still sitting in storage
    // from an earlier login on this device, leaving it there means
    // "Back to Sign In" would silently authenticate as that other
    // owner instead of showing this owner the login form. Clear it now.
    setOwnerToken(null);

    // NOTE: deliberately no "cancelled" flag here. firedForToken above
    // already guarantees this request is only ever sent once per token,
    // so there's no second in-flight request whose stale response needs
    // to be ignored. A cancelled-on-cleanup flag was tried here before,
    // but it broke confirmation entirely under StrictMode: the effect's
    // first invocation fires the request, StrictMode's simulated
    // unmount runs that invocation's cleanup (setting its `cancelled`
    // closure to true), and the second invocation bails out early via
    // firedForToken without creating a new closure -- so when the
    // original request finally resolves, it reads the stale
    // `cancelled = true` from the first closure and silently drops the
    // result, leaving the page stuck on "Confirming your account…"
    // forever with no console error. Setting state after a real
    // (non-StrictMode) unmount is harmless in React 18 -- it's a no-op,
    // not a warning.
    ownerApi
      .confirmAccount(token)
      .then((res) => {
        setOwnerName(res.ownerName);
        setOwnerEmail(res.email ?? null);
        setState('ok');
      })
      .catch((err) => {
        if (err instanceof OwnerApiError && err.reason === 'expired') {
          setState('expired');
          return;
        }
        // status 0 means the request never got a real response from the
        // server (connection refused, or our own client-side timeout) --
        // that's not the same thing as the server rejecting the token, so
        // don't tell the person their link is invalid when we actually
        // just don't know yet. Show the real problem instead.
        if (err instanceof OwnerApiError && err.status === 0) {
          setErrorMessage(err.message);
          setState('error');
          return;
        }
        setState('invalid');
      });
  }, [token]);

  // Once confirmed, the whole point of clicking the email button was to
  // get to the point of signing in -- so send the owner straight to
  // /owner/login instead of leaving them stranded on a static "success"
  // page they'd have to click off of themselves. A brief countdown
  // keeps the confirmation message visible for a moment first, and the
  // "Go to Sign In" button below still works immediately if they don't
  // want to wait.
  useEffect(() => {
    if (state !== 'ok') return;
    if (secondsLeft <= 0) {
      navigate('/owner/login', {
        replace: true,
        state: { notice: 'Your email is confirmed. Sign in with the temporary password from your invitation email.', email: ownerEmail },
      });
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [state, secondsLeft, navigate, ownerEmail]);

  if (state === 'checking') {
    return (
      <OwnerAuthLayout eyebrow="Confirming" title="Confirming your account…" subtitle="One moment please.">
        <div className="h-16 rounded bg-[#0E0E0E] border border-[#262626] animate-pulse" />
        <Link to="/owner/login" className="block text-center text-xs text-[#D4AF37] hover:text-[#E5C158] mt-5">
          Back to Sign In
        </Link>
      </OwnerAuthLayout>
    );
  }

  if (state === 'ok') {
    return (
      <OwnerAuthLayout
        eyebrow="Email Confirmed"
        title="You're all set."
        subtitle={`Your CocoSense account${ownerName ? ` for ${ownerName}` : ''} is now active.`}
      >
        <div className="flex items-center gap-2.5 mb-5 text-[#4CAF50]">
          <CheckCircle2 className="w-8 h-8" />
          <p className="text-xs text-[#E0E0E0]">
            Sign in with the temporary password from your invitation email, then set your own password when
            prompted.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            navigate('/owner/login', {
              replace: true,
              state: { notice: 'Your email is confirmed. Sign in with the temporary password from your invitation email.', email: ownerEmail },
            })
          }
          className={`${ownerAuthButtonClass} block w-full text-center`}
        >
          <span className="inline-flex items-center gap-2">
            <LogIn className="w-4 h-4" /> Go to Sign In
          </span>
        </button>
        <p className="mt-3 text-center text-[10px] text-[#606060]">
          Redirecting to Sign In in {secondsLeft}s…
        </p>
      </OwnerAuthLayout>
    );
  }

  if (state === 'error') {
    return (
      <OwnerAuthLayout
        eyebrow="Couldn't Confirm"
        title="Something went wrong"
        subtitle="This isn't about your link -- we couldn't get an answer from the server."
      >
        <div className="flex items-start gap-2.5 mb-5 text-[#F44336]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#E0E0E0]">{errorMessage}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${ownerAuthButtonClass} block w-full text-center`}
        >
          Try again
        </button>
        <Link to="/owner/login" className="block text-center text-xs text-[#D4AF37] hover:text-[#E5C158] mt-3">
          Back to Sign In
        </Link>
      </OwnerAuthLayout>
    );
  }

  return (
    <OwnerAuthLayout
      eyebrow="Confirmation Link Invalid"
      title="Link invalid or expired"
      subtitle={
        state === 'expired'
          ? 'Confirmation links are valid for 24 hours.'
          : 'This link is not recognized, or has already been used.'
      }
    >
      <div className="flex items-start gap-2.5 mb-5 text-[#F44336]">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#E0E0E0]">
          Ask your plantation administrator to resend the invitation from the Farm Owners page.
        </p>
      </div>
      <Link to="/owner/login" className="block text-center text-xs text-[#D4AF37] hover:text-[#E5C158]">
        Back to Sign In
      </Link>
    </OwnerAuthLayout>
  );
};

import React, { useState } from 'react';
import { Lock, X, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';

interface PasswordPromptModalProps {
  // 'set': choosing a new password to protect an export (password +
  // confirm). 'enter': typing the password to decrypt a file being imported.
  mode: 'set' | 'enter';
  title: string;
  description: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}

const MIN_LENGTH = 6;

// Shared by every "Export CSV"/"Download Audit Summary" and "Import"
// button across the admin console (Farm Owners, Municipality Map,
// Alert History, Bioacoustic Reports) so the password UX -- and the
// minimum-length rule -- is identical everywhere rather than
// reimplemented per view. Encryption itself lives in
// src/utils/encryptedExport.ts; this component only collects the
// password.
export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  mode,
  title,
  description,
  busy = false,
  error,
  onCancel,
  onSubmit,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'set') {
      if (password.length < MIN_LENGTH) {
        setLocalError(`Password must be at least ${MIN_LENGTH} characters.`);
        return;
      }
      if (password !== confirm) {
        setLocalError('Passwords do not match.');
        return;
      }
    } else if (password.length === 0) {
      setLocalError('Enter the password this file was protected with.');
      return;
    }
    setLocalError(null);
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-md rounded bg-[#141414] border border-[#262626] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
          <h3 className="text-base font-bold text-white uppercase serif flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#D4AF37]" />
            {title}
          </h3>
          <button type="button" onClick={onCancel} className="p-1.5 rounded bg-[#1A1A1A] text-[#808080] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#808080] mt-4">{description}</p>

        {(localError || error) && (
          <div className="mt-4 flex items-start gap-2 text-xs text-[#F44336] bg-[#F44336]/10 border border-[#F44336]/30 rounded px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {localError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          <div>
            <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1">
              {mode === 'set' ? 'New Password *' : 'Password *'}
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'set' ? `At least ${MIN_LENGTH} characters` : 'Enter file password'}
                className="w-full px-3 py-2 pr-9 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#808080] hover:text-white"
                tabIndex={-1}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'set' && (
            <div>
              <label className="block font-bold uppercase text-[#808080] text-[10px] tracking-wider mb-1">
                Confirm Password *
              </label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
              />
            </div>
          )}

          {mode === 'set' && (
            <p className="text-[10px] text-[#808080] leading-relaxed">
              Anyone opening this file will need this exact password. CocoSense does not store it anywhere -- if it's lost, the file cannot be recovered.
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-3.5 py-2 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] font-semibold text-xs transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{mode === 'set' ? 'Encrypt & Download' : 'Decrypt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

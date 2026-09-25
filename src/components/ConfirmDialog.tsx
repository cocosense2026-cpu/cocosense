import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' (default) is for destructive actions like delete -- red accent. 'default' uses the app's gold accent for non-destructive confirmations. */
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

// A centered, on-brand replacement for window.confirm(). Browsers render
// window.confirm as a small unstyled OS dialog anchored to a corner of
// the page -- this instead matches the rest of the app (dark card, gold
// accent, same modal-overlay pattern already used for the Add Owner /
// Expand Hardware modals) and sits centered in the viewport regardless
// of where on the page the triggering button was.
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}) => {
  // Esc to cancel, matching how the other modals in this app already
  // behave -- and cancel (not confirm) is the safe default for a
  // destructive-action dialog.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const accentColor = tone === 'danger' ? '#F44336' : '#D4AF37';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="relative w-full max-w-sm rounded bg-[#141414] border border-[#262626] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accentColor }} />

        <div className="p-6 pt-7">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center border"
              style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}66` }}
            >
              <AlertTriangle className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 id="confirm-dialog-title" className="text-base font-bold text-white uppercase serif leading-snug">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 p-1 rounded text-[#808080] hover:text-white hover:bg-[#1A1A1A] transition-colors"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p id="confirm-dialog-message" className="mt-3 text-sm text-[#B0B0B0] leading-relaxed">
            {message}
          </p>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] hover:border-[#404040] transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              autoFocus
              className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

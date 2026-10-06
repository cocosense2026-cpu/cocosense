import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { OwnerApiError } from '../api';

interface TreeDeleteModalProps {
  treeName: string;
  onClose: () => void;
  /** Delete the tree. Throw (OwnerApiError) to keep the dialog open with a message. */
  onConfirm: () => Promise<void>;
}

// "Delete this tree?": asks before removing a tree and everything recorded
// under it. Deleting can't be undone, so the destructive button is the only
// red thing on screen and Cancel is the default (Escape / backdrop).
export const TreeDeleteModal: React.FC<TreeDeleteModalProps> = ({ treeName, onClose, onConfirm }) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : "Couldn't delete that tree. Please try again.");
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete tree"
        className="w-full max-w-md rounded bg-[#141414] border border-[#262626] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[#F44336]" />
            <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">Delete Tree</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#808080] hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-white leading-relaxed">
            Delete <span className="font-bold break-all">{treeName}</span>?
          </p>
          <p className="text-xs text-[#808080] leading-relaxed">
            This permanently removes this tree's monitors, charts and recent log, along with its Active / Infected /
            Cleared settings. This can't be undone. Alerts that were already raised stay in your Alert History. If your
            device is on this tree, it moves to your previous tree.
          </p>

          {error && (
            <div className="rounded bg-[#2B1B1B] border border-[#F44336]/40 p-3 text-xs text-[#F44336] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              autoFocus
              className="px-4 py-2 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#F44336] hover:bg-[#E53935] disabled:opacity-60 text-white text-xs font-bold transition-colors"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete Tree
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertTriangle, TreePalm } from 'lucide-react';
import { OwnerApiError } from '../api';

export const MAX_TREE_NAME_LENGTH = 60;

interface TreeNameModalProps {
  mode: 'add' | 'rename';
  /** Current name when renaming; empty when adding. */
  initialName?: string;
  /** Shown as the placeholder when adding, e.g. "Tree 12" -- used if left blank. */
  suggestedName?: string;
  /** Which device the tree is for (only shown when the owner has several). */
  nodeLabel?: string | null;
  onClose: () => void;
  /** Save the name. Throw (OwnerApiError) to keep the dialog open with a message. */
  onSubmit: (name: string) => Promise<void>;
}

// "Name this tree": the dialog behind both "+ Tree" (name the new tree
// before the device moves onto it) and renaming an existing one, including
// the starting "Tree 1". The server does the real validation (length,
// duplicates) -- this just collects the name and shows its message inline.
export const TreeNameModal: React.FC<TreeNameModalProps> = ({
  mode,
  initialName = '',
  suggestedName = 'Tree',
  nodeLabel,
  onClose,
  onSubmit,
}) => {
  const [value, setValue] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX_TREE_NAME_LENGTH;
  // Adding with a blank name is fine (the suggestion is used); renaming needs a real name.
  const canSubmit = !busy && !tooLong && (mode === 'add' || trimmed.length > 0);

  const submit = async () => {
    if (!canSubmit || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err instanceof OwnerApiError ? err.message : "Couldn't save that name. Please try again.");
      busyRef.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const title = mode === 'add' ? 'Name Your New Tree' : 'Rename Tree';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded bg-[#141414] border border-[#262626] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <TreePalm className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
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
          <p className="text-xs text-[#808080] leading-relaxed">
            {mode === 'add'
              ? `Give this tree a name you'll recognise${nodeLabel ? ` -- your device ${nodeLabel} will start monitoring it` : ' -- your device will start monitoring it'} with a fresh monitor and an empty recent log. Your other trees keep their data.`
              : "Only the name changes. This tree's readings, charts and recent log stay exactly as they are."}
          </p>

          {error && (
            <div className="rounded bg-[#2B1B1B] border border-[#F44336]/40 p-3 text-xs text-[#F44336] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="tree-name" className="text-[10px] uppercase font-bold tracking-widest text-[#808080]">
              Tree name
            </label>
            <input
              id="tree-name"
              ref={inputRef}
              type="text"
              value={value}
              maxLength={MAX_TREE_NAME_LENGTH + 20}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={mode === 'add' ? suggestedName : 'e.g. North gate palm'}
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded bg-[#0D0D0D] border border-[#262626] focus:border-[#D4AF37] outline-none text-sm text-white placeholder:text-[#505050] transition-colors"
            />
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#606060]">
                {mode === 'add' ? `Leave blank to use "${suggestedName}".` : '\u00A0'}
              </span>
              <span className={tooLong ? 'text-[#F44336] font-semibold' : 'text-[#606060]'}>
                {trimmed.length}/{MAX_TREE_NAME_LENGTH}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#E2BE4A] disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-bold transition-colors"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === 'add' ? 'Add Tree' : 'Save Name'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

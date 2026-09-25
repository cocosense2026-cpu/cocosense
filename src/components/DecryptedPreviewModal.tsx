import React from 'react';
import { FileCheck2, X, Download } from 'lucide-react';
import { downloadPlainText } from '../utils/encryptedExport';

interface DecryptedPreviewModalProps {
  filename: string;
  mimeType: string;
  content: string;
  exportedAt?: string;
  onClose: () => void;
}

// Shown after a successful "Import" decrypt. These report/log exports
// (CSV, plain-text audit summaries) have no bulk-write endpoint on the
// server to restore into -- unlike the full System Backup in Settings
// -- so "importing" one means opening it back up for the admin to read
// and, if they want, save an unencrypted copy locally.
export const DecryptedPreviewModal: React.FC<DecryptedPreviewModalProps> = ({
  filename,
  mimeType,
  content,
  exportedAt,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded bg-[#141414] border border-[#262626] p-6 shadow-2xl my-8 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-[#262626] flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-white uppercase serif flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#4CAF50]" />
              Decrypted: {filename}
            </h3>
            {exportedAt && (
              <p className="text-[10px] text-[#808080] mt-0.5">
                Originally exported {new Date(exportedAt).toLocaleString()}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded bg-[#1A1A1A] text-[#808080] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <pre className="mt-4 flex-1 overflow-auto text-[11px] leading-relaxed text-[#E0E0E0] bg-[#0A0A0A] border border-[#262626] rounded p-4 whitespace-pre-wrap break-words font-mono">
          {content}
        </pre>

        <div className="flex items-center justify-end gap-2.5 pt-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => downloadPlainText(filename, content, mimeType)}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#D4AF37] font-semibold text-xs transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Save Decrypted Copy</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

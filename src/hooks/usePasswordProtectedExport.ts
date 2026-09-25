import { useRef, useState } from 'react';
import { encryptAndDownload, decryptFile, DecryptedExport } from '../utils/encryptedExport';

interface PendingExport {
  filename: string;
  content: string;
  mimeType: string;
}

// Shared state machine for the "Export -> set a password" and
// "Import -> enter that password" flows reused across FarmOwnersView,
// MunicipalityMapView, AlertHistoryView, and ReportsView. Keeping this
// in one hook means all four views drive the same
// PasswordPromptModal/DecryptedPreviewModal pair identically instead
// of each re-implementing the open/busy/error bookkeeping.
export function usePasswordProtectedExport() {
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedExport | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Called by a view's "Export CSV"/"Download Audit Summary" button
  // instead of encrypting immediately -- opens the set-password modal first.
  const requestExport = (filename: string, content: string, mimeType: string) => {
    setError(null);
    setPendingExport({ filename, content, mimeType });
  };

  // Called from the hidden <input type="file"> a view's "Import" button clicks.
  const requestImport = (file: File) => {
    setError(null);
    setPendingImportFile(file);
  };

  const cancel = () => {
    setPendingExport(null);
    setPendingImportFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitExportPassword = async (password: string) => {
    if (!pendingExport) return;
    setBusy(true);
    setError(null);
    try {
      await encryptAndDownload(pendingExport.filename, pendingExport.content, pendingExport.mimeType, password);
      setPendingExport(null);
    } catch {
      setError('Could not encrypt this export. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitImportPassword = async (password: string) => {
    if (!pendingImportFile) return;
    setBusy(true);
    setError(null);
    try {
      const text = await pendingImportFile.text();
      const result = await decryptFile(text, password);
      setDecrypted(result);
      setPendingImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decrypt this file.');
    } finally {
      setBusy(false);
    }
  };

  return {
    fileInputRef,
    isExportModalOpen: !!pendingExport,
    isImportModalOpen: !!pendingImportFile,
    decrypted,
    busy,
    error,
    requestExport,
    requestImport,
    cancel,
    submitExportPassword,
    submitImportPassword,
    closePreview: () => setDecrypted(null),
  };
}

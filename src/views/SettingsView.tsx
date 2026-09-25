import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { AvatarUpload } from '../components/AvatarUpload';
import { downloadJsonWithHash, sha256Hex } from '../utils/exportHash';
import { useAdminAuth } from '../admin/context/AdminAuthContext';
import { adminApi, AdminApiError } from '../admin/api';
import { 
  Settings, 
  Save, 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  BellRing,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  UserCircle,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { admin, refreshAdmin, setAdminProfile } = useAdminAuth();
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Admin's own profile (name/email/picture) -- separate save flow from
  // the rest of this page's local-only DSP/UI settings, since this one
  // actually persists to the `admins` table and is what Navigation.tsx's
  // sidebar chip and the Farm Owners table pull the admin's own avatar
  // from.
  // Full name is split into First / Middle / Last for editing, then
  // rejoined into the single `name` string the backend actually stores
  // (the `admins` table has no separate name columns -- see schema.sql).
  const splitName = (full: string) => {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { first: '', middle: '', last: '' };
    if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
    if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
    return { first: parts[0], middle: parts.slice(1, -1).join(' '), last: parts[parts.length - 1] };
  };
  const initialName = splitName(admin?.name || '');
  const [firstName, setFirstName] = useState(initialName.first);
  const [middleName, setMiddleName] = useState(initialName.middle);
  const [lastName, setLastName] = useState(initialName.last);
  const [profileEmail, setProfileEmail] = useState(admin?.email || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(admin?.avatarUrl ?? null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (admin) {
      const parsed = splitName(admin.name || '');
      setFirstName(parsed.first);
      setMiddleName(parsed.middle);
      setLastName(parsed.last);
      setProfileEmail(admin.email || '');
      setProfileAvatarUrl(admin.avatarUrl ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  const adminInitials =
    (admin?.name || 'Administrator')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'AD';

  // Picture changes save to the `admins` table the instant they're made
  // -- independent of the Name/Email fields below, which still need the
  // explicit "Save Profile" submit. This means picking (or removing) a
  // picture is never lost just because the admin navigates away without
  // pressing Save. Reverts the preview on failure so the UI never shows
  // a picture that didn't actually persist.
  const handleAvatarChange = async (dataUrl: string | null) => {
    const previous = profileAvatarUrl;
    setProfileAvatarUrl(dataUrl);
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      const res = await adminApi.updateProfile({ avatarUrl: dataUrl });
      setAdminProfile(res.admin);
      setProfileAvatarUrl(res.admin.avatarUrl ?? null);
    } catch (err) {
      setProfileAvatarUrl(previous);
      setAvatarError(err instanceof AdminApiError ? err.message : 'Could not save your picture. Please try again.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const combinedName = [firstName, middleName, lastName].map(s => s.trim()).filter(Boolean).join(' ');
      const res = await adminApi.updateProfile({
        name: combinedName,
        email: profileEmail,
        avatarUrl: profileAvatarUrl,
      });
      setAdminProfile(res.admin);
      await refreshAdmin();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const restoreInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadBackup = async () => {
    setBackupError(null);
    setBackupBusy(true);
    try {
      // Pulls the real farm/node/tree/alert/notification tables from the
      // database (see server/routes/backup.js) rather than just the
      // local theme setting, so this file can actually restore the
      // system, not just describe it.
      const backup = await adminApi.exportBackup();
      const { ok, ...backupData } = backup;
      // Adds an `integrityHash` field (SHA-256 over the rest of the
      // payload) so the backup can be verified before being restored.
      await downloadJsonWithHash('cocosense-system-backup.json', backupData);
    } catch (err) {
      setBackupError(err instanceof AdminApiError ? err.message : 'Could not export the backup. Please try again.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setRestoreError(null);
    setRestoreSuccess(null);

    let parsed: any;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setRestoreError('That file is not valid JSON.');
      return;
    }

    const { integrityHash, ...rest } = parsed || {};
    if (typeof integrityHash !== 'string' || !integrityHash.startsWith('sha256:')) {
      setRestoreError('This file has no CocoSense integrity hash -- it was not produced by "Export System Backup".');
      return;
    }
    // Hashed over the exact same string that gets sent to the server
    // below, so the server can independently re-verify it byte-for-byte
    // rather than trusting that this browser-side check already ran.
    const canonicalPayload = JSON.stringify(rest);
    const expectedHash = `sha256:${await sha256Hex(canonicalPayload)}`;
    if (expectedHash !== integrityHash) {
      setRestoreError('This backup file failed its integrity check -- it may be corrupted or was edited after export. Restore refused.');
      return;
    }
    if (!rest.tables || typeof rest.tables !== 'object') {
      setRestoreError('This backup file has no restorable data.');
      return;
    }

    const ownerCount = Array.isArray(rest.tables.farm_owners) ? rest.tables.farm_owners.length : 0;
    const confirmed = window.confirm(
      `Restore this backup${rest.exportedAt ? ` from ${new Date(rest.exportedAt).toLocaleString()}` : ''}?\n\n` +
        `This REPLACES every current farm owner (${ownerCount}), node, tree, alert, and notification record with what's in the file. This cannot be undone.`
    );
    if (!confirmed) return;

    setRestoreBusy(true);
    try {
      const res = await adminApi.restoreBackup(canonicalPayload, integrityHash);
      setRestoreSuccess(`Restored ${res.restoredRows} record${res.restoredRows === 1 ? '' : 's'}. Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setRestoreError(err instanceof AdminApiError ? err.message : 'Could not restore the backup. Please try again.');
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            System Settings
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Configure appearance theme, admin profile, and database backup.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition-all w-full sm:w-auto"
        >
          {savedSuccess ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{savedSuccess ? 'Settings Saved!' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Admin Profile Card */}
      <div className="rounded bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
          <h3 className="font-bold text-white text-xs sm:text-sm uppercase serif flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-[#D4AF37]" />
            Admin Profile
          </h3>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4" noValidate>
          {profileError && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336] text-xs">
              {profileError}
            </div>
          )}
          {profileSaved && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#142416] border border-[#4CAF50]/30 text-[#4CAF50] text-xs">
              <CheckCircle2 className="w-4 h-4" /> Profile updated successfully.
            </div>
          )}

          <AvatarUpload
            avatarUrl={profileAvatarUrl}
            initials={adminInitials}
            textColor="#D4AF37"
            name={admin?.name}
            onChange={handleAvatarChange}
            disabled={avatarSaving}
          />
          {avatarSaving && <p className="text-[11px] text-[#808080] -mt-2">Saving picture…</p>}
          {avatarError && <p className="text-[11px] text-[#F44336] -mt-2">{avatarError}</p>}

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">First Name</label>
              <input
                className="w-full px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Middle Name</label>
              <input
                className="w-full px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Last Name</label>
              <input
                className="w-full px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Email Address</label>
            <input
              className="w-full px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" /> {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Settings Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance & Interface Theme Card */}
        <div className="lg:col-span-2 rounded bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#262626]">
            <h3 className="font-bold text-white text-xs sm:text-sm uppercase serif flex items-center gap-2">
              <Sun className="w-4 h-4 text-[#D4AF37]" />
              Display Theme &amp; Visual Appearance
            </h3>
            <span className="font-mono text-xs text-[#D4AF37] uppercase">Active: {theme} mode</span>
          </div>

          <p className="text-xs text-[#808080] font-light">
            Choose your preferred viewing contrast for high-sunlight outdoor field operations or indoor low-light monitoring.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Dark Theme Option */}
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-4 rounded border text-left transition-all flex items-start gap-3.5 ${
                theme === 'dark'
                  ? 'bg-[#1A1A1A] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 shadow-md'
                  : 'bg-[#0A0A0A] border-[#262626] hover:border-[#404040]'
              }`}
            >
              <div className="p-2.5 rounded bg-[#141414] border border-[#262626] text-[#D4AF37]">
                <Moon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">Sophisticated Dark</span>
                  {theme === 'dark' && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#D4AF37] text-black uppercase">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#808080] mt-1 leading-normal">
                  Deep carbon canvas (#0A0A0A), gold accents, optimized for night telemetry and lab monitoring.
                </p>
              </div>
            </button>

            {/* Light Theme Option */}
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-4 rounded border text-left transition-all flex items-start gap-3.5 ${
                theme === 'light'
                  ? 'bg-[#1A1A1A] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 shadow-md'
                  : 'bg-[#0A0A0A] border-[#262626] hover:border-[#404040]'
              }`}
            >
              <div className="p-2.5 rounded bg-[#141414] border border-[#262626] text-[#A37508]">
                <Sun className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">High-Contrast Light</span>
                  {theme === 'light' && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#D4AF37] text-black uppercase">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#808080] mt-1 leading-normal">
                  Crisp off-white canvas, sharp contrast, anti-glare for plantation field inspections in direct sunlight.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Database Backup & Disaster Recovery */}
        <div className="lg:col-span-2 rounded bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <h3 className="font-bold text-white text-xs sm:text-sm uppercase serif flex items-center gap-2">
              <Database className="w-4 h-4 text-[#D4AF37]" />
              Database &amp; State Persistence Snapshot
            </h3>
            <span className="font-mono text-xs text-[#D4AF37]">PostgreSQL / Local State</span>
          </div>

          {backupError && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336] text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {backupError}
            </div>
          )}
          {restoreError && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336] text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {restoreError}
            </div>
          )}
          {restoreSuccess && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#142416] border border-[#4CAF50]/30 text-[#4CAF50] text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {restoreSuccess}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <p className="text-[#808080] max-w-xl">
              Export full farm records, tree coordinates, transducer calibration logs, and pest-detection notification history into a JSON dump, stamped with a SHA-256 integrity hash. Farm owners' names, emails, phone numbers, addresses, and farm coordinates are encrypted in the file — unreadable to anyone without server access, and only decrypted automatically on restore.
            </p>

            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={backupBusy}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#D4AF37] font-semibold text-xs transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{backupBusy ? 'Exporting…' : 'Export System Backup'}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs pt-4 border-t border-[#262626]">
            <p className="text-[#808080] max-w-xl">
              Restore from a previously exported backup file. Its integrity hash is verified first, then every farm owner, node, tree, alert, and notification record is replaced with the file's contents.
            </p>

            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              disabled={restoreBusy}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#D4AF37] font-semibold text-xs transition-all disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{restoreBusy ? 'Restoring…' : 'Restore From Backup'}</span>
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreFileChosen}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};


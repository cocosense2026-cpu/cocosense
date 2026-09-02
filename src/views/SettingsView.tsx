import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { AvatarUpload } from '../components/AvatarUpload';
import { downloadJsonWithHash } from '../utils/exportHash';
import { useAdminAuth } from '../admin/context/AdminAuthContext';
import { adminApi, AdminApiError } from '../admin/api';
import { 
  Settings, 
  Save, 
  Sliders, 
  Radio, 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  BellRing,
  CheckCircle,
  CheckCircle2,
  UserCircle,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { admin, refreshAdmin, setAdminProfile } = useAdminAuth();
  const [freqThreshold, setFreqThreshold] = useState<number>(300);
  const [vibeThreshold, setVibeThreshold] = useState<number>(0.5);
  const [pollingInterval, setPollingInterval] = useState<number>(15);
  const [autoEmailAlerts, setAutoEmailAlerts] = useState<boolean>(true);
  const [psgcCacheEnabled, setPsgcCacheEnabled] = useState<boolean>(true);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Admin's own profile (name/email/picture) -- separate save flow from
  // the rest of this page's local-only DSP/UI settings, since this one
  // actually persists to the `admins` table and is what Navigation.tsx's
  // sidebar chip and the Farm Owners table pull the admin's own avatar
  // from.
  const [profileName, setProfileName] = useState(admin?.name || '');
  const [profileEmail, setProfileEmail] = useState(admin?.email || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(admin?.avatarUrl ?? null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (admin) {
      setProfileName(admin.name || '');
      setProfileEmail(admin.email || '');
      setProfileAvatarUrl(admin.avatarUrl ?? null);
    }
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
      const res = await adminApi.updateProfile({
        name: profileName,
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

  const handleDownloadBackup = async () => {
    const backupData = {
      version: '2.4.8',
      exportedAt: new Date().toISOString(),
      system: 'CocoSense Smart Plantation Telemetry',
      theme,
      frequencyThresholdHz: freqThreshold,
      vibrationThresholdG: vibeThreshold,
      pollingIntervalSec: pollingInterval,
    };
    // Adds an `integrityHash` field (SHA-256 over the rest of the
    // payload) so the backup can be verified before being restored.
    await downloadJsonWithHash('cocosense-system-backup.json', backupData);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            System Settings &amp; Bioacoustic Calibration
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Configure appearance theme, digital DSP filtering, piezoelectric trigger limits, and telemetry mesh storage.
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

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Full Name</label>
              <input
                className="w-full px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
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

        {/* DSP Calibration Card */}
        <div className="rounded bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <h3 className="font-bold text-white text-xs sm:text-sm uppercase serif flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#D4AF37]" />
              DSP Larval Acoustic Filter Thresholds
            </h3>
            <span className="font-mono text-xs text-[#D4AF37]">120Hz - 600Hz Band</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-bold text-[#808080] mb-1">
                <span>Pest Vibration Trigger Frequency</span>
                <span className="font-mono text-[#D4AF37] font-bold">{freqThreshold} Hz</span>
              </div>
              <input
                type="range"
                min="100"
                max="800"
                step="10"
                value={freqThreshold}
                onChange={e => setFreqThreshold(parseInt(e.target.value))}
                className="w-full accent-[#D4AF37]"
              />
              <p className="text-[11px] text-[#808080] mt-1">Frequencies above this threshold trigger automatic warning logs.</p>
            </div>

            <div>
              <div className="flex justify-between font-bold text-[#808080] mb-1">
                <span>Acceleration Amplitude Sensitivity (g)</span>
                <span className="font-mono text-[#D4AF37] font-bold">{vibeThreshold} g</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={vibeThreshold}
                onChange={e => setVibeThreshold(parseFloat(e.target.value))}
                className="w-full accent-[#D4AF37]"
              />
              <p className="text-[11px] text-[#808080] mt-1">Prevents false-positive triggers from wind gusts and heavy rainfall.</p>
            </div>
          </div>
        </div>

        {/* Mesh & Polling Configuration */}
        <div className="rounded bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <h3 className="font-bold text-white text-xs sm:text-sm uppercase serif flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#D4AF37]" />
              Master Mesh LoRaWAN Polling
            </h3>
            <span className="font-mono text-xs text-[#D4AF37]">ASCOT LoRa-915</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[#808080] mb-1.5 uppercase">Hub Polling Cycle Window</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[15, 30, 60, 300].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPollingInterval(s)}
                    className={`py-2 rounded font-mono text-xs font-bold border transition-all ${
                      pollingInterval === s
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                        : 'bg-[#0A0A0A] text-[#808080] border-[#262626] hover:text-white'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-center justify-between p-3 rounded bg-[#0A0A0A] border border-[#262626] cursor-pointer">
                <div className="pr-3">
                  <span className="font-bold text-white block">Auto-Dispatch Critical Email Alerts</span>
                  <span className="text-[11px] text-[#808080]">Notify farm owners within 60s of active pest detection</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoEmailAlerts}
                  onChange={e => setAutoEmailAlerts(e.target.checked)}
                  className="w-4 h-4 accent-[#D4AF37] flex-shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded bg-[#0A0A0A] border border-[#262626] cursor-pointer">
                <div className="pr-3">
                  <span className="font-bold text-white block">Local PSGC Geographic Offline Cache</span>
                  <span className="text-[11px] text-[#808080]">Cache Philippine administrative divisions for field offline operation</span>
                </div>
                <input
                  type="checkbox"
                  checked={psgcCacheEnabled}
                  onChange={e => setPsgcCacheEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#D4AF37] flex-shrink-0"
                />
              </label>
            </div>
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

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <p className="text-[#808080] max-w-xl">
              Export full farm records, tree coordinates, transducer calibration logs, and notification outbox entries into a JSON dump, stamped with a SHA-256 integrity hash.
            </p>

            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#D4AF37] font-semibold text-xs transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export System Backup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


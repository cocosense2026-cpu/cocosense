import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { superAdminApi, SuperAdminApiError } from '../api';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';
import { AvatarUpload } from '../../components/AvatarUpload';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

// Mirrors src/views/SettingsView.tsx's Admin Profile card -- same
// name/email/picture fields, PATCHed to /superadmin/profile instead of
// /admin/profile. Kept as its own page (rather than folding into an
// existing one) since the Super Admin console didn't have a Settings
// page/nav entry before this.
export const SuperAdminSettingsPage: React.FC = () => {
  const { superadmin, refreshSuperAdmin, setSuperAdminProfile } = useSuperAdminAuth();

  const [name, setName] = useState(superadmin?.name || '');
  const [email, setEmail] = useState(superadmin?.email || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(superadmin?.avatarUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (superadmin) {
      setName(superadmin.name || '');
      setEmail(superadmin.email || '');
      setAvatarUrl(superadmin.avatarUrl ?? null);
    }
  }, [superadmin]);

  const initials =
    (superadmin?.name || 'Super Admin')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'SA';

  // Picture changes save to the `superadmins` table the instant they're
  // made -- independent of the Name/Email fields below, which still
  // need the explicit "Save Profile" submit. Reverts the preview on
  // failure so the UI never shows a picture that didn't actually persist.
  const handleAvatarChange = async (dataUrl: string | null) => {
    const previous = avatarUrl;
    setAvatarUrl(dataUrl);
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      const res = await superAdminApi.updateProfile({ avatarUrl: dataUrl });
      setSuperAdminProfile(res.superadmin);
      setAvatarUrl(res.superadmin.avatarUrl ?? null);
    } catch (err) {
      setAvatarUrl(previous);
      setAvatarError(err instanceof SuperAdminApiError ? err.message : 'Could not save your picture. Please try again.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await superAdminApi.updateProfile({ name, email, avatarUrl });
      setSuperAdminProfile(res.superadmin);
      await refreshSuperAdmin();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof SuperAdminApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Super Admin Console"
        subtitle="Settings"
        title="Settings"
        description="Edit your Super Admin profile, including your name, email, and picture. This identity is shown across activity logs visible to the whole plantation network."
        accent="#D4AF37"
      />

      <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-lg space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336] text-xs">
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#142416] border border-[#4CAF50]/30 text-[#4CAF50] text-xs">
              <CheckCircle2 className="w-4 h-4" /> Profile updated successfully.
            </div>
          )}

          <AvatarUpload
            avatarUrl={avatarUrl}
            initials={initials}
            textColor="#D4AF37"
            name={superadmin?.name}
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
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Email Address</label>
              <input
                className="w-full px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>

      <PageFooterNote
        icon={ShieldCheck}
        text="Your Super Admin login has full network access — use a strong, unique password and avoid sharing this account."
        accent="#D4AF37"
      />
    </div>
  );
};

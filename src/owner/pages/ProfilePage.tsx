import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, History, ShieldCheck } from 'lucide-react';
import { ownerApi, OwnerApiError } from '../api';
import { useOwnerAuth } from '../context/OwnerAuthContext';
import { AvatarUpload } from '../../components/AvatarUpload';
import { Avatar } from '../../components/Avatar';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

interface ActivityRow {
  id: number;
  action: string;
  detail?: string;
  createdAt: string;
}

export const ProfilePage: React.FC = () => {
  const { owner, refreshOwner } = useOwnerAuth();
  const [firstName, setFirstName] = useState(owner?.firstName || '');
  const [middleName, setMiddleName] = useState(owner?.middleName || '');
  const [lastName, setLastName] = useState(owner?.lastName || '');
  const [email, setEmail] = useState(owner?.email || '');
  const [phone, setPhone] = useState(owner?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(owner?.avatarUrl ?? null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [activity, setActivity] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (owner) {
      setFirstName(owner.firstName || '');
      setMiddleName(owner.middleName || '');
      setLastName(owner.lastName || '');
      setEmail(owner.email || '');
      setPhone(owner.phone || '');
      setAvatarUrl(owner.avatarUrl ?? null);
    }
  }, [owner]);

  useEffect(() => {
    ownerApi
      .activity()
      .then(setActivity)
      .catch(() => void 0);
  }, []);

  // Picture changes save to this owner's own row the instant they're
  // made -- independent of the Name/Email/Phone fields below, which
  // still need the explicit "Save Changes" submit. Reverts the preview
  // on failure so a picture is never shown as "set" unless it actually
  // persisted to the database.
  const handleAvatarChange = async (dataUrl: string | null) => {
    const previous = avatarUrl;
    setAvatarUrl(dataUrl);
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      await ownerApi.updateProfile({ avatarUrl: dataUrl });
      await refreshOwner();
    } catch (err) {
      setAvatarUrl(previous);
      setAvatarError(err instanceof OwnerApiError ? err.message : 'Could not save your picture. Please try again.');
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
      await ownerApi.updateProfile({ firstName, middleName, lastName, email, phone, avatarUrl });
      await refreshOwner();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err instanceof OwnerApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    setSavingPw(true);
    setPwError(null);
    setPwSaved(false);
    try {
      await ownerApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      setPwError(err instanceof OwnerApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSavingPw(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors';
  const labelClass = 'block text-xs font-semibold text-[#A0A0A0] mb-1.5';

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="My Profile"
        title="My Profile"
        description="Keep your contact details current so plantation alerts, invoices and technician visits reach the right person — and manage your password here."
      />

      <div className="flex items-center gap-4">
        <Avatar
          avatarUrl={owner?.avatarUrl}
          initials={owner?.initials || 'FO'}
          textColor="#D4AF37"
          name={owner?.name}
          size="lg"
        />
        <div className="min-w-0">
          <div className="text-lg font-bold text-white truncate">{owner?.name || 'Farm Owner'}</div>
          <div className="text-xs text-[#808080] truncate">{owner?.email}</div>
        </div>
        <span className="ml-auto px-2.5 py-1 rounded bg-[#142416] border border-[#4CAF50]/30 text-[#4CAF50] text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
          Farm Owner
        </span>
      </div>

      {/* Edit profile */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5">Edit Profile</div>
        <div className="rounded-lg bg-[#141414] border border-[#262626] p-5 sm:p-6">
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
              avatarUrl={avatarUrl}
              initials={owner?.initials || 'FO'}
              textColor="#D4AF37"
              name={owner?.name}
              onChange={handleAvatarChange}
              disabled={avatarSaving}
            />
            {avatarSaving && <p className="text-[11px] text-[#808080] -mt-2">Saving picture…</p>}
            {avatarError && <p className="text-[11px] text-[#F44336] -mt-2">{avatarError}</p>}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name</label>
                <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Middle Name</label>
                <input className={inputClass} value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Phone Number</label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 900 000 0000"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black text-sm font-bold transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>

      {/* Security */}
      <div id="security">
        <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5">Security</div>
        <div className="rounded-lg bg-[#141414] border border-[#262626] p-5 sm:p-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
            {pwError && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336] text-xs">
                {pwError}
              </div>
            )}
            {pwSaved && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#142416] border border-[#4CAF50]/30 text-[#4CAF50] text-xs">
                <CheckCircle2 className="w-4 h-4" /> Password changed successfully.
              </div>
            )}
            <div>
              <label className={labelClass}>Current Password</label>
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>New Password</label>
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Confirm New Password</label>
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={savingPw}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-[#1A1A1A] hover:bg-[#222] border border-[#333333] text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Lock className="w-4 h-4" /> {savingPw ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5">Recent Activity</div>
        <div className="rounded-lg bg-[#141414] border border-[#262626] divide-y divide-[#262626] overflow-hidden">
          {activity.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#808080]">
              <History className="w-6 h-6 mx-auto mb-2 opacity-40" /> No activity recorded yet.
            </div>
          ) : (
            activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3.5">
                <span className="p-1.5 rounded bg-[#0E0E0E] border border-[#262626] text-[#808080] flex-shrink-0">
                  <History className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{a.action}</div>
                  <div className="text-[11px] text-[#808080]">
                    {a.detail ? `${a.detail} · ` : ''}
                    {new Date(a.createdAt.replace(' ', 'T') + 'Z').toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <PageFooterNote
        icon={ShieldCheck}
        text="Changing your password signs you out of all other devices immediately for your security."
      />
    </div>
  );
};

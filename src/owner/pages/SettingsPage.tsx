import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, Mail, Smartphone, Bell, Activity, ShieldCheck, Pencil, Lock, LogOut, ShieldAlert } from 'lucide-react';
import { ownerApi } from '../api';
import { useOwnerAuth } from '../context/OwnerAuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../../components/Avatar';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

interface OwnerSettings {
  notifyEmail: number;
  notifySms: number;
  notifyPush: number;
  localBuzzerAlert: number;
  notifyCriticalOnly: number;
  theme: string;
}

const TOGGLES: Array<{ key: keyof OwnerSettings; icon: React.ComponentType<any>; label: string; desc: string; danger?: boolean }> = [
  { key: 'notifyEmail', icon: Mail, label: 'Email Notifications', desc: 'Receive alert and report summaries by email.' },
  { key: 'notifySms', icon: Smartphone, label: 'SMS Notifications', desc: 'Get critical alerts via text message.' },
  { key: 'notifyPush', icon: Bell, label: 'Push Notifications', desc: 'In-app and browser push notifications.' },
  { key: 'localBuzzerAlert', icon: Activity, label: 'Local Buzzer Alert', desc: 'Sound the on-site buzzer for critical events.' },
  {
    key: 'notifyCriticalOnly',
    icon: ShieldCheck,
    label: 'Critical Alerts Only',
    desc: 'Suppress low-priority notifications entirely.',
    danger: true,
  },
];

export const SettingsPage: React.FC = () => {
  const { owner, logout } = useOwnerAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<OwnerSettings | null>(null);

  useEffect(() => {
    ownerApi
      .settings()
      .then(setSettings)
      .catch(() => void 0);
  }, []);

  const patch = async (partial: Partial<OwnerSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    await ownerApi.updateSettings(next).catch(() => void 0);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/owner/login', { replace: true });
  };

  if (!settings) {
    return <div className="h-40 rounded-lg bg-[#141414] border border-[#262626] animate-pulse" />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Settings"
        title="Settings"
        description="Control how CocoSense reaches you, how the app looks, and how to manage your account and password."
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
      </div>

      {/* Appearance */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5">Appearance</div>
        <div className="rounded-lg bg-[#141414] border border-[#262626] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-[#D4AF37]" /> : <Sun className="w-4 h-4 text-[#D4AF37]" />}
            Display Theme
          </div>
          <div className="flex items-center gap-1 bg-[#0E0E0E] border border-[#262626] rounded p-0.5">
            <button
              type="button"
              onClick={() => {
                setTheme('light');
                patch({ theme: 'Light' });
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                theme === 'light' ? 'bg-[#D4AF37] text-black' : 'text-[#808080] hover:text-white'
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => {
                setTheme('dark');
                patch({ theme: 'Dark' });
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                theme === 'dark' ? 'bg-[#D4AF37] text-black' : 'text-[#808080] hover:text-white'
              }`}
            >
              Dark
            </button>
          </div>
        </div>
      </div>

      {/* Notification preferences */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5">
          Notification Preferences
        </div>
        <div className="rounded-lg bg-[#141414] border border-[#262626] divide-y divide-[#262626] overflow-hidden">
          {TOGGLES.map(({ key, icon: Icon, label, desc, danger }) => {
            const checked = !!settings[key];
            return (
              <div key={key} className="flex items-center gap-3 p-4">
                <span
                  className={`p-2 rounded flex-shrink-0 border ${
                    danger
                      ? 'bg-[#2B1B1B] border-[#F44336]/30 text-[#F44336]'
                      : 'bg-[#0E0E0E] border-[#262626] text-[#D4AF37]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="text-xs text-[#808080]">{desc}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={() => patch({ [key]: checked ? 0 : 1 } as Partial<OwnerSettings>)}
                  className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${
                    checked ? 'bg-[#D4AF37]' : 'bg-[#333333]'
                  }`}
                  style={{ height: 22 }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 rounded-full bg-white transition-transform"
                    style={{ width: 18, height: 18, transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] mb-2.5">Account</div>
        <div className="rounded-lg bg-[#141414] border border-[#262626] divide-y divide-[#262626] overflow-hidden">
          <Link to="/owner/profile" className="flex items-center gap-3 p-4 hover:bg-[#1A1A1A] transition-colors">
            <span className="p-2 rounded bg-[#0E0E0E] border border-[#262626] text-[#D4AF37]">
              <Pencil className="w-4 h-4" />
            </span>
            <div className="text-sm font-semibold text-white">Edit Profile</div>
          </Link>
          <Link to="/owner/profile#security" className="flex items-center gap-3 p-4 hover:bg-[#1A1A1A] transition-colors">
            <span className="p-2 rounded bg-[#0E0E0E] border border-[#262626] text-[#D4AF37]">
              <Lock className="w-4 h-4" />
            </span>
            <div className="text-sm font-semibold text-white">Security</div>
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#2B1B1B] border border-[#F44336]/30 text-[#F44336] text-sm font-bold hover:bg-[#341f1f] transition-colors"
      >
        <LogOut className="w-4 h-4" /> Log Out
      </button>

      <PageFooterNote
        icon={ShieldAlert}
        text="Critical Alerts Only silences low-priority notices — keep at least one channel on so you never miss an active infestation warning."
      />
    </div>
  );
};

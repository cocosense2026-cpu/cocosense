import React, { useEffect, useState } from 'react';
import { UserPlus, X, Power, Trash2, Mail, User, Copy, Check, ShieldAlert } from 'lucide-react';
import { superAdminApi, AdminAccount, SuperAdminApiError } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

export const SuperAdminAdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await superAdminApi.listAdmins();
      setAdmins(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof SuperAdminApiError ? err.message : 'Failed to load admin accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleToggleStatus = async (admin: AdminAccount) => {
    const nextStatus = admin.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await superAdminApi.setAdminStatus(admin.id, nextStatus);
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? res.admin : a)));
      showToast(`${admin.name} is now ${nextStatus}.`);
    } catch (err) {
      showToast(err instanceof SuperAdminApiError ? err.message : 'Failed to update account status.');
    }
  };

  const handleRemove = async (admin: AdminAccount) => {
    if (!window.confirm(`Remove ${admin.name}'s admin account? This cannot be undone.`)) return;
    try {
      await superAdminApi.removeAdmin(admin.id);
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
      showToast(`Removed ${admin.name} from admin accounts.`);
    } catch (err) {
      showToast(err instanceof SuperAdminApiError ? err.message : 'Failed to remove account.');
    }
  };

  const activeCount = admins.filter((a) => a.status === 'Active').length;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Super Admin Console"
        subtitle="Admin Accounts"
        title="Admin Accounts"
        description={`${admins.length} account${admins.length === 1 ? '' : 's'} · ${activeCount} active. Create and manage the admin console logins for your plantation operations team.`}
        accent="#D4AF37"
        actions={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-black text-xs font-bold transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Create Admin Account
          </button>
        }
      />

      {error && <div className="rounded-xl bg-[#2B1B1B] border border-[#F44336]/40 p-4 text-xs text-[#F44336]">{error}</div>}

      <div className="rounded-xl bg-[#141414] border border-[#262626] shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#808080]">Loading admin accounts…</div>
        ) : admins.length === 0 ? (
          <div className="p-10 text-center">
            <UserPlus className="w-6 h-6 text-[#404040] mx-auto" />
            <p className="text-xs text-[#808080] mt-2">No admin accounts yet. Create the first one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#808080] border-b border-[#262626] bg-[#0E0E0E]">
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Created</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[#262626] last:border-0 hover:bg-[#141414]/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-white">{a.name}</td>
                    <td className="py-3 px-4 text-[#A0A0A0] font-mono">{a.email}</td>
                    <td className="py-3 px-4 text-[#A0A0A0]">{a.role}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          a.status === 'Active'
                            ? 'bg-[#142416] text-[#4CAF50] border-[#4CAF50]/30'
                            : 'bg-[#2B1B1B] text-[#F44336] border-[#F44336]/30'
                        }`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#606060] font-mono">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(a)}
                          title={a.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                          className={`p-1.5 rounded border transition-colors ${
                            a.status === 'Active'
                              ? 'border-[#262626] text-[#808080] hover:text-[#F44336] hover:bg-[#2B1B1B]'
                              : // Border/text-only hover (no bg fill) -- the
                                // app's palette has no light-mode-mapped
                                // green hover background, so filling this
                                // with one (e.g. #0F2416) would render as a
                                // near-black square once switched to light
                                // mode, the same class of bug as the row
                                // hover above.
                                'border-[#4CAF50]/30 text-[#4CAF50] hover:border-[#4CAF50]'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(a)}
                          title="Remove account"
                          className="p-1.5 rounded border border-[#262626] text-[#808080] hover:text-[#F44336] hover:bg-[#2B1B1B] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PageFooterNote
        icon={ShieldAlert}
        text="New accounts receive a temporary password shown once at creation — make sure it's shared with the admin securely, since it can't be retrieved again."
        accent="#D4AF37"
      />

      {showForm && (
        <CreateAdminModal
          onClose={() => setShowForm(false)}
          onCreated={(admin) => {
            setAdmins((prev) => [admin, ...prev]);
            setShowForm(false);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 rounded bg-[#141414] border border-[#D4AF37] text-white px-4 py-3 sm:px-5 sm:py-3.5 font-medium text-xs shadow-2xl flex items-center gap-3 max-w-[90vw]">
          <div className="w-2 h-2 rounded-full bg-[#D4AF37] flex-shrink-0"></div>
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
};

const CreateAdminModal: React.FC<{ onClose: () => void; onCreated: (admin: AdminAccount) => void }> = ({
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Administrator');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ admin: AdminAccount; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await superAdminApi.createAdmin({ name: name.trim(), email: email.trim(), role });
      setResult(res);
    } catch (err) {
      setError(err instanceof SuperAdminApiError ? err.message : 'Failed to create admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard?.writeText(result.temporaryPassword).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl bg-[#141414] border border-[#262626] shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-white">
            {result ? 'Admin Account Created' : 'Create Admin Account'}
          </h2>
          <button type="button" onClick={onClose} className="text-[#808080] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <p className="text-xs text-[#A0A0A0] leading-relaxed">
              <span className="font-bold text-white">{result.admin.name}</span> can now sign in at the admin console
              with the temporary password below. They should change it after their first sign-in.
            </p>
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626]">
              <span className="font-mono text-sm text-[#D4AF37]">{result.temporaryPassword}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[#808080] hover:text-white flex items-center gap-1 text-[10px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#4CAF50]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => onCreated(result.admin)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black text-sm font-bold transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div className="px-3.5 py-2.5 rounded bg-[#2B1B1B] border border-[#F44336]/40 text-[#F44336] text-xs">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maria Santos"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#606060] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cocosense.ph"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm placeholder:text-[#4A4A4A] focus:outline-none focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded bg-[#0E0E0E] border border-[#262626] text-white text-sm focus:outline-none focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/30 transition-colors"
              >
                <option>Administrator</option>
                <option>System Administrator</option>
                <option>Field Operations Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] disabled:bg-[#D4AF37]/80 disabled:hover:bg-[#D4AF37]/80 text-black disabled:text-black/80 text-sm font-bold transition-colors disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating…' : 'Create Account'}
            </button>
            <p className="text-[10px] text-[#606060] font-mono text-center">
              A temporary password is generated automatically.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

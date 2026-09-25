import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Bug, Radio, UserCog, UserPlus, Globe2, History, CheckCircle2, Radar } from 'lucide-react';
import { superAdminApi, OverviewTotals, OwnerRollup, AdminAccount, ActivityEntry } from '../api';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';
import { StatTile } from '../components/StatTile';
import { Avatar } from '../../components/Avatar';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

export const SuperAdminDashboardPage: React.FC = () => {
  const { superadmin } = useSuperAdminAuth();
  const [totals, setTotals] = useState<OverviewTotals | null>(null);
  const [owners, setOwners] = useState<OwnerRollup[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [overviewRes, adminsRes, activityRes] = await Promise.all([
          superAdminApi.overview(),
          superAdminApi.listAdmins(),
          superAdminApi.activity().catch(() => []),
        ]);
        if (cancelled) return;
        setTotals(overviewRes.totals);
        setOwners(overviewRes.owners);
        setAdmins(adminsRes);
        setActivity(activityRes);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load dashboard data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const offlineOwners = owners.filter((o) => o.piezoHealth !== 'Working');
  const firstName = (superadmin?.name || 'Super Admin').split(' ')[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Super Admin Console"
        subtitle="Live Sync Active"
        title={`Welcome back, ${firstName}.`}
        description="Network-wide command center across every registered plantation — farm owners, master nodes, and admin accounts, all in one place."
        accent="#D4AF37"
      />

      {error && (
        <div className="rounded-xl bg-[#2B1B1B] border border-[#F44336]/40 p-4 text-xs text-[#F44336]">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatTile
          label="Farm Owners"
          value={loading ? '—' : totals?.totalOwners ?? 0}
          hint={loading ? undefined : `${(totals?.totalTrees ?? 0).toLocaleString()} trees monitored`}
          icon={<Users className="w-4 h-4" />}
          accent="gold"
        />
        <StatTile
          label="Flagged Infected Trees"
          value={loading ? '—' : totals?.totalInfectedTrees ?? 0}
          hint={loading ? undefined : (totals?.totalInfectedTrees ?? 0) > 0 ? 'Needs attention' : 'All clear'}
          icon={<Bug className="w-4 h-4" />}
          accent={(totals?.totalInfectedTrees ?? 0) > 0 ? 'red' : 'green'}
        />
        <StatTile
          label="Master Nodes"
          value={loading ? '—' : totals?.totalNodes ?? 0}
          hint={
            loading
              ? undefined
              : offlineOwners.length > 0
              ? `${offlineOwners.length} owner(s) offline`
              : 'All owners healthy'
          }
          icon={<Radio className="w-4 h-4" />}
          accent={offlineOwners.length > 0 ? 'red' : 'green'}
        />
        <StatTile
          label="Admin Accounts"
          value={loading ? '—' : admins.length}
          hint={loading ? undefined : `${totals?.activeAdmins ?? 0} active`}
          icon={<UserCog className="w-4 h-4" />}
          accent="gold"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Recent Activity</h2>
            <span className="text-[11px] text-[#808080]">Your last actions in this portal</span>
          </div>
          {activity.length === 0 ? (
            <div className="text-center py-9">
              <History className="w-6 h-6 text-[#404040] mx-auto" />
              <p className="text-xs text-[#808080] mt-2">
                Nothing logged yet — actions you take here will show up in this feed.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {activity.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 py-2.5 border-b border-[#262626] last:border-0">
                  <span className="w-7 h-7 rounded-lg bg-[#1A1A1A] border border-[#262626] flex items-center justify-center flex-shrink-0">
                    <History className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-white">{ev.action}</div>
                    {ev.detail && <div className="text-xs text-[#808080] mt-0.5">{ev.detail}</div>}
                    <div className="font-mono text-[10px] text-[#606060] mt-0.5">
                      {new Date(ev.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-lg">
            <h2 className="text-sm font-bold text-white mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                to="/superadmin/admins"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-black text-xs font-bold transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Create Admin Account
              </Link>
              <Link
                to="/superadmin/overview"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#1A1A1A] hover:bg-[#222222] border border-[#333333] text-[#E0E0E0] text-xs font-semibold transition-colors"
              >
                <Globe2 className="w-4 h-4" /> Plantation Overview
              </Link>
            </div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Admin Accounts</h2>
              <Link to="/superadmin/admins" className="text-[11px] text-[#D4AF37] hover:underline">
                View All
              </Link>
            </div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#808080]">Active</span>
              <span className="font-mono font-bold text-white">{totals?.activeAdmins ?? 0}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#262626] overflow-hidden">
              <div
                className="h-full bg-[#15803D]"
                style={{
                  width: `${admins.length ? ((totals?.activeAdmins ?? 0) / admins.length) * 100 : 0}%`,
                }}
              />
            </div>
            {admins.some((a) => a.status !== 'Active') && (
              <div className="flex items-center justify-between text-xs mt-3">
                <span className="text-[#808080]">Deactivated</span>
                <span className="font-mono font-bold text-white">
                  {admins.filter((a) => a.status !== 'Active').length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#141414] border border-[#262626] p-5 sm:p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white">Node Health by Owner</h2>
          <Link to="/superadmin/overview" className="text-[11px] text-[#D4AF37] hover:underline">
            Full Overview
          </Link>
        </div>
        {offlineOwners.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-6 h-6 text-[#4CAF50] mx-auto" />
            <p className="text-xs text-[#808080] mt-2">Every registered farm owner's master node is reporting Working.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#808080] border-b border-[#262626]">
                  <th className="py-2 font-semibold">Farm Owner</th>
                  <th className="py-2 font-semibold">Master Nodes</th>
                  <th className="py-2 font-semibold">Node Health</th>
                </tr>
              </thead>
              <tbody>
                {offlineOwners.slice(0, 6).map((o) => (
                  <tr key={o.id} className="border-b border-[#262626] last:border-0">
                    <td className="py-2.5 font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          avatarUrl={o.avatarUrl}
                          initials={o.initials}
                          color={o.color}
                          name={o.name}
                          size="xs"
                          shape="square"
                        />
                        <span>{o.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 font-mono text-[#A0A0A0]">{o.nodesCount}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30">
                        OFFLINE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PageFooterNote
        icon={Radar}
        text="Totals reflect the latest sync from every farm owner's master node. Owners flagged offline haven't reported in over 15 minutes."
        accent="#D4AF37"
        action={
          <Link to="/superadmin/overview" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#D4AF37] hover:underline">
            Full Overview &rarr;
          </Link>
        }
      />
    </div>
  );
};

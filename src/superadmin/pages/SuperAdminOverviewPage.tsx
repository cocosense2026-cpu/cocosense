import React, { useEffect, useState } from 'react';
import { Globe2, TreeDeciduous, Bug, Radio, MapPinned } from 'lucide-react';
import { superAdminApi, OverviewTotals, OwnerRollup, SuperAdminApiError } from '../api';
import { StatTile } from '../components/StatTile';
import { Avatar } from '../../components/Avatar';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

export const SuperAdminOverviewPage: React.FC = () => {
  const [owners, setOwners] = useState<OwnerRollup[]>([]);
  const [totals, setTotals] = useState<OverviewTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    superAdminApi
      .overview()
      .then((res) => {
        if (cancelled) return;
        setOwners(res.owners);
        setTotals(res.totals);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof SuperAdminApiError ? err.message : 'Failed to load overview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Super Admin Console"
        subtitle="Plantation Overview"
        title="Plantation Overview"
        description="Network-wide rollup across every registered farm owner — tree counts, infection flags, and master node health, side by side."
        accent="#D4AF37"
      />

      {error && <div className="rounded-xl bg-[#2B1B1B] border border-[#F44336]/40 p-4 text-xs text-[#F44336]">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatTile
          label="Farm Owners"
          value={loading ? '—' : totals?.totalOwners ?? 0}
          icon={<Globe2 className="w-4 h-4" />}
          accent="gold"
        />
        <StatTile
          label="Monitored Trees"
          value={loading ? '—' : (totals?.totalTrees ?? 0).toLocaleString()}
          icon={<TreeDeciduous className="w-4 h-4" />}
          accent="green"
        />
        <StatTile
          label="Infected Trees"
          value={loading ? '—' : totals?.totalInfectedTrees ?? 0}
          icon={<Bug className="w-4 h-4" />}
          accent={(totals?.totalInfectedTrees ?? 0) > 0 ? 'red' : 'green'}
        />
        <StatTile
          label="Master Nodes"
          value={loading ? '—' : totals?.totalNodes ?? 0}
          hint={loading ? undefined : `${totals?.offlineOwners ?? 0} owner(s) offline`}
          icon={<Radio className="w-4 h-4" />}
          accent={(totals?.offlineOwners ?? 0) > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="rounded-xl bg-[#141414] border border-[#262626] shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#808080]">Loading plantation data…</div>
        ) : owners.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#808080]">No farm owners registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#808080] border-b border-[#262626] bg-[#0E0E0E]">
                  <th className="py-3 px-4 font-semibold">Farm Owner</th>
                  <th className="py-3 px-4 font-semibold">Sector</th>
                  <th className="py-3 px-4 font-semibold">Master Nodes</th>
                  <th className="py-3 px-4 font-semibold">Trees</th>
                  <th className="py-3 px-4 font-semibold">Infected</th>
                  <th className="py-3 px-4 font-semibold">Node Health</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr
                    key={o.id}
                    // hover fill uses the exact `bg-[#141414]/40` token the
                    // rest of the app already uses for row/nav hovers --
                    // it has a matching light-mode override
                    // (src/index.css), unlike an ad-hoc shade such as
                    // #171717 which has none and renders as a near-black
                    // row once the site is in light mode.
                    className="border-b border-[#262626] last:border-0 hover:bg-[#141414]/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-white">
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
                    <td className="py-3 px-4 text-[#A0A0A0]">{o.sector || '—'}</td>
                    <td className="py-3 px-4 font-mono text-[#A0A0A0]">{o.nodesCount}</td>
                    <td className="py-3 px-4 font-mono text-[#A0A0A0]">{o.treesCount.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono">
                      <span className={o.infectedTreesCount > 0 ? 'text-[#F44336]' : 'text-[#A0A0A0]'}>
                        {o.infectedTreesCount}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          o.piezoHealth === 'Working'
                            ? 'bg-[#142416] text-[#4CAF50] border-[#4CAF50]/30'
                            : 'bg-[#2B1B1B] text-[#F44336] border-[#F44336]/30'
                        }`}
                      >
                        {o.piezoHealth === 'Working' ? 'WORKING' : 'OFFLINE'}
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
        icon={MapPinned}
        text="Node Health reflects each owner's most recently reporting master node. An owner shows OFFLINE once every node under them has missed its check-in window."
        accent="#D4AF37"
      />
    </div>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, AlertTriangle, Bug, Trash2, Clock, Inbox } from 'lucide-react';
import { ownerApi } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';
import { usePolling } from '../../hooks/usePolling';

interface NotifItem {
  id: string;
  icon?: string;
  title: string;
  message: string;
  category: string;
  createdAt: string;
  isRead: boolean;
}

// Pest detection is the only notification category now, so "All" and
// "Pest Activity" resolve to the same feed -- the tabs are kept simple
// rather than offering categories that will never have anything in them.
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'alert', label: 'Pest Activity' },
];

const ICONS: Record<string, React.ComponentType<any>> = {
  bug: Bug,
  'alert-triangle': AlertTriangle,
  bell: Bell,
};

function formatTime(iso: string): string {
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const NotificationsPage: React.FC = () => {
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = (f: string) => {
    setLoading(true);
    ownerApi
      .notifications(f)
      .then((res) => {
        setNotifications(res.notifications);
        setActiveAlertCount(res.activeAlertCount);
      })
      .catch(() => void 0)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Quiet refresh (no loading spinner) so new alerts/notifications show
  // up on their own without the page flickering every 10 seconds.
  const quietRefresh = useCallback(() => {
    ownerApi
      .notifications(filter)
      .then((res) => {
        setNotifications(res.notifications);
        setActiveAlertCount(res.activeAlertCount);
      })
      .catch(() => void 0);
  }, [filter]);
  usePolling(quietRefresh, 10000);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await ownerApi.markNotificationRead(id).catch(() => void 0);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await ownerApi.markAllNotificationsRead().catch(() => void 0);
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await ownerApi.deleteNotification(id).catch(() => void 0);
  };

  const clearedToday = notifications.filter((n) => {
    const d = new Date(n.createdAt.replace(' ', 'T') + 'Z');
    const today = new Date();
    return n.isRead && d.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Notifications"
        title="Notifications"
        description="Stay updated with real-time bioacoustic pest detection alerts across your plantation."
        actions={
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#1A1A1A] hover:bg-[#222] border border-[#262626] text-[#D4AF37] text-xs font-semibold transition-all"
          >
            <CheckCheck className="w-4 h-4" /> Mark All Read
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded bg-[#141414] border border-[#262626] p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-[#808080] font-bold">Active Alerts</div>
          <div className="text-xl font-bold text-[#F44336] mt-1">{String(activeAlertCount).padStart(2, '0')}</div>
        </div>
        <div className="rounded bg-[#142416] border border-[#4CAF50]/30 p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-[#808080] font-bold">Cleared Today</div>
          <div className="text-xl font-bold text-[#4CAF50] mt-1">{clearedToday}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all ${
              filter === tab.key
                ? 'bg-[#D4AF37] text-black font-bold shadow-md'
                : 'bg-[#141414] text-[#808080] hover:text-white border border-[#262626]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          [0, 1, 2].map((i) => <div key={i} className="h-20 rounded bg-[#141414] border border-[#262626] animate-pulse" />)
        ) : notifications.length === 0 ? (
          <div className="rounded bg-[#141414] border border-[#262626] p-12 text-center text-[#808080]">
            <Bell className="w-10 h-10 text-[#808080]/40 mx-auto mb-3" />
            <h3 className="font-bold text-white text-base">You're all caught up</h3>
            <p className="text-xs mt-1">No notifications in this category.</p>
          </div>
        ) : (
          notifications.map((item) => {
            const Icon = ICONS[item.icon || 'bell'] || Bell;
            const isAlert = item.category === 'alert';
            return (
              <div
                key={item.id}
                className={`p-4 rounded border transition-all flex items-start justify-between gap-4 ${
                  item.isRead ? 'bg-[#101010] border-[#262626] opacity-70' : 'bg-[#141414] border-[#D4AF37]/30 shadow-lg'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`p-2.5 rounded flex-shrink-0 ${
                      isAlert
                        ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
                        : 'bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white truncate">{item.title}</h4>
                      {!item.isRead && <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse flex-shrink-0"></span>}
                    </div>
                    <p className="text-xs text-[#E0E0E0] mt-0.5">{item.message}</p>
                    <div className="text-[11px] text-[#808080] font-mono mt-1.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(item.id)}
                      className="text-[11px] text-[#D4AF37] hover:text-[#E5C158] font-semibold"
                    >
                      Mark read
                    </button>
                  )}
                  {item.id.startsWith('n-') && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded hover:bg-[#2B1B1B] text-[#808080] hover:text-[#F44336]"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <PageFooterNote
        icon={Inbox}
        text="Notifications are kept for 90 days. Pest activity alerts marked read stay in your history and can still be reviewed from the Vibration Events log."
      />
    </div>
  );
};

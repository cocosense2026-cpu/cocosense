import React from 'react';
import { NotificationItem } from '../types';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  AlertTriangle, 
  Clock 
} from 'lucide-react';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onToggleRead: (id: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onToggleRead,
}) => {
  // Pest detection is now the only notification category (see
  // server/routes/ingest.js -- the sole source of real notification
  // rows), so there's nothing left to filter by.
  const filtered = notifications;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            Live Notification Center
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Real-time bioacoustic pest detection alerts across every monitored sector.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#D4AF37] text-xs font-semibold transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#141414] hover:bg-[#1C1212] border border-[#262626] text-[#F44336] text-xs font-semibold transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded bg-[#141414] border border-[#262626] p-12 text-center text-[#808080]">
            <Bell className="w-10 h-10 text-[#808080]/40 mx-auto mb-3" />
            <h3 className="font-bold text-white text-base">No pest detection notifications yet</h3>
          </div>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              onClick={() => onToggleRead(String(item.id))}
              className={`p-4 rounded border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                item.read
                  ? 'bg-[#101010] border-[#262626] opacity-70'
                  : 'bg-[#141414] border-[#D4AF37]/30 shadow-lg'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded flex-shrink-0 bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30">
                  <AlertTriangle className="w-4 h-4" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white">{item.title}</h4>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-xs text-[#E0E0E0] mt-0.5">{item.message}</p>
                  <div className="text-[11px] text-[#808080] font-mono mt-1.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>{item.timestamp || item.createdAt}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { BrandLogo } from './BrandLogo';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './Avatar';
import { useAdminAuth } from '../admin/context/AdminAuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Trees, 
  AlertTriangle, 
  Radio, 
  Cpu, 
  FileText, 
  Bell, 
  Settings, 
  X,
  ChevronRight,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';

export type ActiveView = 
  | 'dashboard'
  | 'owners'
  | 'trees'
  | 'alerts'
  | 'nodes'
  | 'diagnostics'
  | 'reports'
  | 'notifications'
  | 'settings';

interface NavigationProps {
  currentView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  unreadCount: number;
  criticalAlertsCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onViewChange,
  unreadCount,
  criticalAlertsCount,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const { admin, logout } = useAdminAuth();
  const adminName = admin?.name || 'Administrator';
  const adminRole = admin?.role || 'Administrator';
  const adminInitials = adminName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'AD';

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
  };

  const navItems = [
    { id: 'dashboard' as ActiveView, label: 'Dashboard & Radar', icon: LayoutDashboard, badge: null },
    { id: 'owners' as ActiveView, label: 'Farm Owners', icon: Users, badge: '5' },
    { id: 'trees' as ActiveView, label: 'Monitored Trees', icon: Trees, badge: '12.4k' },
    { id: 'alerts' as ActiveView, label: 'Alert History', icon: AlertTriangle, badge: criticalAlertsCount > 0 ? `${criticalAlertsCount} CRIT` : null, alertTone: true },
    { id: 'nodes' as ActiveView, label: 'Master Node Mesh', icon: Radio, badge: '98%' },
    { id: 'diagnostics' as ActiveView, label: 'Hardware Diagnostic', icon: Cpu, badge: null },
    { id: 'reports' as ActiveView, label: 'Bioacoustic Reports', icon: FileText, badge: null },
    { id: 'notifications' as ActiveView, label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? `${unreadCount}` : null },
    { id: 'settings' as ActiveView, label: 'Settings & Security', icon: Settings, badge: null },
  ];

  const handleNavClick = (view: ActiveView) => {
    onViewChange(view);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0A0A0A] border-r border-[#262626] flex-shrink-0 h-screen sticky top-0 z-40 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-6 pb-5 border-b border-[#262626]">
          <div className="flex items-center gap-3 mb-5">
            <BrandLogo variant="horizontal" size="md" animateSweep={false} showTagline={false} />
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded bg-[#141414] border border-[#262626] text-xs">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
              <span className="text-[11px] font-medium text-white">Live Telemetry</span>
            </div>
            <span className="font-mono text-[10px] text-[#808080]">98.4% Sync</span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] px-3 mb-2">
            Navigation
          </div>

          <div className="space-y-1">
            {navItems.map(item => {
              const isActive = currentView === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors rounded ${
                    isActive
                      ? 'text-[#D4AF37] font-medium bg-[#141414] border border-[#262626]'
                      : 'text-[#808080] hover:text-white hover:bg-[#141414]/40 font-normal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isActive ? 'bg-[#D4AF37]' : 'bg-transparent border border-[#404040]'
                      }`}
                    ></span>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-[#808080]'}`} />
                    <span className="tracking-wide truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-tighter uppercase ml-2 flex-shrink-0 ${
                        item.alertTone
                          ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
                          : 'bg-[#1A1A1A] text-[#808080] border border-[#333333]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Card & Theme Switcher */}
        <div className="mt-auto p-4 border-t border-[#262626] bg-[#0A0A0A] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 flex-shrink-0">
                <Avatar
                  avatarUrl={admin?.avatarUrl}
                  initials={adminInitials}
                  textColor="#D4AF37"
                  name={adminName}
                  size="xs"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{adminName}</p>
                <p className="text-[10px] text-[#808080] truncate">{adminRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle variant="icon" />
              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#808080] hover:text-white transition-colors"
                title="Account Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded hover:bg-[#2B1B1B] text-[#808080] hover:text-[#F44336] transition-colors"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Slide-down Drawer Backdrop & Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <BrandLogo variant="horizontal" size="sm" animateSweep={false} />
              <div className="flex items-center gap-2">
                <ThemeToggle variant="pill" showLabel={true} />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded bg-[#141414] border border-[#262626] text-[#808080] hover:text-white"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {navItems.map(item => {
                const isActive = currentView === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#141414] text-[#D4AF37] border border-[#262626]'
                        : 'text-[#808080] hover:text-white hover:bg-[#141414]/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#D4AF37]' : 'border border-[#404040]'}`}></span>
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${item.alertTone ? 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30' : 'bg-[#1A1A1A] text-[#808080]'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="pt-4 border-t border-[#262626] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 flex-shrink-0">
                  <Avatar
                    avatarUrl={admin?.avatarUrl}
                    initials={adminInitials}
                    textColor="#D4AF37"
                    name={adminName}
                    size="xs"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{adminName}</p>
                  <p className="text-[10px] text-[#808080] truncate">{adminRole}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30 text-[11px] font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-[#808080]">
              <span>ASCOT &middot; PCA Telemetry System</span>
              <span>v2.4.8-STABLE</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

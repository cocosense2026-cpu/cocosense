import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutGrid,
  Bell,
  Activity,
  Radio,
  Settings,
  Menu,
  X,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Avatar } from '../../components/Avatar';
import { useOwnerAuth } from '../context/OwnerAuthContext';
import { ownerApi } from '../api';

// NAV_ITEMS is a function of unreadCount so the "Notifications" row can
// carry a live badge, the same way the Admin sidebar's own nav items
// (src/components/Navigation.tsx) show a count next to Notifications.
const buildNavItems = (unreadCount: number) => [
  { to: '/owner', label: 'Dashboard', icon: LayoutGrid, end: true, badge: null as string | null },
  {
    to: '/owner/notifications',
    label: 'Notifications',
    icon: Bell,
    badge: unreadCount > 0 ? `${unreadCount}` : null,
  },
  { to: '/owner/events', label: 'Vibration Events', icon: Activity, badge: null as string | null },
  { to: '/owner/nodes', label: 'Master Node Mesh', icon: Radio, badge: null as string | null },
  { to: '/owner/settings', label: 'Settings', icon: Settings, badge: null as string | null },
];

// Extra routes (not in the sidebar nav) that still need a breadcrumb label
const STATIC_NAV_ITEMS = buildNavItems(0);

const BREADCRUMB_LABELS: Array<{ to: string; label: string; end?: boolean }> = [
  ...STATIC_NAV_ITEMS,
  { to: '/owner/profile', label: 'Profile' },
  { to: '/owner/help', label: 'Help & Support' },
];

function getBreadcrumbLabel(pathname: string): string {
  const match = BREADCRUMB_LABELS.find((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
  );
  return match?.label || 'Dashboard';
}

export const OwnerShell: React.FC = () => {
  const { owner, logout } = useOwnerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pageLabel = getBreadcrumbLabel(location.pathname);
  const navItems = buildNavItems(unreadCount);

  // Live badge count for the Notifications row + header bell, mirroring
  // how src/App.tsx wires unreadCount into the Admin sidebar/header.
  useEffect(() => {
    let cancelled = false;
    ownerApi
      .dashboard()
      .then((res: any) => {
        if (!cancelled) setUnreadCount(res?.activeAlertCount ?? 0);
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/owner/login', { replace: true });
  };

  const navLinkClass = (isActive: boolean) =>
    `w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors rounded ${
      isActive
        ? 'text-[#D4AF37] font-medium bg-[#141414] border border-[#262626]'
        : 'text-[#808080] hover:text-white hover:bg-[#141414]/40 font-normal'
    }`;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] flex flex-col lg:flex-row font-sans selection:bg-[#D4AF37] selection:text-black">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0A0A0A] border-r border-[#262626] flex-shrink-0 h-screen sticky top-0 z-40 overflow-y-auto">
        <div className="p-6 pb-5 border-b border-[#262626]">
          <BrandLogo variant="horizontal" size="md" animateSweep={false} showTagline={false} />
          <div className="flex items-center justify-between px-3 py-2 mt-5 rounded bg-[#141414] border border-[#262626] text-xs">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
              <span className="text-[11px] font-medium text-white">Farm Owner Portal</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase font-bold tracking-widest text-[#808080] px-3 mb-2">
            Navigation
          </div>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navLinkClass(isActive)}>
                {({ isActive }) => (
                  <div className="flex items-center justify-between w-full min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isActive ? 'bg-[#D4AF37]' : 'bg-transparent border border-[#404040]'
                        }`}
                      ></span>
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-[#808080]'}`} />
                      <span className="tracking-wide truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-tighter uppercase ml-2 flex-shrink-0 bg-[#1A1A1A] text-[#808080] border border-[#333333]">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="mt-auto p-4 border-t border-[#262626] bg-[#0A0A0A] space-y-3">
          <div className="flex items-center justify-between">
            <NavLink
              to="/owner/profile"
              className="flex items-center gap-2.5 min-w-0 hover:bg-[#141414] rounded p-1.5 -m-1.5 transition-colors"
            >
              <div className="w-7 h-7 flex-shrink-0">
                <Avatar
                  avatarUrl={owner?.avatarUrl}
                  initials={owner?.initials || 'FO'}
                  textColor="#D4AF37"
                  name={owner?.name}
                  size="xs"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{owner?.name || 'Farm Owner'}</p>
                <p className="text-[10px] text-[#808080] truncate">{owner?.sector || 'Farm Owner'}</p>
              </div>
            </NavLink>
            <div className="flex items-center gap-1">
              <ThemeToggle variant="icon" />
              <NavLink
                to="/owner/settings"
                className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#808080] hover:text-white transition-colors"
                title="Account Settings"
              >
                <Settings className="w-4 h-4" />
              </NavLink>
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

      {/* Mobile drawer */}
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
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center justify-between p-3 rounded text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#141414] text-[#D4AF37] border border-[#262626]'
                        : 'text-[#808080] hover:text-white hover:bg-[#141414]/30'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1A1A1A] text-[#808080]">{item.badge}</span>
                  )}
                </NavLink>
              ))}
              <NavLink
                to="/owner/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-3 p-3 rounded text-sm font-medium text-[#808080] hover:text-white hover:bg-[#141414]/30"
              >
                <span className="w-4 h-4 rounded-full bg-[#1A1A1A] border border-[#404040]" />
                <span>My Profile</span>
              </NavLink>
              <NavLink
                to="/owner/help"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-3 p-3 rounded text-sm font-medium text-[#808080] hover:text-white hover:bg-[#141414]/30"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Help &amp; Support</span>
              </NavLink>
            </div>
          </div>

          <div className="pt-4 border-t border-[#262626] flex items-center justify-between text-xs text-[#808080]">
            <span>Farm Owner Portal</span>
            <button type="button" onClick={handleLogout} className="flex items-center gap-1.5 text-[#F44336]">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 min-h-screen lg:h-screen lg:overflow-y-auto bg-[#0A0A0A]">
        <header className="sticky top-0 z-30 bg-[#0E0E0E]/95 backdrop-blur-md border-b border-[#262626] px-3.5 sm:px-6 md:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] transition-colors flex-shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Header Brand Logo (Visible on mobile and desktop, mirrors the Admin dashboard header) */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => navigate('/owner')}
                className="flex items-center text-left hover:opacity-90 transition-opacity focus:outline-none"
                title="CocoSense Farm Owner Portal"
              >
                <BrandLogo variant="horizontal" size="sm" animateSweep={false} />
              </button>

              {/* Divider & Breadcrumb (Desktop / Tablet) */}
              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-[#262626] min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141414] border border-[#262626] text-[10px] font-mono text-[#D4AF37] font-bold uppercase tracking-wider flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
                  Farm Owner Portal
                </span>
                <div className="text-xs font-medium tracking-wide text-[#808080] uppercase flex items-center truncate">
                  <span className="text-[#404040]">/</span>
                  <span className="ml-2 text-white capitalize font-semibold truncate">{pageLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            <ThemeToggle variant="icon" />
            <NavLink
              to="/owner/help"
              className="hidden sm:inline-flex p-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#A0A0A0] hover:text-white transition-colors"
              title="Help & Support"
              aria-label="Help and support"
            >
              <HelpCircle className="w-4 h-4" />
            </NavLink>
            <NavLink
              to="/owner/notifications"
              className="relative p-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#A0A0A0] hover:text-white transition-colors"
              title="Notifications"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#D4AF37] shadow-sm"></span>
              )}
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded bg-[#141414] hover:bg-[#2B1B1B] border border-[#262626] text-[#A0A0A0] hover:text-[#F44336] transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="p-3.5 sm:p-5 md:p-8 lg:p-10 flex-1 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

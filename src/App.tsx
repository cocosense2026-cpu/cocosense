import React, { useState, useEffect } from 'react';
import { 
  INITIAL_TREES, 
  INITIAL_OWNERS, 
  INITIAL_NODES, 
  INITIAL_ALERTS, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_OUTBOX, 
  INITIAL_VIBRATION_EVENTS 
} from './data/mockData';
import { MonitoredTree, FarmOwner, MasterNode, PestAlert, NotificationItem, OutboxEmail, VibrationEvent } from './types';
import { Navigation, ActiveView } from './components/Navigation';
import { BrandLogo } from './components/BrandLogo';
import { ThemeToggle } from './components/ThemeToggle';
import { DashboardView } from './views/DashboardView';
import { FarmOwnersView } from './views/FarmOwnersView';
import { MonitoredTreesView } from './views/MonitoredTreesView';
import { MasterNodesView } from './views/MasterNodesView';
import { AlertHistoryView } from './views/AlertHistoryView';
import { DiagnosticsView } from './views/DiagnosticsView';
import { ReportsView } from './views/ReportsView';
import { NotificationsView } from './views/NotificationsView';
import { OutboxView } from './views/OutboxView';
import { SettingsView } from './views/SettingsView';
import { Search, Bell, Radio, AlertTriangle, Menu } from 'lucide-react';
import { usePolling } from './hooks/usePolling';

// Backend added in server/ (Express + SQLite) -- see README "Backend &
// Database". Falls back to the old fully-local simulated behavior below
// if the backend isn't running, so nothing breaks if you haven't started
// `npm run server` yet.
const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') + '/api';

export function App() {
  const [currentView, setCurrentView] = useState<ActiveView>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Domain State
  const [trees, setTrees] = useState<MonitoredTree[]>(INITIAL_TREES);
  const [owners, setOwners] = useState<FarmOwner[]>(INITIAL_OWNERS);
  const [nodes, setNodes] = useState<MasterNode[]>(INITIAL_NODES);
  const [alerts, setAlerts] = useState<PestAlert[]>(INITIAL_ALERTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [outbox, setOutbox] = useState<OutboxEmail[]>(INITIAL_OUTBOX);
  const [vibrationEvents, setVibrationEvents] = useState<VibrationEvent[]>(INITIAL_VIBRATION_EVENTS);

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load real data from the database on start, so the console reflects
  // what's actually in Turso instead of the bundled demo/mock data
  // (previously only the Farm Owners list did this -- Nodes, Trees,
  // Alerts, Notifications, Outbox, and the raw Vibration log were all
  // silently showing the static mock data forever, even in production).
  // Falls back to the demo data already in state above if the backend
  // isn't reachable, so nothing breaks if it's not running yet.
  const loadAll = React.useCallback((showErrorInConsole: boolean) => {
    const get = (path: string) =>
      fetch(`${API_BASE}${path}`).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status} on ${path}`))
      );

    Promise.all([
      get('/owners'),
      get('/nodes'),
      get('/trees'),
      get('/alerts'),
      get('/notifications'),
      get('/outbox'),
      get('/vibration-events?limit=100'),
    ])
      .then(([ownersRows, nodesRows, treesRows, alertsRows, notificationsRows, outboxRows, vibrationRows]) => {
        setOwners(
          ownersRows.map((o: any) => ({
            ...o,
            accountConfirmed: !!o.accountConfirmed,
            nodesCount: o.nodesCount ?? 0,
            treesCount: o.treesCount ?? 0,
            infectedTreesCount: o.infectedTreesCount ?? 0,
          }))
        );
        setNodes(nodesRows.map((n: any) => ({ ...n, online: !!n.online })));
        setTrees(treesRows);
        setAlerts(alertsRows.map((a: any) => ({ ...a, reviewed: !!a.reviewed })));
        setNotifications(notificationsRows.map((n: any) => ({ ...n, isRead: !!n.isRead })));
        setOutbox(outboxRows);
        setVibrationEvents(vibrationRows);
      })
      .catch((err) => {
        if (showErrorInConsole) {
          console.warn('Backend unreachable, showing local demo data:', err);
        }
      });
  }, []);

  useEffect(() => {
    loadAll(true);
  }, [loadAll]);

  // Keeps every view current with new device readings, alerts, and
  // notifications as they arrive, without needing a manual page
  // refresh. Pauses automatically while the browser tab isn't visible
  // (see usePolling) so an idle tab doesn't keep polling forever.
  usePolling(() => loadAll(false), 10000);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handlers
  const handleResolveAlert = (alertId: number) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, reviewed: true } : a));
    showToast('Alert marked as reviewed & field technician notified.');
  };

  const handleClearAllReviewedAlerts = () => {
    setAlerts(prev => prev.filter(a => !a.reviewed));
    showToast('Cleared all reviewed alerts from history.');
  };

  const handleUpdateTreeStatus = (treeId: string, status: MonitoredTree['status']) => {
    setTrees(prev => prev.map(t => t.id === treeId ? { ...t, status } : t));
    showToast(`Updated palm ${treeId} status to: ${status}`);
  };

  const handleAddOwner = async (newOwnerData: Omit<FarmOwner, 'id' | 'registeredAt' | 'color' | 'initials' | 'accountConfirmed'>) => {
    const newId = `FO-2026-${String(owners.length + 1).padStart(3, '0')}`;
    const initials = `${newOwnerData.firstName[0]}${newOwnerData.lastName[0]}`.toUpperCase();
    const colors = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#4f46e5'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const createdOwner: FarmOwner = {
      ...newOwnerData,
      id: newId,
      initials,
      color: randomColor,
      accountConfirmed: false,
      registeredAt: 'Just now',
    };

    // Try the real backend first: persists to the database, sets the
    // default password (user123, must be changed on first login), and
    // sends the confirmation email (real Gmail send if configured in
    // .env, otherwise logged to Outbox only -- see server/mailer.js).
    //
    // Network failure (server not running) and an explicit rejection
    // from the server (duplicate account, bad data) are handled very
    // differently: a network failure falls back to local-only
    // simulation so the UI still works without the backend running,
    // but an explicit rejection must NOT fall back to adding the owner
    // locally -- that would silently undo the very validation (e.g.
    // the duplicate-account check) the rejection exists to enforce.
    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}/owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createdOwner),
      });
    } catch (networkErr) {
      console.warn('Backend unreachable, falling back to local-only simulation:', networkErr);
      setOwners(prev => [createdOwner, ...prev]);

      const newEmail: OutboxEmail = {
        id: `EM-${Date.now()}`,
        to: createdOwner.email,
        subject: 'Welcome to CocoSense Smart Plantation Monitoring',
        body: `Mabuhay ${createdOwner.name},\n\nYour farm located at ${createdOwner.address} has been successfully provisioned with ${createdOwner.nodesCount} Master Control Node(s).\n\nPlease verify your account at https://cocosense.ph/verify?owner=${createdOwner.id}`,
        sentAt: 'Just now',
        status: 'Sent (250 OK)',
      };
      setOutbox(prev => [newEmail, ...prev]);

      const newNotif: NotificationItem = {
        id: `NOTIF-${Date.now()}`,
        title: 'New Farm Owner Provisioned',
        message: `${createdOwner.name} registered with ${createdOwner.nodesCount} Master Nodes in ${createdOwner.cityMunicipality}, ${createdOwner.province}.`,
        timestamp: 'Just now',
        read: false,
        category: 'INVITATIONS',
      };
      setNotifications(prev => [newNotif, ...prev]);

      showToast(`Registered ${createdOwner.name} (backend offline — simulated locally only).`);
      return;
    }

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      // Explicit rejection (e.g. duplicate name/address/email) -- surface
      // it and stop. The caller (FarmOwnersView) keeps the modal open so
      // the admin can see why and correct the form.
      throw new Error(result.error || 'Failed to create owner.');
    }

    setOwners(prev => [createdOwner, ...prev]);

    const newEmail: OutboxEmail = {
      id: `EM-${Date.now()}`,
      to: createdOwner.email,
      subject: 'Welcome to CocoSense — Confirm Your Account',
      body: `Mabuhay ${createdOwner.name},\n\nYour CocoSense monitoring account has been created.\n\n  Owner ID: ${createdOwner.id}\n  Login email: ${createdOwner.email}\n  Temporary password: user123\n\nA confirmation link was sent to your email -- you'll need to click it before you can sign in.`,
      sentAt: 'Just now',
      status: result.emailDeliveryStatus === 'delivered' ? 'Sent (250 OK)' : 'Logged (SMTP not configured)',
      deliveryStatus: result.emailDeliveryStatus,
      deliveryError: result.emailDeliveryError,
    };
    setOutbox(prev => [newEmail, ...prev]);

    const newNotif: NotificationItem = {
      id: `NOTIF-${Date.now()}`,
      title: 'New Farm Owner Provisioned',
      message: `${createdOwner.name} registered with ${createdOwner.nodesCount} Master Nodes in ${createdOwner.cityMunicipality}, ${createdOwner.province}.`,
      timestamp: 'Just now',
      read: false,
      category: 'INVITATIONS',
    };
    setNotifications(prev => [newNotif, ...prev]);

    showToast(
      result.emailDeliveryStatus === 'delivered'
        ? `Registered ${createdOwner.name} & emailed their confirmation link!`
        : `Registered ${createdOwner.name}. Confirmation link logged to Outbox (configure GMAIL_USER/GMAIL_APP_PASSWORD in .env to actually send).`
    );
  };

  const handleDeleteOwner = async (ownerId: string) => {
    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}/owners/${ownerId}`, { method: 'DELETE' });
    } catch (networkErr) {
      console.warn('Backend unreachable, removing locally only:', networkErr);
      setOwners(prev => prev.filter(o => o.id !== ownerId));
      showToast(`Removed owner ${ownerId} from directory (backend offline — simulated locally only).`);
      return;
    }

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      showToast(result.error || 'Failed to remove owner.');
      return;
    }

    setOwners(prev => prev.filter(o => o.id !== ownerId));
    showToast(`Removed owner ${ownerId} from directory.`);
  };

  const handleExpandNodes = async (ownerId: string, additionalNodes: number) => {
    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}/owners/${ownerId}/expand-nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalNodes }),
      });
    } catch (networkErr) {
      console.warn('Backend unreachable, expanding locally only:', networkErr);
      setOwners(prev => prev.map(o => o.id === ownerId
        ? { ...o, nodesCount: o.nodesCount + additionalNodes, treesCount: o.treesCount + (additionalNodes * 1140) }
        : o));
      showToast(`Allocated +${additionalNodes} Master Nodes (+${additionalNodes * 6} Sensors) to ${ownerId} (backend offline — simulated locally only).`);
      return;
    }

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      showToast(result.error || 'Failed to allocate nodes.');
      return;
    }

    // Real hardware provisioning only adds nodes+sensors, not trees --
    // unlike the old local-only simulation, treesCount here reflects
    // what's actually in the database (unchanged, since new trees still
    // need to be registered separately), not a fabricated estimate.
    setOwners(prev => prev.map(o => o.id === ownerId
      ? { ...o, nodesCount: result.nodesCount, treesCount: result.treesCount }
      : o));
    showToast(`Allocated +${additionalNodes} Master Nodes (+${additionalNodes * 6} Sensors) to ${ownerId}.`);
  };

  const handleResendInvite = async (owner: FarmOwner) => {
    try {
      const resp = await fetch(`${API_BASE}/owners/${owner.id}/resend-invite`, { method: 'POST' });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to resend invite');

      const newEmail: OutboxEmail = {
        id: `EM-${Date.now()}`,
        to: owner.email,
        subject: 'Reminder: Activate Your CocoSense Account',
        body: `Hello ${owner.name},\n\nYour monitoring station credentials for ${owner.sector} (${owner.id}) are pending confirmation.`,
        sentAt: 'Just now',
        status: result.emailDeliveryStatus === 'delivered' ? 'Sent (250 OK)' : 'Logged (SMTP not configured)',
        deliveryStatus: result.emailDeliveryStatus,
        deliveryError: result.emailDeliveryError,
      };
      setOutbox(prev => [newEmail, ...prev]);
      showToast(
        result.emailDeliveryStatus === 'delivered'
          ? `Re-dispatched invitation credentials to ${owner.email}.`
          : `Logged reminder to Outbox (SMTP not configured — see .env).`
      );
      return;
    } catch (err) {
      console.warn('Backend unavailable, falling back to local-only simulation:', err);
    }

    const newEmail: OutboxEmail = {
      id: `EM-${Date.now()}`,
      to: owner.email,
      subject: 'Reminder: Activate Your CocoSense Plantation Account',
      body: `Hello ${owner.name},\n\nYour monitoring station credentials for ${owner.sector} (${owner.id}) are pending confirmation.\n\nLink: https://cocosense.ph/verify?owner=${owner.id}`,
      sentAt: 'Just now',
      status: 'Sent (250 OK)',
    };
    setOutbox(prev => [newEmail, ...prev]);
    showToast(`Re-dispatched invitation credentials to ${owner.email} (backend offline — simulated locally only).`);
  };

  const handleSendBroadcast = (recipient: string, subject: string, body: string) => {
    const newEmail: OutboxEmail = {
      id: `EM-${Date.now()}`,
      to: recipient,
      subject,
      body,
      sentAt: 'Just now',
      status: 'Sent (250 OK)',
    };
    setOutbox(prev => [newEmail, ...prev]);
    showToast(`Dispatched broadcast message to ${recipient}.`);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('Marked all notifications as read.');
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    showToast('Cleared all notifications.');
  };

  const handleToggleNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalAlertsCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.reviewed).length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] flex flex-col lg:flex-row font-sans selection:bg-[#D4AF37] selection:text-black">
      {/* Sidebar Navigation */}
      <Navigation
        currentView={currentView}
        onViewChange={setCurrentView}
        unreadCount={unreadCount}
        criticalAlertsCount={criticalAlertsCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen lg:h-screen lg:overflow-y-auto bg-[#0A0A0A]">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#0E0E0E]/95 backdrop-blur-md border-b border-[#262626] px-3.5 sm:px-6 md:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-md">
          {/* Left: Brand Logo & Navigation Controls */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#E0E0E0] transition-colors flex-shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Header Brand Logo (Visible on mobile and desktop) */}
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => setCurrentView('dashboard')} 
                className="flex items-center text-left hover:opacity-90 transition-opacity focus:outline-none"
                title="CocoSense Telemetry Dashboard"
              >
                <BrandLogo variant="horizontal" size="sm" animateSweep={false} />
              </button>

              {/* Divider & Breadcrumbs (Desktop / Tablet) */}
              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-[#262626]">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141414] border border-[#262626] text-[10px] font-mono text-[#D4AF37] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
                  ASCOT &amp; PCA LoRa Mesh
                </span>
                <div className="text-xs font-medium tracking-wide text-[#808080] uppercase flex items-center truncate">
                  <span className="text-[#404040]">/</span> 
                  <span className="ml-2 text-white capitalize font-semibold truncate">{currentView.replace('-', ' ')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {criticalAlertsCount > 0 && (
              <button
                type="button"
                onClick={() => setCurrentView('alerts')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/40 text-xs font-bold transition-all shadow-sm"
                title={`${criticalAlertsCount} critical pest alerts active`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{criticalAlertsCount} Critical</span>
                <span className="sm:hidden">{criticalAlertsCount}</span>
              </button>
            )}

            {/* Theme Switcher Toggle */}
            <ThemeToggle variant="icon" />

            {/* Notifications Button */}
            <button
              type="button"
              onClick={() => setCurrentView('notifications')}
              className="relative p-2 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] text-[#A0A0A0] hover:text-white transition-colors"
              title="Notifications"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#D4AF37] shadow-sm"></span>
              )}
            </button>
          </div>
        </header>

        {/* View Viewport */}
        <div className="p-3.5 sm:p-5 md:p-8 lg:p-10 flex-1 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8">
          {currentView === 'dashboard' && (
            <DashboardView
              trees={trees}
              owners={owners}
              nodes={nodes}
              alerts={alerts}
              vibrationEvents={vibrationEvents}
              onNavigate={setCurrentView}
              onSelectTree={(tree) => setCurrentView('trees')}
              onResolveAlert={handleResolveAlert}
            />
          )}

          {currentView === 'owners' && (
            <FarmOwnersView
              owners={owners}
              onAddOwner={handleAddOwner}
              onDeleteOwner={handleDeleteOwner}
              onExpandNodes={handleExpandNodes}
              onResendInvite={handleResendInvite}
              onNavigateDiagnostics={(ownerId) => setCurrentView('diagnostics')}
            />
          )}

          {currentView === 'trees' && (
            <MonitoredTreesView
              trees={trees}
              onInspectTree={() => {}}
              onUpdateTreeStatus={handleUpdateTreeStatus}
            />
          )}

          {currentView === 'nodes' && (
            <MasterNodesView
              nodes={nodes}
            />
          )}

          {currentView === 'alerts' && (
            <AlertHistoryView
              alerts={alerts}
              onResolveAlert={handleResolveAlert}
              onClearAllReviewed={handleClearAllReviewedAlerts}
            />
          )}

          {currentView === 'diagnostics' && (
            <DiagnosticsView nodes={nodes} />
          )}

          {currentView === 'reports' && (
            <ReportsView />
          )}

          {currentView === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onClearAll={handleClearAllNotifications}
              onToggleRead={handleToggleNotificationRead}
            />
          )}

          {currentView === 'outbox' && (
            <OutboxView
              outbox={outbox}
              onSendBroadcast={handleSendBroadcast}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView />
          )}
        </div>
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 rounded bg-[#141414] border border-[#D4AF37] text-white px-4 py-3 sm:px-5 sm:py-3.5 font-medium text-xs shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-[90vw]">
          <div className="w-2 h-2 rounded-full bg-[#D4AF37] flex-shrink-0"></div>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;

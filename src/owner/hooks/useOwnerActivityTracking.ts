import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ownerApi } from '../api';
import { usePolling } from '../../hooks/usePolling';

// Reports what the signed-in owner is doing to the backend, so the admin
// console's Recent Activity page (src/views/RecentActivityView.tsx) can
// show it live:
//   - every route change is logged as "Opened <page>"
//   - a heartbeat every 30s (while the tab is visible) keeps them
//     showing as "online" between page changes
//
// Mounted once, inside OwnerShell -- which only renders for a signed-in
// owner past the forced password change, so login/signup/reset pages are
// never tracked. Failures are swallowed on purpose: tracking must never
// get in the way of the owner actually using the portal.
export function useOwnerActivityTracking() {
  const { pathname } = useLocation();

  useEffect(() => {
    ownerApi.trackOpen(pathname).catch(() => void 0);
  }, [pathname]);

  usePolling(() => {
    ownerApi.heartbeat().catch(() => void 0);
  }, 30000);
}

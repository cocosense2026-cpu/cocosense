import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import App from './App.tsx';
import OwnerApp from './owner/OwnerApp.tsx';
import SuperAdminApp from './superadmin/SuperAdminApp.tsx';
import { AdminGate } from './admin/AdminGate.tsx';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Farm Owner Portal -- separate, auth-gated route tree. See
              src/owner/. Does not share state or auth with the admin
              console below. */}
          <Route path="/owner/*" element={<OwnerApp />} />
          {/* Super Admin console -- own, separate auth-gated route tree
              (own login, own bearer token, own sessions table). Sits
              above the admin console: provisions/deactivates admin
              accounts and reads a plantation-wide overview. See
              src/superadmin/. */}
          <Route path="/superadmin/*" element={<SuperAdminApp />} />
          {/* Admin console -- still tab-based internally (not React
              Router routes), mounted at everything outside /owner, and
              gated behind an admin sign-in (see src/admin/). */}
          <Route
            path="/*"
            element={
              <AdminGate>
                <App />
              </AdminGate>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);

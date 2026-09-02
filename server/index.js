import './load-env.js'; // must stay first -- see comment in that file
import express from 'express';
import './db.js';
import ingestRoutes from './routes/ingest.js';
import apiRoutes from './routes/api.js';
import ownerRoutes from './routes/owner.js';
import adminRoutes from './routes/admin.js';
import superadminRoutes from './routes/superadmin.js';

const app = express();
// Raised from Express's 100kb default so a profile-picture data URL
// (already resized/compressed client-side to a small JPEG, capped at
// 2MB server-side -- see validateAvatarDataUrl in server/utils.js)
// doesn't get rejected before it ever reaches a route handler.
app.use(express.json({ limit: '6mb' }));

// Minimal CORS so the Vite dev server (a different port) can call this API
// without adding an extra dependency. Tighten this before real deployment.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Device-facing endpoint (ESP32 posts here) -- kept at the same path
// shape (/api/ingest-vibration) as the existing PHP backend so the
// firmware only needs its serverURL changed, nothing else.
app.use('/api', ingestRoutes);

// Frontend-facing read/write endpoints for the React admin console.
app.use('/api', apiRoutes);

// Farm Owner portal -- separate, bearer-token-authenticated endpoints
// under /api/owner/*. See server/routes/owner.js.
app.use('/api', ownerRoutes);

// Admin console -- bearer-token-authenticated login/logout/me endpoints
// under /api/admin/*. See server/routes/admin.js.
app.use('/api', adminRoutes);

// Super Admin console -- bearer-token-authenticated endpoints under
// /api/superadmin/*. Provisions/deactivates admin accounts and reads a
// plantation-wide overview. See server/routes/superadmin.js.
app.use('/api', superadminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[server] CocoSense backend listening on http://localhost:${PORT}`);
});

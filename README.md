<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8ac3ba80-e4cf-4bce-89ea-7403a1196f0a

## Run Locally

**Prerequisites:**  Node.js 22+


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in at least `GMAIL_USER` /
   `GMAIL_APP_PASSWORD` if you want real emails sent (see "Backend &
   Database" below for details — without these, the app still works,
   emails just aren't actually delivered).
3. (Optional) Seed a small starter dataset: `npm run seed`
4. Run the app — **both the frontend and backend together, in one
   terminal:**
   `npm run start`

   This is the one command to use for normal local development. It
   starts the Vite frontend (`http://localhost:3000`) and the
   Express/SQLite backend (`http://localhost:4000`) at the same time,
   labeled `[CLIENT]`/`[SERVER]` in the same terminal output.

   **Why this matters:** the frontend and backend are two separate
   processes. If only the frontend is running, pages will load, but
   anything backed by real data — the Farm Owners list, login, etc. —
   will silently show stale/demo data instead of what's actually in the
   database, since there's nothing running for it to fetch from. Using
   `npm run start` instead of running `npm run dev` and `npm run
   server` separately makes it impossible to forget the second one.

   If you do want them in separate terminals (e.g. to restart just one
   without the other), that still works exactly as before:
   `npm run dev` (frontend only) and `npm run server` (backend only).

## Backend & Database

A small Node/Express + SQLite backend lives in `server/` (added
separately from the existing frontend -- only `src/App.tsx` was touched,
to wire two handlers to real API calls; every other file under `src/` is
untouched). Uses Node's built-in `node:sqlite`, so no native DB
dependency or separate DB server install is required — just Node 22+.

**Setup:**

1. Copy `.env.example` to `.env`. At minimum, review `PORT` and
   `DEVICE_API_KEY`. To send real welcome emails via Gmail, also fill in
   `GMAIL_USER` / `GMAIL_APP_PASSWORD` (see the comment above them in
   `.env.example` for how to generate a Gmail App Password). Without
   those two set, emails are still logged to the in-app Outbox, just not
   actually sent.
2. (Optional) Seed a small starter dataset: `npm run seed`
3. Start both frontend and backend together: `npm run start` (see "Run
   Locally" above). The backend listens on `http://localhost:4000` by
   default and creates `server/data/cocosense.db` on first run.

**Account creation / confirmation / password flow:**

- `POST /api/owners` creates a farm owner with the default password
  `user123`, `must_change_password = 1`, and `account_confirmed = 0`,
  then emails them a confirmation link (real send if Gmail is
  configured, otherwise logged to Outbox only — see below for testing
  without SMTP).
- The owner **cannot log in until they click that link.** It points at
  `<OWNER_PORTAL_URL>/owner/confirm?token=...` (set `OWNER_PORTAL_URL`
  in `.env` — defaults to `http://localhost:3000`), which calls `POST
  /api/owner/auth/confirm` and flips `account_confirmed` to `1`. Links
  expire after 24 hours and can only be used once.
- `POST /api/owners/:id/resend-invite` re-sends the right email for
  wherever the owner currently is: a fresh confirmation link (with a
  new 24-hour token) if they haven't confirmed yet, or a plain
  credentials reminder if they already have. This is wired to the
  "Resend Invite" button next to each owner's Pending/Active badge on
  the Farm Owners page.
- Passwords are hashed with Node's built-in `crypto.scrypt`, and
  confirmation tokens/reset codes are hashed too (never stored in
  plaintext) — see `server/auth.js`.
- Owner login, password change, and forgot-password all live under
  `/api/owner/auth/*` (see the Farm Owner Portal section below) — this
  admin console has no login of its own.
- `POST /api/owners` also rejects a registration whose **name, address,
  and email all exactly match** (case/whitespace-insensitive) an
  existing owner, with a 409 and a clear message naming the existing
  Owner ID — same person, submitted twice. Two owners sharing only a
  name or only an address (e.g. family members on the same estate) are
  still allowed, since only the full triple counts as a duplicate.
  Email alone is separately enforced unique at the database level
  regardless of name/address, since two accounts can never share a
  login email.

**Testing the confirmation email without Gmail configured:** every
email — sent or not — is logged to the `outbox_emails` table (visible
in the admin console's Outbox view, or query it directly). The
confirmation link is in the email body, so you can copy the `token=...`
value out of there and paste it into `/owner/confirm?token=...`
yourself to confirm an account during local testing.

**Connecting the ESP32 device:** point the sketch's `serverURL` at
`http://<YOUR_COMPUTER_IP>:4000/api/ingest-vibration` (LAN IP, not
`localhost`). `apiKey` in the sketch must match `DEVICE_API_KEY` in
`.env` (both default to `"Luna-1327"`).

The endpoint expects a JSON POST body shaped like:

```json
{
  "api_key": "Luna-1327",
  "node_id": "MN-N1",
  "sector": "Sector 1",
  "grams": 3.4,
  "battery": 78,
  "rssi": -62,
  "pest_likely": false,
  "pest_clicks": 0,
  "pest_band_ratio": 0
}
```

`node_id` must match an existing master node's id (the seeded demo node
is `MN-N1` — see `server/seed.js`) or the reading is logged but the node
health snapshot won't update. Only `node_id` and `grams` are required;
everything else is optional:

- **`battery`** (0-100) and **`rssi`** (dBm) update the node's live
  Battery % and Signal display on the Master Node Mesh / Hardware
  Diagnostic pages. `rssi` is converted into the same
  `"-62 dBm (Excellent/Good/Fair/No Signal)"` label format already used
  throughout the dashboard. Omit either one and the node's last known
  value is left untouched, rather than being cleared.
- **`pest_likely`** / `pest_clicks` / `pest_band_ratio` — set
  `pest_likely: true` when the firmware's on-device feeding-pattern
  detector matches, and this also raises a Notification (bell icon), not
  just an Alert History entry. An ordinary impact/knock (any `grams`
  reading with `pest_likely` absent or `false`) still raises an Alert
  History entry when it's Elevated/Critical, it just won't ping
  Notifications.

See `server/routes/ingest.js` for the full logic (severity thresholds
live in `server/utils.js` / `GRAMS_ELEVATED` & `GRAMS_CRITICAL` in
`.env`).

**Other endpoints:** `/api/dashboard`, `/api/nodes`, `/api/trees`,
`/api/vibration-events`, `/api/alerts`, `/api/notifications`,
`/api/outbox` — see `server/routes/api.js` for the full list.

## Farm Owner Portal

A separate, owner-facing app lives at **`/owner`** (e.g.
`http://localhost:3000/owner/login`) — a different route from the admin
console at `/`, with its own login, session, and pages. Being signed into
one grants no access to the other.

**Pages:** Sign in, Forgot Password (6-digit email code) → Verify Code →
Reset Password, forced Set-New-Password on first login, Dashboard, live
Vibration Events, Notifications, Profile (edit info + change password +
recent activity), Settings (theme + notification toggles), and Help &
Support. All styled to match the admin console's dark/gold design.

**Try it:** run `npm run seed` (see above) for a demo account, then sign
in at `/owner/login` with **`demo@example.com`** / **`user123`**. The
seeded demo account is pre-confirmed (`account_confirmed = 1`) so you
can log in immediately without clicking a link — that's only for local
testing convenience; every owner created through the admin console for
real still has to confirm their email first. You'll be prompted to set
a new password on first login either way — that's the same
`must_change_password` gate the admin console already sets for every
new owner.

**How it's authenticated:** the owner portal is a separate SPA route,
not a separate server, so it uses its own bearer-token sessions
(`owner_sessions` table) instead of the admin console's (currently
none). The token lives in the browser's `localStorage` and is sent as
`Authorization: Bearer <token>` — see `src/owner/api.ts`.

**New backend pieces** (all in `server/routes/owner.js`, scoped to the
signed-in owner only):
- `POST /api/owner/auth/login` (blocked with a 403 until the account is
  confirmed — see above), `/logout`, `/change-password`
- `POST /api/owner/auth/confirm` — `{ token }`, called by the `/owner/confirm`
  page when an owner clicks their emailed link
- `POST /api/owner/auth/forgot-password` → emails a 6-digit code (real
  send if Gmail is configured, otherwise the code is returned directly
  in the response as `devCode` so the flow is testable without SMTP set
  up — shown on the Verify Code screen as "Demo Mode")
- `POST /api/owner/auth/verify-reset-code`, `/reset-password`
- `GET/PATCH /api/owner/me`, `GET /api/owner/activity`
- `GET /api/owner/dashboard`, `/api/owner/events`
- `GET /api/owner/notifications`, `PATCH .../:id/read`, `POST
  .../read-all`, `DELETE .../:id`
- `GET/PATCH /api/owner/settings`
- `GET /api/owner/export/trees.csv` — owner's own tree inventory only,
  never the full owners/farms roster the admin export exposes

**Account isolation:** every owner-portal query and write is scoped to
the signed-in owner's own id — an owner can only ever see or change
their own trees, nodes, alerts, notifications, settings, and profile.
Deleting or updating something in one owner's account never touches
another owner's data, and vice versa; the only thing that can affect
another owner's records at all is an admin acting from the admin
console. This is enforced at the database query level (every relevant
`WHERE` clause includes the owner's id), not just hidden in the UI.

Three tables were added to support this: `owner_sessions` (bearer
tokens), `owner_settings` (per-owner notification/theme prefs), and
`owner_activity` (the "Recent Activity" list on the Profile page).
`farm_owners` gained `reset_code_hash`/`reset_code_expires` (forgot-
password) and `confirm_token_hash`/`confirm_token_expires` (the
account-confirmation link), and `notifications` gained
`audience`/`owner_id` so owner-facing notices don't mix with the admin
console's feed. All migrations run automatically on server start
(`server/db.js`) — no manual DB steps needed even against an existing
`cocosense.db`.

// Central fan-out point: turns one internal alert event into real
// outbound delivery across whichever channels a farm owner has turned
// on in their Owner Portal Settings page (Email / SMS / Push, plus the
// "Critical Alerts Only" filter). This is the ONE place that reads
// owner_settings and acts on it -- every caller (ingest.js today,
// anything else later) goes through here instead of re-implementing
// the on/off logic, so the toggles have one real, consistent effect
// everywhere instead of only being stored and ignored.
import { db } from './db.js';
import { toCamel } from './utils.js';
import { restampRowHash } from './hash.js';
import { sendMail } from './mailer.js';
import { sendSms } from './sms.js';

async function getOwnerSettings(ownerId) {
  let row = await db.prepare(`SELECT * FROM owner_settings WHERE owner_id = ?`).get(ownerId);
  if (!row) {
    // Same getOrCreate pattern as routes/owner.js's getOrCreateOwnerSettings
    // -- an owner who has never opened Settings still gets the schema's
    // defaults (email+push on, SMS off) instead of silently getting no
    // notifications at all.
    await db.prepare(`INSERT INTO owner_settings (owner_id) VALUES (?)`).run(ownerId);
    await restampRowHash(db, 'owner_settings', 'owner_id', ownerId);
    row = await db.prepare(`SELECT * FROM owner_settings WHERE owner_id = ?`).get(ownerId);
  }
  return toCamel(row);
}

/**
 * @param {string} ownerId
 * @param {{ title: string, message: string, icon?: string, category?: string, severity?: 'Normal'|'Elevated'|'Critical' }} alert
 * @returns {Promise<{ buzzer: boolean }>} whether this owner's on-site
 *   buzzer should sound for this event -- the caller (ingest.js) reads
 *   this and echoes it back in its HTTP response to the very device
 *   that just reported the reading, since that's the only channel this
 *   system has to reach the physical hardware (no separate command/poll
 *   endpoint exists). See the "Local Buzzer Alert" toggle on the Owner
 *   Portal's Settings page -- this is what makes that toggle do
 *   something instead of only being saved and never read.
 */
export async function notifyOwner(ownerId, { title, message, icon = 'bell', category = 'system', severity = 'Critical' }) {
  if (!ownerId) return { buzzer: false }; // node isn't assigned to an owner yet -- nothing to deliver

  const owner = await db.prepare(`SELECT id, name, email, phone FROM farm_owners WHERE id = ?`).get(ownerId);
  if (!owner) return { buzzer: false };

  const settings = await getOwnerSettings(ownerId);

  const isCritical = String(severity).toUpperCase() === 'CRITICAL';

  // The physical siren is judged independently of "Critical Alerts
  // Only" below -- that toggle is about muting the *remote* channels
  // (email/SMS/bell) for non-critical noise, whereas the on-site buzzer
  // is described on Settings as firing "for critical events" full stop,
  // so it isn't affected by that separate mute.
  const buzzer = !!settings.localBuzzerAlert && isCritical;

  if (settings.notifyCriticalOnly && !isCritical) {
    // "Critical Alerts Only" suppresses every remote channel for
    // anything below Critical -- exactly what the Settings page
    // description promises ("Suppress low-priority notifications
    // entirely"). The buzzer decision above is unaffected since it's
    // never true for a non-critical event anyway.
    return { buzzer };
  }

  // Push == the in-app/browser notification bell (src/owner/pages/
  // NotificationsPage.tsx). There's no native mobile push subscription
  // in this app, so the bell feed IS the push channel -- turning this
  // off means no row lands in the owner's notification feed at all.
  if (settings.notifyPush) {
    const insert = await db
      .prepare(
        `INSERT INTO notifications (icon, title, message, category, audience, owner_id)
         VALUES (?, ?, ?, ?, 'owner', ?)`
      )
      .run(icon, title, message, category, ownerId);
    await restampRowHash(db, 'notifications', 'id', insert.lastInsertRowid);
  }

  if (settings.notifyEmail && owner.email) {
    await sendMail({
      toName: owner.name,
      toEmail: owner.email,
      subject: `CocoSense Alert: ${title}`,
      body: `${message}\n\n— CocoSense Smart Plantation Monitoring`,
      category,
    });
  }

  if (settings.notifySms) {
    await sendSms({
      toName: owner.name,
      toPhone: owner.phone,
      message: `CocoSense Alert - ${title}: ${message}`,
      category,
    });
  }

  return { buzzer };
}

// Sends a real SMS via Semaphore (a Philippines-focused SMS gateway)
// when SEMAPHORE_API_KEY is set in .env, and ALWAYS writes a record to
// outbox_sms either way -- exactly the same "log always, send for real
// if configured" pattern mailer.js already uses for Gmail, so the
// Settings page's SMS toggle is visibly doing something (a delivery
// attempt appears) even before a real SMS provider is wired up.
//
// Get a free API key at https://semaphore.co, then put it in
// server/.env as SEMAPHORE_API_KEY=your-key (SEMAPHORE_SENDER_NAME is
// optional, defaults to "COCOSENSE").
import { db } from './db.js';
import { restampRowHash } from './hash.js';

async function sendViaSemaphore(toPhone, message) {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) {
    return { deliveryStatus: 'not_sent', deliveryError: 'SEMAPHORE_API_KEY not configured in .env -- logged only.' };
  }
  try {
    const res = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apikey: apiKey,
        number: toPhone,
        message,
        sendername: process.env.SEMAPHORE_SENDER_NAME || 'COCOSENSE',
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { deliveryStatus: 'failed', deliveryError: `Semaphore responded ${res.status}: ${text.slice(0, 200)}` };
    }
    return { deliveryStatus: 'delivered', deliveryError: null };
  } catch (err) {
    return { deliveryStatus: 'failed', deliveryError: err.message };
  }
}

export async function sendSms({ toName, toPhone, message, category }) {
  let deliveryStatus = 'not_sent';
  let deliveryError = 'No phone number on file for this owner.';

  if (toPhone) {
    ({ deliveryStatus, deliveryError } = await sendViaSemaphore(toPhone, message));
  }

  const insert = await db
    .prepare(
      `INSERT INTO outbox_sms (to_name, to_phone, message, category, status, delivery_status, delivery_error)
       VALUES (?, ?, ?, ?, 'sent', ?, ?)`
    )
    .run(toName ?? null, toPhone ?? null, message, category ?? 'system', deliveryStatus, deliveryError);
  await restampRowHash(db, 'outbox_sms', 'id', insert.lastInsertRowid);

  return { deliveryStatus, deliveryError };
}

// Sends real email via Gmail SMTP when GMAIL_USER / GMAIL_APP_PASSWORD
// are set in .env, and ALWAYS writes a record to outbox_emails either
// way -- so the existing Outbox view has something to show even before
// SMTP is configured, and you can see delivery failures there too.
//
// Gmail requires an "App Password", not your normal Gmail password:
// Google Account -> Security -> 2-Step Verification (must be ON) ->
// App Passwords -> generate one for "Mail". Put that 16-character value
// in GMAIL_APP_PASSWORD.
import nodemailer from 'nodemailer';
import { db } from './db.js';
import { restampRowHash } from './hash.js';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    // Without explicit timeouts, nodemailer's Gmail transport can hang
    // for minutes if the outbound network can't reach smtp.gmail.com
    // (common on campus Wi-Fi / hotspots / hosts that block ports
    // 465/587) -- and any route that `await`s sendMail() would hang
    // right along with it. 10s is generous for a real SMTP handshake
    // but fails fast when the port is simply blocked.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
  return transporter;
}

// `html`, when provided, is sent as the rich version of the message
// (nodemailer falls back to `text` automatically for clients that can't
// render HTML). `body` (plain text) is always what's stored in
// outbox_emails, since the Outbox view is a plain-text admin log, not a
// preview of the actual rendered email.
export async function sendMail({ toName, toEmail, subject, body, html, category }) {
  const t = getTransporter();
  let status = 'sent';
  let deliveryStatus = 'delivered';
  let deliveryError = null;

  if (!t) {
    deliveryStatus = 'not_sent';
    deliveryError = 'GMAIL_USER / GMAIL_APP_PASSWORD not configured in .env -- logged only.';
  } else {
    try {
      await t.sendMail({
        from: `"CocoSense" <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject,
        text: body,
        ...(html ? { html } : {}),
      });
    } catch (err) {
      deliveryStatus = 'failed';
      deliveryError = err.message;
    }
  }

  const emailInsert = await db.prepare(
    `INSERT INTO outbox_emails (to_name, to_email, subject, category, body, status, delivery_status, delivery_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(toName ?? null, toEmail ?? null, subject, category ?? 'system', body, status, deliveryStatus, deliveryError);
  await restampRowHash(db, 'outbox_emails', 'id', emailInsert.lastInsertRowid);

  return { deliveryStatus, deliveryError };
}

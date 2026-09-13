const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_EMAIL_URL = 'https://api.resend.com/emails';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

const memoryRateLimit =
  globalThis.__limunContactRateLimit ||
  (globalThis.__limunContactRateLimit = new Map());

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validEmail(email) {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function rateLimited(ip) {
  const now = Date.now();
  const current = memoryRateLimit.get(ip);

  if (!current || now - current.startedAt > WINDOW_MS) {
    memoryRateLimit.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  memoryRateLimit.set(ip, current);

  // This is only an extra per-instance guard. Turnstile remains
  // the primary anti-bot protection.
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function allowedHostname(resultHostname, requestHostname) {
  const configured = clean(process.env.TURNSTILE_ALLOWED_HOSTNAMES);

  const allowed = configured
    ? configured.split(',').map(item => item.trim()).filter(Boolean)
    : [requestHostname];

  return Boolean(resultHostname && allowed.includes(resultHostname));
}

async function verifyTurnstile(token, ip, requestHostname) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured.');
  }

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (ip && ip !== 'unknown') form.set('remoteip', ip);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form
  });

  if (!response.ok) {
    return { ok: false, reason: 'verification-service-error' };
  }

  const result = await response.json();

  const ok =
    result.success === true &&
    result.action === 'contact' &&
    allowedHostname(result.hostname, requestHostname);

  return {
    ok,
    reason: ok ? null : 'verification-failed',
    result
  };
}

async function sendEmail({ name, email, message, requestId }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !from || !to) {
    throw new Error('Email environment variables are not configured.');
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

  const payload = {
    from,
    to: [to],
    reply_to: email,
    subject: `[Limun Portfolio] Message from ${name}`,
    text: [
      `New portfolio contact message`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      ``,
      message
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#1f1b2d">
        <div style="border:2px solid #1f1b2d;padding:24px;box-shadow:6px 6px 0 #ffb6cf">
          <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">
            Limun Portfolio
          </p>
          <h1 style="font-size:26px;margin:8px 0 22px">New contact message</h1>

          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>

          <div style="margin-top:22px;padding:18px;background:#fff8ef;border:1px solid #1f1b2d;line-height:1.65">
            ${safeMessage}
          </div>

          <p style="font-size:12px;color:#6f687d;margin-top:22px">
            Reply to this email to respond directly to ${safeName}.
          </p>
        </div>
      </div>
    `
  };

  const idempotencyKey =
    `portfolio-contact/${requestId}`.slice(0, 250);

  const response = await fetch(RESEND_EMAIL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Resend error:', data);
    throw new Error('Email service rejected the message.');
  }

  return data;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ ok: false, message: 'Method not allowed.' }, 405);
    }

    const requestUrl = new URL(request.url);
    const origin = request.headers.get('origin');

    // Same-origin browser requests only. This prevents another website
    // from directly using this endpoint as an email relay.
    if (!origin || origin !== requestUrl.origin) {
      return json({ ok: false, message: 'Invalid request origin.' }, 403);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return json({ ok: false, message: 'Invalid request format.' }, 415);
    }

    const ip = getClientIp(request);

    if (rateLimited(ip)) {
      return json(
        { ok: false, message: 'Too many attempts. Please wait a few minutes and try again.' },
        429
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, message: 'Invalid JSON body.' }, 400);
    }

    const name = clean(body.name);
    const email = clean(body.email);
    const message = clean(body.message);
    const honeypot = clean(body.website);
    const token = clean(body.turnstileToken);
    const requestId = clean(body.requestId);
    const startedAt = Number(body.startedAt);

    // Quietly accept obvious bot submissions without sending anything.
    if (honeypot) {
      return json({ ok: true, message: 'Message received.' });
    }

    if (
      !Number.isFinite(startedAt) ||
      Date.now() - startedAt < 1200
    ) {
      return json({ ok: true, message: 'Message received.' });
    }

    if (name.length < 2 || name.length > 80) {
      return json({ ok: false, message: 'Please enter a valid name.' }, 400);
    }

    if (!validEmail(email)) {
      return json({ ok: false, message: 'Please enter a valid email address.' }, 400);
    }

    if (message.length < 10 || message.length > 3000) {
      return json(
        { ok: false, message: 'Message must be between 10 and 3000 characters.' },
        400
      );
    }

    if (!token || token.length > 2048) {
      return json({ ok: false, message: 'Security verification is required.' }, 400);
    }

    if (!/^[A-Za-z0-9_-]{8,120}$/.test(requestId)) {
      return json({ ok: false, message: 'Invalid request identifier.' }, 400);
    }

    let turnstile;
    try {
      turnstile = await verifyTurnstile(token, ip, requestUrl.hostname);
    } catch (error) {
      console.error('Turnstile configuration error:', error);
      return json(
        { ok: false, message: 'Security verification is temporarily unavailable.' },
        503
      );
    }

    if (!turnstile.ok) {
      return json(
        { ok: false, message: 'Security verification failed. Please try again.' },
        403
      );
    }

    try {
      await sendEmail({ name, email, message, requestId });
    } catch (error) {
      console.error('Contact email error:', error);
      return json(
        { ok: false, message: 'Could not send your message. Please try again shortly.' },
        502
      );
    }

    return json({
      ok: true,
      message: 'Message sent successfully.'
    });
  }
};

    # Limun Portfolio — Contact + Hidden Guestbook Setup

## Files added

- `css/contact.css`
- `css/guestbook.css`
- `js/contact.js`
- `js/guestbook.js`
- `api/contact.mjs`
- `vercel.json`
- `.env.example`

`style.css` and `main.js` remain separated and unchanged.

---

## 1. Cloudflare Turnstile

1. Create a Turnstile widget in Cloudflare.
2. Add your production hostname (for example `yourdomain.com` or your Vercel hostname).
3. Copy the **sitekey** and **secret key**.
4. In `index.html`, replace:

```html
<meta name="turnstile-sitekey" content="REPLACE_WITH_TURNSTILE_SITE_KEY">
```

with your public sitekey.

5. Do **not** put the secret key in HTML or frontend JS.

The Vercel Function validates every token server-side and checks:
- token success
- Turnstile action = `contact`
- verified Turnstile hostname

---

## 2. Resend

1. Create a Resend account.
2. Add and verify a sending domain/subdomain.
3. Create a Resend API key.
4. Pick a sender such as:

```text
Limun Portfolio <hello@contact.yourdomain.com>
```

The form recipient is fixed server-side as `lintangmunoh@gmail.com`.
The visitor's email becomes `reply_to`, so replying to the received email
goes directly back to the visitor.

---

## 3. Add Vercel environment variables


In:

**Vercel Project → Settings → Environment Variables**

add:

```text
RESEND_API_KEY
TURNSTILE_SECRET_KEY
CONTACT_TO_EMAIL
CONTACT_FROM_EMAIL
```

Recommended values:

```text
CONTACT_TO_EMAIL=lintangmunoh@gmail.com
CONTACT_FROM_EMAIL=Limun Portfolio <hello@your-verified-domain.com>
```

The secrets belong in Vercel only. Do not hard-code them in the repo.

After changing environment variables, redeploy so the new deployment receives them.

---

## 4. Deploy

The project stays plain HTML/CSS/JS.

Vercel automatically treats `api/contact.mjs` as a Node.js Vercel Function.
The frontend submits only to:

```text
POST /api/contact
```

No Resend or Turnstile secret is shipped to the browser.

---

## Security layers already included

- Cloudflare Turnstile client challenge
- mandatory server-side Siteverify validation
- Turnstile action check (`contact`)
- Turnstile hostname validation
- same-origin request check
- fixed server-side destination email
- server-side input length / email validation
- honeypot field
- too-fast bot submission trap
- per-instance burst limiter
- Resend idempotency key
- HTML escaping before email rendering
- `Cache-Control: no-store` on the API
- basic Vercel security headers

The in-memory burst limiter is deliberately only an extra layer because
serverless instances are distributed. Turnstile is the primary anti-bot layer.
If the contact endpoint ever receives significant abuse, add a durable/global
rate limiter (for example Vercel Firewall or a shared rate-limit store).

---

## Guestbook

The guestbook is intentionally **collapsed** above the footer.

It is a playful easter egg rather than a primary navigation item:
- noticeable when somebody reaches the bottom
- closed by default
- expands inline
- responsive on desktop/tablet/mobile
- Escape closes it
- current notes are a local-browser UI preview via `localStorage`

A public guestbook backend can be added later without touching the contact form.

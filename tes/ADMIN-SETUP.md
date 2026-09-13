# LIMUN Admin Dashboard Setup

This patch creates a responsive admin dashboard at:

```text
https://limun-portfolio-website.vercel.app/admin/
```

It is designed for laptop, tablet, and mobile.

## Copy these paths into your project

```text
admin/
├── index.html
├── admin.css
├── admin.js
└── firebase-config.js

api/
└── admin/
    └── guestbook.mjs

lib/
├── firebase.mjs        ← replace your current file with this version
└── admin-auth.mjs      ← new
```

You do not need a second Vercel project.

---

## 1. Enable Google Sign-In in Firebase

Firebase Console:

```text
Build → Authentication → Get started
→ Sign-in method
→ Google
→ Enable
```

Choose your Google account/project support email and save.

Then open:

```text
Authentication → Settings → Authorized domains
```

Make sure the production hostname is allowed:

```text
limun-portfolio-website.vercel.app
```

If you use custom domains later, add those as authorized domains too.

---

## 2. Create a Firebase Web App

Firebase Console:

```text
Project settings
→ General
→ Your apps
→ Add app
→ Web
```

The nickname can be:

```text
Limun Admin
```

Firebase will show a public config similar to:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Copy those values into:

```text
admin/firebase-config.js
```

Important:

`firebase-config.js` is PUBLIC CLIENT CONFIG.
It is safe to commit.

Do NOT put any of these server secrets there:

```text
FIREBASE_PRIVATE_KEY
TURNSTILE_SECRET_KEY
RESEND_API_KEY
RATE_LIMIT_SALT
```

---

## 3. Configure the first admin account

In Vercel:

```text
Project
→ Settings
→ Environment Variables
```

Add:

```text
ADMIN_EMAIL
```

Value:

```text
lintangmunoh@gmail.com
```

`ADMIN_EMAIL` can be Config because an email address is not an API secret.

Redeploy.

Now visit:

```text
/admin/
```

Sign in using that exact Google account.

The dashboard will show a **Copy UID** button.

---

## 4. Optional but recommended: lock admin access to Firebase UID

After the first successful login:

1. Click **Copy UID** in the admin dashboard.
2. Add a Vercel environment variable:

```text
ADMIN_UID=<the copied Firebase UID>
```

3. Redeploy.

When `ADMIN_UID` exists, the backend ignores the email allowlist for authorization
and requires that exact Firebase user UID.

Keep `ADMIN_EMAIL` if you want it as documentation; `ADMIN_UID` takes precedence.

---

## 5. Existing Firebase Admin setup remains the same

The backend still needs:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

and the npm dependency:

```bash
npm install firebase-admin --save
```

Your existing public Guestbook and Contact backend remain compatible.

`lib/firebase.mjs` in this patch is a drop-in replacement that additionally exports
the initialized Firebase Admin app for Authentication.

---

## 6. Firestore Rules remain locked

Keep the rules:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The admin browser does NOT access Firestore directly.

Flow:

```text
/admin/
  ↓
Google Sign-In
  ↓
Firebase ID Token
  ↓
/api/admin/guestbook
  ↓
verifyIdToken()
  ↓
ADMIN_UID / ADMIN_EMAIL allowlist
  ↓
Firebase Admin SDK
  ↓
Firestore
```

So knowing the `/admin/` URL does not grant access.

---

## 7. Admin actions

The dashboard supports:

```text
Pending
→ Approve
→ Reject
→ Delete

Approved
→ Move to pending
→ Delete

Rejected
→ Approve
→ Move to pending
→ Delete
```

Approve writes:

```text
approved: true
status: "approved"
moderatedAt: server timestamp
moderatedBy: admin UID
moderatedByEmail: admin email
```

Reject writes:

```text
approved: false
status: "rejected"
```

Move to pending writes:

```text
approved: false
status: "pending"
```

Delete permanently deletes the Firestore document.

---

## 8. Git commit

Commit:

```text
admin/
api/admin/guestbook.mjs
lib/firebase.mjs
lib/admin-auth.mjs
```

Do NOT commit a real `.env` file.

Example:

```bash
git add .
git commit -m "add secure guestbook admin dashboard"
git push
```

Vercel will deploy `/admin/` together with the existing portfolio.

---

## 9. Quick test checklist

After deployment:

1. Open `/admin/` on laptop.
2. Sign in with your allowed Google account.
3. Pending Firestore notes should appear.
4. Approve one note.
5. Refresh the public Guestbook.
6. The approved note should appear publicly.
7. Open `/admin/` on your phone and repeat a moderation action.
8. Try another Google account: it should be rejected by the backend.

If Firebase shows `auth/unauthorized-domain`, add the current hostname under
Firebase Authentication → Settings → Authorized domains.

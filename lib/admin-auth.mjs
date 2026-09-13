import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirebaseAdminApp
} from "./firebase.mjs";


export class AdminAuthError extends Error {
  constructor(
    message,
    status = 401
  ) {
    super(message);

    this.name =
      "AdminAuthError";

    this.status =
      status;
  }
}


function clean(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}


/* =========================================================
   GET BEARER TOKEN
   ========================================================= */

function getBearerToken(request) {
  const header =
    request.headers.get(
      "authorization"
    ) || "";


  const match =
    header.match(
      /^Bearer\s+(.+)$/i
    );


  return match
    ? match[1].trim()
    : "";
}


/* =========================================================
   ADMIN EMAIL ALLOWLIST
   ========================================================= */

function getAllowedEmails() {
  /*
    Recommended:
    ADMIN_EMAILS=email1@gmail.com,email2@gmail.com

    ADMIN_EMAIL lama tetap didukung
    sebagai fallback agar deployment lama
    tidak langsung rusak.
  */

  const multiple =
    clean(
      process.env.ADMIN_EMAILS
    );


  if (multiple) {
    return multiple
      .split(",")
      .map(email =>
        email
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
  }


  const legacy =
    clean(
      process.env.ADMIN_EMAIL
    )
      .toLowerCase();


  return legacy
    ? [legacy]
    : [];
}


/* =========================================================
   ADMIN UID ALLOWLIST
   ========================================================= */

function getAllowedUids() {
  /*
    Optional stronger mode:

    ADMIN_UIDS=uid1,uid2

    ADMIN_UID lama juga tetap
    didukung sebagai fallback.
  */

  const multiple =
    clean(
      process.env.ADMIN_UIDS
    );


  if (multiple) {
    return multiple
      .split(",")
      .map(uid =>
        uid.trim()
      )
      .filter(Boolean);
  }


  const legacy =
    clean(
      process.env.ADMIN_UID
    );


  return legacy
    ? [legacy]
    : [];
}


/* =========================================================
   VERIFY ADMIN
   ========================================================= */

export async function verifyAdminRequest(
  request
) {

  const token =
    getBearerToken(
      request
    );


  if (!token) {
    throw new AdminAuthError(
      "Sign in is required.",
      401
    );
  }


  let decoded;


  try {

    decoded =
      await getAuth(
        getFirebaseAdminApp()
      )
        .verifyIdToken(
          token,
          true
        );


  } catch (error) {

    console.error(
      "Admin token verification failed:",
      error?.code ||
      error?.message ||
      error
    );


    throw new AdminAuthError(
      "Your admin session is invalid or expired.",
      401
    );
  }


  /* =====================================================
     GOOGLE ACCOUNT ONLY
     ===================================================== */

  if (
    decoded.firebase
      ?.sign_in_provider !==
      "google.com"
  ) {

    throw new AdminAuthError(
      "Google sign-in is required.",
      403
    );
  }


  /* =====================================================
     EMAIL MUST BE VERIFIED
     ===================================================== */

  if (
    decoded.email_verified !==
    true
  ) {

    throw new AdminAuthError(
      "A verified Google account is required.",
      403
    );
  }


  const allowedUids =
    getAllowedUids();


  const allowedEmails =
    getAllowedEmails();


  if (
    allowedUids.length === 0 &&
    allowedEmails.length === 0
  ) {

    throw new AdminAuthError(
      "Admin allowlist is not configured.",
      503
    );
  }


  const tokenEmail =
    clean(
      decoded.email
    )
      .toLowerCase();


  const uidAllowed =
    allowedUids.includes(
      decoded.uid
    );


  const emailAllowed =
    allowedEmails.includes(
      tokenEmail
    );


  /*
    Jika ADMIN_UIDS / ADMIN_UID ada,
    UID menjadi security utama.

    Kalau UID belum dikonfigurasi,
    gunakan email allowlist.
  */

  if (
    allowedUids.length > 0
  ) {

    if (!uidAllowed) {

      throw new AdminAuthError(
        "This Google account is not authorized.",
        403
      );
    }

  } else {

    if (!emailAllowed) {

      throw new AdminAuthError(
        "This Google account is not authorized.",
        403
      );
    }
  }


  return {
    uid:
      decoded.uid,

    email:
      decoded.email || null,

    authorizationMode:
      allowedUids.length > 0
        ? "uid"
        : "email"
  };
}
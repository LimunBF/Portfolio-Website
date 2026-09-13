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


  /*
    Admin dashboard intentionally accepts
    Google-authenticated Firebase sessions only.
  */
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


  if (
    decoded.email_verified !==
    true
  ) {
    throw new AdminAuthError(
      "A verified Google account is required.",
      403
    );
  }


  const configuredUid =
    clean(
      process.env.ADMIN_UID
    );

  const configuredEmail =
    clean(
      process.env.ADMIN_EMAIL
    )
      .toLowerCase();


  if (
    !configuredUid &&
    !configuredEmail
  ) {
    throw new AdminAuthError(
      "Admin allowlist is not configured.",
      503
    );
  }


  /*
    UID takes precedence once configured.
    ADMIN_EMAIL is convenient for the first login.
  */
  if (configuredUid) {
    if (
      decoded.uid !==
      configuredUid
    ) {
      throw new AdminAuthError(
        "This Google account is not authorized.",
        403
      );
    }

  } else {
    const tokenEmail =
      clean(
        decoded.email
      )
        .toLowerCase();

    if (
      !tokenEmail ||
      tokenEmail !==
        configuredEmail
    ) {
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
      configuredUid
        ? "uid"
        : "email"
  };
}

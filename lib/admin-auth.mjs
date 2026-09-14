import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirebaseAdminApp
} from "./firebase.mjs";


export class AdminAuthError extends Error {
  constructor(message, status = 401) {
    super(message);

    this.name =
      "AdminAuthError";

    this.status =
      status;
  }
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


function getAllowedEmails() {
  const raw =
    process.env.ADMIN_EMAILS || "";

  return raw
    .split(",")
    .map(email =>
      email
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
}


export async function verifyAdminRequest(
  request
) {
  const token =
    getBearerToken(request);

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
      ).verifyIdToken(
        token,
        true
      );

  } catch (error) {
    console.error(
      "Firebase ID token error:",
      error
    );

    throw new AdminAuthError(
      "Invalid or expired session.",
      401
    );
  }


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


  const email =
    String(
      decoded.email || ""
    )
      .trim()
      .toLowerCase();


  const allowedEmails =
    getAllowedEmails();


  if (
    !email ||
    !allowedEmails.includes(email)
  ) {
    throw new AdminAuthError(
      "This Google account is not authorized.",
      403
    );
  }


  return {
    uid:
      decoded.uid,

    email:
      decoded.email,

    emailVerified:
      decoded.email_verified === true
  };
}
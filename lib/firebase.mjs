import {
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";

import {
  getFirestore
} from "firebase-admin/firestore";


let cachedApp = null;
let cachedDb = null;


function requireEnv(name) {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}


function normalizePrivateKey(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/^"(.*)"$/s, "$1");
}


/* =========================================================
   FIREBASE ADMIN APP
   ========================================================= */

export function getFirebaseAdminApp() {
  if (cachedApp) {
    return cachedApp;
  }


  if (getApps().length) {
    cachedApp =
      getApps()[0];

    return cachedApp;
  }


  const projectId =
    requireEnv(
      "FIREBASE_PROJECT_ID"
    );


  const clientEmail =
    requireEnv(
      "FIREBASE_CLIENT_EMAIL"
    );


  const privateKey =
    normalizePrivateKey(
      requireEnv(
        "FIREBASE_PRIVATE_KEY"
      )
    );


  cachedApp =
    initializeApp({
      credential:
        cert({
          projectId,
          clientEmail,
          privateKey
        })
    });


  return cachedApp;
}


/* =========================================================
   FIRESTORE
   ========================================================= */

export function getDb() {
  if (cachedDb) {
    return cachedDb;
  }


  cachedDb =
    getFirestore(
      getFirebaseAdminApp()
    );


  return cachedDb;
}
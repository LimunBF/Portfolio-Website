import {
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";

import {
  getFirestore
} from "firebase-admin/firestore";


let cachedDb = null;


function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}


function normalizePrivateKey(value) {
  /*
    Vercel kadang menyimpan private key
    sebagai multiline asli,
    kadang sebagai "\n".
  */
  return value.replace(/\\n/g, "\n");
}


export function getDb() {
  if (cachedDb) {
    return cachedDb;
  }


  const projectId =
    requireEnv("FIREBASE_PROJECT_ID");

  const clientEmail =
    requireEnv("FIREBASE_CLIENT_EMAIL");

  const privateKey =
    normalizePrivateKey(
      requireEnv(
        "FIREBASE_PRIVATE_KEY"
      )
    );


  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });


  cachedDb =
    getFirestore(app);


  return cachedDb;
}
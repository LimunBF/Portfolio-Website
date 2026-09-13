import {
  FieldValue
} from "firebase-admin/firestore";

import {
  getDb
} from "../lib/firebase.mjs";

import {
  consumeRateLimit,
  getClientIp
} from "../lib/rate-limit.mjs";


const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";


const GUESTBOOK_LIMIT = 3;

const GUESTBOOK_WINDOW_MS =
  30 * 60 * 1000;

const PUBLIC_NOTE_LIMIT = 6;


/* =========================================================
   RESPONSE
   ========================================================= */

function json(
  data,
  status = 200,
  extraHeaders = {}
) {

  return Response.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",

        ...extraHeaders
      }
    }
  );
}


function clean(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}


/* =========================================================
   TURNSTILE HOSTNAME
   ========================================================= */

function allowedHostname(
  resultHostname,
  requestHostname
) {

  const configured =
    clean(
      process.env
        .TURNSTILE_ALLOWED_HOSTNAMES
    );


  const allowed =
    configured

      ? configured
          .split(",")
          .map(
            item =>
              item.trim()
          )
          .filter(Boolean)

      : [
          requestHostname
        ];


  return Boolean(
    resultHostname &&
    allowed.includes(
      resultHostname
    )
  );
}


/* =========================================================
   TURNSTILE VERIFY
   ========================================================= */

async function verifyTurnstile(
  token,
  ip,
  requestHostname
) {

  const secret =
    process.env
      .TURNSTILE_SECRET_KEY;


  if (!secret) {
    throw new Error(
      "TURNSTILE_SECRET_KEY is not configured."
    );
  }


  const form =
    new URLSearchParams();


  form.set(
    "secret",
    secret
  );

  form.set(
    "response",
    token
  );


  if (
    ip &&
    ip !== "unknown"
  ) {

    form.set(
      "remoteip",
      ip
    );
  }


  const response =
    await fetch(
      TURNSTILE_VERIFY_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body: form
      }
    );


  if (!response.ok) {
    return {
      ok: false
    };
  }


  const result =
    await response.json();


  /*
    Penting:
    Contact harus "contact".
    Guestbook harus "guestbook".
  */
  const ok =
    result.success === true &&

    result.action ===
      "guestbook" &&

    allowedHostname(
      result.hostname,
      requestHostname
    );


  return {
    ok,
    result
  };
}


/* =========================================================
   GET APPROVED NOTES
   ========================================================= */

async function getApprovedNotes() {

  const db =
    getDb();


  const snapshot =
    await db
      .collection(
        "guestbook_notes"
      )
      .where(
        "approved",
        "==",
        true
      )
      .orderBy(
        "createdAt",
        "desc"
      )
      .limit(
        PUBLIC_NOTE_LIMIT
      )
      .get();


  return snapshot.docs.map(
    document => {

      const data =
        document.data();


      return {
        name:
          clean(data.name) ||
          "Anonymous",

        message:
          clean(data.message),

        createdAt:
          data.createdAt
            ?.toDate?.()
            ?.toISOString?.()
            ?? null
      };
    }
  );
}


/* =========================================================
   SAVE PENDING NOTE
   ========================================================= */

async function createPendingNote({
  requestId,
  name,
  message
}) {

  const db =
    getDb();


  /*
    requestId menjadi document ID.

    Keuntungannya:
    request yang sama tidak menciptakan
    note duplicate.
  */
  const ref =
    db
      .collection(
        "guestbook_notes"
      )
      .doc(
        requestId
      );


  return db.runTransaction(
    async transaction => {

      const existing =
        await transaction.get(
          ref
        );


      if (
        existing.exists
      ) {

        return {
          duplicate: true
        };
      }


      transaction.set(
        ref,
        {
          name:
            name ||
            "Anonymous",

          message,

          approved:
            false,

          status:
            "pending",

          createdAt:
            FieldValue
              .serverTimestamp(),

          moderatedAt:
            null
        }
      );


      return {
        duplicate: false
      };
    }
  );
}


/* =========================================================
   GET
   ========================================================= */

async function handleGet() {

  try {

    const notes =
      await getApprovedNotes();


    return json({
      ok: true,
      notes
    });


  } catch (error) {

    console.error(
      "Guestbook GET error:",
      error
    );


    return json(
      {
        ok: false,

        message:
          "Could not load guestbook notes."
      },
      500
    );
  }
}


/* =========================================================
   POST
   ========================================================= */

async function handlePost(
  request
) {

  const requestUrl =
    new URL(
      request.url
    );


  const origin =
    request.headers.get(
      "origin"
    );


  /*
    Request browser harus berasal
    dari website itu sendiri.
  */
  if (
    !origin ||
    origin !==
      requestUrl.origin
  ) {

    return json(
      {
        ok: false,

        message:
          "Invalid request origin."
      },
      403
    );
  }


  const contentType =
    request.headers.get(
      "content-type"
    ) || "";


  if (
    !contentType.includes(
      "application/json"
    )
  ) {

    return json(
      {
        ok: false,

        message:
          "Invalid request format."
      },
      415
    );
  }


  let body;


  try {

    body =
      await request.json();

  } catch {

    return json(
      {
        ok: false,

        message:
          "Invalid JSON body."
      },
      400
    );
  }


  const name =
    clean(
      body.name
    );


  const message =
    clean(
      body.message
    );


  const honeypot =
    clean(
      body.website
    );


  const token =
    clean(
      body.turnstileToken
    );


  const requestId =
    clean(
      body.requestId
    );


  const startedAt =
    Number(
      body.startedAt
    );


  /* =====================================================
     BOT TRAPS
     ===================================================== */

  if (honeypot) {

    /*
      Pura-pura berhasil.
      Bot tidak tahu bahwa datanya dibuang.
    */
    return json({
      ok: true,

      pending: true,

      message:
        "Note received."
    });
  }


  if (
    !Number.isFinite(
      startedAt
    ) ||

    Date.now() -
      startedAt <
      1200
  ) {

    return json({
      ok: true,

      pending: true,

      message:
        "Note received."
    });
  }


  /* =====================================================
     VALIDATION
     ===================================================== */

  if (
    name.length > 40
  ) {

    return json(
      {
        ok: false,

        message:
          "Name is too long."
      },
      400
    );
  }


  if (
    message.length < 2 ||
    message.length > 240
  ) {

    return json(
      {
        ok: false,

        message:
          "Note must be between 2 and 240 characters."
      },
      400
    );
  }


  if (
    !token ||
    token.length > 2048
  ) {

    return json(
      {
        ok: false,

        message:
          "Security verification is required."
      },
      400
    );
  }


  if (
    !/^[A-Za-z0-9_-]{8,120}$/
      .test(
        requestId
      )
  ) {

    return json(
      {
        ok: false,

        message:
          "Invalid request identifier."
      },
      400
    );
  }


  /* =====================================================
     TURNSTILE
     ===================================================== */

  const ip =
    getClientIp(
      request
    );


  let turnstile;


  try {

    turnstile =
      await verifyTurnstile(
        token,
        ip,
        requestUrl.hostname
      );


  } catch (error) {

    console.error(
      "Guestbook Turnstile error:",
      error
    );


    return json(
      {
        ok: false,

        message:
          "Security verification is temporarily unavailable."
      },
      503
    );
  }


  if (
    !turnstile.ok
  ) {

    return json(
      {
        ok: false,

        message:
          "Security verification failed. Please try again."
      },
      403
    );
  }


  /* =====================================================
     FIRESTORE RATE LIMIT
     ===================================================== */

  let rateLimit;


  try {

    rateLimit =
      await consumeRateLimit({
        request,

        scope:
          "guestbook-submit",

        /*
          Maksimal 3 note / 30 menit
          per hashed IP.
        */
        limit:
          GUESTBOOK_LIMIT,

        windowMs:
          GUESTBOOK_WINDOW_MS
      });


  } catch (error) {

    console.error(
      "Guestbook rate limit error:",
      error
    );


    /*
      Fail closed.

      Kalau limiter/database error,
      jangan izinkan submission.
    */
    return json(
      {
        ok: false,

        message:
          "Guestbook is temporarily unavailable."
      },
      503
    );
  }


  if (
    !rateLimit.allowed
  ) {

    return json(
      {
        ok: false,

        message:
          "Too many notes from this connection. Please try again later."
      },
      429,
      {
        "Retry-After":
          String(
            rateLimit
              .retryAfterSeconds
          )
      }
    );
  }


  /* =====================================================
     SAVE PENDING NOTE
     ===================================================== */

  try {

    await createPendingNote({
      requestId,
      name,
      message
    });


  } catch (error) {

    console.error(
      "Guestbook Firestore write error:",
      error
    );


    return json(
      {
        ok: false,

        message:
          "Could not save your note. Please try again."
      },
      500
    );
  }


  return json({
    ok: true,

    pending: true,

    message:
      "Note received. It will appear after approval."
  });
}


/* =========================================================
   HANDLER
   ========================================================= */

export default {

  async fetch(request) {

    if (
      request.method ===
      "GET"
    ) {

      return handleGet();
    }


    if (
      request.method ===
      "POST"
    ) {

      return handlePost(
        request
      );
    }


    return json(
      {
        ok: false,

        message:
          "Method not allowed."
      },
      405,
      {
        Allow:
          "GET, POST"
      }
    );
  }
};
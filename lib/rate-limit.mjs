import {
  createHmac
} from "node:crypto";

import {
  Timestamp
} from "firebase-admin/firestore";

import {
  getDb
} from "./firebase.mjs";


function getSalt() {
  const salt =
    process.env.RATE_LIMIT_SALT;

  if (
    !salt ||
    salt.length < 32
  ) {
    throw new Error(
      "RATE_LIMIT_SALT must contain at least 32 random characters."
    );
  }

  return salt;
}


export function getClientIp(request) {
  const forwarded =
    request.headers.get(
      "x-forwarded-for"
    );


  if (forwarded) {
    return forwarded
      .split(",")[0]
      .trim();
  }


  return (
    request.headers.get(
      "x-real-ip"
    ) ||
    request.headers.get(
      "cf-connecting-ip"
    ) ||
    "unknown"
  );
}


function hashIp(ip) {
  return createHmac(
    "sha256",
    getSalt()
  )
    .update(ip)
    .digest("hex");
}


function cleanScope(scope) {
  return String(scope)
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]/g,
      "-"
    )
    .slice(0, 40);
}


export async function consumeRateLimit({
  request,
  scope,
  limit,
  windowMs
}) {

  if (
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    throw new Error(
      "Invalid rate limit."
    );
  }


  const db =
    getDb();

  const ip =
    getClientIp(request);

  const ipHash =
    hashIp(ip);

  const safeScope =
    cleanScope(scope);


  const ref =
    db
      .collection("_rate_limits")
      .doc(
        `${safeScope}_${ipHash}`
      );


  const now =
    Date.now();


  return db.runTransaction(
    async transaction => {

      const snapshot =
        await transaction.get(ref);


      /*
        Belum pernah request.
      */
      if (!snapshot.exists) {

        transaction.set(
          ref,
          {
            scope:
              safeScope,

            count:
              1,

            windowStartedAt:
              Timestamp.fromMillis(
                now
              ),

            /*
              Bisa digunakan sebagai
              Firestore TTL nanti.
            */
            expiresAt:
              Timestamp.fromMillis(
                now +
                windowMs * 2
              )
          }
        );


        return {
          allowed: true,

          remaining:
            Math.max(
              limit - 1,
              0
            ),

          retryAfterSeconds: 0
        };
      }


      const data =
        snapshot.data() || {};


      const startedAt =
        data.windowStartedAt
          ?.toMillis?.() ?? 0;


      const elapsed =
        now - startedAt;


      /*
        Window lama selesai.
      */
      if (
        !startedAt ||
        elapsed >= windowMs ||
        elapsed < 0
      ) {

        transaction.set(
          ref,
          {
            scope:
              safeScope,

            count:
              1,

            windowStartedAt:
              Timestamp.fromMillis(
                now
              ),

            expiresAt:
              Timestamp.fromMillis(
                now +
                windowMs * 2
              )
          },
          {
            merge: true
          }
        );


        return {
          allowed: true,

          remaining:
            Math.max(
              limit - 1,
              0
            ),

          retryAfterSeconds: 0
        };
      }


      const count =
        Number(
          data.count || 0
        );


      /*
        Limit habis.
      */
      if (
        count >= limit
      ) {

        return {
          allowed: false,

          remaining: 0,

          retryAfterSeconds:
            Math.max(
              1,

              Math.ceil(
                (
                  windowMs -
                  elapsed
                ) / 1000
              )
            )
        };
      }


      /*
        Tambahkan counter.
      */
      transaction.update(
        ref,
        {
          count:
            count + 1,

          expiresAt:
            Timestamp.fromMillis(
              startedAt +
              windowMs * 2
            )
        }
      );


      return {
        allowed: true,

        remaining:
          Math.max(
            limit -
            (count + 1),
            0
          ),

        retryAfterSeconds: 0
      };
    }
  );
}
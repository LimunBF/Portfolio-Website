import {
  FieldValue
} from "firebase-admin/firestore";

import {
  getDb
} from "../../lib/firebase.mjs";

import {
  AdminAuthError,
  verifyAdminRequest
} from "../../lib/admin-auth.mjs";


const MAX_ADMIN_NOTES = 200;

const VALID_ID =
  /^[A-Za-z0-9_-]{8,120}$/;


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


function sameOrigin(request) {
  const url =
    new URL(request.url);

  const origin =
    request.headers.get(
      "origin"
    );

  return Boolean(
    origin &&
    origin === url.origin
  );
}


function serializeTimestamp(
  value
) {
  return value
    ?.toDate?.()
    ?.toISOString?.()
    ?? null;
}


function normalizeStatus(data) {
  if (
    data.status === "approved" ||
    data.approved === true
  ) {
    return "approved";
  }

  if (
    data.status === "rejected"
  ) {
    return "rejected";
  }

  return "pending";
}


async function listNotes() {
  const db =
    getDb();

  /*
    Only one ordered field is used here,
    so this does not require the public
    guestbook composite index.
  */
  const snapshot =
    await db
      .collection(
        "guestbook_notes"
      )
      .orderBy(
        "createdAt",
        "desc"
      )
      .limit(
        MAX_ADMIN_NOTES
      )
      .get();


  return snapshot.docs.map(
    document => {
      const data =
        document.data();

      return {
        id:
          document.id,

        name:
          clean(data.name) ||
          "Anonymous",

        message:
          clean(data.message),

        approved:
          data.approved === true,

        status:
          normalizeStatus(data),

        createdAt:
          serializeTimestamp(
            data.createdAt
          ),

        moderatedAt:
          serializeTimestamp(
            data.moderatedAt
          )
      };
    }
  );
}


async function readJson(request) {
  const contentType =
    request.headers.get(
      "content-type"
    ) || "";

  if (
    !contentType.includes(
      "application/json"
    )
  ) {
    throw Object.assign(
      new Error(
        "Invalid request format."
      ),
      {
        status: 415
      }
    );
  }

  try {
    return await request.json();

  } catch {
    throw Object.assign(
      new Error(
        "Invalid JSON body."
      ),
      {
        status: 400
      }
    );
  }
}


function requireValidId(value) {
  const id =
    clean(value);

  if (
    !VALID_ID.test(id)
  ) {
    throw Object.assign(
      new Error(
        "Invalid note identifier."
      ),
      {
        status: 400
      }
    );
  }

  return id;
}


async function updateNote({
  id,
  action,
  admin
}) {
  const db =
    getDb();

  const ref =
    db
      .collection(
        "guestbook_notes"
      )
      .doc(id);


  const snapshot =
    await ref.get();

  if (!snapshot.exists) {
    throw Object.assign(
      new Error(
        "Note not found."
      ),
      {
        status: 404
      }
    );
  }


  const updates = {
    moderatedAt:
      FieldValue.serverTimestamp(),

    moderatedBy:
      admin.uid,

    moderatedByEmail:
      admin.email || null
  };


  if (
    action === "approve"
  ) {
    updates.approved =
      true;

    updates.status =
      "approved";

  } else if (
    action === "reject"
  ) {
    updates.approved =
      false;

    updates.status =
      "rejected";

  } else if (
    action === "pending"
  ) {
    updates.approved =
      false;

    updates.status =
      "pending";

  } else {
    throw Object.assign(
      new Error(
        "Unsupported moderation action."
      ),
      {
        status: 400
      }
    );
  }


  await ref.update(
    updates
  );


  return {
    id,
    action
  };
}


async function removeNote(id) {
  const db =
    getDb();

  const ref =
    db
      .collection(
        "guestbook_notes"
      )
      .doc(id);


  const snapshot =
    await ref.get();

  if (!snapshot.exists) {
    throw Object.assign(
      new Error(
        "Note not found."
      ),
      {
        status: 404
      }
    );
  }


  await ref.delete();
}


export default {
  async fetch(request) {
    /*
      This endpoint is only meant for
      the same site's admin page.
    */
    if (
      !sameOrigin(request)
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


    let admin;

    try {
      admin =
        await verifyAdminRequest(
          request
        );

    } catch (error) {
      if (
        error instanceof
        AdminAuthError
      ) {
        return json(
          {
            ok: false,
            message:
              error.message
          },
          error.status
        );
      }

      console.error(
        "Admin auth error:",
        error
      );

      return json(
        {
          ok: false,
          message:
            "Could not verify admin access."
        },
        500
      );
    }


    try {
      if (
        request.method ===
        "GET"
      ) {
        const notes =
          await listNotes();

        return json({
          ok: true,

          admin,

          notes,

          truncated:
            notes.length >=
            MAX_ADMIN_NOTES
        });
      }


      if (
        request.method ===
        "PATCH"
      ) {
        const body =
          await readJson(
            request
          );

        const id =
          requireValidId(
            body.id
          );

        const action =
          clean(
            body.action
          );

        const result =
          await updateNote({
            id,
            action,
            admin
          });

        return json({
          ok: true,
          ...result
        });
      }


      if (
        request.method ===
        "DELETE"
      ) {
        const body =
          await readJson(
            request
          );

        const id =
          requireValidId(
            body.id
          );

        await removeNote(
          id
        );

        return json({
          ok: true,
          id
        });
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
            "GET, PATCH, DELETE"
        }
      );


    } catch (error) {
      console.error(
        "Admin guestbook error:",
        error
      );

      return json(
        {
          ok: false,

          message:
            error?.message ||
            "Admin guestbook request failed."
        },
        Number(
          error?.status
        ) || 500
      );
    }
  }
};

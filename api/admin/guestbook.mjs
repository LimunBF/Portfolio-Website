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


const MAX_NOTES = 200;

const VALID_ID =
  /^[A-Za-z0-9_-]{8,120}$/;


function json(
  data,
  status = 200
) {
  return Response.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}


function clean(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}


function serializeTimestamp(value) {
  return value
    ?.toDate?.()
    ?.toISOString?.()
    ?? null;
}


function normalizeStatus(data) {
  if (data.status === "rejected") {
    return "rejected";
  }

  if (
    data.status === "approved" ||
    data.approved === true
  ) {
    return "approved";
  }

  return "pending";
}


/* =========================================================
   READ ALL NOTES
   ========================================================= */

async function getAllNotes() {
  const db = getDb();

  const snapshot =
    await db
      .collection("guestbook_notes")
      .orderBy("createdAt", "desc")
      .limit(MAX_NOTES)
      .get();


  return snapshot.docs.map(document => {
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
  });
}


/* =========================================================
   BODY
   ========================================================= */

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
        "Request must be JSON."
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


function validateId(value) {
  const id =
    clean(value);

  if (!VALID_ID.test(id)) {
    throw Object.assign(
      new Error(
        "Invalid note ID."
      ),
      {
        status: 400
      }
    );
  }

  return id;
}


/* =========================================================
   UPDATE NOTE
   ========================================================= */

async function moderateNote(
  id,
  action,
  admin
) {
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


  const update = {
    moderatedAt:
      FieldValue.serverTimestamp(),

    moderatedBy:
      admin.uid,

    moderatedByEmail:
      admin.email || null
  };


  if (action === "approve") {
    update.approved = true;
    update.status = "approved";

  } else if (action === "reject") {
    update.approved = false;
    update.status = "rejected";

  } else if (action === "pending") {
    update.approved = false;
    update.status = "pending";

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


  await ref.update(update);
}


/* =========================================================
   DELETE
   ========================================================= */

async function deleteNote(id) {
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


/* =========================================================
   API
   ========================================================= */

export default {
  async fetch(request) {

    let admin;


    /* AUTHORIZATION */

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
            "Could not verify admin."
        },
        500
      );
    }


    try {

      /* GET ALL */

      if (
        request.method === "GET"
      ) {
        const notes =
          await getAllNotes();


        return json({
          ok: true,

          admin,

          notes,

          count:
            notes.length
        });
      }


      /* MODERATE */

      if (
        request.method === "PATCH"
      ) {
        const body =
          await readJson(
            request
          );


        const id =
          validateId(
            body.id
          );


        const action =
          clean(
            body.action
          );


        await moderateNote(
          id,
          action,
          admin
        );


        return json({
          ok: true,
          id,
          action
        });
      }


      /* DELETE */

      if (
        request.method === "DELETE"
      ) {
        const body =
          await readJson(
            request
          );


        const id =
          validateId(
            body.id
          );


        await deleteNote(id);


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
        405
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
            "Guestbook admin request failed."
        },
        error?.status || 500
      );
    }
  }
};